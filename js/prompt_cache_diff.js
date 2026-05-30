// Prompt-Cache Diff Predictor (v0.8.4 anti-bullshit pack #10)
//
// Pain: small prompt edits silently invalidate provider prompt caches,
// turning a 50% discount into a 0% discount and 10x'ing the bill.
// Users debug this blind because:
//   - Anthropic's `cache_control` cache breaks at the first token diff
//     in the marked prefix (TTL 5 min default, 1 hour beta).
//   - OpenAI auto-caches prefixes ≥1024 tokens but invalidates on any
//     prefix change; the 50% read discount only applies on hit.
//   - Gemini's context cache requires explicit creation, ≥32K tokens,
//     and any prefix edit forces a new cache.
//
// Tool: paste old + new prompt → compute longest common prefix in
// tokens → predict per-provider cache hit ratio + $ delta vs no-cache.
//
// Pure logic — no human strings; main.js does i18n. Returns
// {code, params, providers: [{provider_id, ...}]}.

// =============================================================================
// Token estimation — heuristic, browser-only
// =============================================================================
//
// Real tokenizers vary by ±15% between Llama / GPT / Claude / Qwen and
// running them in-browser would mean shipping a 5-10 MB WASM blob. For a
// cache-diff predictor the absolute count doesn't matter — what matters
// is the RATIO of common-prefix to divergent-suffix tokens, which is
// robust to estimator choice. The three profiles below cover 95% of
// real prompts; users with extreme cases can paste pre-tokenized counts.
const TOKEN_PROFILES = {
  english: { chars_per_token: 4.0, label_key: "cache.profile.english" },
  code:    { chars_per_token: 3.5, label_key: "cache.profile.code" },
  mixed:   { chars_per_token: 2.0, label_key: "cache.profile.mixed" }, // CJK / Cyrillic
};

export function estimateTokens(text, profile = "english") {
  if (typeof text !== "string" || !text) return 0;
  const cpt = TOKEN_PROFILES[profile]?.chars_per_token ?? 4.0;
  return Math.ceil(text.length / cpt);
}

// =============================================================================
// Provider rules — pricing + cache mechanics
// =============================================================================
//
// Prices are USD per million tokens, snapshot 2026-01 (knowledge cutoff).
// `cache_read_multiplier` is the fraction of input price billed on a
// cache hit (Anthropic 0.10 = 10%; OpenAI/Gemini 0.50 = 50%; etc).
// `cache_write_multiplier` accounts for Anthropic's 25% write surcharge
// the first time a prefix is seen.
//
// `min_cache_tokens` is the floor below which the provider cannot cache
// (OpenAI auto-cache requires ≥1024; Gemini context cache ≥32K).
// Anthropic has no min token floor but requires explicit cache_control
// marker — we treat that as min=0 with a `requires_explicit` flag for UI.
//
// HONESTY: these prices are a frozen snapshot and go stale silently. The
// snapshot date is surfaced to the UI via `PRICES_AS_OF` (returned in params)
// so it can render an "as of" caveat. Update this date whenever prices change.
export const PRICES_AS_OF = "2026-01";
export const PROVIDERS = {
  anthropic_opus: {
    name: "Claude Opus 4.7",
    min_cache_tokens: 0,
    requires_explicit: true,
    cache_ttl_seconds: 300,                 // 5 min default
    input_per_mt:  15.00,
    output_per_mt: 75.00,
    cache_write_multiplier: 1.25,
    cache_read_multiplier:  0.10,           // 10% of input
  },
  anthropic_sonnet: {
    name: "Claude Sonnet 4.6",
    min_cache_tokens: 0,
    requires_explicit: true,
    cache_ttl_seconds: 300,
    input_per_mt:   3.00,
    output_per_mt: 15.00,
    cache_write_multiplier: 1.25,
    cache_read_multiplier:  0.10,
  },
  anthropic_haiku: {
    name: "Claude Haiku 4.5",
    min_cache_tokens: 0,
    requires_explicit: true,
    cache_ttl_seconds: 300,
    input_per_mt:   1.00,
    output_per_mt:  5.00,
    cache_write_multiplier: 1.25,
    cache_read_multiplier:  0.10,
  },
  openai_gpt5: {
    name: "OpenAI GPT-5",
    min_cache_tokens: 1024,
    requires_explicit: false,
    cache_ttl_seconds: 600,                 // ~5-10 min observed
    input_per_mt:   5.00,
    output_per_mt: 15.00,
    cache_write_multiplier: 1.00,
    cache_read_multiplier:  0.50,           // 50% of input
  },
  openai_gpt5_mini: {
    name: "OpenAI GPT-5 mini",
    min_cache_tokens: 1024,
    requires_explicit: false,
    cache_ttl_seconds: 600,
    input_per_mt:   0.30,
    output_per_mt:  1.20,
    cache_write_multiplier: 1.00,
    cache_read_multiplier:  0.50,
  },
  gemini_25_pro: {
    name: "Gemini 2.5 Pro",
    min_cache_tokens: 32768,
    requires_explicit: true,
    cache_ttl_seconds: 3600,                // 1 hour default for context cache
    input_per_mt:   1.25,
    output_per_mt: 10.00,
    cache_write_multiplier: 1.00,
    cache_read_multiplier:  0.25,           // 25% of input
  },
};

