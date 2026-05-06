// Contamination Prior (v0.7.3 anti-bullshit pack #4)
// Bayesian-ish prior on whether a benchmark score is contaminated, based on
// (model training cutoff date) × (benchmark release date) × (known leak status).
// Pure logic — no human strings. Open LLM Leaderboard v1 (MMLU/HellaSwag/etc)
// was killed for contamination; this lets a user calibrate trust per score.

// Benchmark database. Each entry tracks release date, whether it's known to
// be in common pretraining corpora (CommonCrawl etc), and a base-rate adjustment
// (incident-driven: confirmed leaks, paraphrased copies in training data, etc).
//
// Sources: arxiv 2404.00699 (contamination survey), HF dataset cards,
// public reproductions / known leak reports.
export const BENCHMARK_DB = {
  // Format: { id, name, released: "YYYY-MM", in_corpora: bool, leak_factor: 0..1, category, paper }
  "mmlu":          { id: "mmlu",          name: "MMLU",                 released: "2020-09", in_corpora: true,  leak_factor: 0.18, category: "knowledge", paper: "Hendrycks 2020" },
  "mmlu_pro":      { id: "mmlu_pro",      name: "MMLU-Pro",             released: "2024-06", in_corpora: false, leak_factor: 0.05, category: "knowledge", paper: "Wang 2024" },
  "hellaswag":     { id: "hellaswag",     name: "HellaSwag",            released: "2019-05", in_corpora: true,  leak_factor: 0.20, category: "commonsense", paper: "Zellers 2019" },
  "arc_challenge": { id: "arc_challenge", name: "ARC Challenge",        released: "2018-04", in_corpora: true,  leak_factor: 0.15, category: "knowledge", paper: "Clark 2018" },
  "truthfulqa":    { id: "truthfulqa",    name: "TruthfulQA",           released: "2021-09", in_corpora: true,  leak_factor: 0.10, category: "truthfulness", paper: "Lin 2021" },
  "gsm8k":         { id: "gsm8k",         name: "GSM8K",                released: "2021-10", in_corpora: true,  leak_factor: 0.12, category: "math", paper: "Cobbe 2021" },
  "math":          { id: "math",          name: "MATH",                 released: "2021-03", in_corpora: true,  leak_factor: 0.10, category: "math", paper: "Hendrycks 2021" },
  "humaneval":     { id: "humaneval",     name: "HumanEval",            released: "2021-07", in_corpora: true,  leak_factor: 0.18, category: "code", paper: "Chen 2021" },
  "mbpp":          { id: "mbpp",          name: "MBPP",                 released: "2021-08", in_corpora: true,  leak_factor: 0.12, category: "code", paper: "Austin 2021" },
  "bbh":           { id: "bbh",           name: "BIG-Bench Hard (BBH)", released: "2022-10", in_corpora: true,  leak_factor: 0.08, category: "reasoning", paper: "Suzgun 2022" },
  "ifeval":        { id: "ifeval",        name: "IFEval",               released: "2023-11", in_corpora: false, leak_factor: 0.05, category: "instruction", paper: "Zhou 2023" },
  "musr":          { id: "musr",          name: "MuSR",                 released: "2023-10", in_corpora: false, leak_factor: 0.04, category: "reasoning", paper: "Sprague 2023" },
  "gpqa":          { id: "gpqa",          name: "GPQA",                 released: "2023-11", in_corpora: false, leak_factor: 0.04, category: "graduate-knowledge", paper: "Rein 2023" },
  "math500":       { id: "math500",       name: "MATH-500",             released: "2023-11", in_corpora: false, leak_factor: 0.05, category: "math", paper: "Lightman 2023" },
  "aime24":        { id: "aime24",        name: "AIME 2024",            released: "2024-02", in_corpora: false, leak_factor: 0.02, category: "math", paper: "AIME 2024" },
  "winogrande":    { id: "winogrande",    name: "Winogrande",           released: "2019-07", in_corpora: true,  leak_factor: 0.15, category: "commonsense", paper: "Sakaguchi 2019" },
  "boolq":         { id: "boolq",         name: "BoolQ",                released: "2019-05", in_corpora: true,  leak_factor: 0.15, category: "reading", paper: "Clark 2019" },
  "drop":          { id: "drop",          name: "DROP",                 released: "2019-04", in_corpora: true,  leak_factor: 0.12, category: "reading", paper: "Dua 2019" },
  "triviaqa":      { id: "triviaqa",      name: "TriviaQA",             released: "2017-05", in_corpora: true,  leak_factor: 0.18, category: "knowledge", paper: "Joshi 2017" },
  "squad":         { id: "squad",         name: "SQuAD",                released: "2016-06", in_corpora: true,  leak_factor: 0.20, category: "reading", paper: "Rajpurkar 2016" },
};

