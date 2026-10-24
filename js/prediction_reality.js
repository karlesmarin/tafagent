// TAF Agent — Prediction vs Reality + Bring-Your-Own-Data (#1, server-less).
// Pure logic, no DOM. Compares TAF closed-form predictions against MEASURED values
// (shipped dataset, user's Diagnose-CLI JSON, or harvested published benchmarks),
// and builds a contribution record so a user's measurement can be PR'd into the
// public dataset (karlexmarin/taf-attention-decay) — benefiting everyone. No server.
// Spec: docs/proposals/prediction-vs-reality-byod.md

const GAMMA_TOL = 0.1; // Descriptive threshold only; not a statistical test.
const DATASET_REPO = "karlexmarin/taf-attention-decay";
const finite = v => typeof v === "number" && Number.isFinite(v);
const object = v => v && typeof v === "object" && !Array.isArray(v);

export function gammaPade(theta, T) {
  const z = T * Math.SQRT2;
  return (2 * theta - z) / (2 * theta + z);
}

// Accept a shipped-dataset record OR a Diagnose-CLI JSON and normalise to one shape.
export function normalizeMeasured(rec) {
  if (!object(rec)) return null;
  const model = rec.model || rec.stem || null;
  // Idempotent: accept raw {gamma} or an already-normalized {gamma_obs}.
  const gamma_obs = finite(rec.gamma) ? rec.gamma
    : finite(rec.gamma_obs) ? rec.gamma_obs : null;
  if (model == null && gamma_obs == null) return null;
  const R2 = finite(rec.R2) ? rec.R2
    : finite(rec.r2_log) ? rec.r2_log
    : finite(rec.fit_power_law?.R2) ? rec.fit_power_law.R2
    : null;
  return {
    ...rec, // Preserve curve, residuals, uncertainty and provenance on round trips.
    model,
    gamma_obs,
    R2,
    theta: rec.theta_nom ?? rec.theta ?? null,
    T: rec.T_eval ?? rec.protocol?.length ?? rec.T ?? rec.N ?? null,
    protocol: object(rec.protocol) ? rec.protocol : null,
    D90: finite(rec.D90) ? rec.D90 : null,
    corpus: rec.corpus ?? null,
    gamma_pred: finite(rec.gamma_pred) ? rec.gamma_pred : null,
    source: rec.source ?? (rec.corpus ? "dataset:" + rec.corpus : "user"),
  };
}

// A context limit or integration horizon N need not be a measured sequence length.
export function predictionContext(measured, pred = {}) {
  const m = normalizeMeasured(measured);
  if (!m) return { status: "missing" };
  if (m.protocol?.length_policy === "distance_plus_50" ||
      (m.attn_by_distance && m.fit_power_law && !m.protocol)) return { status: "variable" };
  const theta = m.theta ?? pred.theta;
  const T = m.T ?? pred.T;
  if ((pred.theta != null && m.theta != null && pred.theta !== m.theta) ||
      (pred.T != null && m.T != null && pred.T !== m.T) ||
      (m.T_eval != null && m.protocol?.length != null && m.T_eval !== m.protocol.length)) {
    return { status: "conflict" };
  }
  if (!finite(theta) || theta <= 0 || !finite(T) || T <= 0) return { status: "missing" };
  return { status: m.protocol?.length != null || m.T_eval != null ? "documented" : "legacy", theta, T };
}

