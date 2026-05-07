// Multilingual Tokenizer Tax Calculator (v0.8.7 anti-bullshit pack #13)
//
// Pain: "I bought 1M tokens of API credit for our English chatbot. Then
// we added Chinese support and the bill 3x'd overnight." The tokenizer
// tax is real and silently asymmetric across languages. tiktokenizer.
// vercel.app shows OpenAI's tokenizer; nothing public compares Llama vs
// Qwen vs Phi vs Gemma vs GPT for the SAME text in the SAME interface.
//
// This module loads HuggingFace's transformers.js (browser-side BPE
// runtime) lazily and tokenizes user-pasted text against a preset list
// of open-weight tokenizers. The output is REAL per-tokenizer token
// counts plus the cost asymmetry ratio (vs the user's chosen baseline).
//
// Pure logic + lazy CDN import. Codes/params only; main.js renders i18n.

// =============================================================================
// transformers.js lazy loader
// =============================================================================
//
// Pinned 3.x major because the API surface (AutoTokenizer.from_pretrained,
// .encode) is stable. Loaded from jsdelivr CDN — same pattern used
// across HF Spaces. ~3 MB compressed bundle, cached aggressively after
// first load.

const TRANSFORMERS_CDN_URL = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/dist/transformers.min.js";

let _autoTokenizer = null;
let _loadPromise = null;

async function loadTransformersJs() {
  if (_autoTokenizer) return _autoTokenizer;
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    const mod = await import(TRANSFORMERS_CDN_URL);
    _autoTokenizer = mod.AutoTokenizer;
    return _autoTokenizer;
  })();
  return _loadPromise;
}

// =============================================================================
// Per-tokenizer cache (avoid re-downloading tokenizer.json on every encode)
// =============================================================================

const _tokenizerCache = new Map();

async function loadTokenizer(modelId) {
  if (_tokenizerCache.has(modelId)) return _tokenizerCache.get(modelId);
  const AT = await loadTransformersJs();
  const tok = await AT.from_pretrained(modelId);
  _tokenizerCache.set(modelId, tok);
  return tok;
}

// =============================================================================
// Public: tokenize one model
// =============================================================================

export async function tokenizeWithModel(modelId, text) {
  if (typeof text !== "string") {
    return { ok: false, modelId, error: "invalid_input" };
  }
  try {
    const tok = await loadTokenizer(modelId);
    // transformers.js returns Int32Array | number[]. Use .length for count.
    const ids = await tok.encode(text);
    return { ok: true, modelId, token_count: ids.length };
  } catch (e) {
    return {
      ok: false,
      modelId,
      error: classifyTokenizerError(e),
      raw: String(e?.message || e).slice(0, 200),
    };
  }
}

function classifyTokenizerError(e) {
  const msg = String(e?.message || e).toLowerCase();
  if (msg.includes("401") || msg.includes("403") || msg.includes("gated")) return "gated";
  if (msg.includes("404") || msg.includes("not found")) return "not_found";
  if (msg.includes("timeout") || msg.includes("aborted")) return "timeout";
  if (msg.includes("network") || msg.includes("failed to fetch")) return "network";
  return "fetch_failed";
}

// =============================================================================
// Public: tokenize many models in parallel + compute ratios
// =============================================================================

export async function tokenizeAll(modelIds, text, baseline_idx = 0) {
  if (!Array.isArray(modelIds) || modelIds.length === 0 || typeof text !== "string") {
    return { code: "empty_input", results: [], baseline: null };
  }
  const results = await Promise.all(
    modelIds.map(id => tokenizeWithModel(id, text))
  );
  const okResults = results.filter(r => r.ok);
  if (okResults.length === 0) {
    return { code: "all_failed", results, baseline: null };
  }
  // Baseline: first OK tokenizer, or the user-specified index if it's OK.
  let baseline = okResults[0];
  if (baseline_idx >= 0 && baseline_idx < results.length && results[baseline_idx].ok) {
    baseline = results[baseline_idx];
  }
  // Stamp ratio vs baseline + chars-per-token for each.
  const charCount = text.length;
  const byteCount = new TextEncoder().encode(text).length;
  for (const r of results) {
    if (!r.ok) continue;
    r.chars_per_token = r.token_count > 0 ? charCount / r.token_count : null;
    r.bytes_per_token = r.token_count > 0 ? byteCount / r.token_count : null;
    r.ratio_vs_baseline = baseline.token_count > 0
      ? r.token_count / baseline.token_count
      : null;
  }
  return {
    code: "ok",
    results,
    baseline_id: baseline.modelId,
    baseline_count: baseline.token_count,
    chars: charCount,
    bytes: byteCount,
  };
}

