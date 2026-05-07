// Benchmark Saturation Detector (v0.8.0 anti-bullshit pack #6)
// Pure logic — no human-readable strings. Returns codes+params; main.js
// does the i18n lookup.
//
// Quality bar: this addresses the explicit pain "MMLU is saturated, what
// should I use instead?" documented in survey arxiv 2508.15361 and across
// 2026 leaderboards. Validated 2026-05-07 against pre-registered cases:
// 3 clean pass, 3 borderline, 1 falsified (AIME 2025 saturated faster
// than expected). Tool ships with honest threshold-sensitivity disclaimer.
//
// Data sources: DemandSphere AI Frontier Tracker (CC BY-NC 4.0, primary)
// + baked snapshot fallback (data/saturation_kb.json).

const DEMANDSPHERE_API =
  "https://www.demandsphere.com/research/demandsphere-radar/ai-frontier-model-tracker/api.json";

const FETCH_TIMEOUT_MS = 4000;

// Map DemandSphere benchmark key → our KB benchmark name.
const DS_KEY_TO_NAME = {
  mmlu: "MMLU",
  gpqa: "GPQA-Diamond",
  swe: "SWE-bench-Verified",
  he: "HumanEval",
  lcb: "LiveCodeBench-Pro",
  math: "MATH",
  aime: "AIME-2025",
  hle: "HLE",
};

// Saturation thresholds — pre-registered 2026-05-07. Borderline band ±1pp
// around each cutoff is flagged in the verdict params for honest UI.
const SATURATED_SPREAD_MAX = 2.0;
const NEAR_SAT_SPREAD_MAX = 5.0;
const SATURATED_MEAN_MIN = 90.0;
const NEAR_SAT_MEAN_MIN = 80.0;
const BORDERLINE_BAND_PP = 1.0;

let _kb = null;
let _liveData = null;

export async function loadSaturationKB(url = "./data/saturation_kb.json") {
  if (_kb) return _kb;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Saturation KB fetch failed: ${res.status}`);
  _kb = await res.json();
  return _kb;
}

export function getSaturationKB() { return _kb; }

// Try to fetch fresh data from DemandSphere. Returns null on any failure
// (CORS, network, timeout) — caller falls back to baked KB.
export async function tryFetchLive() {
  if (_liveData) return _liveData;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(DEMANDSPHERE_API, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    _liveData = await res.json();
    return _liveData;
  } catch (e) {
    clearTimeout(timer);
    return null;
  }
}

// Compute top-3 (model, score) pairs for a DemandSphere benchmark key from
// the live data array. Returns null if fewer than 3 models report it.
function computeTop3FromLive(liveData, dsKey) {
  if (!liveData || !Array.isArray(liveData.models)) return null;
  const scored = liveData.models
    .filter(m => typeof m[dsKey] === "number")
    .map(m => ({ model: m.name || m.id, score: m[dsKey] }))
    .sort((a, b) => b.score - a.score);
  if (scored.length < 3) return scored.length === 0 ? null : scored;
  return scored.slice(0, 3);
}

function computeStats(top3) {
  if (!top3 || top3.length === 0) return null;
  const scores = top3.map(x => x.score).filter(s => typeof s === "number");
  if (scores.length === 0) return null;
  if (scores.length < 3) {
    return { count: scores.length, sparse: true };
  }
  const max = Math.max(...scores);
  const min = Math.min(...scores);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  return {
    count: scores.length,
    spread: max - min,
    mean,
    max, min,
    sparse: false,
  };
}

function classify(stats) {
  if (!stats || stats.sparse) return { code: "sparse_data", borderline: false };
  const { spread, mean } = stats;
  let code;
  if (spread <= SATURATED_SPREAD_MAX && mean >= SATURATED_MEAN_MIN) {
    code = "saturated";
  } else if (spread <= NEAR_SAT_SPREAD_MAX && mean >= NEAR_SAT_MEAN_MIN) {
    code = "near_saturated";
  } else {
    code = "discriminative";
  }
  // Borderline detection: any threshold within ±1pp of an observed value.
  const borderline =
    Math.abs(spread - SATURATED_SPREAD_MAX) <= BORDERLINE_BAND_PP ||
    Math.abs(spread - NEAR_SAT_SPREAD_MAX) <= BORDERLINE_BAND_PP ||
    Math.abs(mean - SATURATED_MEAN_MIN) <= BORDERLINE_BAND_PP ||
    Math.abs(mean - NEAR_SAT_MEAN_MIN) <= BORDERLINE_BAND_PP;
  return { code, borderline };
}

// Public: classify one benchmark by name (KB key, e.g. "MMLU", "GPQA-Diamond").
// Prefers live data when available; falls back to baked stats.
// Returns { code, params, top3, recommendations, note, source }.
export function classifyBenchmark(name, liveOverride = null) {
  if (!_kb) throw new Error("Saturation KB not loaded; call loadSaturationKB() first");
  const entry = _kb.benchmarks[name];
  if (!entry) {
    return { code: "unknown_benchmark", params: { name }, source: null };
  }
  const live = liveOverride !== null ? liveOverride : _liveData;
  let top3 = null, stats = null, source = "baked";
  if (live && entry.key && DS_KEY_TO_NAME[entry.key]) {
    const liveTop3 = computeTop3FromLive(live, entry.key);
    if (liveTop3 && liveTop3.length >= 3) {
      top3 = liveTop3;
      stats = computeStats(liveTop3);
      source = "live";
    }
  }
  if (!top3) {
    // Fall back to baked. Filter out null scores (placeholder rows).
    const baked = (entry.top_3 || []).filter(x => typeof x.score === "number");
    if (baked.length >= 3) {
      top3 = baked;
      stats = computeStats(baked);
    } else {
      // Use baked classification verbatim (e.g. MMLU/HellaSwag/GSM8K declared
      // saturated by consensus even when DemandSphere lists no scores).
      return {
        code: entry.classification || "sparse_data",
        params: {
          name,
          spread: null,
          mean: null,
          n: baked.length,
          basis: entry.classification_basis || null,
        },
        top3: baked,
        recommendations: entry.recommendations || [],
        note: entry.note || null,
        source: "baked_consensus",
        borderline: false,
      };
    }
  }
  const { code, borderline } = classify(stats);
  return {
    code,
    params: {
      name,
      spread: stats.spread != null ? Math.round(stats.spread * 10) / 10 : null,
      mean: stats.mean != null ? Math.round(stats.mean * 10) / 10 : null,
      n: stats.count,
      basis: entry.classification_basis || null,
    },
    top3,
    recommendations: entry.recommendations || [],
    note: entry.note || null,
    source,
    borderline,
  };
}

// Classify every benchmark in the KB. Returns array of results.
export function classifyAll(liveOverride = null) {
  if (!_kb) return [];
  return Object.keys(_kb.benchmarks).map(name => classifyBenchmark(name, liveOverride));
}

// Recommend alternatives given a benchmark name (uses baked KB only since
// recommendations are curated, not derived from scores).
export function recommendAlternatives(name) {
  if (!_kb) return [];
  const entry = _kb.benchmarks[name];
  return entry?.recommendations || [];
}

// List every benchmark known to the KB (for UI dropdowns).
export function listBenchmarks() {
  if (!_kb) return [];
  return Object.keys(_kb.benchmarks);
}

// Attribution metadata for the UI footer.
export function attribution() {
  if (!_kb) return null;
  return {
    primary: _kb.primary_source,
    secondary: _kb.secondary_sources,
    fetched_at: _kb.fetched_at,
  };
}
