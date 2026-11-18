// Context metadata and exact published aggregate lookup. No task-rate predictor.
import { gammaPade } from "./gamma_check.js";

export function predictNIAHReasoning(config, T_eval) {
  if (!Number.isFinite(T_eval) || T_eval <= 0) throw new Error("Positive evaluation length required");
  const configured = config.max_position_embeddings ?? null;
  const trained = config.training_context_length ?? null;
  const theta = config.rope_theta ?? null;
  return {T_eval, T_train:trained, configured_context:configured, theta,
    rope_scaling:config.rope_scaling ?? null,
    gamma_pade:Number.isFinite(theta)?gammaPade(theta,T_eval):null,
    extrapolation_ratio:Number.isFinite(trained)&&trained>0?T_eval/trained:null,
    niah_rate:null, reasoning_rate:null, gap:null, safe_context:null,
    verdict:"needs_evaluation", status:"no_task_prediction_from_configuration"};
}

// Sweep across context lengths (1k, 4k, 16k, 64k, 128k) so user sees the curve.
export function sweepContextLengths(config, lengths = null) {
  const T_max = config.max_position_embeddings ?? 131072;
  const defaults = lengths || [1024, 4096, 16384, 65536, T_max].filter((v, i, arr) =>
    v <= T_max && arr.indexOf(v) === i
  );
  return defaults.map(T => predictNIAHReasoning(config, T));
}


// RULER values retain their published aggregate meaning and exact context.
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
  return null;
}

export function calibrateNIAH(modelId, T_eval, _unused) {
  const entry=lookupRulerModel(modelId);
  if (!entry) return null;
  const key=({4096:"4k",8192:"8k",16384:"16k",32768:"32k",65536:"64k",131072:"128k"})[T_eval];
  const score=key ? entry.ruler_avg?.[key] : null;
  if (!Number.isFinite(score)) return null;
  return {canonical_id:entry.canonical,matched_alias:modelId,ruler_avg_pct:score,
    interp_anchor:key,extrapolated:false,kind:"published_aggregate_exact_context",
    claimed_context:entry.claimed_context,effective_context:entry.effective_context,
    niah_calibrated:null,reasoning_calibrated:null,delta_niah:null,delta_reasoning:null,
    source_url:(_rulerKb.source?.primary || "").match(/https:\/\/[^ ]+/)?.[0] || ((_rulerKb.source?.primary || "").includes("arxiv.org/abs/2404.06654") ? "https://arxiv.org/abs/2404.06654" : "")};
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
