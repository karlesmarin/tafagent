// TAF Agent — Memory Reality Check: architecture-aware long-context classifier.
// Pure functions (config.json → structured verdict). No DOM, no inference → testable in Node.
// Detection rules validated 2026-06-14 against 13 live HF configs (tests/fixtures/memory_reality_configs.json).
// Spec: docs/proposals/memory-reality-check.md

const HYBRID_MT = new Set([
  "jamba", "zamba", "zamba2", "nemotron_h", "granitemoehybrid",
  "bamba", "falcon_h1", "minimax", "minimax_text_01",
]);
const SSM_MT = new Set(["mamba", "mamba2", "falcon_mamba", "codestral_mamba"]);
const LINEAR_MT = new Set([
  "gla", "retnet", "delta_net", "deltanet", "gated_deltanet",
  "rwkv7", "lightning_attn", "based", "hgrn", "hgrn2", "linear_attention",
]);
const TTT_MT = new Set(["delta_net", "deltanet", "gated_deltanet", "titans"]);
const FLA_ATTN_MODES = new Set(["chunk", "fused_recurrent", "fused_chunk"]);

// i18n key suffix per class — the UI maps these to memreal.* strings.
export const CLASS_KEY = {
  FULL: "full", SWA: "swa", SSM: "ssm", RWKV: "rwkv", LINEAR: "linear",
  TTT: "ttt", HYBRID: "hybrid", UNKNOWN: "unknown",
};
// Traffic light by recall-risk (green = random-access recall, red = lossy fixed state).
export const CLASS_LIGHT = {
  FULL: "green", SWA: "yellow", SSM: "red", RWKV: "red", LINEAR: "red",
  TTT: "orange", HYBRID: "yellow", UNKNOWN: "gray",
};

function moeInfo(cfg) {
  const experts = cfg.num_experts ?? cfg.num_local_experts ?? null;
  if (!experts) return null;
  return { experts, active: cfg.num_experts_per_tok ?? null };
}

function isExtended(cfg) {
  if (cfg.rope_scaling && typeof cfg.rope_scaling === "object") return true;
  const maxPos = cfg.max_position_embeddings;
  return typeof maxPos === "number" && maxPos > 200000; // heuristic: likely extended past native
}

function archName(cfg) {
  const a = Array.isArray(cfg.architectures) ? cfg.architectures[0] : cfg.architectures;
  return (a || "").toLowerCase();
}

// Count the attention/hybrid (random-access-recall) layers in a hybrid model, per family.
function hybridRecallLayers(cfg) {
  const total = cfg.num_hidden_layers ?? null;
  if (Array.isArray(cfg.layers_block_type)) {
    return cfg.layers_block_type.filter((x) => /hybrid|attn|attention/i.test(String(x))).length;
  }
  if (typeof cfg.hybrid_override_pattern === "string") {
    const toks = cfg.hybrid_override_pattern.split("-").filter(Boolean);
    return toks.filter((t) => t.toUpperCase() !== "M").length; // non-Mamba tokens = attention/MLP
  }
  if (Array.isArray(cfg.attn_layer_indices)) return cfg.attn_layer_indices.length;
  if (Array.isArray(cfg.attention_layer_indices)) return cfg.attention_layer_indices.length;
  if (cfg.attn_layer_period != null && total != null) {
    return Math.floor(total / cfg.attn_layer_period);
  }
  return null;
}

/**
 * Classify a model's long-context memory type from its config.json object.
 * Returns { cls, subtype, light, claimedContext, totalLayers, recallLayers,
 *           stateSize, window, ghostWindow, extended, moe, confidence, markers }.
 */
