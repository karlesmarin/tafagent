// Fit Check ("¿me cabe?") — generic will-it-fit planner, decoupled from the
// llama.cpp launch flow. Answers the #1 recurring forum pain: "weights fit,
// then KV cache at long context blew my VRAM" (e.g. Llama-3.1-8B fp16 =
// ~16 GB weights + ~16 GB KV at 128K).
//
// Pure logic: returns codes + numbers only; main.js translates and renders.
// Reuses launch_flags.js primitives so the two modes can never disagree.

import { QUANT_BPW, estimateNParams, planLaunch } from "./launch_flags.js";

const GB = 1024 ** 3;

// Weight-precision options shown in Fit Check: GGUF quants (from QUANT_BPW)
// plus transformers-style dtypes for the pip-install crowd.
export const FIT_PRECISIONS = {
  FP32:   { bpw: 32.0, kind: "dtype" },
  BF16:   { bpw: 16.0, kind: "dtype" },
  FP16:   { bpw: 16.0, kind: "dtype" },
  INT8:   { bpw:  8.5, kind: "dtype" },   // bnb int8 incl. overhead
  NF4:    { bpw:  4.5, kind: "dtype" },   // bnb 4-bit incl. quant constants
  ...Object.fromEntries(Object.entries(QUANT_BPW).map(([k, bpw]) => [k, { bpw, kind: "gguf" }])),
};

// KV bytes per token for the whole stack (2 = K+V).
export function kvPerTokenBytes({ nLayers, nKvHeads, headDim }, cacheBytes = 2) {
  return 2 * nLayers * nKvHeads * headDim * cacheBytes;
}

// Largest context that fits in `vramGB` for a given precision, inverting the
// same budget planLaunch uses (weights + KV + scratch + fixed overhead).
export function maxContextThatFits(geom, { bpw, vramGB, cacheBytes = 2, flashAttn = true }) {
  const N = estimateNParams(geom);
  if (!N || !geom.nLayers || !geom.nKvHeads || !geom.headDim) return null;
  const weightsB = N * bpw / 8;
  const fixedB = 0.4 * GB + (flashAttn ? 0.25 : 0.6) * GB;
  const perTokB = kvPerTokenBytes(geom, cacheBytes) + (geom.hidden ? 0.5 * geom.hidden * 2 : 0);
  const budgetB = vramGB * GB - weightsB - fixedB;
  if (budgetB <= 0 || perTokB <= 0) return 0;
  return Math.floor(budgetB / perTokB);
}

// Scan precisions from the requested one downwards; first that fits at the
// target context. Returns null if even the smallest doesn't fit.
export function precisionThatFits(geom, opts) {
  const ladder = ["FP32", "BF16", "FP16", "Q8_0", "INT8", "Q6_K", "Q5_K_M", "Q4_K_M", "NF4", "Q4_0", "Q3_K_M", "Q2_K"];
  const startIdx = Math.max(0, ladder.indexOf(opts.precision));
  for (let i = startIdx; i < ladder.length; i++) {
    const p = ladder[i];
    const maxCtx = maxContextThatFits(geom, { ...opts, bpw: FIT_PRECISIONS[p].bpw });
    if (maxCtx != null && maxCtx >= opts.targetCtx) return p;
  }
  return null;
}

// Main entry. geom = {nParams?, nLayers, nKvHeads, headDim, hidden?, vocab?,
// intermediate?, tieEmbeddings?, ropeTheta?, ctxTrain?}.
export function checkFit(geom, { precision = "BF16", cacheType = "fp16", vramGB, targetCtx, flashAttn = true }) {
  const spec = FIT_PRECISIONS[precision] ?? FIT_PRECISIONS.BF16;
  // Delegate the budget to planLaunch (single source of truth). It reads bpw
  // from QUANT_BPW, so map dtype precisions through a bpw-equivalent key or
  // patch the result for non-GGUF bpw below.
  const plan = planLaunch({
    nParams: geom.nParams, nLayers: geom.nLayers, nKvHeads: geom.nKvHeads,
    headDim: geom.headDim, hidden: geom.hidden, vocab: geom.vocab,
    intermediate: geom.intermediate, tieEmbeddings: geom.tieEmbeddings,
    ropeTheta: geom.ropeTheta, ctxTrain: geom.ctxTrain,
    quant: spec.kind === "gguf" ? precision : "F16",
    vramGB, targetCtx, cacheType, flashAttn,
  });
  if (!plan.ok) return { ok: false, verdict: plan.verdict };

  // Correct weights for non-GGUF precisions (planLaunch only knows QUANT_BPW).
  let { weightsGB, kvGB, overheadGB } = plan;
  if (spec.kind === "dtype" && plan.nParams) {
    weightsGB = plan.nParams * spec.bpw / 8 / GB;
  }
  const totalGB = weightsGB + kvGB + overheadGB;
  const fits = totalGB <= vramGB;
  const headroomGB = vramGB - totalGB;
  const kvShare = totalGB > 0 ? kvGB / totalGB : 0;

  const cacheBytes = { fp16: 2, q8_0: 1, q4_0: 0.5 }[cacheType] ?? 2;
  const maxCtx = maxContextThatFits(geom, { bpw: spec.bpw, vramGB, cacheBytes, flashAttn });
  const rescuePrecision = fits ? null : precisionThatFits(geom, { precision, vramGB, cacheBytes, targetCtx, flashAttn });

  // Verdict codes (main.js translates): the split kv_bound / weights_bound is
  // the pedagogical core — "it's not the model, it's your context".
  let verdictCode;
  if (fits) verdictCode = headroomGB >= 0.10 * vramGB ? "fits_comfortably" : "fits_tight";
  else if (weightsGB + overheadGB <= vramGB) verdictCode = "kv_bound";
  else verdictCode = "weights_bound";

  const suggestions = [];
  if (!fits) {
    if (verdictCode === "kv_bound" && maxCtx > 0) suggestions.push({ code: "reduce_ctx", params: { maxCtx } });
    if (cacheType === "fp16") suggestions.push({ code: "quant_cache" });
    if (rescuePrecision && rescuePrecision !== precision) suggestions.push({ code: "lower_precision", params: { precision: rescuePrecision } });
    if (plan.ngl > 0 && plan.ngl < plan.nLayers) suggestions.push({ code: "partial_offload", params: { ngl: plan.ngl, nLayers: plan.nLayers } });
    if (!rescuePrecision) suggestions.push({ code: "bigger_gpu" });
  }

  return {
    ok: true, fits, verdictCode, suggestions,
    precision, bpw: spec.bpw, cacheType, flashAttn,
    nParams: plan.nParams, weightsGB, kvGB, overheadGB, totalGB, vramGB,
    headroomGB, kvShare, maxCtx, targetCtx,
    kvPerTokenKB: kvPerTokenBytes(geom, cacheBytes) / 1024,
    warnings: plan.warnings,   // includes kv_wasted / beyond_trained from TAF
  };
}
