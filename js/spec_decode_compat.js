// Speculative-Decode Compatibility Checker (v0.8.5 anti-bullshit pack #11)
//
// Pain: speculative decoding (vLLM, SGLang, llama.cpp, transformers
// `assistant_model`) requires the draft and target model to share an
// EXACT vocabulary. If token IDs disagree, every draft token is
// rejected by the target's verifier — the user pays the draft compute
// AND the full target compute, getting WORSE throughput than baseline.
// Worse, the system reports nominal output (just slower) so the bug
// is invisible in unit tests.
//
// Common silent failures:
//   - Llama-3.1 draft + Llama-3.2 target (vocab differs by added tokens)
//   - Mistral draft + Llama target (different tokenizer family entirely)
//   - Quantized variant with different special tokens
//   - Chat-template additions (`<|im_start|>` etc) on one side only
//
// vLLM #4570 / #16757 / #20409 / #12488 all surface variants of this.
//
// Tool: paste two HF model ids → fetch `tokenizer.json` from HF Hub for
// both → compare vocab type, size, token-to-id sample, special tokens,
// added tokens → verdict + speedup estimate when compatible.
//
// Pure logic + async fetch. No human strings; main.js does i18n.

// =============================================================================
// HF Hub fetching
// =============================================================================
//
// HF Hub serves text-content files (tokenizer.json, tokenizer_config.json,
// config.json) with CORS. The v0.7.4 autocomplete already proved this
// path is reachable from the browser. We fetch with a short timeout so
// the UI doesn't hang on gated/private/missing models.

const HF_BASE = "https://huggingface.co";
const FETCH_TIMEOUT_MS = 8000;

