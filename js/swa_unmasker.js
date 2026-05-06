// SWA Unmasker (v0.7.0 anti-bullshit pack #1)
// Pure logic — no human-readable strings. Returns structured warnings/reco
// codes + params; main.js does the i18n lookup so EN/ES/FR/ZH all work.

// Conservative multi-hop bound for SWA models. Empirically the effective
// "reasoning" context is roughly 2× the window, NOT window × n_layers
// (which is the theoretical upper bound but breaks down past a few hops).
const SWA_MULTIHOP_FACTOR = 2;

export function unmaskConfig(config) {
  const out = {
    declaredContext: config.max_position_embeddings ?? null,
    effectiveContext: null,
    verdict: "honest",
    ratio: 1.0,
    flags: {
      hasSWA: false,
      swaWindow: null,
      hasYaRN: false,
      yarnFactor: null,
      yarnOriginal: null,
      ropeScalingType: null,
      hasGQA: false,
      n_kv_heads: config.num_key_value_heads ?? config.num_attention_heads ?? null,
      n_attn_heads: config.num_attention_heads ?? null,
      n_layers: config.num_hidden_layers ?? null,
      rope_theta: config.rope_theta ?? null,
      d_head: null,
    },
    warnings: [],   // each: { code, params }
    recoCode: null,
    recoParams: {},
  };

  if (out.flags.n_attn_heads && out.flags.n_kv_heads) {
    out.flags.hasGQA = out.flags.n_kv_heads < out.flags.n_attn_heads;
  }
  if (config.hidden_size && out.flags.n_attn_heads) {
    out.flags.d_head = config.hidden_size / out.flags.n_attn_heads;
  }

  // SWA: explicit sliding_window field (Mistral, Gemma-2). Some configs set
  // it to null or to max_pe — treat as "no SWA" in those cases.
  const sw = config.sliding_window;
  if (typeof sw === "number" && sw > 0
      && (!out.declaredContext || sw < out.declaredContext)) {
    out.flags.hasSWA = true;
    out.flags.swaWindow = sw;
  }

  // RoPE scaling (YaRN / linear / dynamic NTK). Only flag if factor > 1.
  const rs = config.rope_scaling;
  if (rs && typeof rs === "object") {
    out.flags.ropeScalingType = rs.type ?? rs.rope_type ?? null;
    out.flags.yarnFactor = rs.factor ?? null;
    out.flags.yarnOriginal = rs.original_max_position_embeddings ?? null;
    if (out.flags.ropeScalingType && out.flags.yarnFactor && out.flags.yarnFactor > 1) {
      out.flags.hasYaRN = true;
    }
  }

  // Compute verdict
  if (out.flags.hasSWA) {
    const multiHop = out.flags.swaWindow * SWA_MULTIHOP_FACTOR;
    out.effectiveContext = Math.min(multiHop, out.declaredContext ?? multiHop);
    out.ratio = out.declaredContext ? out.effectiveContext / out.declaredContext : 1.0;
    // <= 0.25 catches the canonical Mistral case (window=4096, declared=32768, ratio=0.25 exact)
    out.verdict = out.ratio <= 0.25 ? "severely_inflated" : "inflated";
    out.warnings.push(
      { code: "swa_window", params: { window: out.flags.swaWindow } },
      { code: "multihop", params: { multiHop, factor: SWA_MULTIHOP_FACTOR } },
    );
    out.recoCode = out.verdict;
    out.recoParams = {
      effective: out.effectiveContext,
      declared: out.declaredContext,
    };
  } else if (out.flags.hasYaRN) {
    out.verdict = "yarn_extended";
    const orig = out.flags.yarnOriginal
      ?? (out.declaredContext ? out.declaredContext / out.flags.yarnFactor : null);
    out.effectiveContext = out.declaredContext;
    out.ratio = 1.0;
    out.warnings.push(
      { code: "yarn", params: { type: out.flags.ropeScalingType, factor: out.flags.yarnFactor, original: orig ? Math.round(orig) : null, declared: out.declaredContext } },
      { code: "yarn_advice", params: {} },
    );
    out.recoCode = "yarn_extended";
    out.recoParams = { declared: out.declaredContext };
  } else if (out.declaredContext) {
    out.effectiveContext = out.declaredContext;
    out.verdict = "honest";
    out.recoCode = "honest";
    out.recoParams = { declared: out.declaredContext };
  } else {
    out.verdict = "unknown";
    out.recoCode = "unknown";
    out.recoParams = {};
  }

  // KV-cache compression hint for small d_head + GQA — independent of verdict
  if (out.flags.hasGQA && out.flags.d_head && out.flags.d_head < 64) {
    out.warnings.push({ code: "gqa_small_dhead", params: { d_head: out.flags.d_head } });
  }

  return out;
}
