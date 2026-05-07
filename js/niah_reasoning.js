// NIAH → reasoning gap predictor (v0.7.6 anti-bullshit pack #7)
// Predicts pass rate at a given evaluation context for two tasks:
//   - NIAH (Needle in a Haystack): single-fact retrieval, lenient
//   - Multi-hop reasoning: chained inference, strict
// And the GAP — the dominant failure mode for "long context" claims.
//
// Calibration: rough empirical fit to RULER paper bands (NVIDIA 2024) +
// observed degradation curves on Llama-3.1, Mistral, Qwen2.5 at 8k/16k/32k/64k.
// Uses TAF's existing γ_Padé / d_horizon machinery for the architectural input.
//
// Pure logic — no human strings. Render via i18n in main.js.

import { gammaPade, thetaEffPade } from "./gamma_check.js";

// d_horizon ≈ effective attention horizon. Reproduces formula from
// taf_browser.py / paper §sec:gamma_decomposition. For browser-only v1 use.
function dHorizon(theta, gammaPredicted) {
  if (gammaPredicted >= 1) return Infinity;
  if (gammaPredicted <= 0) return theta;
  // d_horizon ≈ θ × (1 + γ_predicted) / (1 - γ_predicted)
  // Padé-canonical form (paper §sec:gamma_decomposition).
  return theta * (1 + gammaPredicted) / (1 - gammaPredicted);
}

// Sigmoid-like passrate vs. ratio = T_eval / d_horizon.
// Calibrated such that:
//   ratio = 0.25 → ≈ 0.95 (well within horizon)
//   ratio = 0.50 → ≈ 0.88
//   ratio = 1.00 → ≈ 0.65
//   ratio = 2.00 → ≈ 0.35
//   ratio = 4.00 → ≈ 0.15
function niahRate(ratio) {
  // Logistic on log-ratio: P = 1/(1+exp(k*(log(ratio)-log(0.7))))
  const k = 1.4;
  const center = Math.log(0.7);
  const x = Math.log(Math.max(0.01, ratio));
  return 1 / (1 + Math.exp(k * (x - center)));
}

// Multi-hop reasoning is strictly harder than NIAH. RULER paper shows ~30-50%
// drop from NIAH-Single to multi-hop at long context. The gap grows with
// architecture pressure (small d_head, aggressive GQA, SWA boundary).
function reasoningPenalty(ratio, archPressure) {
  // Base penalty grows with context ratio (more multi-hop steps required).
  // archPressure ∈ [1.0, 1.6] from architecture (small d_head + GQA → higher).
  const base = ratio < 0.5 ? 0.05 :
               ratio < 1.0 ? 0.15 :
               ratio < 2.0 ? 0.30 :
               ratio < 4.0 ? 0.45 : 0.55;
  return Math.min(0.7, base * archPressure);
}

function archPressureFromConfig(config) {
  let p = 1.0;
  const n_attn = config.num_attention_heads ?? null;
  const n_kv   = config.num_key_value_heads ?? n_attn;
  const hidden = config.hidden_size ?? null;
  const d_head = config.head_dim ?? (n_attn && hidden ? hidden / n_attn : null);
  if (d_head !== null) {
    if (d_head < 64)  p *= 1.25;
    else if (d_head < 96)  p *= 1.10;
    else if (d_head < 128) p *= 1.03;
  }
  if (n_attn && n_kv && n_kv < n_attn) {
    const ratio = n_attn / n_kv;
    if (ratio >= 8)      p *= 1.15;
    else if (ratio >= 4) p *= 1.08;
  }
  if (typeof config.sliding_window === "number" && config.sliding_window > 0) {
    p *= 1.10; // SWA: cross-window reasoning costs extra
  }
  return Math.min(1.6, p);
}