// These are documented conditions, not evidence of statistical equivalence.
export function protocolFields(measured) {
  const m = normalizeMeasured(measured) || {};
  const p = m.protocol || {};
  return {
    ...p,
    model: m.model, revision: m.revision, corpus: m.corpus, theta: m.theta,
    id: p.id, length: p.length ?? p.lengths, queries: p.queries,
    sink_tokens: p.sink_tokens, distance: m.distance ?? p.distances ??
      (p.d_min != null && p.d_max != null ? { d_min: p.d_min, d_max: p.d_max } : null),
    samples: p.samples ?? p.samples_by_distance, pooling: p.pooling, fit: p.fit,
    layer: p.layer, head: p.head, backend: p.backend, dtype: p.dtype,
    quantization: p.quantization, seed: p.seed, tokenizer_revision: p.tokenizer_revision,
  };
}
function known(v) {
  return v != null && v !== "" && v !== "unknown" && !(typeof v === "number" && !Number.isFinite(v)) &&
    !(Array.isArray(v) && (!v.length || !v.every(known))) &&
    !(object(v) && (!Object.keys(v).length || !Object.values(v).every(known)));
}
function canonical(v) {
  return JSON.stringify(v, (_, value) => object(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
}
export function missingProtocolFields(measured) {
  return Object.entries(protocolFields(measured)).filter(([, v]) => !known(v)).map(([k]) => k);
}
export function compareProtocols(first, second) {
  const a = protocolFields(first), b = protocolFields(second);
  const fields = [...new Set([...Object.keys(a), ...Object.keys(b)])].map(key => ({ key, first: a[key] ?? null, second: b[key] ?? null,
    status: !known(a[key]) || !known(b[key]) ? "unknown"
      : canonical(a[key]) === canonical(b[key]) ? "same" : "different" }));
  return { status: fields.some(f => f.status === "different") ? "different"
      : fields.some(f => f.status === "unknown") ? "unknown" : "same", fields };
}

// Find every measured record for a model id in a shipped/loaded dataset array.
export function matchMeasured(modelId, dataset) {
  if (!Array.isArray(dataset) || !modelId) return [];
  const id = modelId.toLowerCase();
  return dataset
    .filter((r) => (r.model || "").toLowerCase() === id)
    .map(normalizeMeasured)
    .filter(Boolean);
}

// Build the Prediction-vs-Reality rows for one model + one measurement.
// pred params: { theta, T } (from config.json or the measurement itself).
export function predictionVsReality(pred, measured) {
  const m = normalizeMeasured(measured);
  const rows = [];
  if (!m) return rows;
  const { theta, T } = predictionContext(m, pred || {});
  if (theta && T && m.gamma_obs != null) {
    const predicted = gammaPade(theta, T);
    const delta = m.gamma_obs - predicted;
    rows.push({
      metric: "gamma", predicted, measured: m.gamma_obs, delta,
      within: Math.abs(delta) <= GAMMA_TOL, source: m.source,
    });
  }
  if (m.D90 != null && m.D90_kind !== "derived_power_law" && !(m.fit_power_law && m.attn_by_distance)) {
    rows.push({ metric: "D90", predicted: null, measured: m.D90, delta: null, within: null, source: m.source });
  }
  return rows;
}

// A measured exponent supplies no downstream benchmark or calibration evidence.
export function confidenceFromMeasured(measured) {
  const m = normalizeMeasured(measured);
  return [m?.gamma_obs != null
    ? { key: "gamma_measured", status: "ok" }
    : { key: "gamma_closed", status: "warn" }];
}

// Generate a ready-to-submit dataset record + the HF discussion/PR link (server-less contribution).
export function contributionRecord(modelId, measured, cfg) {
  const m = normalizeMeasured(measured) || {};
  const rec = {
    ...m,
    model: modelId || m.model,
    gamma: m.gamma_obs,
    R2: m.R2 ?? null,
    theta_nom: m.theta ?? (cfg && cfg.rope_theta) ?? null,
    N: m.N ?? m.T ?? null,
    corpus: m.corpus ?? null,
  };
  delete rec.gamma_obs;
  delete rec.theta;
  delete rec.T;
  return {
    json: rec,
    repo: DATASET_REPO,
    hfUrl: `https://huggingface.co/datasets/${DATASET_REPO}/discussions/new`,
    note: "Submit as an HF dataset discussion/PR; the maintainer reviews and merges. No data is auto-uploaded.",
  };
}

export const PVR_CONST = { GAMMA_TOL, DATASET_REPO };