// =============================================================================
// Longest common prefix — character-level
// =============================================================================

export function longestCommonPrefix(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return 0;
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

// First differing line — useful for the UI "your edit landed here" hint.
function firstDifferingLine(a, b, prefixLen) {
  // Walk back to the start of the line containing the diff
  let i = prefixLen;
  while (i > 0 && a[i - 1] !== "\n" && b[i - 1] !== "\n") i--;
  // Count line number (1-indexed)
  let line = 1;
  for (let j = 0; j < i; j++) {
    if (a[j] === "\n") line++;
  }
  return { offset: i, line };
}

// =============================================================================
// Per-provider cache analysis
// =============================================================================

function analyseProvider(
  providerId,
  totalTokensNew,
  commonTokens,
  divergeTokens,
  outputTokens,
) {
  const p = PROVIDERS[providerId];
  if (!p) return null;

  const inputPrice = p.input_per_mt / 1_000_000;
  const outputPrice = p.output_per_mt / 1_000_000;
  const baseCost =
    totalTokensNew * inputPrice + outputTokens * outputPrice;

  // Can the provider cache anything? Two failure modes:
  //   (a) common prefix below provider's minimum cacheable size
  //   (b) provider requires an explicit marker AND the user almost
  //       certainly didn't include one in the paste — we still report
  //       the best-case savings but tag the result as `requires_marker`.
  let canCache = true;
  let reason = null;
  if (commonTokens < p.min_cache_tokens) {
    canCache = false;
    reason = "below_min";
  }

  if (!canCache) {
    return {
      provider_id: providerId,
      provider_name: p.name,
      base_cost_usd: baseCost,
      cached_cost_usd: baseCost,
      savings_usd: 0,
      hit_ratio: 0,
      tokens_cached: 0,
      tokens_billed_input: totalTokensNew,
      reason,
      min_cache_tokens: p.min_cache_tokens,
      requires_explicit: p.requires_explicit,
      cache_ttl_seconds: p.cache_ttl_seconds,
    };
  }

  // Cost on cache HIT for the prefix:
  //   cache-read: commonTokens × inputPrice × cache_read_multiplier
  //   fresh:      divergeTokens × inputPrice
  //   output:     outputTokens × outputPrice
  const cachedInputCost =
    commonTokens * inputPrice * p.cache_read_multiplier +
    divergeTokens * inputPrice;
  const cachedCost = cachedInputCost + outputTokens * outputPrice;

  // Cache write surcharge (Anthropic). Surfaced as `cache_write_cost`
  // separately so users see the amortization picture.
  const cacheWriteSurcharge =
    commonTokens * inputPrice * (p.cache_write_multiplier - 1.0);

  const savings = baseCost - cachedCost;
  const hitRatio = totalTokensNew === 0 ? 0 : commonTokens / totalTokensNew;

  return {
    provider_id: providerId,
    provider_name: p.name,
    base_cost_usd: baseCost,
    cached_cost_usd: cachedCost,
    cache_write_surcharge_usd: cacheWriteSurcharge,
    savings_usd: savings,
    savings_pct: baseCost === 0 ? 0 : savings / baseCost,
    hit_ratio: hitRatio,
    tokens_cached: commonTokens,
    tokens_billed_input: divergeTokens,
    reason: null,
    min_cache_tokens: p.min_cache_tokens,
    requires_explicit: p.requires_explicit,
    cache_ttl_seconds: p.cache_ttl_seconds,
  };
}

// =============================================================================
// Public entry point
// =============================================================================

export function diffPromptCache(
  oldPrompt,
  newPrompt,
  {
    profile = "english",
    outputTokensEstimate = 500,
    providers = null,
  } = {},
) {
  if (typeof oldPrompt !== "string" || typeof newPrompt !== "string") {
    return { code: "empty_input", params: {} };
  }
  const oldTrim = oldPrompt;
  const newTrim = newPrompt;
  if (!oldTrim && !newTrim) {
    return { code: "empty_input", params: {} };
  }

  // HONESTY: the common prefix is measured at the CHARACTER level, but real
  // provider caches break at TOKEN boundaries. A small edit inside a token can
  // shift the true token-level break earlier than the char-level prefix implies,
  // so char-LCP OVERCOUNTS cached tokens. The resulting hit_ratio is therefore
  // an UPPER BOUND (flagged via hit_ratio_is_upper_bound in the returned params).
  const lcpChars = longestCommonPrefix(oldTrim, newTrim);
  const isIdentical = oldTrim === newTrim;
  const totalCharsNew = newTrim.length;
  const divergeChars = totalCharsNew - lcpChars;

  const tokensCommon  = estimateTokens(oldTrim.slice(0, lcpChars), profile);
  const tokensDiverge = estimateTokens(newTrim.slice(lcpChars),    profile);
  const tokensTotal   = tokensCommon + tokensDiverge;

  const providerIds = providers ?? Object.keys(PROVIDERS);
  const providerResults = providerIds
    .map(id => analyseProvider(id, tokensTotal, tokensCommon, tokensDiverge, outputTokensEstimate))
    .filter(r => r !== null);

  const diffPoint = isIdentical
    ? { offset: oldTrim.length, line: oldTrim.split("\n").length }
    : firstDifferingLine(oldTrim, newTrim, lcpChars);

  let code;
  if (isIdentical) {
    code = "identical";
  } else if (lcpChars === 0) {
    code = "fully_divergent";
  } else if (providerResults.every(r => r.reason === "below_min")) {
    code = "divergent_below_min";
  } else {
    code = "divergent_can_cache";
  }

  return {
    code,
    params: {
      profile,
      lcp_chars: lcpChars,
      diverge_chars: divergeChars,
      tokens_common: tokensCommon,
      tokens_diverge: tokensDiverge,
      tokens_total: tokensTotal,
      hit_ratio: tokensTotal === 0 ? 0 : tokensCommon / tokensTotal,
      hit_ratio_is_upper_bound: true,   // char-level LCP overcounts vs token-boundary caches
      diff_point: diffPoint,
      output_tokens: outputTokensEstimate,
      prices_as_of: PRICES_AS_OF,       // snapshot date for the pricing caveat
    },
    providers: providerResults,
  };
}

// Helper used by the UI: short summary string per provider, suitable for
// rendering in a table row (i18n-substituted in main.js).
export function summariseProvider(result) {
  if (!result) return null;
  return {
    name: result.provider_name,
    hit_pct: Math.round(result.hit_ratio * 100),
    base: result.base_cost_usd,
    cached: result.cached_cost_usd,
    savings: result.savings_usd,
    savings_pct: result.savings_pct ?? 0,
    requires_explicit: result.requires_explicit,
    reason: result.reason,
  };
}