export function classifyMemory(cfg) {
  cfg = cfg || {};
  const mt = String(cfg.model_type || "").toLowerCase();
  const arch = archName(cfg).replace(/forcausallm$/, "");
  const maxPos = cfg.max_position_embeddings ?? null;
  const moe = moeInfo(cfg);
  const markers = [];
  const base = { claimedContext: maxPos, moe, totalLayers: cfg.num_hidden_layers ?? null };

  const mk = (cls, extra = {}) => ({
    cls, light: CLASS_LIGHT[cls], keySuffix: CLASS_KEY[cls],
    confidence: "high", markers, ...base, ...extra,
  });

  // 1) HYBRID — model_type OR any per-layer scheme
  const hasHybridScheme =
    cfg.layers_block_type || cfg.hybrid_override_pattern ||
    cfg.attn_layer_period != null || cfg.attn_layer_indices || cfg.attention_layer_indices;
  if (HYBRID_MT.has(mt) || hasHybridScheme) {
    markers.push("hybrid:" + (mt || "layer-map"));
    return mk("HYBRID", { recallLayers: hybridRecallLayers(cfg), extended: isExtended(cfg) });
  }

  // 2) SSM (state-space) — model_type OR (state+conv AND no attention heads)
  const hasStateConv =
    (cfg.state_size != null || cfg.d_state != null) &&
    (cfg.conv_kernel != null || cfg.d_conv != null);
  if (SSM_MT.has(mt) || (hasStateConv && cfg.num_attention_heads == null)) {
    markers.push("ssm:" + (mt || "state+conv"));
    return mk("SSM", { stateSize: cfg.state_size ?? cfg.d_state ?? null });
  }

  // 3) RWKV (linear-recurrent) — R1: prefix wins even though it declares num_attention_heads
  if (mt.startsWith("rwkv")) {
    markers.push("rwkv:" + mt);
    return mk("RWKV", {});
  }

  // 4) LINEAR / TTT — model_type, arch, explicit flags, or fla attn_mode (R3)
  const attnMode = String(cfg.attn_mode || "").toLowerCase();
  const isFla = FLA_ATTN_MODES.has(attnMode);
  if (LINEAR_MT.has(mt) || LINEAR_MT.has(arch) ||
      cfg.linear_attention === true || cfg.use_linear_attention === true || isFla) {
    const ttt = TTT_MT.has(mt) || /delta/.test(mt) || /delta/.test(arch);
    markers.push((ttt ? "ttt:" : "linear:") + (mt || attnMode));
    return mk(ttt ? "TTT" : "LINEAR", { subtype: mt || arch });
  }

  // 5) SWA — R2 triple guard: present, not disabled, strictly below the advertised context
  const sw = cfg.sliding_window;
  const swEnabled = cfg.use_sliding_window !== false; // absent ⇒ enabled
  if (sw != null && swEnabled && (maxPos == null || sw < maxPos)) {
    markers.push("swa:" + sw);
    return mk("SWA", { window: sw });
  }
  const ghostWindow = sw != null && cfg.use_sliding_window === false;

  // 6) FULL — only after every linear/ssm/rwkv check (R1: never decide on "has heads" alone)
  if (cfg.num_attention_heads != null || mt) {
    markers.push("full:" + (mt || "attn"));
    return mk("FULL", { ghostWindow, extended: isExtended(cfg), confidence: mt ? "high" : "medium" });
  }

  // 7) UNKNOWN
  markers.push("none");
  return mk("UNKNOWN", { confidence: "low" });
}

// Order-of-magnitude "compression pressure" for fixed-state classes (honest regime flag, NOT a recall prediction).
// pressure ≈ (claimed_context × hidden) / (n_layers × hidden × state)  = claimed_context / (n_layers × state)
export function compressionPressure(cfg, result, refLen = 131072) {
  if (!["SSM", "LINEAR", "TTT"].includes(result.cls)) return null;
  const layers = cfg.num_hidden_layers;
  const state = result.stateSize ?? cfg.state_size ?? cfg.d_state;
  const declared = cfg.max_position_embeddings ?? null;
  const ctx = declared ?? refLen; // fixed-state models often declare no context → reference length
  if (!ctx || !layers || !state) return null;
  return {
    value: ctx / (layers * state),
    refLen: ctx, refUsed: declared == null,
    note: "order_of_magnitude_only",
  };
}
