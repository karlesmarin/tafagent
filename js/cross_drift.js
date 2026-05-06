// Cross-framework drift bound (v0.7.5 anti-bullshit pack #6)
// Given two benchmark scores from different (framework, dtype, batch, chat_template)
// configurations, predicts the maximum allowable drift from numerical noise alone.
// If the observed gap exceeds this bound, flags it as a real bug — typically
// chat-template mismatch, KV-cache layout, or aggressive batching.
//
// Refs: arxiv 2506.09501 (numerical sources of LLM eval irreproducibility),
//       lm-evaluation-harness issue #1841 (chat_template auto-apply).

// dtype-pair bands (additive contribution to expected drift in benchmark points,
// assuming a 0-100 benchmark scale; halve roughly for 0-50 scale tasks).
const DTYPE_DRIFT = {
  // same dtype, different runs → non-determinism floor
  "bf16-bf16": 0.05, "fp16-fp16": 0.05, "fp32-fp32": 0.02, "nf4-nf4": 0.10, "int8-int8": 0.08,
  // cross-precision
  "bf16-fp16": 0.30, "fp16-bf16": 0.30,
  "bf16-fp32": 0.05, "fp32-bf16": 0.05,
  "fp16-fp32": 0.10, "fp32-fp16": 0.10,
  // any quantized vs full-precision
  "bf16-int8": 0.40, "int8-bf16": 0.40,
  "bf16-nf4":  0.80, "nf4-bf16":  0.80,
  "fp16-int8": 0.40, "int8-fp16": 0.40,
  "fp16-nf4":  0.80, "nf4-fp16":  0.80,
  "int8-nf4":  0.50, "nf4-int8":  0.50,
};

// framework-pair drift (different attention kernels, KV layouts, etc.).
// Conservative — empirical reports vary by model.
const FRAMEWORK_DRIFT = {
  "lm-eval-hf-vllm-served":     0.30, "lm-eval-hf-vllm-batched": 0.25,
  "lm-eval-hf-tgi":             0.20, "lm-eval-hf-transformers": 0.05,
  "vllm-served-vllm-batched":   0.10, "vllm-served-tgi":         0.20,
  "vllm-batched-tgi":           0.20, "vllm-served-transformers": 0.30,
  "vllm-batched-transformers":  0.30, "tgi-transformers":         0.25,
};

const FRAMEWORKS = [
  { id: "lm-eval-hf",      label: "lm-eval-harness (hf)" },
  { id: "vllm-served",     label: "vLLM serve (OpenAI API)" },
  { id: "vllm-batched",    label: "vLLM batched (offline)" },
  { id: "tgi",             label: "Text Generation Inference (TGI)" },
  { id: "transformers",    label: "transformers (raw .generate)" },
];

const DTYPES = [
  { id: "bf16", label: "BF16" },
  { id: "fp16", label: "FP16" },
  { id: "fp32", label: "FP32" },
  { id: "int8", label: "int8" },
  { id: "nf4",  label: "NF4 (4-bit)" },
];

function dtypeDrift(a, b) {
  const k1 = `${a}-${b}`;
  const k2 = `${b}-${a}`;
  return DTYPE_DRIFT[k1] ?? DTYPE_DRIFT[k2] ?? 0.20; // generic upper bound for unknown pairs
}

function frameworkDrift(a, b) {
  if (a === b) return 0.05; // same framework, different runs/seeds
  // sort the pair so lookup is symmetric
  const [x, y] = [a, b].sort();
  return FRAMEWORK_DRIFT[`${x}-${y}`] ?? 0.30; // default upper bound for any cross-framework
}

function batchDrift(batchA, batchB) {
  if (!batchA || !batchB || batchA === batchB) return 0;
  const ratio = Math.max(batchA, batchB) / Math.max(1, Math.min(batchA, batchB));
  if (ratio <= 2)  return 0.05;
  if (ratio <= 8)  return 0.10;
  if (ratio <= 32) return 0.15;
  return 0.20;
}

// Chat-template mismatch is the dominant failure mode — separated from numerical
// drift because the cause is structural, not floating point.
function templateDriftHuge(templateA, templateB) {
  if (templateA === templateB) return null;       // both same → numerical only
  if (templateA === "unknown" || templateB === "unknown") return null;
  return 25.0; // typical drop on multi-turn evals; user will swamp this
}

export function computeDriftBound(setupA, setupB) {
  // setup = { score, framework, dtype, batch, chat_template, benchmark }
  const dDtype = dtypeDrift(setupA.dtype, setupB.dtype);
  const dFw    = frameworkDrift(setupA.framework, setupB.framework);
  const dBatch = batchDrift(setupA.batch, setupB.batch);
  const dTpl   = templateDriftHuge(setupA.chat_template, setupB.chat_template);

  // Numerical-only bound (additive worst-case). Floor at 0.3 pts to account
  // for random-seed + run-to-run non-determinism that ALL setups have, even
  // when the configs match exactly.
  const numericalBand = Math.max(0.3, dDtype + dFw + dBatch);

  const observedGap = Math.abs((setupA.score ?? 0) - (setupB.score ?? 0));
  let verdict, dominantCause = null;

  if (dTpl !== null) {
    // chat-template mismatch dominates anything else by orders of magnitude
    verdict = "bug_template";
    dominantCause = "template_mismatch";
  } else if (observedGap <= numericalBand) {
    verdict = "noise";
  } else if (observedGap <= 2.5 * numericalBand) {
    // 1× to 2.5× the noise band → borderline. Could be a real bug or just an
    // unlucky run combination. User should investigate before claiming a fix.
    verdict = "suspicious";
    const contrib = { dtype: dDtype, framework: dFw, batch: dBatch };
    dominantCause = Object.entries(contrib).sort((a, b) => b[1] - a[1])[0][0];
  } else {
    // > 2.5× → definitely beyond what numerical noise can explain.
    verdict = "bug";
    const contrib = { dtype: dDtype, framework: dFw, batch: dBatch };
    dominantCause = Object.entries(contrib).sort((a, b) => b[1] - a[1])[0][0];
  }

  return {
    observed_gap: Math.round(observedGap * 100) / 100,
    numerical_band: Math.round(numericalBand * 100) / 100,
    breakdown: {
      dtype: Math.round(dDtype * 100) / 100,
      framework: Math.round(dFw * 100) / 100,
      batch: Math.round(dBatch * 100) / 100,
      template_mismatch: dTpl,
    },
    verdict,
    dominant_cause: dominantCause,
    setup_a: setupA,
    setup_b: setupB,
  };
}

export { FRAMEWORKS, DTYPES };