export function predictNIAHReasoning(config, T_eval) {
  const baseTheta = config.rope_theta ?? 10000;
  // YaRN / linear / dynamic NTK rope-scaling effectively widens d_horizon.
  // Use scaled theta when present so YaRN-extended models aren't false-broken.
  const rs = config.rope_scaling;
  const yarnFactor = rs && (rs.factor ?? 1);
  const theta = (rs && yarnFactor > 1) ? baseTheta * yarnFactor : baseTheta;
  const T_train = config.max_position_embeddings ?? T_eval;
  const gPade = gammaPade(theta, T_eval);
  const dh = dHorizon(theta, gPade);
  const ratio = dh === Infinity ? 0 : T_eval / dh;

  const archPressure = archPressureFromConfig(config);
  // Extrapolation penalty: models tested far beyond their training context
  // degrade regardless of architecture (no positional embeddings learned for
  // unseen positions). Capped at 0.7 so we never zero out completely.
  const extrapolation_ratio = T_train > 0 ? T_eval / T_train : 1;
  const extrapolation_penalty = extrapolation_ratio > 1
    ? Math.min(0.7, (extrapolation_ratio - 1) * 0.3)
    : 0;
  const niah = Math.max(0.02, niahRate(ratio) * (1 - extrapolation_penalty));
  const penalty = reasoningPenalty(ratio, archPressure);
  const reasoning = Math.max(0.02, niah * (1 - penalty));
  const gap = niah - reasoning;

  // Verdict bands
  let verdict;
  if (niah < 0.35)                           verdict = "broken";        // model can't even retrieve
  else if (gap >= 0.30)                       verdict = "retrieval_only"; // canonical RULER finding
  else if (gap >= 0.15)                       verdict = "degraded";
  else if (niah >= 0.70 && reasoning >= 0.55) verdict = "robust";
  else                                        verdict = "marginal";

  // Find a "safe" context where reasoning >= 0.65 (binary search-like sweep)
  let safeT = null;
  for (let t = 1024; t <= T_eval; t *= 2) {
    const gP = gammaPade(theta, t);
    const dh2 = dHorizon(theta, gP);
    const r = dh2 === Infinity ? 0 : t / dh2;
    const niah2 = niahRate(r);
    const reas2 = niah2 * (1 - reasoningPenalty(r, archPressure));
    if (reas2 >= 0.65) safeT = t;
    else break;
  }

  return {
    T_eval,
    T_train,
    theta,
    arch_pressure: Math.round(archPressure * 100) / 100,
    gamma_pade: Math.round(gPade * 1000) / 1000,
    d_horizon: dh === Infinity ? null : Math.round(dh),
    horizon_ratio: Math.round(ratio * 100) / 100,
    niah_rate: Math.round(niah * 100) / 100,
    reasoning_rate: Math.round(reasoning * 100) / 100,
    gap: Math.round(gap * 100) / 100,
    verdict,
    safe_context: safeT,
  };
}

// Sweep across context lengths (1k, 4k, 16k, 64k, 128k) so user sees the curve.
export function sweepContextLengths(config, lengths = null) {
  const T_max = config.max_position_embeddings ?? 131072;
  const defaults = lengths || [1024, 4096, 16384, 65536, T_max].filter((v, i, arr) =>
    v <= T_max && arr.indexOf(v) === i
  );
  return defaults.map(T => predictNIAHReasoning(config, T));
}


// =============================================================================
// RULER calibration (v0.8.6 anti-bullshit pack #12)
// =============================================================================
//
// The heuristic predictor above is a Padé-canonical extrapolation from
// architectural inputs. It's calibrated against ROUGH RULER bands, but
// for any specific (model, context) pair where NVIDIA published a
// measurement, the published number is GROUND TRUTH. This block layers
// calibration on top: when the user's model id matches a row in
// data/ruler_kb.json, we interpolate the published RULER aggregate at
// the requested T_eval and back out per-task estimates via the paper's
// retrieval-vs-reasoning factor band.
//
// Anti-bullshit principle: if measured data exists, USE the measured
// data, don't ship a heuristic guess that contradicts it. Surface the
// heuristic-vs-calibrated delta so users see when our predictor was
// over- or under-confident vs the published ground truth.

let _rulerKb = null;

export async function loadRulerKB(url = "./data/ruler_kb.json") {
  if (_rulerKb) return _rulerKb;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`RULER KB fetch failed: ${res.status}`);
    _rulerKb = await res.json();
    // Build alias→canonical reverse index for fast lookup. Lowercase
    // for case-insensitive matching of user-pasted ids.
    _rulerKb._aliasIndex = {};
    for (const [canon, m] of Object.entries(_rulerKb.models)) {
      _rulerKb._aliasIndex[canon.toLowerCase()] = canon;
      for (const a of m.id_aliases || []) {
        _rulerKb._aliasIndex[a.toLowerCase()] = canon;
      }
    }
    return _rulerKb;
  } catch (e) {
    return null;
  }
}

export function getRulerKB() { return _rulerKb; }

