// TAF Agent — Prediction vs Reality + Bring-Your-Own-Data (#1, server-less).
// Pure logic, no DOM. Compares TAF closed-form predictions against MEASURED values
// (shipped dataset, user's Diagnose-CLI JSON, or harvested published benchmarks),
// and builds a contribution record so a user's measurement can be PR'd into the
// public dataset (karlexmarin/taf-attention-decay) — benefiting everyone. No server.
// Spec: docs/proposals/prediction-vs-reality-byod.md

const GAMMA_TOL = 0.1; // |γ_obs − γ_Padé| within this ⇒ "matches prediction"
const DATASET_REPO = "karlexmarin/taf-attention-decay";

export function gammaPade(theta, T) {
  const z = T * Math.SQRT2;
  return (2 * theta - z) / (2 * theta + z);
}

// Accept a shipped-dataset record OR a Diagnose-CLI JSON and normalise to one shape.
export function normalizeMeasured(rec) {
  if (!rec || typeof rec !== "object") return null;
  const model = rec.model || rec.stem || null;
  // Idempotent: accept raw {gamma} or an already-normalized {gamma_obs}.
  const gamma_obs = typeof rec.gamma === "number" ? rec.gamma
    : typeof rec.gamma_obs === "number" ? rec.gamma_obs : null;
  if (model == null && gamma_obs == null) return null;
  const R2 = typeof rec.R2 === "number" ? rec.R2
    : (rec.fit_power_law && typeof rec.fit_power_law.R2 === "number") ? rec.fit_power_law.R2
    : null;
  return {
    model,
    gamma_obs,
    R2,
    theta: rec.theta_nom ?? rec.theta ?? null,
    T: rec.N ?? rec.T ?? null,
    D90: typeof rec.D90 === "number" ? rec.D90 : null,
    corpus: rec.corpus ?? null,
    gamma_pred: typeof rec.gamma_pred === "number" ? rec.gamma_pred : null,
    source: rec.corpus ? "dataset:" + rec.corpus : (rec.source ?? "user"),
  };
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
  const m = normalizeMeasured(measured) || measured;
  const rows = [];
  const theta = (pred && pred.theta) ?? m.theta;
  const T = (pred && pred.T) ?? m.T;
  if (theta && T && m.gamma_obs != null) {
    const predicted = gammaPade(theta, T);
    const delta = m.gamma_obs - predicted;
    rows.push({
      metric: "gamma", predicted, measured: m.gamma_obs, delta,
      within: Math.abs(delta) <= GAMMA_TOL, source: m.source,
    });
  }
  if (m.D90 != null) {
    rows.push({ metric: "D90", predicted: null, measured: m.D90, delta: null, within: null, source: m.source });
  }
  return rows;
}

// Confidence factors (feed js/confidence.js) when a measurement exists — flips benchmark_no→yes.
export function confidenceFromMeasured(measured) {
  const m = normalizeMeasured(measured) || measured;
  const f = [{ key: "benchmark_yes", status: "ok" }];
  f.push(m.gamma_obs != null
    ? { key: "gamma_measured", status: "ok" }
    : { key: "gamma_closed", status: "warn" });
  if (m.R2 != null) {
    f.push(m.R2 >= 0.8
      ? { key: "calib_reliable", status: "ok" }
      : { key: "calib_exploratory", status: "warn" });
  }
  return f;
}

// Generate a ready-to-submit dataset record + the HF discussion/PR link (server-less contribution).
export function contributionRecord(modelId, measured, cfg) {
  const m = normalizeMeasured(measured) || measured;
  const rec = {
    model: modelId || m.model,
    gamma: m.gamma_obs,
    R2: m.R2 ?? null,
    theta_nom: m.theta ?? (cfg && cfg.rope_theta) ?? null,
    N: m.T ?? null,
    corpus: m.corpus ?? "user-submitted",
  };
  return {
    json: rec,
    repo: DATASET_REPO,
    hfUrl: `https://huggingface.co/datasets/${DATASET_REPO}/discussions/new`,
    note: "Submit as an HF dataset discussion/PR; the maintainer reviews and merges. No data is auto-uploaded.",
  };
}

export const PVR_CONST = { GAMMA_TOL, DATASET_REPO };
