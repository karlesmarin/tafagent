// TAF Agent — Adapter Reality Check: published PEFT/LoRA adapter sanity + forgetting evidence.
// Pure functions (adapter_config.json → structured verdict). No DOM, no inference → testable in Node.
// First real consumer of forgetting_lit_explorer.js + data/forgetting_kb.json.
// Spec: docs/proposals/adapter-reality.md
//
// No human-readable strings: returns codes + params; main.js does the i18n lookup
// (same shape as forgetting_lit_explorer.js / memory_reality.js).

import { loadForgettingKB, queryKB } from "./forgetting_lit_explorer.js";

// PEFT types that are rank-based (LoRA-family) → forgetting band applies.
const RANK_BASED = new Set(["lora", "adalora", "loha", "lokr", "dora"]);
// Canonical attention-projection module names across families.
const ATTN_MODULES = new Set([
  "q_proj", "k_proj", "v_proj", "o_proj",
  "query_key_value", "qkv_proj", "Wqkv", "c_attn", "out_proj",
]);
const MLP_MODULES = new Set([
  "gate_proj", "up_proj", "down_proj", "mlp", "fc1", "fc2", "c_fc", "c_proj", "w1", "w2", "w3",
]);
const EMBED_MODULES = new Set(["embed_tokens", "lm_head", "wte", "embeddings"]);

// --- base model id → KB family group key (FAMILY_GROUPS in forgetting_lit_explorer) ---
export function familyFromModelId(id) {
  const s = String(id || "").toLowerCase();
  if (!s) return null;
  if (/llama[-_]?3|meta-llama-3|llama-3\.1|llama-3\.2/.test(s)) return "llama-3";
  if (/llama[-_]?2|llama2/.test(s)) return "llama-2";
  if (/qwen2\.5|qwen-2\.5|qwen2_5|qwen25/.test(s)) return "qwen-2.5";
  if (/llava|minigpt/.test(s)) return "vlm-any";
  return null;
}

// --- rank → KB bucket (matches RANK_BUCKETS in forgetting_lit_explorer) ---
export function rankBucket(r) {
  if (r == null || !Number.isFinite(r)) return null;
  if (r <= 16) return "low";
  if (r <= 128) return "med";
  return "high";
}

// --- normalize an adapter_config.json object ---
export function parseAdapterConfig(cfg) {
  cfg = cfg || {};
  const peftType = String(cfg.peft_type || "").toLowerCase();
  const r = typeof cfg.r === "number" ? cfg.r : null;
  const alpha = typeof cfg.lora_alpha === "number" ? cfg.lora_alpha : null;
  let targetModules = cfg.target_modules;
  if (typeof targetModules === "string") targetModules = [targetModules];
  if (!Array.isArray(targetModules)) targetModules = null;
  const modulesToSave = Array.isArray(cfg.modules_to_save) ? cfg.modules_to_save : null;
  const useRslora = cfg.use_rslora === true;
  const useDora = cfg.use_dora === true;
  // Effective scaling: rsLoRA divides by √r, classic LoRA by r.
  let scaling = null;
  if (r != null && alpha != null && r > 0) {
    scaling = useRslora ? alpha / Math.sqrt(r) : alpha / r;
  }
  const isRankBased = RANK_BASED.has(peftType) || useDora || r != null;
  return {
    peftType: peftType || null,
    r, alpha, scaling,
    targetModules,
    baseModel: cfg.base_model_name_or_path || null,
    modulesToSave,
    taskType: cfg.task_type || null,
    useRslora, useDora,
    bias: cfg.bias || null,
    rankPattern: cfg.rank_pattern && Object.keys(cfg.rank_pattern).length ? cfg.rank_pattern : null,
    alphaPattern: cfg.alpha_pattern && Object.keys(cfg.alpha_pattern).length ? cfg.alpha_pattern : null,
    isRankBased,
  };
}

// Classify what target_modules touch: attention-only, mlp-inclusive, embed, empty, custom.
function classifyTargets(targetModules) {
  if (!targetModules || targetModules.length === 0) return "empty";
  const names = targetModules.map(String);
  const hasMlp = names.some((n) => MLP_MODULES.has(n));
  const hasAttn = names.some((n) => ATTN_MODULES.has(n));
  const hasEmbed = names.some((n) => EMBED_MODULES.has(n));
  if (hasEmbed) return "embed";
  if (hasAttn && hasMlp) return "full";
  if (hasAttn && !hasMlp) return "attn_only";
  return "custom";
}