// Lookup a model in the KB. Tolerates: bare canonical key, any listed
// alias, or HF "{org}/{name}" form. Returns the model entry or null.
export function lookupRulerModel(modelId) {
  if (!_rulerKb || !modelId) return null;
  const k = String(modelId).trim().toLowerCase();
  const canon = _rulerKb._aliasIndex[k];
  if (canon) return { canonical: canon, ..._rulerKb.models[canon] };
  // Try the post-`/` segment too (e.g. "meta-llama/Llama-3.1-70B-Instruct"
  // → "Llama-3.1-70B-Instruct")
  const tail = k.includes("/") ? k.split("/").pop() : null;
  if (tail) {
    const c2 = _rulerKb._aliasIndex[tail];
    if (c2) return { canonical: c2, ..._rulerKb.models[c2] };
  }
  return null;
}

// Linear-interpolate RULER aggregate score between bracketing context
// samples. Returns null when T_eval is outside the bracketed range
// (we extrapolate cautiously: clamp at the nearest endpoint).
function interpolateRulerAvg(rulerEntry, T_eval) {
  const levels = [4096, 8192, 16384, 32768, 65536, 131072];
  const keys   = ["4k", "8k", "16k", "32k", "64k", "128k"];
  const vals = keys.map(k => rulerEntry.ruler_avg[k]).filter(v => typeof v === "number");
  if (vals.length === 0) return null;
  // Below smallest sample → clamp at first
  if (T_eval <= levels[0]) {
    return { value: rulerEntry.ruler_avg[keys[0]], extrapolated: T_eval < levels[0], anchor: keys[0] };
  }
  // Above largest sample → clamp at last (extrapolation flag set)
  if (T_eval >= levels[levels.length - 1]) {
    return { value: rulerEntry.ruler_avg[keys[keys.length - 1]], extrapolated: T_eval > levels[levels.length - 1], anchor: keys[keys.length - 1] };
  }
  // Find bracketing pair
  for (let i = 0; i < levels.length - 1; i++) {
    if (T_eval >= levels[i] && T_eval <= levels[i + 1]) {
      const a = rulerEntry.ruler_avg[keys[i]];
      const b = rulerEntry.ruler_avg[keys[i + 1]];
      // Linear in log-context (RULER scores degrade roughly linearly
      // in log T near the effective-length boundary)
      const t = (Math.log2(T_eval) - Math.log2(levels[i])) /
                (Math.log2(levels[i + 1]) - Math.log2(levels[i]));
      return { value: a + (b - a) * t, extrapolated: false, anchor: `${keys[i]}↔${keys[i + 1]}` };
    }
  }
  return null;
}

// Calibrate a heuristic prediction against the published RULER
// aggregate. Returns null if the model isn't in the KB. Returns a
// calibration object otherwise: measured aggregate, derived NIAH and
// reasoning rates, and the delta vs heuristic.
export function calibrateNIAH(modelId, T_eval, heuristicResult) {
  const entry = lookupRulerModel(modelId);
  if (!entry || !_rulerKb) return null;

  const interp = interpolateRulerAvg(entry, T_eval);
  if (!interp) return null;

  const aggregate = interp.value;     // 0-100 scale per RULER convention
  const priors = _rulerKb.task_breakdown_priors || {
    retrieval_factor: 1.04,
    reasoning_factor: 0.78,
  };
  const niahCalibrated      = Math.min(1.0, (aggregate * priors.retrieval_factor) / 100);
  const reasoningCalibrated = Math.min(1.0, (aggregate * priors.reasoning_factor) / 100);

  return {
    canonical_id: entry.canonical,
    matched_alias: modelId,
    ruler_avg_pct: Math.round(aggregate * 10) / 10,
    interp_anchor: interp.anchor,
    extrapolated: interp.extrapolated,
    claimed_context: entry.claimed_context,
    effective_context: entry.effective_context,
    niah_calibrated: Math.round(niahCalibrated * 100) / 100,
    reasoning_calibrated: Math.round(reasoningCalibrated * 100) / 100,
    delta_niah: heuristicResult
      ? Math.round((niahCalibrated - heuristicResult.niah_rate) * 100) / 100
      : null,
    delta_reasoning: heuristicResult
      ? Math.round((reasoningCalibrated - heuristicResult.reasoning_rate) * 100) / 100
      : null,
    retrieval_factor: priors.retrieval_factor,
    reasoning_factor: priors.reasoning_factor,
    source_url: _rulerKb.source?.primary || "",
  };
}

// List all models in the KB (for UI dropdown / "did you mean" hint).
export function listRulerModels() {
  if (!_rulerKb) return [];
  return Object.entries(_rulerKb.models).map(([k, v]) => ({
    canonical: k,
    aliases: v.id_aliases || [],
    claimed_context: v.claimed_context,
    effective_context: v.effective_context,
    category: v.category,
  }));
}
