// Forgetting Lit Explorer (v0.8.0 anti-bullshit pack #6)
// Pure logic — no human-readable strings. Returns structured codes+params;
// main.js does the i18n lookup so EN/ES/FR/ZH all work.
//
// Anti-bullshit philosophy: this is NOT a predictor. The lit scan that
// motivated the feature found that same (arch, rank) can yield Δ from
// -10pp to +35pp on essentially identical setups, dominated by
// dataset×task interaction. Predicting magnitude is doomed by variance.
// So instead: curated KB lookup + range stats + honest variance warning.

const RANK_BUCKETS = {
  any: r => true,
  low: r => r !== null && r <= 16,
  med: r => r !== null && r > 16 && r <= 128,
  high: r => r !== null && r > 128,
  full_ft: (r, ft) => ft === "full_ft",
};

const FAMILY_GROUPS = {
  any: () => true,
  "llama-any": f => f === "llama-2" || f === "llama-3",
  "llama-2": f => f === "llama-2",
  "llama-3": f => f === "llama-3",
  "qwen-2.5": f => f === "qwen-2.5",
  "vlm-any": f => f === "llava-1.5" || f === "minigpt-4",
};

let _kb = null;

export async function loadForgettingKB(url = "./data/forgetting_kb.json") {
  if (_kb) return _kb;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`KB fetch failed: ${res.status}`);
  _kb = await res.json();
  return _kb;
}

export function getKB() { return _kb; }

// Match a single datapoint against filter object.
// Filter fields: family (group key), rankBucket, sourceDomain, evalBenchmark.
// "any" / null / undefined on a field = wildcard.
function matchesFilter(d, f) {
  if (f.family && f.family !== "any") {
    const fn = FAMILY_GROUPS[f.family];
    if (!fn || !fn(d.family)) return false;
  }
  if (f.rankBucket && f.rankBucket !== "any") {
    const fn = RANK_BUCKETS[f.rankBucket];
    if (!fn) return false;
    if (!fn(d.lora_rank, d.ft_method)) return false;
  }
  if (f.sourceDomain && f.sourceDomain !== "any") {
    if (d.source_domain !== f.sourceDomain) return false;
  }
  if (f.evalBenchmark && f.evalBenchmark !== "any") {
    // Match on eval_domain (broad) or eval_benchmark (narrow), whichever fits.
    if (d.eval_domain !== f.evalBenchmark
        && d.eval_benchmark !== f.evalBenchmark) return false;
  }
  return true;
}

// Stats for a list of matched datapoints. Only entries with metric=delta_pp
// or metric=bwt are included in delta-range stats; abs_score entries are
// listed but not aggregated (they need a baseline for honest comparison).
function computeStats(matches) {
  const deltas = matches
    .filter(d => (d.metric === "delta_pp" || d.metric === "bwt") && typeof d.value === "number")
    .map(d => d.value);
  if (deltas.length === 0) {
    return { count: matches.length, deltaCount: 0 };
  }
  deltas.sort((a, b) => a - b);
  const min = deltas[0];
  const max = deltas[deltas.length - 1];
  const median = deltas[Math.floor(deltas.length / 2)];
  const negCount = deltas.filter(x => x < 0).length;
  const posCount = deltas.filter(x => x > 0).length;
  const range = max - min;
  return {
    count: matches.length,
    deltaCount: deltas.length,
    min, max, median, range,
    negCount, posCount,
    sign: negCount > 0 && posCount > 0 ? "mixed"
        : negCount > 0 ? "negative"
        : posCount > 0 ? "positive"
        : "zero",
  };
}

// Verdict given filter + matches + stats. Returns { code, params, warnings: [{code,params}] }.
function deriveVerdict(filter, matches, stats) {
  const warnings = [];

  if (matches.length === 0) {
    return {
      code: "no_matches",
      params: { filter },
      warnings: [{ code: "broaden_filter", params: {} }],
    };
  }

  // Variance / sign warnings
  if (stats.deltaCount >= 2 && stats.range !== undefined && stats.range > 20) {
    warnings.push({
      code: "high_variance",
      params: { range: Math.round(stats.range * 10) / 10, n: stats.deltaCount },
    });
  }
  if (stats.sign === "mixed") {
    warnings.push({
      code: "sign_mixed",
      params: { neg: stats.negCount, pos: stats.posCount },
    });
  }
  if (stats.sign === "negative" && stats.median < -3) {
    warnings.push({
      code: "consistent_forgetting",
      params: { median: Math.round(stats.median * 10) / 10 },
    });
  }
  // Red-flag anchor cross-check
  const tripped3pp = stats.min !== undefined && stats.min < -3;
  const tripped22pp = stats.min !== undefined && stats.min < -22;
  const tripped30pp = stats.min !== undefined && stats.min < -30;
  if (tripped30pp) warnings.push({ code: "redflag_30pp", params: { min: stats.min } });
  else if (tripped22pp) warnings.push({ code: "redflag_22pp", params: { min: stats.min } });
  else if (tripped3pp) warnings.push({ code: "redflag_3pp", params: { min: stats.min } });

  // Verdict code
  let verdictCode;
  if (stats.deltaCount === 0) {
    verdictCode = "abs_only"; // only absolute-score entries; no Δ aggregation
  } else if (stats.sign === "positive") {
    verdictCode = "likely_improvement";
  } else if (stats.sign === "negative" && stats.median <= -10) {
    verdictCode = "likely_forgetting_severe";
  } else if (stats.sign === "negative") {
    verdictCode = "likely_forgetting_mild";
  } else {
    verdictCode = "uncertain_high_variance";
  }

  return {
    code: verdictCode,
    params: {
      n: stats.count,
      nDelta: stats.deltaCount,
      min: stats.min !== undefined ? Math.round(stats.min * 10) / 10 : null,
      max: stats.max !== undefined ? Math.round(stats.max * 10) / 10 : null,
      median: stats.median !== undefined ? Math.round(stats.median * 10) / 10 : null,
    },
    warnings,
  };
}

export function queryKB(filter) {
  if (!_kb) throw new Error("KB not loaded; call loadForgettingKB() first");
  const matches = _kb.datapoints.filter(d => matchesFilter(d, filter));
  const stats = computeStats(matches);
  const verdict = deriveVerdict(filter, matches, stats);
  return { matches, stats, verdict };
}

// Helpers for UI dropdowns — return the available values for each filter,
// derived from the actual loaded KB so the UI never offers a value with 0 hits.
export function kbDistinctValues() {
  if (!_kb) return null;
  const set = (k) => Array.from(new Set(_kb.datapoints.map(d => d[k]).filter(Boolean)));
  return {
    families: set("family"),
    sourceDomains: set("source_domain"),
    evalDomains: set("eval_domain"),
    evalBenchmarks: set("eval_benchmark"),
  };
}

// Citation map: paper id (arxiv) → entry count + title. Useful for the
// "evidence base" summary panel.
export function citationSummary() {
  if (!_kb) return [];
  const acc = new Map();
  for (const d of _kb.datapoints) {
    const c = d.citation || {};
    const key = c.arxiv || c.title || "uncited";
    if (!acc.has(key)) {
      acc.set(key, { arxiv: c.arxiv || null, title: c.title || null, venue: c.venue || null, count: 0 });
    }
    acc.get(key).count += 1;
  }
  return Array.from(acc.values()).sort((a, b) => b.count - a.count);
}
