// Quant-regime classifier (v0.7.3 anti-bullshit pack #5)
// Predicts γ shift under quantization given (architecture × quant scheme).
// Pure logic — no human strings. Solves: HF community widely complains that
// quantization "cliffs" are unpredictable per model. Generic "AWQ ~95% retention"
// claims are too vague — TAF gives architecture-specific verdict.
//
// Calibration sources: Maarten Grootendorst's quant comparison newsletter,
// llama.cpp PPL benchmarks, GPTQ/AWQ papers.

export const QUANT_SCHEMES = [
  { id: "fp8",         label: "FP8 (Hopper)",       bits: 8, base_penalty: 0.007, calibrated: false, hardware: "h100+" },
  { id: "int8",        label: "int8 (LLM.int8())", bits: 8, base_penalty: 0.010, calibrated: false, hardware: "any"   },
  { id: "gguf_q8_0",   label: "GGUF Q8_0",         bits: 8, base_penalty: 0.008, calibrated: false, hardware: "cpu/any" },
  { id: "gguf_q5_km",  label: "GGUF Q5_K_M",       bits: 5, base_penalty: 0.020, calibrated: false, hardware: "cpu/any" },
  { id: "awq",         label: "AWQ (4-bit, calibrated)", bits: 4, base_penalty: 0.020, calibrated: true,  hardware: "any" },
  { id: "gptq",        label: "GPTQ (4-bit, calibrated)", bits: 4, base_penalty: 0.035, calibrated: true,  hardware: "any" },
  { id: "gguf_q4_km",  label: "GGUF Q4_K_M",       bits: 4, base_penalty: 0.050, calibrated: false, hardware: "cpu/any" },
  { id: "nf4",         label: "NF4 (bitsandbytes, uncalibrated)", bits: 4, base_penalty: 0.070, calibrated: false, hardware: "any" },
  { id: "gguf_q3_km",  label: "GGUF Q3_K_M (aggressive)", bits: 3, base_penalty: 0.110, calibrated: false, hardware: "cpu/any" },
  { id: "gguf_q2_k",   label: "GGUF Q2_K (extreme)",       bits: 2, base_penalty: 0.180, calibrated: false, hardware: "cpu/any" },
];

const REGIME_BANDS = [
  { id: "safe",         max_gamma_shift: 0.015, label_code: "safe" },
  { id: "mild",         max_gamma_shift: 0.04,  label_code: "mild" },
  { id: "significant",  max_gamma_shift: 0.08,  label_code: "significant" },
  { id: "cliff",        max_gamma_shift: 1.0,   label_code: "cliff" },
];

function bandFor(gammaShift) {
  for (const b of REGIME_BANDS) if (gammaShift <= b.max_gamma_shift) return b.id;
  return "cliff";
}

// Architecture-specific multiplier on the base quant penalty.
// More sensitive: small d_head, aggressive GQA ratio, very small models (pre-IH).
// Less sensitive: large d_head, post-IH, MHA (no GQA pressure).
function archMultiplier(config) {
  let mult = 1.0;
  const n_attn = config.num_attention_heads ?? null;
  const n_kv   = config.num_key_value_heads ?? n_attn;
  const hidden = config.hidden_size ?? null;
  const d_head = config.head_dim ?? (n_attn && hidden ? hidden / n_attn : null);
  const n_params = inferNParams(config);
  const hasSWA = typeof config.sliding_window === "number" && config.sliding_window > 0;
  const hasGQA = n_attn && n_kv && n_kv < n_attn;
  const gqaRatio = hasGQA ? n_attn / n_kv : 1;

  // d_head sensitivity (small head = more compression damage)
  if (d_head !== null) {
    if (d_head < 64) mult *= 1.5;
    else if (d_head < 96) mult *= 1.2;
    else if (d_head < 128) mult *= 1.05;
    // d_head >= 128: no penalty
  }
  // GQA pressure (heavily-shared kv heads = more interference under quant)
  if (gqaRatio >= 8) mult *= 1.3;
  else if (gqaRatio >= 4) mult *= 1.15;
  // SWA: localized attention is somewhat more robust to head-level noise
  if (hasSWA) mult *= 0.92;
  // Post-IH (large) models more robust; pre-IH (small) less robust
  if (n_params !== null) {
    if (n_params < 1.5e9) mult *= 1.4;       // <1.5B = pre-IH
    else if (n_params < 4e9) mult *= 1.15;   // borderline
    else if (n_params >= 30e9) mult *= 0.85; // very large = robust
    else if (n_params >= 7e9) mult *= 0.95;
  }
  return mult;
}