// --- compatibility checks → [{code, level, params}] (level: ok|info|warn|bad) ---
export function compatChecks(parsed, baseId) {
  const out = [];

  // 1) Base match
  const adapterBase = parsed.baseModel;
  if (baseId && baseId.trim()) {
    const a = String(adapterBase || "").toLowerCase().trim();
    const b = baseId.toLowerCase().trim();
    if (!adapterBase) out.push({ code: "base_unknown", level: "warn", params: { user: baseId } });
    else if (a === b) out.push({ code: "base_match_exact", level: "ok", params: { base: adapterBase } });
    else if (familyFromModelId(a) && familyFromModelId(a) === familyFromModelId(b))
      out.push({ code: "base_match_family", level: "info", params: { adapter: adapterBase, user: baseId } });
    else out.push({ code: "base_mismatch", level: "bad", params: { adapter: adapterBase, user: baseId } });
  } else {
    out.push(adapterBase
      ? { code: "base_declared", level: "info", params: { base: adapterBase } }
      : { code: "base_unknown", level: "warn", params: {} });
  }

  // 2) target_modules sanity
  const targets = classifyTargets(parsed.targetModules);
  out.push({
    code: "targets_" + targets,
    level: targets === "empty" ? "warn" : (targets === "custom" ? "info" : "ok"),
    params: { modules: (parsed.targetModules || []).join(", "), n: (parsed.targetModules || []).length },
  });

  // 3) α/r scaling
  if (parsed.scaling != null) {
    const code = parsed.scaling > 4 ? "scaling_high"
      : parsed.scaling < 0.25 ? "scaling_low" : "scaling_ok";
    out.push({
      code, level: code === "scaling_ok" ? "ok" : "warn",
      params: { alpha: parsed.alpha, r: parsed.r, scaling: Math.round(parsed.scaling * 100) / 100,
        rslora: parsed.useRslora },
    });
  }

  // 4) modules_to_save → embedding resize
  if (parsed.modulesToSave && parsed.modulesToSave.some((m) => EMBED_MODULES.has(String(m))))
    out.push({ code: "modules_to_save_embed", level: "warn",
      params: { modules: parsed.modulesToSave.join(", ") } });

  // 5) DoRA / rsLoRA notes
  if (parsed.useDora) out.push({ code: "dora", level: "info", params: {} });
  if (parsed.useRslora) out.push({ code: "rslora", level: "info", params: {} });

  // 6) non-rank-based adapter
  if (!parsed.isRankBased)
    out.push({ code: "not_rank_based", level: "info", params: { type: parsed.peftType } });

  // 7) non-uniform rank
  if (parsed.rankPattern) out.push({ code: "rank_pattern", level: "info", params: {} });

  // 8) task type
  if (parsed.taskType) out.push({ code: "task_type", level: "info", params: { task: parsed.taskType } });

  return out;
}

// --- forgetting band from the KB (evidence, not a prediction) ---
// Returns { applicable, bucket, family, broadened, query } where query is the
// raw queryKB result ({matches, stats, verdict}) — main.js renders it reusing
// the existing forgetting.* i18n strings.
export async function forgettingBand(parsed, baseId, kbUrl) {
  if (!parsed.isRankBased || parsed.r == null) {
    return { applicable: false, reason: "not_rank_based" };
  }
  await loadForgettingKB(kbUrl || "./data/forgetting_kb.json");
  const bucket = rankBucket(parsed.r);
  const family = familyFromModelId(baseId) || familyFromModelId(parsed.baseModel) || "any";

  let res = queryKB({ family, rankBucket: bucket });
  let broadened = false;
  // No evidence for this (family, bucket) → broaden family to "any" (related setups).
  if (!res.matches.length || res.stats.deltaCount === 0) {
    const wide = queryKB({ family: "any", rankBucket: bucket });
    if (wide.matches.length) { res = wide; broadened = family !== "any"; }
  }
  return { applicable: true, bucket, family, broadened, query: res };
}