// Parse "YYYY-MM" or "YYYY-MM-DD" or "YYYY". Returns Date or null.
function parseLooseDate(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = m[2] ? Math.max(1, Math.min(12, parseInt(m[2], 10))) : 6;
  const d = m[3] ? Math.max(1, Math.min(28, parseInt(m[3], 10))) : 15;
  return new Date(Date.UTC(y, mo - 1, d));
}

// Time-based base prior. Returns probability that benchmark text was in the
// model's training data given (cutoff - release) gap.
//
// Heuristic curve:
//   gap < 0 (released after cutoff)      → 0.02 (only via leaks)
//   gap 0-3 months                       → 0.10–0.25
//   gap 3-12 months                      → 0.25–0.55
//   gap 12-24 months                     → 0.55–0.75
//   gap > 24 months (heavily reproduced) → 0.75–0.92
function timePrior(gapMonths) {
  if (gapMonths < 0) return 0.02;
  if (gapMonths === 0) return 0.10;
  if (gapMonths <= 3)  return 0.10 + (gapMonths / 3) * 0.15;
  if (gapMonths <= 12) return 0.25 + ((gapMonths - 3) / 9) * 0.30;
  if (gapMonths <= 24) return 0.55 + ((gapMonths - 12) / 12) * 0.20;
  return Math.min(0.92, 0.75 + ((gapMonths - 24) / 36) * 0.17);
}

// Per-benchmark prior: time-prior × in_corpora boost + leak_factor.
// Caps at 0.97 (always some uncertainty).
export function computeContaminationPrior(modelCutoff, benchmarkId) {
  const bench = BENCHMARK_DB[benchmarkId];
  if (!bench) return null;
  const cutoffDate = parseLooseDate(modelCutoff);
  const releaseDate = parseLooseDate(bench.released);
  if (!cutoffDate || !releaseDate) return null;

  const gapMs = cutoffDate.getTime() - releaseDate.getTime();
  const gapMonths = gapMs / (1000 * 60 * 60 * 24 * 30.44);
  const tp = timePrior(gapMonths);
  const corporaBoost = bench.in_corpora ? 0.10 : 0.0;
  const raw = tp + corporaBoost + bench.leak_factor;
  const prior = Math.max(0.01, Math.min(0.97, raw));

  let level;
  if (prior >= 0.65) level = "high";
  else if (prior >= 0.30) level = "medium";
  else level = "low";

  return {
    benchmark: bench.name,
    benchmark_id: bench.id,
    benchmark_released: bench.released,
    benchmark_category: bench.category,
    benchmark_in_corpora: bench.in_corpora,
    benchmark_paper: bench.paper,
    model_cutoff: modelCutoff,
    gap_months: Math.round(gapMonths * 10) / 10,
    time_prior: Math.round(tp * 100) / 100,
    corpora_boost: corporaBoost,
    leak_factor: bench.leak_factor,
    prior: Math.round(prior * 100) / 100,
    level,
    advice_code: level === "high" ? "treat_unreliable" :
                 level === "medium" ? "verify_alternate" : "score_likely_clean",
  };
}

// Batch helper: rate all benchmarks for a given cutoff. Returns array sorted
// by prior descending so the most-contaminated ones surface first.
export function rateAllBenchmarks(modelCutoff) {
  return Object.values(BENCHMARK_DB)
    .map(b => computeContaminationPrior(modelCutoff, b.id))
    .filter(Boolean)
    .sort((a, b) => b.prior - a.prior);
}

// Aggregate verdict for a list of (benchmark_id, reported_score) pairs.
// User pastes their leaderboard scores → tool flags which are likely
// contaminated and which aren't.
export function aggregateScoreSheet(modelCutoff, scoreSheet) {
  const rows = [];
  for (const { benchmark_id, score } of scoreSheet) {
    const p = computeContaminationPrior(modelCutoff, benchmark_id);
    if (p) rows.push({ ...p, reported_score: score });
  }
  rows.sort((a, b) => b.prior - a.prior);
  const counts = { high: 0, medium: 0, low: 0 };
  for (const r of rows) counts[r.level]++;
  return {
    rows,
    counts,
    total: rows.length,
    high_pct: rows.length ? Math.round(counts.high / rows.length * 100) : 0,
  };
}