function inferNParams(config) {
  if (typeof config.num_parameters === "number") return config.num_parameters;
  if (typeof config.n_params === "number") return config.n_params;
  // Estimate from h × layers × ~12h (transformer rule-of-thumb)
  const h = config.hidden_size ?? null;
  const L = config.num_hidden_layers ?? null;
  const v = config.vocab_size ?? null;
  if (h && L) {
    const transformer = 12 * L * h * h;
    const embed = v ? v * h : 0;
    return transformer + 2 * embed;
  }
  return null;
}

// Predict ΔPPL band from γ shift, scaled by model size.
// Empirical fit (rough): ΔPPL ≈ 8 × γ_shift² × (1 + log10(N)/4).
// Returns {low, mid, high} estimate as a band (50% uncertainty).
function predictDeltaPPL(gammaShift, nParams) {
  if (gammaShift <= 0) return { low: 0, mid: 0, high: 0 };
  const sizeBoost = nParams ? 1 + Math.log10(nParams / 1e9) / 4 : 1;
  const mid = 8 * gammaShift * gammaShift * sizeBoost;
  return {
    low:  Math.max(0, Math.round((mid * 0.6) * 100) / 100),
    mid:  Math.round(mid * 100) / 100,
    high: Math.round((mid * 1.5) * 100) / 100,
  };
}

export function predictQuantShift(config, schemeId) {
  const scheme = QUANT_SCHEMES.find(s => s.id === schemeId);
  if (!scheme) return null;

  const mult = archMultiplier(config);
  const gammaShift = scheme.base_penalty * mult;
  const regime = bandFor(gammaShift);
  const nParams = inferNParams(config);
  const deltaPPL = predictDeltaPPL(gammaShift, nParams);

  // Recommendation logic (which scheme to switch to if regime is bad).
  let recommendCode = null;
  let recommendScheme = null;
  if (regime === "cliff") {
    // Suggest stepping up to next-better: q4_km → q5_km, nf4 → awq, q3 → q4, q2 → q4
    if (scheme.id === "nf4") { recommendCode = "switch_to_awq"; recommendScheme = "awq"; }
    else if (scheme.id === "gguf_q4_km") { recommendCode = "switch_to_q5_km"; recommendScheme = "gguf_q5_km"; }
    else if (scheme.id === "gguf_q3_km") { recommendCode = "switch_to_q4_km"; recommendScheme = "gguf_q4_km"; }
    else if (scheme.id === "gguf_q2_k") { recommendCode = "switch_to_q4_km"; recommendScheme = "gguf_q4_km"; }
    else if (scheme.id === "gptq") { recommendCode = "switch_to_awq"; recommendScheme = "awq"; }
    else recommendCode = "use_higher_bits";
  } else if (regime === "significant") {
    if (scheme.id === "nf4") { recommendCode = "consider_awq"; recommendScheme = "awq"; }
    else recommendCode = "verify_with_eval";
  }

  return {
    scheme: scheme.id,
    scheme_label: scheme.label,
    scheme_bits: scheme.bits,
    scheme_calibrated: scheme.calibrated,
    arch_multiplier: Math.round(mult * 100) / 100,
    base_penalty: scheme.base_penalty,
    gamma_shift: Math.round(gammaShift * 1000) / 1000,
    regime,
    delta_ppl: deltaPPL,
    n_params: nParams,
    recommend_code: recommendCode,
    recommend_scheme: recommendScheme,
  };
}

// Batch: predict all schemes for one config. Useful for "show me the trade-offs".
export function predictAllSchemes(config) {
  return QUANT_SCHEMES.map(s => predictQuantShift(config, s.id))
    .filter(Boolean)
    .sort((a, b) => a.gamma_shift - b.gamma_shift);
}
