// longscore.js — pure logic for the 🎯 LongScore mode.
//
// Looks up an HF-style model id in data/longscore_kb.json and returns:
// - exact match: ruler_per_ctx (if available) + ruler_long_score (computed) + helmet aggregate
// - HELMET-only: aggregate scores at 128K, no LongScore (no per-length data)
// - miss: fallback for unknown models
//
// No UI strings — emits codes + params; main.js translates via i18n.
//
// LongScore formula (100-LongBench, ACL 2025, arXiv:2505.19293, §3.2):
//   Base = mean(S_4K, S_8K)
//   LC_l = (S_l - Base) / Base
//   LongScore = mean(LC_l for l in {16K, 32K, 64K, 128K})
//
// More negative = worse long-ctx retention.

let KB = null;

export async function loadKB() {
  if (KB) return KB;
  const res = await fetch("data/longscore_kb.json");
  if (!res.ok) throw new Error("longscore_kb fetch failed: " + res.status);
  KB = await res.json();
  return KB;
}

export function normalize(name) {
  if (!name) return "";
  let s = String(name).toLowerCase().trim();
  s = s.replace(/^(meta-llama\/|01-ai\/|ai21labs\/|nvidia\/|princeton-nlp\/|unsloth\/)/, "");
  s = s.replace(/_/g, "-").replace(/\./g, "-");
  s = s.replace(/([a-z])(\d)/g, "$1-$2");
  s = s.replace(/(\d)([a-z])/g, "$1-$2");
  s = s.replace(/-+/g, "-");
  // -inst → -instruct (both at end and in middle, before next -segment)
  s = s.replace(/-inst(?=-|$)/g, "-instruct");
  return s;
}

/** Classify LongScore avg into verdict code. */
export function classify(longscore_avg, thresholds) {
  if (longscore_avg === null || longscore_avg === undefined) return "no_data";
  if (longscore_avg >= thresholds.no_degradation) return "no_degradation";
  if (longscore_avg >= thresholds.mild) return "mild";
  if (longscore_avg >= thresholds.moderate) return "moderate";
  if (longscore_avg >= thresholds.severe) return "severe";
  return "extreme";
}

/** Look up a model and return a structured result. */
export async function lookup(rawId) {
  const kb = await loadKB();
  const id = normalize(rawId);
  const entry = kb.models[id];
  if (!entry) {
    return {
      code: "miss",
      normalized_id: id,
      n_kb_total: kb.stats.n_total,
    };
  }

  const longscore = entry.ruler_long_score;
  const verdict = longscore
    ? classify(longscore.avg_lc, kb.thresholds)
    : null;

  return {
    code: longscore ? "ruler_hit" : (entry.helmet ? "helmet_only" : "partial"),
    display_name: entry.display_name,
    normalized_id: id,
    ruler_per_ctx: entry.ruler_per_ctx,
    ruler_long_score: longscore,
    helmet: entry.helmet,
    recipe_class: entry.recipe_class,
    params_b: entry.params_b,
    native_context_k: entry.native_context_k,
    source: entry.source,
    verdict,
    thresholds: kb.thresholds,
  };
}

/** Get sorted list of all model ids — for autocomplete. */
export async function listAllIds() {
  const kb = await loadKB();
  return Object.keys(kb.models).sort();
}

/** Top-N best/worst by LongScore (for sanity inspection). Optional helper. */
export async function rank(direction) {
  const kb = await loadKB();
  const items = Object.entries(kb.models)
    .filter(([, m]) => m.ruler_long_score)
    .map(([id, m]) => ({
      id,
      display_name: m.display_name,
      recipe_class: m.recipe_class,
      avg_lc: m.ruler_long_score.avg_lc,
    }));
  items.sort((a, b) =>
    direction === "best" ? b.avg_lc - a.avg_lc : a.avg_lc - b.avg_lc
  );
  return items;
}