async function fetchHfJson(modelId, fileName) {
  if (typeof modelId !== "string" || !modelId.trim()) {
    return { ok: false, error: "missing_model_id" };
  }
  const url = `${HF_BASE}/${encodeURI(modelId.trim())}/raw/main/${fileName}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "gated_or_private", status: res.status };
    }
    if (res.status === 404) {
      return { ok: false, error: "not_found", status: 404 };
    }
    if (!res.ok) {
      return { ok: false, error: "fetch_failed", status: res.status };
    }
    const text = await res.text();
    try {
      return { ok: true, data: JSON.parse(text), bytes: text.length };
    } catch (e) {
      return { ok: false, error: "parse_failed", message: String(e).slice(0, 200) };
    }
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      return { ok: false, error: "timeout" };
    }
    return { ok: false, error: "network", message: String(e).slice(0, 200) };
  }
}

export async function fetchTokenizer(modelId) {
  // tokenizer.json is the canonical fast-tokenizer artifact. If it's
  // absent (some older models ship only sentencepiece), fall back to
  // tokenizer_config.json which carries the special-tokens metadata
  // even without the BPE merges.
  const main = await fetchHfJson(modelId, "tokenizer.json");
  if (main.ok) return { ...main, source: "tokenizer.json" };
  const fallback = await fetchHfJson(modelId, "tokenizer_config.json");
  if (fallback.ok) return { ...fallback, source: "tokenizer_config.json" };
  return main; // surface the original error code
}

export async function fetchConfig(modelId) {
  return await fetchHfJson(modelId, "config.json");
}

// =============================================================================
// Vocab extraction + comparison
// =============================================================================

// Return a Map<string,id> for whatever shape the tokenizer.json carries.
// HF fast tokenizers store vocab under `model.vocab`, which is either
// {token: id} (BPE) or [[token, score], ...] (Unigram). Special tokens
// live under top-level `added_tokens` (with id) and the model itself
// keeps an `unk_token`/`bos_token`/`eos_token` etc shape.
function extractVocab(tokenizer) {
  if (!tokenizer || typeof tokenizer !== "object") return null;
  const model = tokenizer.model;
  if (!model) return null;
  let vocab = null;
  if (model.vocab && typeof model.vocab === "object" && !Array.isArray(model.vocab)) {
    // BPE / WordPiece form
    vocab = model.vocab;
  } else if (Array.isArray(model.vocab)) {
    // Unigram form: [[token, log_prob], ...]
    vocab = {};
    for (let i = 0; i < model.vocab.length; i++) {
      const entry = model.vocab[i];
      if (Array.isArray(entry)) vocab[entry[0]] = i;
    }
  }
  return vocab;
}

function extractAddedTokens(tokenizer) {
  if (!tokenizer || typeof tokenizer !== "object") return [];
  const arr = tokenizer.added_tokens;
  if (!Array.isArray(arr)) return [];
  return arr.map(t => ({
    id: typeof t.id === "number" ? t.id : null,
    content: typeof t.content === "string" ? t.content : "",
    special: !!t.special,
  })).filter(t => t.content);
}

function extractSpecialTokens(tokenizer) {
  // tokenizer.json places special-token strings on the post-processor /
  // template — but the canonical names are in tokenizer_config.json.
  // Return what's available; the UI can show "—" for missing.
  if (!tokenizer || typeof tokenizer !== "object") return {};
  return {
    bos_token: tokenizer.bos_token ?? null,
    eos_token: tokenizer.eos_token ?? null,
    pad_token: tokenizer.pad_token ?? null,
    unk_token: tokenizer.unk_token ?? null,
  };
}

function tokenizerType(tokenizer) {
  return tokenizer?.model?.type || null;
}

// Sample-match strategy: for full-vocab compare (which is fine in JS
// for vocabs up to ~150K), build both maps and check equality. The
// expensive branch — VOCABS DIFFER — short-circuits on the first
// mismatch so the cost is bounded by the number of differing tokens.
export function compareVocabs(targetTok, draftTok) {
  const tType = tokenizerType(targetTok);
  const dType = tokenizerType(draftTok);
  const tVocab = extractVocab(targetTok);
  const dVocab = extractVocab(draftTok);

  if (!tVocab || !dVocab) {
    return {
      type_match: tType !== null && tType === dType,
      target_type: tType,
      draft_type: dType,
      vocab_size_match: false,
      target_vocab_size: tVocab ? Object.keys(tVocab).length : 0,
      draft_vocab_size: dVocab ? Object.keys(dVocab).length : 0,
      sampled_total: 0,
      sampled_match_count: 0,
      first_mismatch: null,
      special_tokens_diff: [],
      added_tokens_diff: [],
    };
  }

  const tKeys = Object.keys(tVocab);
  const dKeys = Object.keys(dVocab);
  const tSize = tKeys.length;
  const dSize = dKeys.length;
  const sizeMatch = tSize === dSize;

  // Sample comparison: walk every key on the SMALLER side. For each
  // key, check the id matches exactly. First mismatch is recorded.
  const sampleKeys = tSize <= dSize ? tKeys : dKeys;
  const a = tSize <= dSize ? tVocab : dVocab;
  const b = tSize <= dSize ? dVocab : tVocab;
  const sideA = tSize <= dSize ? "target" : "draft";
  const sideB = sideA === "target" ? "draft" : "target";

  let matchCount = 0;
  let firstMismatch = null;
  for (const key of sampleKeys) {
    const aId = a[key];
    const bId = b[key];
    if (aId === bId) {
      matchCount++;
    } else if (firstMismatch === null) {
      firstMismatch = { token: key, [`${sideA}_id`]: aId, [`${sideB}_id`]: bId };
    }
  }

  // Special-token diff
  const tSpec = extractSpecialTokens(targetTok);
  const dSpec = extractSpecialTokens(draftTok);
  const specDiff = [];
  for (const name of ["bos_token", "eos_token", "pad_token", "unk_token"]) {
    if ((tSpec[name] ?? null) !== (dSpec[name] ?? null)) {
      specDiff.push({ name, target: tSpec[name], draft: dSpec[name] });
    }
  }

  // Added-tokens diff (chat-template tokens etc.)
  const tAdded = extractAddedTokens(targetTok);
  const dAdded = extractAddedTokens(draftTok);
  const tAddedSet = new Set(tAdded.map(x => `${x.id}:${x.content}`));
  const dAddedSet = new Set(dAdded.map(x => `${x.id}:${x.content}`));
  const addedDiff = [];
  for (const k of tAddedSet) if (!dAddedSet.has(k)) addedDiff.push({ side: "target_only", token: k });
  for (const k of dAddedSet) if (!tAddedSet.has(k)) addedDiff.push({ side: "draft_only", token: k });

  return {
    type_match: tType === dType,
    target_type: tType,
    draft_type: dType,
    vocab_size_match: sizeMatch,
    target_vocab_size: tSize,
    draft_vocab_size: dSize,
    sampled_total: sampleKeys.length,
    sampled_match_count: matchCount,
    first_mismatch: firstMismatch,
    special_tokens_diff: specDiff,
    added_tokens_diff: addedDiff,
  };
}

// =============================================================================
// Param-count parsing — best-effort from model id strings
// =============================================================================
//
// HF model ids commonly carry a size hint: "Llama-3.1-8B", "Qwen2.5-72B",
// "Mistral-7B-v0.3". Parse the largest "{N}{B|M}" token; fall back to
// fetched config.json hidden_size × num_hidden_layers heuristic.

const PARAM_HINT_RE = /(\d+(?:\.\d+)?)\s*([bm])\b/i;

export function parseParamHint(modelId) {
  if (typeof modelId !== "string") return null;
  // Pick the LAST match — for "Llama-3.1-8B" we want 8B, not the "3.1"
  // (which doesn't carry b/m suffix anyway). Iterating to ensure we
  // find size hints not just version numbers.
  const matches = [...modelId.matchAll(/(\d+(?:\.\d+)?)\s*([bm])\b/gi)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const value = parseFloat(last[1]);
  const unit = last[2].toLowerCase();
  if (isNaN(value)) return null;
  const params = unit === "b" ? value * 1e9 : value * 1e6;
  return params;
}

// Approximate param count from config.json. Highly heuristic.
function paramsFromConfig(config) {
  if (!config) return null;
  const h = config.hidden_size ?? config.n_embd ?? config.d_model;
  const l = config.num_hidden_layers ?? config.n_layer ?? config.num_layers;
  const v = config.vocab_size;
  if (typeof h !== "number" || typeof l !== "number" || typeof v !== "number") return null;
  // Rough transformer param count: 12 × h² × l + h × v (embedding) + h × v (output, if not tied).
  // Not exact but order-of-magnitude usable for ratio computation.
  return 12 * h * h * l + 2 * h * v;
}

// =============================================================================
// Speedup estimation
// =============================================================================
//
// Speculative decoding theoretical maximum speedup:
//   S = 1 / ((1 - α^(K+1)) / (1 - α) × (T_d / T_t) + α^(K+1))
// where α = draft acceptance rate, K = lookahead, T_d/T_t = ratio of
// draft to target step time. For practical config (K=4-7, α=0.6-0.8):
//   S ≈ 1 + α × (1 - param_ratio)
// up to a ceiling of ~3-4x. Anything beyond that is wishful.
//
// Without α measured in-domain, return a band: low (α=0.5), expected
// (α=0.7), high (α=0.85). Surfaces the uncertainty honestly.

function speedupBand(targetParams, draftParams) {
  if (!targetParams || !draftParams) return null;
  const ratio = draftParams / targetParams;
  if (ratio >= 1) {
    // Draft must be smaller; this is misuse.
    return { ratio, code: "draft_not_smaller" };
  }
  const compute = (alpha) => {
    const s = 1 + alpha * (1 - ratio);
    // Cap at empirical 3.5x ceiling — beyond that, the assumptions break.
    return Math.min(s, 3.5);
  };
  return {
    ratio,
    low:      Math.round(compute(0.50) * 100) / 100,
    expected: Math.round(compute(0.70) * 100) / 100,
    high:     Math.round(compute(0.85) * 100) / 100,
  };
}

// =============================================================================
// Public entry point — orchestrates fetch + compare + speedup
// =============================================================================

const COMPATIBLE_THRESHOLD = 0.999;        // 99.9% of sampled tokens map identically
const PARTIAL_THRESHOLD    = 0.95;          // >=95% but <99.9%

export async function checkCompatibility(targetId, draftId) {
  if (!targetId || !draftId) {
    return { code: "missing_input", params: { targetId, draftId }, errors: [] };
  }
  if (targetId.trim() === draftId.trim()) {
    return { code: "identical_models", params: { targetId, draftId }, errors: [] };
  }

  const [tTok, dTok, tCfg, dCfg] = await Promise.all([
    fetchTokenizer(targetId),
    fetchTokenizer(draftId),
    fetchConfig(targetId),
    fetchConfig(draftId),
  ]);

  const errors = [];
  if (!tTok.ok) errors.push({ side: "target", error: tTok.error, status: tTok.status });
  if (!dTok.ok) errors.push({ side: "draft",  error: dTok.error, status: dTok.status });
  if (!tTok.ok || !dTok.ok) {
    return { code: "fetch_failed", params: { targetId, draftId }, errors };
  }

  const cmp = compareVocabs(tTok.data, dTok.data);

  // Param ratio + speedup estimate
  const tParams = paramsFromConfig(tCfg.ok ? tCfg.data : null) || parseParamHint(targetId);
  const dParams = paramsFromConfig(dCfg.ok ? dCfg.data : null) || parseParamHint(draftId);
  const speedup = speedupBand(tParams, dParams);

  const sampledMatchRatio = cmp.sampled_total === 0
    ? 0
    : cmp.sampled_match_count / cmp.sampled_total;

  let code;
  if (!cmp.type_match) {
    code = "type_mismatch";
  } else if (!cmp.vocab_size_match) {
    code = "vocab_size_mismatch";
  } else if (sampledMatchRatio >= COMPATIBLE_THRESHOLD) {
    code = cmp.special_tokens_diff.length || cmp.added_tokens_diff.length
      ? "compatible_with_caveats"
      : "compatible";
  } else if (sampledMatchRatio >= PARTIAL_THRESHOLD) {
    code = "partial_compatible";
  } else {
    code = "incompatible";
  }

  return {
    code,
    params: {
      targetId, draftId,
      ...cmp,
      sampled_match_ratio: Math.round(sampledMatchRatio * 10000) / 10000,
      target_params: tParams,
      draft_params: dParams,
      param_ratio: speedup?.ratio ?? null,
      speedup_low:      speedup?.low ?? null,
      speedup_expected: speedup?.expected ?? null,
      speedup_high:     speedup?.high ?? null,
      target_source: tTok.source,
      draft_source: dTok.source,
    },
    errors,
  };
}