// =============================================================================
// Language detection — Unicode block analysis (no external deps)
// =============================================================================
//
// Surfaced as context next to the token counts so users see "this text
// is 60% CJK, 40% Latin" — explains why one tokenizer is 3× another.

const UNICODE_BLOCKS = [
  // [name, regex_class]
  ["latin",      /[A-z]/g],
  ["cjk",        /[぀-ゟ゠-ヿ一-鿿ｦ-ﾝ]/g],
  ["korean",     /[가-힯ᄀ-ᇿ]/g],
  ["arabic",     /[؀-ۿݐ-ݿ]/g],
  ["cyrillic",   /[Ѐ-ӿ]/g],
  ["devanagari", /[ऀ-ॿ]/g],
  ["thai",       /[฀-๿]/g],
  ["greek",      /[Ͱ-Ͽ]/g],
  ["hebrew",     /[֐-׿]/g],
];

export function detectLanguageBlocks(text) {
  if (typeof text !== "string" || !text) {
    return { total_chars: 0, blocks: {}, dominant: null };
  }
  const blocks = {};
  for (const [name, re] of UNICODE_BLOCKS) {
    re.lastIndex = 0;
    const m = text.match(re);
    blocks[name] = m ? m.length : 0;
  }
  const total = text.length;
  const dominant = Object.entries(blocks)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return { total_chars: total, blocks, dominant };
}

// =============================================================================
// Preset tokenizer list — all open-weight (no HF auth required)
// =============================================================================
//
// Curated for breadth: one per major tokenizer family. For gated
// originals (Llama, Mistral, Gemma) the unsloth open-mirror is used —
// tokenizer.json is byte-identical to the original because quantization
// touches weights, not tokens (see spec-decode docs for the same
// argument).

export const PRESET_TOKENIZERS = [
  {
    id: "Qwen/Qwen2.5-7B-Instruct",
    label: "Qwen2.5",
    family: "Qwen-BPE (152k vocab, CJK-aware)",
  },
  {
    id: "microsoft/Phi-3.5-mini-instruct",
    label: "Phi-3.5",
    family: "tiktoken-style BPE (32k)",
  },
  {
    id: "unsloth/Meta-Llama-3.1-8B-Instruct",
    label: "Llama-3.1",
    family: "Llama-3 BPE (128k)",
  },
  {
    id: "unsloth/gemma-2-9b-it",
    label: "Gemma-2",
    family: "SentencePiece (256k)",
  },
  {
    id: "Xenova/gpt-4",
    label: "GPT-4 (cl100k)",
    family: "OpenAI tiktoken cl100k_base",
  },
  {
    id: "Xenova/claude-tokenizer",
    label: "Claude (approx)",
    family: "Anthropic open approx (community port)",
  },
];

// Sample texts that demonstrate cost asymmetry — identical meaning
// across languages so the user sees per-language tax directly.
export const SAMPLE_TEXTS = {
  english: "The quick brown fox jumps over the lazy dog. " +
    "She sells seashells by the seashore. Pack my box with five dozen liquor jugs.",
  chinese: "敏捷的棕色狐狸跳过了懒狗。她在海边卖海贝壳。请用五打酒壶装满我的箱子。" +
    "中文用字符表示词义,所以一段文字所需的字符数远少于英文。",
  arabic: "الثعلب البني السريع يقفز فوق الكلب الكسول. " +
    "تبيع أصدافًا بحرية على شاطئ البحر. عبئ صندوقي بخمسين إبريقًا من الخمر.",
  mixed: "Hello world! 你好世界 مرحبا بالعالم Привет мир नमस्ते दुनिया",
  code: "def quick_brown_fox(jumps_over: int) -> str:\n" +
    "    return f'The fox jumped {jumps_over} times'\n\n" +
    "for i in range(10):\n    print(quick_brown_fox(i))",
};
