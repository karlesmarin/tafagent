// TAF Agent — Confidence engine (#5). Turns a list of evidence factors into a
// 0–100 score + band, so no prediction is shown as an absolute truth.
// Pure logic, no DOM, no i18n → testable in Node. Rendering lives in main.js
// (confidenceHtml) so EN/ES/FR/ZH all work; Python mirrors this in taf_browser._confidence.
//
// factor: { key: string, status: "ok" | "warn" | "miss", weight?: number }
//   ok   ✓ evidence supports the prediction        (weight × 1.0)
//   warn ⚠ partial / closed-form-only / exploratory (weight × 0.5)
//   miss ✗ evidence missing or out-of-regime        (weight × 0.0)

const STATUS_SCORE = { ok: 1.0, warn: 0.5, miss: 0.0 };

export function computeConfidence(factors) {
  const fs = (factors || []).filter(Boolean);
  const total = fs.reduce((s, f) => s + (f.weight ?? 1), 0);
  const score = fs.reduce((s, f) => s + (f.weight ?? 1) * (STATUS_SCORE[f.status] ?? 0), 0);
  const pct = total > 0 ? Math.round((100 * score) / total) : 0;
  const band = pct >= 80 ? "high" : pct >= 55 ? "medium" : "low";
  return { pct, band, factors: fs };
}
