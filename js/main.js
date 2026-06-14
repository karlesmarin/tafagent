// TAF Agent — main orchestration (v0.2 — i18n + Profile + Compare)
//
// Phases:
//  1. Pyodide loads + TAF formulas      → deterministic computation
//  2. WebLLM loads on demand            → plain-English synthesis
//  3. Router (LLM)                      → free-form question → recipe + params
//  4. Modes: Profile (all recipes) + Compare (multi-model side-by-side)
//  5. i18n: EN/ES/FR/ZH

import { initI18n, setLang, t } from "./i18n.js";
import { initPhaseDiagram } from "./phase_diagram.js";
import { gammaCheckAll, REGIME_META } from "./gamma_check.js";
import { loadLeanManifest, badgeHtml, badgesForUiBinding, renderTheoremTable, getManifest } from "./lean_badges.js";
import { unmaskConfig } from "./swa_unmasker.js";
import { classifyMemory, compressionPressure, CLASS_LIGHT } from "./memory_reality.js";
import { computeConfidence } from "./confidence.js";
import { normalizeMeasured, predictionVsReality, confidenceFromMeasured, contributionRecord, gammaPade as pvrGammaPade } from "./prediction_reality.js";
import { sniffChatTemplate } from "./chat_template_sniffer.js";
import { parseVotesCSV, computeArenaCI, SAMPLE_VOTES_CSV } from "./arena_ci.js";
import { rateAllBenchmarks, BENCHMARK_DB } from "./contamination_prior.js";
import { predictQuantShift, predictAllSchemes, QUANT_SCHEMES } from "./quant_regime.js";
import { attachAllHfAutocompletes, attachHfAutocomplete } from "./hf_autocomplete.js";
import { computeDriftBound, FRAMEWORKS as DRIFT_FRAMEWORKS, DTYPES as DRIFT_DTYPES } from "./cross_drift.js";
import { predictNIAHReasoning, sweepContextLengths, loadRulerKB, calibrateNIAH, listRulerModels } from "./niah_reasoning.js";
import {
  loadSaturationKB, classifyAll, classifyBenchmark,
  listBenchmarks, attribution as saturationAttribution, tryFetchLive,
} from "./saturation_detector.js";
import {
  loadHub, listCategories, listEntries, searchEntries,
  hubStats, getCategoryMeta,
} from "./solutions_hub.js";
import { lintJsonCot, reorderJsonText, classifyFieldName } from "./json_cot_linter.js";
import { lintPeftCode, ARCH_TARGET_MODULES } from "./peft_anti_pattern.js";
import { diffPromptCache, PROVIDERS as CACHE_PROVIDERS } from "./prompt_cache_diff.js";
import { checkCompatibility as specCheckCompat, parseParamHint } from "./spec_decode_compat.js";
import {
  tokenizeAll, detectLanguageBlocks,
  PRESET_TOKENIZERS as TAX_PRESETS, SAMPLE_TEXTS as TAX_SAMPLES,
} from "./tokenizer_tax.js";
import {
  loadKB as loadLongscoreKB, lookup as longscoreLookup, rank as longscoreRank,
} from "./longscore.js";
import { planExtension, suggestRopeType } from "./yarn_planner.js";
import { listGgufFiles, fetchGgufMetadata, ggufToConfig, quantFromFilename, analyzeGguf } from "./gguf_bridge.js";
import { GPU_PRESETS, QUANT_BPW, planLaunch, launchCommands } from "./launch_flags.js";

// Attach HF Hub search-as-you-type to all 5 model id inputs (Profile, Recipe,
// Unmask, Template, Quant). Hits public huggingface.co/api/models. Idempotent.
attachAllHfAutocompletes();

const TAF_BROWSER_URL = "python/taf_browser.py";
const ENABLE_WEBLLM = true;
// Smaller model = fits in default browser quota (~350MB vs 700MB for Llama-1B)
const WEBLLM_MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";
const WEBLLM_FALLBACK = "SmolLM2-360M-Instruct-q4f16_1-MLC";

const $ = (id) => document.getElementById(id);

const state = {
  pyodide: null,
  webllm: null,
  presets: [],
  recipes: [],
  recipesById: {},
  currentMode: "ask",
  currentRecipe: null,
};

const EXAMPLES = [
  "Will Meta-Llama-3-8B handle 32000-token NIAH retrieval reliably?",
  "I have $5000 to spend on training. What model can I afford?",
  "Should I use Mistral-7B-v0.1 at 16K context or extend it first?",
  "Compare cheapest GPU to serve Llama-3-8B at 10 million tokens per day.",
  "Should I use soft KV decay or hard cutoff for Qwen2.5-7B at 32K?",
  "Is it cheaper to train an 8B custom model or use GPT-4o for 50M tokens/month?",
];

// ════════════════════════════════════════════════════════════════════
// Bootstrap
// ════════════════════════════════════════════════════════════════════
function showLoadingBar(show, progress=null) {
  const wrap = $("loading-bar-wrap");
  const bar = $("loading-bar");
  if (!wrap || !bar) return;
  if (!show) { wrap.style.display = "none"; return; }
  wrap.style.display = "block";
  if (progress === null) {
    bar.classList.add("indeterminate");
    bar.style.width = "100%";
  } else {
    bar.classList.remove("indeterminate");
    bar.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
  }
}

async function loadPyodideAndTaf() {
  showLoadingBar(true, null);
  setStatus(t("status.loading_pyodide"));
  state.pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
  });
  showLoadingBar(true, 0.5);
  setStatus(t("status.loading_taf"));
  const tafCode = await fetch(TAF_BROWSER_URL).then(r => r.text());
  await state.pyodide.runPythonAsync(tafCode);

  state.presets = JSON.parse(state.pyodide.runPython("list_presets()"));
  state.recipes = JSON.parse(state.pyodide.runPython("list_recipes()"));
  state.recipesById = Object.fromEntries(state.recipes.map(r => [r.id, r]));

  showLoadingBar(true, 0.95);
  populatePresets();
  populateRecipes();
  enableUI();
  showLoadingBar(false);
  setStatus(t("status.ready"));
}

function populatePresets() {
  // Recipe form preset
  ["preset", "profile-preset"].forEach(id => {
    const sel = $(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">— select to autofill —</option>';
    state.presets.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.label}  (θ=${p.theta.toLocaleString()}, T_train=${p.T_train})`;
      sel.appendChild(opt);
    });
  });
  // Compare slot presets
  document.querySelectorAll(".compare-preset").forEach(sel => {
    sel.innerHTML = '<option value="">— or preset —</option>';
    state.presets.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.label;
      sel.appendChild(opt);
    });
  });
}

function populateRecipes() {
  ["recipe-select", "compare-recipe"].forEach(id => {
    const sel = $(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">— select a recipe —</option>';
    state.recipes.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.id} — ${r.name}`;
      sel.appendChild(opt);
    });
  });
}

function enableUI() {
  $("ask-btn").disabled = false;
  $("recipe-select").disabled = false;
  $("preset").disabled = false;
  $("profile-preset").disabled = false;
  $("profile-btn").disabled = false;
  $("compare-recipe").disabled = false;
  $("compare-btn").disabled = false;
  $("inspector-btn").disabled = false;
  // Restore from URL if present
  parseUrlState();
}

function setStatus(msg) { $("status").textContent = msg; }

// ════════════════════════════════════════════════════════════════════
// Main-panel wrap: every <main> section gets a foldable details/summary
// shell at runtime so users can collapse any panel they don't need open.
// h2 is moved INTO summary so its data-i18n binding survives. Idempotent.
// ════════════════════════════════════════════════════════════════════
function wrapMainSectionsAsFoldable() {
  document.querySelectorAll("main > section").forEach(section => {
    if (section.id === "status-bar") return;                     // skip loading bar
    if (section.querySelector(":scope > details.main-panel")) return; // already wrapped
    const h2 = section.querySelector(":scope > h2");
    if (!h2) return;

    const details = document.createElement("details");
    details.className = "main-panel";
    details.open = true;

    const summary = document.createElement("summary");
    summary.className = "main-panel-title";
    summary.appendChild(h2);  // preserve h2 + its data-i18n + all children

    details.appendChild(summary);
    while (section.firstChild) details.appendChild(section.firstChild);
    section.appendChild(details);
  });

  // Stop ⓘ tooltip clicks inside summaries from toggling the panel.
  document.querySelectorAll(".main-panel > .main-panel-title .info").forEach(el => {
    el.addEventListener("click", (e) => e.stopPropagation());
  });
}
wrapMainSectionsAsFoldable();

// v0.7.7 — task-tiles is the primary entry point; collapse the legacy 14-tab
// strip by default so users don't see duplicated navigation. Power users can
// still expand it with one click.
const __modeDetails = document.querySelector("#mode-section > details.main-panel");
if (__modeDetails) __modeDetails.open = false;

// ════════════════════════════════════════════════════════════════════
// Mode toggle
// ════════════════════════════════════════════════════════════════════
// v0.7.7 — task tiles: clicking a tile-mode-link button triggers the equivalent mode-btn.
// Reuses the mode switcher entirely (no duplicate state). Smoothly scrolls to the
// activated section so the user immediately sees the form they expected.
document.addEventListener("click", (e) => {
  const linkBtn = e.target.closest("[data-mode-link]");
  if (!linkBtn) return;
  const targetMode = linkBtn.dataset.modeLink;
  const targetTab = document.querySelector(`.mode-btn[data-mode="${targetMode}"]`);
  if (targetTab) {
    targetTab.click();
    // Scroll the activated section into view so the tile click feels responsive.
    const sectionId = {
      ask: "ask-section", recipe: "recipe-section", profile: "profile-section",
      compare: "compare-section", inspector: "inspector-section",
      diagnose: "diagnose-section", phase: "phase-section", unmask: "unmask-section",
      memreal: "memreal-section", pvr: "pvr-section",
      template: "template-section", arena: "arena-section", contam: "contam-section",
      quant: "quant-section", drift: "drift-section", niah: "niah-section",
      saturation: "saturation-section",
      cot: "cot-section",
      peft: "peft-section",
      cache: "cache-section",
      speculative: "speculative-section",
      tax: "tax-section",
      longscore: "longscore-section",
      hub: "hub-section",
      yarn: "yarn-section",
      gguf: "gguf-section",
      launch: "launch-section",
    }[targetMode];
    if (sectionId) {
      const sec = document.getElementById(sectionId);
      if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
});

document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach(b => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    const mode = btn.dataset.mode;
    state.currentMode = mode;
    // Hide all mode sections
    ["ask-section", "recipe-section", "form-section",
     "profile-section", "compare-section", "inspector-section",
     "diagnose-section", "phase-section", "unmask-section", "memreal-section", "pvr-section",
     "template-section", "arena-section", "contam-section",
     "quant-section", "drift-section", "niah-section",
     "saturation-section", "cot-section", "peft-section", "cache-section", "speculative-section", "tax-section", "longscore-section", "hub-section", "yarn-section", "gguf-section", "launch-section"].forEach(id => {
      const el = $(id);
      if (el) el.style.display = "none";
    });
    // Show selected
    const sectionMap = {
      ask: "ask-section", recipe: "recipe-section", profile: "profile-section",
      compare: "compare-section", inspector: "inspector-section",
      diagnose: "diagnose-section", phase: "phase-section", unmask: "unmask-section",
      memreal: "memreal-section", pvr: "pvr-section",
      template: "template-section", arena: "arena-section", contam: "contam-section",
      quant: "quant-section", drift: "drift-section", niah: "niah-section",
      saturation: "saturation-section",
      cot: "cot-section",
      peft: "peft-section",
      cache: "cache-section",
      speculative: "speculative-section",
      tax: "tax-section",
      longscore: "longscore-section",
      hub: "hub-section",
      yarn: "yarn-section",
      gguf: "gguf-section",
      launch: "launch-section",
    };
    const sectionId = sectionMap[mode];
    if (sectionId) $(sectionId).style.display = "";
    $("mode-desc").textContent = t(`mode_desc.${mode}`) || "";
    if (mode === "phase") initPhaseDiagram();
    if (mode === "saturation") initSaturation();
    if (mode === "cot") initCot();
    if (mode === "peft") initPeft();
    if (mode === "cache") initCacheDiff();
    if (mode === "speculative") initSpeculative();
    if (mode === "tax") initTax();
    if (mode === "longscore") initLongscore();
    if (mode === "hub") initHub();
    if (mode === "yarn") initYarn();
    if (mode === "gguf") initGguf();
    if (mode === "launch") initLaunch();
    // Re-scan: any model-id input rendered lazily by an init() above now gets the
    // autocomplete dropdown too. Idempotent (WeakSet) — already-attached inputs are skipped.
    attachAllHfAutocompletes();
  });
});

// ════════════════════════════════════════════════════════════════════
// Diagnose mode: build the diagnose_model.py CLI command
// ════════════════════════════════════════════════════════════════════
function buildDiagnoseCommand() {
  const model = ($("diag-model")?.value || "").trim();
  if (!model) {
    return "# Please enter a HuggingFace model id";
  }
  const theta = ($("diag-theta")?.value || "").trim();
  const N = ($("diag-N")?.value || "2000").trim();
  const local = ($("diag-local")?.value || "").trim();
  const fast = $("diag-fast")?.checked;
  const cpu = $("diag-cpu")?.checked;
  const fourbit = $("diag-4bit")?.checked;

  const parts = ["python cli/diagnose_model.py"];
  parts.push(`--model ${model}`);
  if (theta) parts.push(`--theta ${theta}`);
  if (N && N !== "2000") parts.push(`--N ${N}`);
  if (local) parts.push(`--local "${local}"`);
  if (fast) parts.push("--fast");
  if (cpu) parts.push("--cpu");
  if (fourbit) parts.push("--load_in_4bit");
  return parts.join(" \\\n  ");
}

const _diagBuildBtn = $("diag-build-btn");
if (_diagBuildBtn) {
  _diagBuildBtn.addEventListener("click", () => {
    const cmd = buildDiagnoseCommand();
    $("diag-cmd").textContent = cmd;
    $("diag-output").style.display = "";
  });
}

const _diagCopyBtn = $("diag-copy-btn");
if (_diagCopyBtn) {
  _diagCopyBtn.addEventListener("click", async () => {
    const cmd = $("diag-cmd").textContent;
    if (!cmd) return;
    try {
      await navigator.clipboard.writeText(cmd);
      _diagCopyBtn.textContent = "✓ Copied";
      setTimeout(() => {
        _diagCopyBtn.textContent = (window.t ? window.t("diagnose.copy_btn") : "📋 Copy to clipboard");
      }, 1800);
    } catch (e) {
      _diagCopyBtn.textContent = "✗ Copy failed (browser blocks)";
    }
  });
}

// Make sure inspector section is hidden initially
const _inspectorSection = $("inspector-section");
if (_inspectorSection) _inspectorSection.style.display = "none";

// ════════════════════════════════════════════════════════════════════
// Recipe selector
// ════════════════════════════════════════════════════════════════════
$("recipe-select").addEventListener("change", (e) => {
  const rid = e.target.value;
  if (!rid) {
    $("form-section").style.display = "none";
    return;
  }
  const r = state.recipesById[rid];
  state.currentRecipe = r;
  $("recipe-desc-display").textContent = r.description;
  $("form-section").style.display = "";
  buildDynamicForm(r);
});

function buildDynamicForm(recipe) {
  const container = $("dynamic-form");
  container.innerHTML = "";
  const defaults = getRecipeDefaults(recipe.id);
  recipe.params.forEach(name => {
    const div = document.createElement("div");
    div.className = "form-field";

    const labelWrap = document.createElement("label");
    labelWrap.htmlFor = `param_${name}`;
    labelWrap.innerHTML = paramLabel(name);
    if (PARAM_TOOLTIPS[name]) {
      const info = document.createElement("span");
      info.className = "info";
      info.innerHTML = `<span class="tooltip">${PARAM_TOOLTIPS[name]}</span>`;
      labelWrap.appendChild(info);
    }
    div.appendChild(labelWrap);

    const input = document.createElement("input");
    input.type = "text";
    input.id = `param_${name}`;
    input.dataset.param = name;
    input.value = defaults[name] !== undefined ? String(defaults[name]) : "";
    div.appendChild(input);
    container.appendChild(div);
  });
  $("run-btn").disabled = false;
}

function paramLabel(name) {
  const labels = {
    theta: "θ (rope_theta)", T_train: "T_train", T_eval: "T_eval (target context)",
    n_attention_heads: "num_attention_heads", n_kv_heads: "num_key_value_heads",
    d_head: "head_dim", n_layers: "num_hidden_layers", n_params: "n_params (e.g. 8e9)",
    has_SWA: "Has SWA? (true/false)",
    N_params: "N_params (e.g. 8e9)", D_tokens: "D_tokens (or empty for Chinchilla)",
    gpu: "GPU", n_gpus: "n_gpus", mfu: "MFU (default 0.45)",
    api_model: "API model to compare", monthly_tokens_M: "Monthly tokens (M)",
    USD_budget: "USD budget", bytes_per_weight: "Bytes per weight (BF16=2)",
    target_tokens_per_day: "Target tokens/day", concurrent_users: "Concurrent users",
  };
  return labels[name] || name;
}

const PARAM_TOOLTIPS = {
  theta: "<strong>RoPE base frequency</strong>. From <code>config.rope_theta</code>. Higher = more long-range capacity. Typical: <code>10000</code> early models, <code>500000</code> Llama-3, <code>1000000</code> Qwen2.5.",
  T_train: "<strong>Max context the model was trained on</strong>. From <code>max_position_embeddings</code>. The model has never seen positions beyond this; extrapolating much further usually fails.",
  T_eval: "<strong>Your target inference context length</strong>. The key knob. The whole question is: will the model behave well at <em>this</em> length?",
  n_attention_heads: "Number of query heads. From <code>num_attention_heads</code>.",
  n_kv_heads: "Number of K/V heads. If &lt; n_attention_heads → model uses GQA (Grouped Query Attention). Smaller = more memory-efficient KV cache but pushes γ toward Hagedorn boundary.",
  d_head: "Per-head dimension. Typically <code>hidden_size / n_attention_heads</code>. Common: 64, 80, 128.",
  n_layers: "Number of transformer layers. From <code>num_hidden_layers</code>.",
  n_params: "<strong>Total parameter count</strong>. Use scientific notation: <code>8e9</code> for 8B. Threshold ~400M is the induction-head emergence boundary (sign-flip in Δγ).",
  has_SWA: "Sliding Window Attention. <code>true</code> for Mistral, gemma-2, phi-3. SWA lowers γ_decomposition by ~0.21.",
  N_params: "Same as n_params. Total parameter count, scientific notation (e.g. <code>8e9</code>).",
  D_tokens: "Number of training tokens. Leave empty to use Chinchilla 20:1 default (D = 20·N).",
  gpu: "GPU model from the catalog. Options: H100 SXM, H100 PCIe, H200, B200, A100 80GB, A100 40GB, L40S, MI300X, RTX 4090, RTX 5090, RTX 5060Ti.",
  n_gpus: "Number of GPUs in your training/serving cluster.",
  mfu: "<strong>Model FLOPs Utilization</strong>. Realistic fraction of peak FLOPs achieved. Typical: 0.4-0.5 for well-tuned. Default 0.45.",
  api_model: "Frontier API to compare against. Options: GPT-4o, GPT-4o-mini, Claude-Opus-4, Claude-Sonnet-4, Claude-Haiku-4, Gemini-1.5-Pro, DeepSeek-V3, Llama-3.3-70B (Together).",
  monthly_tokens_M: "Expected monthly token volume <em>in millions</em>. e.g. <code>10</code> = 10 million tokens/month.",
  USD_budget: "Your training budget in US dollars (no symbol). e.g. <code>5000</code> for $5K.",
  bytes_per_weight: "Memory per parameter. BF16/FP16 = 2, INT8 = 1, INT4 = 0.5.",
  target_tokens_per_day: "How many tokens/day you need to serve. e.g. <code>10000000</code> = 10M tokens/day.",
  concurrent_users: "Simultaneous concurrent requests. Affects KV cache memory needed.",
};

function getRecipeDefaults(recipeId) {
  const D = {
    "X-1": { N_params: "8e9", D_tokens: "", gpu: "H100 SXM", n_gpus: 8, mfu: 0.45,
             api_model: "GPT-4o", monthly_tokens_M: 10.0 },
    "X-2": { theta: 500000, T_train: 8192, T_eval: 32000,
             n_attention_heads: 32, n_kv_heads: 8, d_head: 128,
             n_layers: 32, n_params: "8e9", has_SWA: false },
    "X-3": { USD_budget: 5000, gpu: "H100 SXM", mfu: 0.45, n_gpus: 1 },
    "X-5": { N_params: "8e9", T_eval: 4096, n_layers: 32, n_kv_heads: 8, d_head: 128,
             bytes_per_weight: 2.0, target_tokens_per_day: 10000000, concurrent_users: 1 },
    "X-19": { theta: 500000, T_train: 8192, T_eval: 8192,
              n_attention_heads: 32, n_kv_heads: 8, d_head: 128,
              n_layers: 32, n_params: "8e9", has_SWA: false },
  };
  return D[recipeId] || {};
}

// ════════════════════════════════════════════════════════════════════
// Preset autofill (works in recipe mode)
// ════════════════════════════════════════════════════════════════════
$("preset").addEventListener("change", (e) => {
  if (!e.target.value) return;
  const modelId = e.target.value;
  state.lastModelId = modelId;  // remember for filename/hash
  // Mirror behavior with profile-preset: also fill HF id input if present.
  if ($("hf-id")) {
    $("hf-id").value = modelId;
    if ($("hf-status")) $("hf-status").textContent = tFmt("profile.preset_loaded", { id: modelId });
  }
  const proxy = state.pyodide.runPython(`get_preset(${JSON.stringify(modelId)})`);
  const preset = proxy.toJs ? proxy.toJs({ dict_converter: Object.fromEntries }) : proxy;
  if (!preset || Object.keys(preset).length === 0) return;
  fillRecipeForm(preset);
});

function fillRecipeForm(p) {
  // Fill any matching field in dynamic form
  Object.entries(p).forEach(([k, v]) => {
    const map = {
      theta: "theta", T_train: "T_train",
      n_attention_heads: "n_attention_heads", n_kv_heads: "n_kv_heads",
      d_head: "d_head", n_layers: "n_layers", n_params: "n_params",
      has_SWA: "has_SWA",
    };
    const formId = "param_" + (map[k] || k);
    const el = $(formId);
    if (el) el.value = (typeof v === "number" && (k === "n_params" || v > 1e6))
      ? v.toExponential(2) : String(v);
    // Also fill N_params for cost recipes
    if (k === "n_params") {
      const np = $("param_N_params");
      if (np) np.value = (typeof v === "number" ? v.toExponential(2) : String(v));
    }
  });
}

// ════════════════════════════════════════════════════════════════════
// HF Hub fetch (any model)
// ════════════════════════════════════════════════════════════════════
// Build the same unsloth mirror candidates used in spec-decode. Lets us
// fetch config.json for gated families (Llama / Mistral / Gemma) without
// requiring HF auth — the unsloth redistributions are public and ship the
// original config.json verbatim (they only quantize weights, not metadata).
function _hfMirrorCandidates(modelId) {
  const last = modelId.split("/").slice(-1)[0];
  if (!last) return [];
  const out = [
    `unsloth/${last}`,
    last.startsWith("Meta-") ? null : `unsloth/Meta-${last}`,
    `unsloth/${last}-bnb-4bit`,
    last.startsWith("Meta-") ? null : `unsloth/Meta-${last}-bnb-4bit`,
  ].filter(c => c && c !== modelId);
  // Dedupe in case last starts with Meta- already.
  return [...new Set(out)];
}

async function _tryConfigUrl(modelId) {
  // /resolve/main/ rather than /raw/main/ — same lesson as spec-decode:
  // /resolve follows LFS for large files (irrelevant for config.json which
  // is always small, but consistent & future-proof). CORS is granted on both.
  const url = `https://huggingface.co/${modelId}/resolve/main/config.json`;
  const resp = await fetch(url);
  if (!resp.ok) return { ok: false, status: resp.status };
  try {
    const j = await resp.json();
    return { ok: true, data: j };
  } catch (e) {
    return { ok: false, error: "parse_failed" };
  }
}

async function fetchHfConfig(modelId) {
  // 1. Try the user-pasted id directly.
  let r = await _tryConfigUrl(modelId);
  if (r.ok) return r.data;

  // 2. On 401/403, try open-mirror fallback (unsloth/...). On other
  //    errors (404/network/parse), surface as before — mirror won't help.
  if (r.status === 401 || r.status === 403) {
    for (const cand of _hfMirrorCandidates(modelId)) {
      const m = await _tryConfigUrl(cand);
      if (m.ok) {
        // Stamp the mirror id so callers can surface a "fetched via mirror"
        // hint if they want; backwards-compatible with code that ignores it.
        m.data.__via_mirror = cand;
        m.data.__mirror_of  = modelId;
        return m.data;
      }
    }
    const err = new Error(`🔒 ${modelId} is gated — accept license at https://huggingface.co/${modelId}`);
    err.code = "gated";
    err.modelId = modelId;
    throw err;
  }

  throw new Error(`HTTP ${r.status} — config.json not found at https://huggingface.co/${modelId}/resolve/main/config.json`);
}

$("hf-fetch-btn").addEventListener("click", async () => {
  const modelId = $("hf-id").value.trim();
  if (!modelId) {
    $("hf-status").textContent = "⚠ Enter a model id like 'Qwen/Qwen2.5-32B-Instruct'";
    return;
  }
  $("hf-status").textContent = `⏳ Fetching config.json from HF Hub for ${modelId}...`;
  $("hf-fetch-btn").disabled = true;
  state.lastModelId = modelId;  // remember for filename/hash
  try {
    const cfg = await fetchHfConfig(modelId);
    const preset = configToPreset(cfg, modelId);
    fillRecipeForm(preset);
    $("hf-status").innerHTML = `✅ Config loaded for <strong>${escapeHtml(modelId)}</strong> (family: ${preset._family}). Verify values, click Analyze.`;
  } catch (err) {
    $("hf-status").textContent = `❌ ${err.message}`;
  } finally {
    $("hf-fetch-btn").disabled = false;
  }
});

// ════════════════════════════════════════════════════════════════════
// 🪟 Unmask mode (v0.7.0 anti-bullshit pack #1)
// ════════════════════════════════════════════════════════════════════

// Tiny string-template helper: t(key) with {placeholder} substitution.
// Falls back to the raw key when the i18n entry is missing so dev sees the gap.
function tFmt(key, params = {}) {
  let s = t(key) || key;
  for (const [k, v] of Object.entries(params)) {
    const fmtVal = v === null || v === undefined ? "—"
      : (typeof v === "number" ? v.toLocaleString() : String(v));
    s = s.replace(new RegExp(`\\{${k}\\}`, "g"), fmtVal);
  }
  return s;
}

const VERDICT_COLOR = {
  honest:            "#3fb950",
  inflated:          "#f1c40f",
  severely_inflated: "#f85149",
  yarn_extended:     "#f1c40f",
  unknown:           "#8b949e",
};

function renderUnmaskCard(result, modelId = "") {
  const color = VERDICT_COLOR[result.verdict] || VERDICT_COLOR.unknown;
  const ratioPct = (result.ratio * 100).toFixed(1);
  const f = result.flags;
  const fmtN = (x) => x === null || x === undefined ? "—" : Number(x).toLocaleString();
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const verdictLabel = t(`unmask.verdict.${result.verdict}`) || result.verdict;
  const labelDeclared  = t("unmask.label.declared")  || "Declared context";
  const labelEffective = t("unmask.label.effective") || "Effective (estimate)";
  const labelRatio     = t("unmask.label.ratio")     || "Ratio";
  const sectionFlags   = t("unmask.section.flags")   || "Architecture flags";
  const sectionWarn    = t("unmask.section.warnings")|| "Warnings";
  const sectionReco    = t("unmask.section.reco")    || "Recommendation";

  // Architecture flags row labels
  const flagSwa     = t("unmask.flag.swa")     || "SWA";
  const flagRope    = t("unmask.flag.rope")    || "RoPE scaling";
  const flagGqa     = t("unmask.flag.gqa")     || "GQA";
  const flagLayers  = t("unmask.flag.layers")  || "Layers";
  const flagDhead   = t("unmask.flag.dhead")   || "d_head";
  const flagTheta   = t("unmask.flag.theta")   || "RoPE θ";
  const flagYes     = t("unmask.flag.yes")     || "yes";
  const flagNo      = t("unmask.flag.no")      || "no";

  const swaText = f.hasSWA
    ? `${flagYes} (window = ${fmtN(f.swaWindow)})`
    : flagNo;
  const ropeText = f.hasYaRN
    ? `${f.ropeScalingType} (factor = ${f.yarnFactor}, original = ${fmtN(f.yarnOriginal)})`
    : flagNo;
  const gqaText = f.hasGQA
    ? `${flagYes} (${f.n_kv_heads} kv / ${f.n_attn_heads} attn heads)`
    : (t("unmask.flag.full_mha") || "no (full MHA, {n} heads)").replace("{n}", f.n_attn_heads ?? "?");

  const warningsHtml = result.warnings.length
    ? `<details class="unmask-panel" open><summary class="unmask-panel-title">${sectionWarn}</summary><ul>${result.warnings.map(w =>
        `<li>${tFmt("unmask.warn." + w.code, w.params)}</li>`).join("")}</ul></details>`
    : "";

  const recoHtml = result.recoCode
    ? `<details class="unmask-panel" open><summary class="unmask-panel-title">${sectionReco}</summary><p class="unmask-reco">${tFmt("unmask.reco." + result.recoCode, result.recoParams)}</p></details>`
    : "";

  return `
    <div class="unmask-result">
      <div class="unmask-hero" style="border-color: ${color};">
        <div class="unmask-verdict" style="color: ${color};">${verdictLabel}</div>
        ${modelId ? `<div class="unmask-model"><code>${escapeHtml(modelId)}</code></div>` : ""}
        <div class="unmask-numbers">
          <div><span class="unmask-num-label">${labelDeclared}</span><span class="unmask-num-val">${fmtN(result.declaredContext)}</span></div>
          <div><span class="unmask-num-label">${labelEffective}</span><span class="unmask-num-val">${fmtN(result.effectiveContext)}</span></div>
          <div><span class="unmask-num-label">${labelRatio}</span><span class="unmask-num-val">${ratioPct}%</span></div>
        </div>
      </div>

      <div class="unmask-details">
        <details class="unmask-panel" open>
          <summary class="unmask-panel-title">${sectionFlags}</summary>
          <ul>
            <li><strong>${flagSwa}:</strong> ${swaText}</li>
            <li><strong>${flagRope}:</strong> ${ropeText}</li>
            <li><strong>${flagGqa}:</strong> ${gqaText}</li>
            <li><strong>${flagLayers}:</strong> ${fmtN(f.n_layers)} · <strong>${flagDhead}:</strong> ${fmtN(f.d_head)} · <strong>${flagTheta}:</strong> ${fmtN(f.rope_theta)}</li>
          </ul>
        </details>
        ${warningsHtml}
        ${recoHtml}
      </div>
    </div>
  `;
}

async function runUnmaskFromId() {
  const modelId = ($("unmask-id").value || "").trim();
  if (!modelId) {
    $("unmask-status").textContent = t("unmask.status.empty_id") || "⚠ Enter a model id.";
    return;
  }
  $("unmask-status").textContent = tFmt("unmask.status.fetching", { modelId });
  $("unmask-fetch-btn").disabled = true;
  try {
    const cfg = await fetchHfConfig(modelId);
    const result = unmaskConfig(cfg);
    $("unmask-output").innerHTML = renderUnmaskCard(result, modelId);
    const verdictLocalized = t(`unmask.verdict.${result.verdict}`) || result.verdict;
    $("unmask-status").textContent = tFmt("unmask.status.success", { modelId, verdict: verdictLocalized });
  } catch (err) {
    if (err.code === "gated") {
      $("unmask-status").innerHTML = `🔒 <strong>${escapeHtml(err.modelId)}</strong> ${t("hf_auto.gated_msg") || "is gated. Accept the license here:"} <a href="https://huggingface.co/${escapeHtml(err.modelId)}" target="_blank" rel="noopener">huggingface.co/${escapeHtml(err.modelId)}</a>`;
    } else {
      $("unmask-status").textContent = `❌ ${err.message}`;
    }
    $("unmask-output").innerHTML = "";
  } finally {
    $("unmask-fetch-btn").disabled = false;
  }
}

function runUnmaskFromPaste() {
  const raw = ($("unmask-paste").value || "").trim();
  if (!raw) {
    $("unmask-status").textContent = t("unmask.status.empty_paste") || "⚠ Paste a config.json first.";
    return;
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    $("unmask-status").textContent = tFmt("unmask.status.invalid_json", { error: e.message });
    return;
  }
  const result = unmaskConfig(cfg);
  const pastedLabel = t("unmask.pasted_label") || "(pasted config)";
  $("unmask-output").innerHTML = renderUnmaskCard(result, pastedLabel);
  const verdictLocalized = t(`unmask.verdict.${result.verdict}`) || result.verdict;
  $("unmask-status").textContent = tFmt("unmask.status.success_paste", { verdict: verdictLocalized });
}

$("unmask-fetch-btn")?.addEventListener("click", runUnmaskFromId);
$("unmask-paste-btn")?.addEventListener("click", runUnmaskFromPaste);
$("unmask-id")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); runUnmaskFromId(); }
});

// ════════════════════════════════════════════════════════════════════
// 🧠 Memory Reality Check (v0.9.x — architecture-aware long-context)
// ════════════════════════════════════════════════════════════════════

const MEMREAL_LIGHT_COLOR = {
  green: "#3fb950", yellow: "#f1c40f", orange: "#e67e22", red: "#f85149", gray: "#8b949e",
};
const MEMREAL_LIGHT_EMOJI = {
  green: "🟢", yellow: "🟡", orange: "🟠", red: "🔴", gray: "⚪",
};

function memrealTokens(n) {
  if (n == null) return "?";
  return n >= 1000 ? Math.round(n / 1000).toLocaleString() + "k" : String(n);
}

function renderMemRealCard(result, cfg, modelId = "") {
  const k = result.keySuffix;
  const color = MEMREAL_LIGHT_COLOR[result.light] || MEMREAL_LIGHT_COLOR.gray;
  const className = t("memreal.class." + k) || result.cls;
  const means = t("memreal.means." + k) || "";
  const fail = t("memreal.fail." + k) || "";
  const memConf = computeConfidence([
    { key: result.confidence === "low" ? "arch_exotic" : "arch_known",
      status: result.confidence === "high" ? "ok" : result.confidence === "medium" ? "warn" : "miss" },
    { key: "structural_only", status: "warn" },
  ]);

  const flags = [];
  if (result.moe) flags.push(tFmt("memreal.flag.moe", { experts: result.moe.experts, active: result.moe.active ?? "?" }));
  if (result.ghostWindow) flags.push(t("memreal.flag.ghost"));
  if (result.extended) flags.push(t("memreal.flag.extended"));
  if (result.claimedContext) flags.push(tFmt("memreal.flag.tokens",
    { ctx: memrealTokens(result.claimedContext), words: memrealTokens(Math.round(result.claimedContext * 0.75)) }));

  const fixedState = ["ssm", "rwkv", "linear", "ttt"].includes(k);
  const rows = [];
  rows.push([t("memreal.label.context"),
    result.claimedContext != null ? memrealTokens(result.claimedContext)
      : (fixedState ? t("memreal.val.unbounded") : "—")]);
  if (result.recallLayers != null) rows.push([t("memreal.label.recall"), `${result.recallLayers} / ${result.totalLayers ?? "?"}`]);
  if (result.stateSize != null) rows.push([t("memreal.label.state"), String(result.stateSize)]);
  if (result.window != null) rows.push([t("memreal.label.window"), memrealTokens(result.window)]);
  const press = compressionPressure(cfg, result);
  if (press) {
    const ref = press.refUsed ? " " + tFmt("memreal.pressure.atref", { ref: memrealTokens(press.refLen) }) : "";
    rows.push([t("memreal.label.pressure"), `~${Math.round(press.value).toLocaleString()}×${ref}`]);
  }
  rows.push([t("memreal.label.markers"), (result.markers || []).join(", ")]);

  const rowsHtml = rows.map(([l, v]) =>
    `<div><span class="unmask-num-label">${escapeHtml(l)}</span> <code>${escapeHtml(String(v))}</code></div>`).join("");
  const flagsHtml = flags.length
    ? `<details class="unmask-panel" open><summary class="unmask-panel-title">${t("memreal.sec.flags")}</summary><ul>${flags.map(f => `<li>${f}</li>`).join("")}</ul></details>`
    : "";

  return `
    <div class="unmask-result">
      <div class="unmask-hero" style="border-color:${color};">
        <div class="unmask-verdict" style="color:${color};">${MEMREAL_LIGHT_EMOJI[result.light] || ""} ${escapeHtml(className)}<span style="font-size:0.62em; font-weight:600; opacity:0.85;"> · ${escapeHtml(t("memreal.risk." + result.light) || "")}</span></div>
        ${modelId ? `<div class="unmask-model"><code>${escapeHtml(modelId)}</code></div>` : ""}
        <p style="margin:0.5em 0;"><strong>${t("memreal.sec.means")}:</strong> ${means}</p>
        <p style="margin:0.5em 0;"><strong>${t("memreal.sec.fail")}:</strong> ${fail}</p>
        ${confidenceHtml(memConf)}
      </div>
      <div class="unmask-details">
        ${flagsHtml}
        <details class="unmask-panel"><summary class="unmask-panel-title">${t("memreal.sec.details")}</summary>${rowsHtml}</details>
        <details class="unmask-panel"><summary class="unmask-panel-title">${t("memreal.sec.limits")}</summary><p>${t("memreal.limits")}</p></details>
      </div>
    </div>`;
}

async function runMemRealFromId() {
  const modelId = ($("memreal-id").value || "").trim();
  if (!modelId) { $("memreal-status").textContent = t("memreal.status.empty_id"); return; }
  $("memreal-status").textContent = tFmt("memreal.status.fetching", { modelId });
  $("memreal-fetch-btn").disabled = true;
  try {
    const cfg = await fetchHfConfig(modelId);
    const result = classifyMemory(cfg);
    $("memreal-output").innerHTML = renderMemRealCard(result, cfg, modelId);
    $("memreal-status").textContent = tFmt("memreal.status.success",
      { modelId, cls: t("memreal.class." + result.keySuffix) || result.cls });
  } catch (err) {
    if (err.code === "gated") {
      $("memreal-status").innerHTML = `🔒 <strong>${escapeHtml(err.modelId)}</strong> ${t("hf_auto.gated_msg") || "is gated."} <a href="https://huggingface.co/${escapeHtml(err.modelId)}" target="_blank" rel="noopener">huggingface.co/${escapeHtml(err.modelId)}</a>`;
    } else {
      $("memreal-status").textContent = `❌ ${err.message}`;
    }
    $("memreal-output").innerHTML = "";
  } finally {
    $("memreal-fetch-btn").disabled = false;
  }
}

function runMemRealFromPaste() {
  const raw = ($("memreal-paste").value || "").trim();
  if (!raw) { $("memreal-status").textContent = t("memreal.status.empty_paste"); return; }
  let cfg;
  try { cfg = JSON.parse(raw); }
  catch (e) { $("memreal-status").textContent = tFmt("memreal.status.invalid_json", { error: e.message }); return; }
  const result = classifyMemory(cfg);
  $("memreal-output").innerHTML = renderMemRealCard(result, cfg, t("memreal.pasted_label"));
  $("memreal-status").textContent = tFmt("memreal.status.success",
    { modelId: t("memreal.pasted_label"), cls: t("memreal.class." + result.keySuffix) || result.cls });
}

$("memreal-fetch-btn")?.addEventListener("click", runMemRealFromId);
$("memreal-paste-btn")?.addEventListener("click", runMemRealFromPaste);
$("memreal-id")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); runMemRealFromId(); }
});

// ════════════════════════════════════════════════════════════════════
// 📊 Prediction vs Reality + BYOD (v0.9.x — server-less, contributes to dataset)
// ════════════════════════════════════════════════════════════════════

function pvrNum(v) {
  if (v == null) return "—";
  return typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(v);
}

function renderPvrPrediction(modelId, theta, T) {
  const pred = pvrGammaPade(theta, T);
  return `<div class="unmask-result"><div class="unmask-hero">
      <div class="unmask-verdict" style="font-size:1.2rem;">📊 ${escapeHtml(modelId)}</div>
      <p style="margin:0.5em 0;">${tFmt("pvr.prediction_line", { gamma: pred.toFixed(3), theta: theta.toLocaleString(), T: memrealTokens(T) })}</p>
      <p class="recipe-desc">${escapeHtml(t("pvr.prediction_only") || "Paste a measurement below to compare predicted vs reality.")}</p>
    </div></div>`;
}

function renderPvrCard(measured, modelId, cfg) {
  const m = normalizeMeasured(measured) || measured;
  const rows = predictionVsReality(
    { theta: (cfg && cfg.rope_theta) ?? m.theta, T: (cfg && cfg.max_position_embeddings) ?? m.T }, m);
  if (!rows.length) {
    return `<div class="unmask-result"><div class="unmask-hero"><p>${escapeHtml(t("pvr.prediction_only") || "No comparable measurement found.")}</p></div></div>`;
  }
  const TH = `style="text-align:left; padding:3px 8px; border-bottom:1px solid rgba(128,128,128,0.35);"`;
  const TD = `style="padding:3px 8px; border-bottom:1px solid rgba(128,128,128,0.18);"`;
  const head = `<tr><th ${TH}>${t("pvr.col.metric")}</th><th ${TH}>${t("pvr.col.prediction")}</th><th ${TH}>${t("pvr.col.measured")}</th><th ${TH}>Δ</th><th ${TH}>${t("pvr.col.source")}</th></tr>`;
  const body = rows.map((r) => {
    const within = r.within == null ? "" : (r.within ? ` <span style="color:#3fb950">✓</span>` : ` <span style="color:#f85149">✗</span>`);
    const metric = t("pvr.metric." + r.metric) || r.metric;
    const dlt = r.delta == null ? "—" : (r.delta > 0 ? "+" : "") + r.delta.toFixed(3);
    return `<tr><td ${TD}>${escapeHtml(metric)}</td><td ${TD}>${pvrNum(r.predicted)}</td><td ${TD}>${pvrNum(r.measured)}${within}</td><td ${TD}>${dlt}</td><td ${TD}><code>${escapeHtml(r.source || "")}</code></td></tr>`;
  }).join("");
  const conf = computeConfidence(confidenceFromMeasured(m));
  const contrib = contributionRecord(modelId || m.model, m, cfg);
  const contribHtml = `
    <details class="unmask-panel" style="margin-top:0.6rem;">
      <summary class="unmask-panel-title">➕ ${escapeHtml(t("pvr.contribute_btn") || "Contribute this measurement")}</summary>
      <p class="recipe-desc" style="font-size:0.85em;">${escapeHtml(t("pvr.contribute.note") || contrib.note)}</p>
      <textarea readonly rows="6" style="width:100%; font-family:monospace; font-size:0.8em;">${escapeHtml(JSON.stringify(contrib.json, null, 2))}</textarea>
      <a href="${contrib.hfUrl}" target="_blank" rel="noopener" style="display:inline-block; margin-top:0.4em;">↗ ${escapeHtml(t("pvr.contribute.open") || "Open HF dataset discussion")}</a>
    </details>`;
  return `
    <div class="unmask-result">
      <div class="unmask-hero">
        <div class="unmask-verdict" style="font-size:1.2rem;">📊 ${escapeHtml(modelId || m.model || "")}</div>
        <table style="width:100%; border-collapse:collapse; margin-top:0.5em; font-size:0.9em;">${head}${body}</table>
      </div>
      <div class="unmask-details">
        ${confidenceHtml(conf)}
        ${contribHtml}
      </div>
    </div>`;
}

async function runPvrFromId() {
  const modelId = ($("pvr-id").value || "").trim();
  if (!modelId) { $("pvr-status").textContent = t("pvr.status.empty_id"); return; }
  $("pvr-status").textContent = tFmt("pvr.status.fetching", { modelId });
  $("pvr-fetch-btn").disabled = true;
  try {
    const cfg = await fetchHfConfig(modelId);
    const theta = cfg.rope_theta ?? null;
    const T = cfg.max_position_embeddings ?? null;
    if (theta && T) {
      $("pvr-output").innerHTML = renderPvrPrediction(modelId, theta, T);
      $("pvr-status").textContent = tFmt("pvr.status.predicted", { modelId });
    } else {
      $("pvr-output").innerHTML = "";
      $("pvr-status").textContent = t("pvr.status.no_geom");
    }
  } catch (err) {
    if (err.code === "gated") {
      $("pvr-status").innerHTML = `🔒 <strong>${escapeHtml(err.modelId)}</strong> <a href="https://huggingface.co/${escapeHtml(err.modelId)}" target="_blank" rel="noopener">huggingface.co/${escapeHtml(err.modelId)}</a>`;
    } else {
      $("pvr-status").textContent = `❌ ${err.message}`;
    }
    $("pvr-output").innerHTML = "";
  } finally {
    $("pvr-fetch-btn").disabled = false;
  }
}

function runPvrFromPaste() {
  const raw = ($("pvr-paste").value || "").trim();
  if (!raw) { $("pvr-status").textContent = t("pvr.status.empty_paste"); return; }
  let rec;
  try { rec = JSON.parse(raw); }
  catch (e) { $("pvr-status").textContent = tFmt("pvr.status.invalid_json", { error: e.message }); return; }
  const m = normalizeMeasured(rec);
  if (!m || m.gamma_obs == null) { $("pvr-status").textContent = t("pvr.status.no_measure"); return; }
  const modelId = m.model || ($("pvr-id").value || "").trim() || t("pvr.pasted_label");
  $("pvr-output").innerHTML = renderPvrCard(m, modelId, null);
  $("pvr-status").textContent = tFmt("pvr.status.done", { modelId });
}

$("pvr-fetch-btn")?.addEventListener("click", runPvrFromId);
$("pvr-paste-btn")?.addEventListener("click", runPvrFromPaste);
$("pvr-id")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); runPvrFromId(); }
});

// ════════════════════════════════════════════════════════════════════
// 📜 Chat-template Sniffer (v0.7.1 anti-bullshit pack #2)
// ════════════════════════════════════════════════════════════════════

const TEMPLATE_VERDICT_COLOR = {
  ok:          "#3fb950",
  custom:      "#f1c40f",
  missing:     "#f85149",
  base_model:  "#8b949e",
  unknown:     "#8b949e",
};

async function fetchHfTokenizerConfig(modelId) {
  const url = `https://huggingface.co/${modelId}/raw/main/tokenizer_config.json`;
  const resp = await fetch(url);
  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      const err = new Error(`🔒 ${modelId} is gated — accept license at https://huggingface.co/${modelId}`);
      err.code = "gated";
      err.modelId = modelId;
      throw err;
    }
    throw new Error(`HTTP ${resp.status} — tokenizer_config.json not found at ${url}`);
  }
  return await resp.json();
}

function renderTemplateCard(result, modelId = "") {
  const color = TEMPLATE_VERDICT_COLOR[result.verdict] || TEMPLATE_VERDICT_COLOR.unknown;
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const verdictLabel = t(`template.verdict.${result.verdict}`) || result.verdict;
  const labelFamily   = t("template.label.family")   || "Detected family";
  const labelMarkers  = t("template.label.markers")  || "Matched markers";
  const labelTplLen   = t("template.label.tpl_len")  || "Template length";
  const sectionWarn   = t("template.section.warnings") || "Warnings";
  const sectionCmd    = t("template.section.commands") || "Commands by framework";
  const sectionRaw    = t("template.section.raw")      || "Raw template (preview)";

  // Human-readable family name
  const familyName = result.detectedLabel
    ? result.detectedLabel
    : (result.detectedFamily === "custom" ? (t("template.family.custom") || "custom (unknown family)")
       : (t("template.family.none") || "(no chat_template)"));

  const warningsHtml = result.warnings.length
    ? `<details class="unmask-panel" open>
         <summary class="unmask-panel-title">${sectionWarn}</summary>
         <ul>${result.warnings.map(w => `<li>${tFmt("template.warn." + w.code, w.params)}</li>`).join("")}</ul>
       </details>`
    : "";

  // Framework commands — only show when we have a chat_template to apply.
  let cmdHtml = "";
  if (result.hasChatTemplate) {
    const lmEvalCmd = "lm_eval --model hf --model_args pretrained=" + (modelId || "MODEL_ID") +
      " --tasks gsm8k --apply_chat_template --batch_size 8";
    const vllmCmd = result.vllmTemplate
      ? `vllm serve ${modelId || "MODEL_ID"} --chat-template ${result.vllmTemplate}`
      : `vllm serve ${modelId || "MODEL_ID"}  # template auto-detected from tokenizer_config`;
    const transformersCmd =
      `from transformers import AutoTokenizer\n` +
      `tok = AutoTokenizer.from_pretrained("${modelId || "MODEL_ID"}")\n` +
      `prompt = tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)`;

    cmdHtml = `
      <details class="unmask-panel" open>
        <summary class="unmask-panel-title">${sectionCmd}</summary>
        <div class="template-cmd-block">
          <div class="template-cmd-label">lm-evaluation-harness</div>
          <pre class="template-cmd"><code>${escapeHtml(lmEvalCmd)}</code></pre>
          <div class="template-cmd-label">vLLM serve</div>
          <pre class="template-cmd"><code>${escapeHtml(vllmCmd)}</code></pre>
          <div class="template-cmd-label">transformers (Python)</div>
          <pre class="template-cmd"><code>${escapeHtml(transformersCmd)}</code></pre>
        </div>
      </details>
    `;
  }

  // Raw preview only when present
  const rawHtml = result.rawTemplate
    ? `<details class="unmask-panel">
         <summary class="unmask-panel-title">${sectionRaw}</summary>
         <pre class="template-cmd"><code>${escapeHtml(result.rawTemplate)}</code></pre>
       </details>`
    : "";

  return `
    <div class="unmask-result">
      <div class="unmask-hero" style="border-color: ${color};">
        <div class="unmask-verdict" style="color: ${color};">${verdictLabel}</div>
        ${modelId ? `<div class="unmask-model"><code>${escapeHtml(modelId)}</code></div>` : ""}
        <div class="unmask-numbers">
          <div><span class="unmask-num-label">${labelFamily}</span><span class="unmask-num-val">${escapeHtml(familyName)}</span></div>
          <div><span class="unmask-num-label">${labelMarkers}</span><span class="unmask-num-val">${result.matchedMarkers.length}</span></div>
          <div><span class="unmask-num-label">${labelTplLen}</span><span class="unmask-num-val">${result.rawTemplateLength.toLocaleString()}</span></div>
        </div>
      </div>

      <div class="unmask-details">
        ${warningsHtml}
        ${cmdHtml}
        ${rawHtml}
      </div>
    </div>
  `;
}

async function runTemplateFromId() {
  const modelId = ($("template-id").value || "").trim();
  if (!modelId) {
    $("template-status").textContent = t("template.status.empty_id") || "⚠ Enter a model id.";
    return;
  }
  $("template-status").textContent = tFmt("template.status.fetching", { modelId });
  $("template-fetch-btn").disabled = true;
  try {
    const cfg = await fetchHfTokenizerConfig(modelId);
    const result = sniffChatTemplate(cfg);
    $("template-output").innerHTML = renderTemplateCard(result, modelId);
    const verdictLocalized = t(`template.verdict.${result.verdict}`) || result.verdict;
    $("template-status").textContent = tFmt("template.status.success", { modelId, verdict: verdictLocalized });
  } catch (err) {
    if (err.code === "gated") {
      $("template-status").innerHTML = `🔒 <strong>${escapeHtml(err.modelId)}</strong> ${t("hf_auto.gated_msg") || "is gated. Accept the license here:"} <a href="https://huggingface.co/${escapeHtml(err.modelId)}" target="_blank" rel="noopener">huggingface.co/${escapeHtml(err.modelId)}</a>`;
    } else {
      $("template-status").textContent = `❌ ${err.message}`;
    }
    $("template-output").innerHTML = "";
  } finally {
    $("template-fetch-btn").disabled = false;
  }
}

function runTemplateFromPaste() {
  const raw = ($("template-paste").value || "").trim();
  if (!raw) {
    $("template-status").textContent = t("template.status.empty_paste") || "⚠ Paste a tokenizer_config.json first.";
    return;
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    $("template-status").textContent = tFmt("template.status.invalid_json", { error: e.message });
    return;
  }
  const result = sniffChatTemplate(cfg);
  const pastedLabel = t("template.pasted_label") || "(pasted config)";
  $("template-output").innerHTML = renderTemplateCard(result, pastedLabel);
  const verdictLocalized = t(`template.verdict.${result.verdict}`) || result.verdict;
  $("template-status").textContent = tFmt("template.status.success_paste", { verdict: verdictLocalized });
}

$("template-fetch-btn")?.addEventListener("click", runTemplateFromId);
$("template-paste-btn")?.addEventListener("click", runTemplateFromPaste);
$("template-id")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); runTemplateFromId(); }
});

// ════════════════════════════════════════════════════════════════════
// 🎯 Arena-Elo CI reconstructor (v0.7.2 anti-bullshit pack #3)
// ════════════════════════════════════════════════════════════════════

function renderArenaCard(result) {
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtN = (x) => x === null || x === undefined ? "—" : Number(x).toLocaleString();

  const titleRanked     = t("arena.section.ranked")     || "Ranked Elos with 95% CIs";
  const titleTies       = t("arena.section.ties")       || "Statistical ties (CI overlap)";
  const titleSummary    = t("arena.section.summary")    || "Summary";
  const colRank         = t("arena.col.rank")           || "#";
  const colModel        = t("arena.col.model")          || "Model";
  const colElo          = t("arena.col.elo")            || "Elo";
  const colCi           = t("arena.col.ci")             || "95% CI";
  const colSpread       = t("arena.col.ci_width")       || "CI width";
  const colMatches      = t("arena.col.matches")        || "Matches";
  const colWins         = t("arena.col.wins")           || "W / L / T";
  const noTies          = t("arena.no_ties")            || "No statistical ties — all pairs distinguishable at 95% CI.";

  // Ranked table
  let tableRows = "";
  for (const r of result.ratings) {
    tableRows += `<tr>
      <td class="arena-rank">#${r.rank}</td>
      <td class="arena-model"><code>${escapeHtml(r.model)}</code></td>
      <td class="arena-elo"><strong>${fmtN(r.elo)}</strong></td>
      <td class="arena-ci">[${fmtN(r.ci_low)}, ${fmtN(r.ci_high)}]</td>
      <td class="arena-spread">±${fmtN(Math.round(r.ci_width / 2 * 10) / 10)}</td>
      <td class="arena-matches">${fmtN(r.matches)}</td>
      <td class="arena-wlt">${fmtN(r.wins)} / ${fmtN(r.losses)} / ${fmtN(r.ties_count)}</td>
    </tr>`;
  }

  // Ties section
  let tiesHtml = "";
  if (result.ties.length === 0) {
    tiesHtml = `<p class="unmask-reco">${noTies}</p>`;
  } else {
    tiesHtml = `<table class="arena-ties-table">
      <thead><tr>
        <th>${t("arena.col.tie_pair") || "Pair"}</th>
        <th>${t("arena.col.tie_diff") || "Elo gap"}</th>
        <th>${t("arena.col.tie_overlap") || "CI overlap"}</th>
      </tr></thead><tbody>`;
    for (const tieEntry of result.ties) {
      tiesHtml += `<tr>
        <td>#${tieEntry.rank_a} <code>${escapeHtml(tieEntry.model_a)}</code> vs #${tieEntry.rank_b} <code>${escapeHtml(tieEntry.model_b)}</code></td>
        <td>${fmtN(Math.round(tieEntry.elo_diff * 10) / 10)} Elo</td>
        <td>${fmtN(Math.round(tieEntry.overlap_elo * 10) / 10)} Elo</td>
      </tr>`;
    }
    tiesHtml += `</tbody></table>`;
  }

  // Summary panel
  const s = result.summary;
  const summaryHtml = `
    <ul>
      <li><strong>${t("arena.summary.votes") || "Total votes"}:</strong> ${fmtN(s.total_votes)}</li>
      <li><strong>${t("arena.summary.models") || "Models"}:</strong> ${fmtN(s.n_models)}</li>
      <li><strong>${t("arena.summary.ties") || "Statistical ties"}:</strong> ${fmtN(s.n_ties)}</li>
      <li><strong>${t("arena.summary.bootstrap") || "Bootstrap iters"}:</strong> ${fmtN(s.bootstrap_iters)}</li>
      <li><strong>${t("arena.summary.ci_level") || "CI level"}:</strong> ${(s.ci_level * 100).toFixed(0)}%</li>
    </ul>
  `;

  return `
    <div class="arena-result">
      <details class="unmask-panel" open>
        <summary class="unmask-panel-title">${titleRanked}</summary>
        <div style="overflow-x:auto;">
          <table class="arena-table">
            <thead><tr>
              <th>${colRank}</th><th>${colModel}</th><th>${colElo}</th>
              <th>${colCi}</th><th>${colSpread}</th>
              <th>${colMatches}</th><th>${colWins}</th>
            </tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
      </details>
      <details class="unmask-panel" open>
        <summary class="unmask-panel-title">${titleTies} <span class="arena-tie-count">(${result.ties.length})</span></summary>
        ${tiesHtml}
      </details>
      <details class="unmask-panel">
        <summary class="unmask-panel-title">${titleSummary}</summary>
        ${summaryHtml}
      </details>
    </div>
  `;
}

function runArenaCompute() {
  const csv = ($("arena-csv").value || "").trim();
  if (!csv) {
    $("arena-status").textContent = t("arena.status.empty") || "⚠ Paste vote CSV or click Load sample.";
    return;
  }
  let votes;
  try {
    votes = parseVotesCSV(csv);
  } catch (e) {
    $("arena-status").textContent = `❌ ${e.message}`;
    return;
  }
  if (votes.length < 10) {
    $("arena-status").textContent = tFmt("arena.status.too_few", { n: votes.length });
    return;
  }
  $("arena-status").textContent = tFmt("arena.status.computing", { n: votes.length });
  // Defer to next tick so the status text actually paints before the heavy bootstrap.
  setTimeout(() => {
    const t0 = performance.now();
    const result = computeArenaCI(votes, { bootstrapN: 200, ciLevel: 0.95 });
    const ms = Math.round(performance.now() - t0);
    $("arena-output").innerHTML = renderArenaCard(result);
    $("arena-status").textContent = tFmt("arena.status.done", {
      n: votes.length, models: result.summary.n_models,
      ties: result.summary.n_ties, ms,
    });
  }, 30);
}

$("arena-sample-btn")?.addEventListener("click", () => {
  $("arena-csv").value = SAMPLE_VOTES_CSV;
  $("arena-status").textContent = t("arena.status.sample_loaded") || "✅ Sample loaded. Click Compute CIs.";
});
$("arena-run-btn")?.addEventListener("click", runArenaCompute);
$("arena-clear-btn")?.addEventListener("click", () => {
  $("arena-csv").value = "";
  $("arena-output").innerHTML = "";
  $("arena-status").textContent = "";
});

// ════════════════════════════════════════════════════════════════════
// 🧪 Contamination Prior (v0.7.3 anti-bullshit pack #4)
// ════════════════════════════════════════════════════════════════════

const CONTAM_LEVEL_COLOR = { high: "#f85149", medium: "#f1c40f", low: "#3fb950" };

function renderContamCard(rows, modelCutoff) {
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  const titleRanked  = t("contam.section.ranked")  || "Benchmark contamination risk (uncalibrated)";
  const titleHigh    = t("contam.section.high")    || "🔴 High-risk benchmarks (treat scores as unreliable)";
  const titleMed     = t("contam.section.medium")  || "🟡 Medium-risk (verify with alternates)";
  const titleLow     = t("contam.section.low")     || "🟢 Low-risk (likely clean)";
  const colBench     = t("contam.col.benchmark")   || "Benchmark";
  const colReleased  = t("contam.col.released")    || "Released";
  const colGap       = t("contam.col.gap")         || "Gap (months)";
  const colPrior     = t("contam.col.prior")       || "Risk (0–1)";
  const colLevel     = t("contam.col.level")       || "Level";
  const colCorpora   = t("contam.col.corpora")     || "In corpora";
  const colCategory  = t("contam.col.category")    || "Category";

  const high = rows.filter(r => r.level === "high");
  const medium = rows.filter(r => r.level === "medium");
  const low = rows.filter(r => r.level === "low");

  function tableFor(group) {
    if (group.length === 0) return `<p class="unmask-reco">${t("contam.no_entries") || "(none in this category)"}</p>`;
    let body = "";
    for (const r of group) {
      body += `<tr>
        <td><strong>${escapeHtml(r.benchmark)}</strong></td>
        <td>${escapeHtml(r.benchmark_released)}</td>
        <td class="arena-spread">${r.gap_months > 0 ? "+" : ""}${r.gap_months}</td>
        <td class="arena-elo" style="color: ${CONTAM_LEVEL_COLOR[r.level]};"><strong>${r.prior.toFixed(2)}</strong>${r.clamped ? '<span class="subtle" title="clamped at ceiling — not a literal probability">*</span>' : ''}</td>
        <td>${r.benchmark_in_corpora ? "✓" : "✗"}</td>
        <td class="arena-spread">${escapeHtml(r.benchmark_category)}</td>
      </tr>`;
    }
    return `<table class="arena-table">
      <thead><tr><th>${colBench}</th><th>${colReleased}</th><th>${colGap}</th><th>${colPrior}</th><th>${colCorpora}</th><th>${colCategory}</th></tr></thead>
      <tbody>${body}</tbody></table>`;
  }

  const adviceHigh   = t("contam.advice.high")   || "Treat these scores as unreliable. Replace with newer / private-test alternates (MMLU-Pro, GPQA, MUSR, MATH-500).";
  const adviceMedium = t("contam.advice.medium") || "Take with caution. Look for replication on a held-out subset or community reproductions.";
  const adviceLow    = t("contam.advice.low")    || "Score likely uncontaminated, but absence of leak is not proof — still cross-check with alternate test.";

  return `
    <div class="arena-result">
      <div class="unmask-hero" style="border-color: #58a6ff;">
        <div class="unmask-verdict" style="color: #58a6ff;">${tFmt("contam.summary.headline", { cutoff: modelCutoff, n: rows.length })}</div>
        <div class="unmask-numbers">
          <div><span class="unmask-num-label" style="color:${CONTAM_LEVEL_COLOR.high}">🔴 ${t("contam.label.high") || "High risk"}</span><span class="unmask-num-val">${high.length}</span></div>
          <div><span class="unmask-num-label" style="color:${CONTAM_LEVEL_COLOR.medium}">🟡 ${t("contam.label.medium") || "Medium"}</span><span class="unmask-num-val">${medium.length}</span></div>
          <div><span class="unmask-num-label" style="color:${CONTAM_LEVEL_COLOR.low}">🟢 ${t("contam.label.low") || "Low"}</span><span class="unmask-num-val">${low.length}</span></div>
        </div>
      </div>
      <div class="unmask-details">
        <details class="unmask-panel" open>
          <summary class="unmask-panel-title">${titleHigh} <span class="arena-tie-count">(${high.length})</span></summary>
          <p class="unmask-reco">${adviceHigh}</p>
          ${tableFor(high)}
        </details>
        <details class="unmask-panel" open>
          <summary class="unmask-panel-title">${titleMed} <span class="arena-tie-count">(${medium.length})</span></summary>
          <p class="unmask-reco">${adviceMedium}</p>
          ${tableFor(medium)}
        </details>
        <details class="unmask-panel">
          <summary class="unmask-panel-title">${titleLow} <span class="arena-tie-count">(${low.length})</span></summary>
          <p class="unmask-reco">${adviceLow}</p>
          ${tableFor(low)}
        </details>
      </div>
    </div>
  `;
}

function runContamCompute() {
  const cutoff = ($("contam-cutoff").value || "").trim();
  if (!cutoff) {
    $("contam-status").textContent = t("contam.status.empty") || "⚠ Enter a model training cutoff date (e.g. 2023-12).";
    return;
  }
  if (!/^\d{4}(-\d{1,2})?(-\d{1,2})?$/.test(cutoff)) {
    $("contam-status").textContent = t("contam.status.bad_date") || "⚠ Bad date format. Use YYYY-MM or YYYY-MM-DD.";
    return;
  }
  const rows = rateAllBenchmarks(cutoff);
  $("contam-output").innerHTML = renderContamCard(rows, cutoff);
  $("contam-status").textContent = tFmt("contam.status.done", {
    cutoff, n: rows.length,
    high: rows.filter(r => r.level === "high").length,
  });
}

$("contam-run-btn")?.addEventListener("click", runContamCompute);
$("contam-cutoff")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); runContamCompute(); }
});

// ════════════════════════════════════════════════════════════════════
// ⚖️ Quant-regime classifier (v0.7.3 anti-bullshit pack #5)
// ════════════════════════════════════════════════════════════════════

const QUANT_REGIME_COLOR = {
  safe:        "#3fb950",
  mild:        "#3fb950",
  significant: "#f1c40f",
  cliff:       "#f85149",
};

// Populate scheme dropdown from QUANT_SCHEMES on first render. Idempotent.
function populateQuantSchemes() {
  const sel = $("quant-scheme");
  if (!sel || sel.options.length > 1) return;
  for (const s of QUANT_SCHEMES) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    sel.appendChild(opt);
  }
}

// Cache config across "Fetch" + "Predict" / "Compare" actions on the same id.
let __quantLastConfig = null;
let __quantLastModelId = null;

async function quantFetchConfig() {
  const modelId = ($("quant-id").value || "").trim();
  if (!modelId) {
    $("quant-status").textContent = t("quant.status.empty_id") || "⚠ Enter a model id.";
    return null;
  }
  $("quant-status").textContent = tFmt("quant.status.fetching", { modelId });
  $("quant-fetch-btn").disabled = true;
  try {
    const cfg = await fetchHfConfig(modelId);
    __quantLastConfig = cfg;
    __quantLastModelId = modelId;
    $("quant-status").textContent = tFmt("quant.status.fetched", { modelId });
    return cfg;
  } catch (err) {
    if (err.code === "gated") {
      $("quant-status").innerHTML = `🔒 <strong>${escapeHtml(err.modelId)}</strong> ${t("hf_auto.gated_msg") || "is gated. Accept the license here:"} <a href="https://huggingface.co/${escapeHtml(err.modelId)}" target="_blank" rel="noopener">huggingface.co/${escapeHtml(err.modelId)}</a>`;
    } else {
      $("quant-status").textContent = `❌ ${err.message}`;
    }
    return null;
  } finally {
    $("quant-fetch-btn").disabled = false;
  }
}

function renderQuantSingle(result, modelId) {
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtN = (x) => x === null || x === undefined ? "—" : Number(x).toLocaleString();
  const color = QUANT_REGIME_COLOR[result.regime] || "#8b949e";
  const regimeLabel = t(`quant.regime.${result.regime}`) || result.regime;

  let recoHtml = "";
  if (result.recommend_code) {
    const recoText = result.recommend_scheme
      ? tFmt("quant.reco." + result.recommend_code, {
          scheme: QUANT_SCHEMES.find(s => s.id === result.recommend_scheme)?.label || result.recommend_scheme,
        })
      : (t("quant.reco." + result.recommend_code) || result.recommend_code);
    recoHtml = `<p class="unmask-reco">${recoText}</p>`;
  } else {
    recoHtml = `<p class="unmask-reco">${t("quant.reco.no_action") || "No action needed — quantization is safe for this architecture."}</p>`;
  }

  return `
    <div class="unmask-result">
      <div class="unmask-hero" style="border-color: ${color};">
        <div class="unmask-verdict" style="color: ${color};">${regimeLabel}</div>
        <div class="unmask-model"><code>${escapeHtml(modelId)}</code> + <code>${escapeHtml(result.scheme_label)}</code></div>
        <div class="unmask-numbers">
          <div><span class="unmask-num-label">${t("quant.label.gamma_shift") || "γ shift"}</span><span class="unmask-num-val">+${result.gamma_shift.toFixed(3)}</span></div>
          <div><span class="unmask-num-label">${t("quant.label.delta_ppl") || "ΔPPL (est.)"}</span><span class="unmask-num-val">+${result.delta_ppl.mid.toFixed(2)}</span></div>
          <div><span class="unmask-num-label">${t("quant.label.arch_mult") || "Arch multiplier"}</span><span class="unmask-num-val">×${result.arch_multiplier}</span></div>
        </div>
      </div>
      <div class="unmask-details">
        <details class="unmask-panel" open>
          <summary class="unmask-panel-title">${t("quant.section.breakdown") || "Breakdown"}</summary>
          <ul>
            <li><strong>${t("quant.field.scheme") || "Scheme"}:</strong> ${escapeHtml(result.scheme_label)} (${result.scheme_bits}-bit, ${result.scheme_calibrated ? (t("quant.field.calibrated") || "calibrated") : (t("quant.field.uncalibrated") || "uncalibrated")})</li>
            <li><strong>${t("quant.field.base_penalty") || "Base penalty"}:</strong> ${result.base_penalty.toFixed(3)}</li>
            <li><strong>${t("quant.field.arch_mult_full") || "Architecture multiplier"}:</strong> ×${result.arch_multiplier} (d_head, GQA, SWA, params)</li>
            <li><strong>${t("quant.field.gamma_shift") || "Predicted γ shift"}:</strong> +${result.gamma_shift.toFixed(3)}</li>
            <li><strong>${t("quant.field.ppl_band") || "ΔPPL band (est.)"}:</strong> ${result.delta_ppl.low.toFixed(2)} – ${result.delta_ppl.high.toFixed(2)}</li>
            <li><strong>${t("quant.field.params") || "Parameters"}:</strong> ${fmtN(result.n_params)}</li>
          </ul>
        </details>
        <details class="unmask-panel" open>
          <summary class="unmask-panel-title">${t("quant.section.reco") || "Recommendation"}</summary>
          ${recoHtml}
        </details>
      </div>
    </div>
  `;
}

function renderQuantAll(rows, modelId) {
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let body = "";
  for (const r of rows) {
    const color = QUANT_REGIME_COLOR[r.regime] || "#8b949e";
    const regimeLabel = t(`quant.regime.${r.regime}`) || r.regime;
    body += `<tr>
      <td><strong>${escapeHtml(r.scheme_label)}</strong></td>
      <td class="arena-spread">${r.scheme_bits}-bit ${r.scheme_calibrated ? "✓" : ""}</td>
      <td class="arena-elo">+${r.gamma_shift.toFixed(3)}</td>
      <td class="arena-spread">${r.delta_ppl.low.toFixed(2)}–${r.delta_ppl.high.toFixed(2)}</td>
      <td style="color: ${color};"><strong>${regimeLabel}</strong></td>
    </tr>`;
  }
  return `
    <div class="arena-result">
      <div class="unmask-hero" style="border-color: #58a6ff;">
        <div class="unmask-verdict" style="color: #58a6ff;">${tFmt("quant.summary.headline_all", { modelId })}</div>
      </div>
      <div class="unmask-details">
        <details class="unmask-panel" open>
          <summary class="unmask-panel-title">${t("quant.section.compare") || "All schemes (sorted by safety)"}</summary>
          <table class="arena-table">
            <thead><tr>
              <th>${t("quant.col.scheme") || "Scheme"}</th>
              <th>${t("quant.col.bits") || "Bits"}</th>
              <th>${t("quant.col.gamma_shift") || "γ shift"}</th>
              <th>${t("quant.col.ppl_band") || "ΔPPL band"}</th>
              <th>${t("quant.col.regime") || "Regime"}</th>
            </tr></thead>
            <tbody>${body}</tbody>
          </table>
        </details>
      </div>
    </div>
  `;
}

async function runQuantPredict() {
  const cfg = __quantLastConfig || await quantFetchConfig();
  if (!cfg) return;
  const schemeId = $("quant-scheme").value;
  if (!schemeId) {
    $("quant-status").textContent = t("quant.status.no_scheme") || "⚠ Pick a quant scheme.";
    return;
  }
  const result = predictQuantShift(cfg, schemeId);
  if (!result) {
    $("quant-status").textContent = "❌ Unknown scheme.";
    return;
  }
  $("quant-output").innerHTML = renderQuantSingle(result, __quantLastModelId);
  $("quant-status").textContent = tFmt("quant.status.done", { regime: t(`quant.regime.${result.regime}`) || result.regime });
}

async function runQuantAll() {
  const cfg = __quantLastConfig || await quantFetchConfig();
  if (!cfg) return;
  const rows = predictAllSchemes(cfg);
  $("quant-output").innerHTML = renderQuantAll(rows, __quantLastModelId);
  $("quant-status").textContent = tFmt("quant.status.done_all", { n: rows.length });
}

populateQuantSchemes();
$("quant-fetch-btn")?.addEventListener("click", quantFetchConfig);
$("quant-run-btn")?.addEventListener("click", runQuantPredict);
$("quant-all-btn")?.addEventListener("click", runQuantAll);
$("quant-id")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); quantFetchConfig(); }
});

// ════════════════════════════════════════════════════════════════════
// 🔀 Cross-framework drift bound (v0.7.5 anti-bullshit pack #6)
// ════════════════════════════════════════════════════════════════════

const DRIFT_VERDICT_COLOR = {
  noise:        "#3fb950",
  suspicious:   "#f1c40f",
  bug:          "#f85149",
  bug_template: "#f85149",
};

function populateDriftDropdowns() {
  for (const side of ["a", "b"]) {
    const fwSel = $(`drift-${side}-framework`);
    const dtSel = $(`drift-${side}-dtype`);
    if (fwSel && fwSel.options.length === 0) {
      for (const f of DRIFT_FRAMEWORKS) {
        const opt = document.createElement("option");
        opt.value = f.id; opt.textContent = f.label;
        fwSel.appendChild(opt);
      }
    }
    if (dtSel && dtSel.options.length === 0) {
      for (const d of DRIFT_DTYPES) {
        const opt = document.createElement("option");
        opt.value = d.id; opt.textContent = d.label;
        dtSel.appendChild(opt);
      }
    }
  }
}

function readDriftSetup(side) {
  return {
    score: parseFloat($(`drift-${side}-score`).value),
    framework: $(`drift-${side}-framework`).value,
    dtype: $(`drift-${side}-dtype`).value,
    batch: parseInt($(`drift-${side}-batch`).value, 10) || 1,
    chat_template: $(`drift-${side}-template`).value,
  };
}

function renderDriftCard(result) {
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const color = DRIFT_VERDICT_COLOR[result.verdict] || "#8b949e";
  const verdictLabel = t(`drift.verdict.${result.verdict}`) || result.verdict;
  const a = result.setup_a, b = result.setup_b;
  const fwLabel = (id) => DRIFT_FRAMEWORKS.find(f => f.id === id)?.label || id;
  const dtLabel = (id) => DRIFT_DTYPES.find(d => d.id === id)?.label || id;

  let causeHtml = "";
  if (result.dominant_cause) {
    const causeText = t(`drift.cause.${result.dominant_cause}`) || result.dominant_cause;
    causeHtml = `<p class="unmask-reco"><strong>${t("drift.dominant_cause") || "Dominant cause"}:</strong> ${causeText}</p>`;
  }

  const recoText = t(`drift.reco.${result.verdict}`) || "";

  return `
    <div class="unmask-result">
      <div class="unmask-hero" style="border-color: ${color};">
        <div class="unmask-verdict" style="color: ${color};">${verdictLabel}</div>
        <div class="unmask-numbers">
          <div><span class="unmask-num-label">${t("drift.label.observed") || "Observed gap"}</span><span class="unmask-num-val">${result.observed_gap.toFixed(2)}</span></div>
          <div><span class="unmask-num-label">${t("drift.label.band") || "Numerical band"}</span><span class="unmask-num-val">±${result.numerical_band.toFixed(2)}</span></div>
          <div><span class="unmask-num-label">${t("drift.label.ratio") || "Gap / band"}</span><span class="unmask-num-val">${result.numerical_band > 0 ? (result.observed_gap / result.numerical_band).toFixed(1) : "∞"}×</span></div>
        </div>
      </div>
      <div class="unmask-details">
        <details class="unmask-panel" open>
          <summary class="unmask-panel-title">${t("drift.section.setups") || "Setups"}</summary>
          <table class="arena-table">
            <thead><tr><th></th><th>${t("drift.setup_a") || "Setup A"}</th><th>${t("drift.setup_b") || "Setup B"}</th></tr></thead>
            <tbody>
              <tr><td>${t("drift.score") || "Score"}</td><td class="arena-elo">${a.score?.toFixed(2)}</td><td class="arena-elo">${b.score?.toFixed(2)}</td></tr>
              <tr><td>${t("drift.framework") || "Framework"}</td><td>${escapeHtml(fwLabel(a.framework))}</td><td>${escapeHtml(fwLabel(b.framework))}</td></tr>
              <tr><td>${t("drift.dtype") || "Dtype"}</td><td>${escapeHtml(dtLabel(a.dtype))}</td><td>${escapeHtml(dtLabel(b.dtype))}</td></tr>
              <tr><td>${t("drift.batch") || "Batch"}</td><td>${a.batch}</td><td>${b.batch}</td></tr>
              <tr><td>${t("drift.template") || "Chat-template"}</td><td>${escapeHtml(t("drift.template." + a.chat_template) || a.chat_template)}</td><td>${escapeHtml(t("drift.template." + b.chat_template) || b.chat_template)}</td></tr>
            </tbody>
          </table>
        </details>
        <details class="unmask-panel" open>
          <summary class="unmask-panel-title">${t("drift.section.breakdown") || "Drift contributors (numerical band)"}</summary>
          <ul>
            <li><strong>${t("drift.contrib.dtype") || "Dtype mismatch"}:</strong> ${result.breakdown.dtype.toFixed(2)} pts</li>
            <li><strong>${t("drift.contrib.framework") || "Framework"}:</strong> ${result.breakdown.framework.toFixed(2)} pts</li>
            <li><strong>${t("drift.contrib.batch") || "Batch difference"}:</strong> ${result.breakdown.batch.toFixed(2)} pts</li>
            ${result.breakdown.template_mismatch ? `<li style="color:${color};"><strong>${t("drift.contrib.template") || "Chat-template"}:</strong> ⚠ ${t("drift.contrib.template_differ") || "templates differ (see cause below)"}</li>` : ""}
          </ul>
        </details>
        <details class="unmask-panel" open>
          <summary class="unmask-panel-title">${t("drift.section.verdict") || "Verdict & recommendation"}</summary>
          ${causeHtml}
          ${recoText ? `<p class="unmask-reco">${recoText}</p>` : ""}
        </details>
      </div>
    </div>
  `;
}

function runDriftCompute() {
  const a = readDriftSetup("a");
  const b = readDriftSetup("b");
  if (Number.isNaN(a.score) || Number.isNaN(b.score)) {
    $("drift-status").textContent = t("drift.status.empty_scores") || "⚠ Enter both scores.";
    return;
  }
  const result = computeDriftBound(a, b);
  $("drift-output").innerHTML = renderDriftCard(result);
  if (window.__taf_applyTranslations) window.__taf_applyTranslations();
  $("drift-status").textContent = tFmt("drift.status.done", { verdict: t(`drift.verdict.${result.verdict}`) || result.verdict });
}

function loadDriftSample() {
  // Canonical chat-template bug: same model on lm-eval-hf (no template applied)
  // gets ~50 on multi-turn, vLLM-served (template auto-applied) gets ~75.
  $("drift-a-score").value = 50.2;
  $("drift-a-framework").value = "lm-eval-hf";
  $("drift-a-dtype").value = "bf16";
  $("drift-a-batch").value = 1;
  $("drift-a-template").value = "not_applied";
  $("drift-b-score").value = 74.8;
  $("drift-b-framework").value = "vllm-served";
  $("drift-b-dtype").value = "bf16";
  $("drift-b-batch").value = 8;
  $("drift-b-template").value = "applied";
  $("drift-status").textContent = t("drift.status.sample_loaded") || "✅ Sample loaded (canonical chat-template bug). Click Compute drift bound.";
}

populateDriftDropdowns();
$("drift-run-btn")?.addEventListener("click", runDriftCompute);
$("drift-sample-btn")?.addEventListener("click", loadDriftSample);

// ════════════════════════════════════════════════════════════════════
// 🔍 NIAH → reasoning gap predictor (v0.7.6 anti-bullshit pack #7)
// ════════════════════════════════════════════════════════════════════

const NIAH_VERDICT_COLOR = {
  robust:         "#3fb950",
  marginal:       "#f1c40f",
  degraded:       "#f1c40f",
  retrieval_only: "#f85149",
  broken:         "#f85149",
};

let __niahLastConfig = null;
let __niahLastModelId = null;

async function niahFetchConfig() {
  const modelId = ($("niah-id").value || "").trim();
  if (!modelId) {
    $("niah-status").textContent = t("niah.status.empty_id") || "⚠ Enter a model id.";
    return null;
  }
  $("niah-status").textContent = tFmt("niah.status.fetching", { modelId });
  $("niah-fetch-btn").disabled = true;
  try {
    const cfg = await fetchHfConfig(modelId);
    __niahLastConfig = cfg;
    // Keep the user-pasted id for RULER lookup (it has the canonical
    // alias mapping). The mirror id is recorded in cfg.__via_mirror
    // for any UI that wants to surface "fetched via mirror" — niah
    // status string already shows it below.
    __niahLastModelId = modelId;
    if (cfg.__via_mirror) {
      $("niah-status").innerHTML = `${tFmt("niah.status.fetched", { modelId })} <span class="subtle" style="color:#d29922;">(via mirror <code>${escapeHtml(cfg.__via_mirror)}</code>)</span>`;
    } else {
      $("niah-status").textContent = tFmt("niah.status.fetched", { modelId });
    }
    return cfg;
  } catch (err) {
    if (err.code === "gated") {
      $("niah-status").innerHTML = `🔒 <strong>${escapeHtml(err.modelId)}</strong> ${t("hf_auto.gated_msg") || "is gated. Accept the license here:"} <a href="https://huggingface.co/${escapeHtml(err.modelId)}" target="_blank" rel="noopener">huggingface.co/${escapeHtml(err.modelId)}</a>`;
    } else {
      $("niah-status").textContent = `❌ ${err.message}`;
    }
    return null;
  } finally {
    $("niah-fetch-btn").disabled = false;
  }
}

function renderNIAHCard(result, modelId, calib = null) {
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtN = (x) => x === null || x === undefined ? "—" : Number(x).toLocaleString();
  const color = NIAH_VERDICT_COLOR[result.verdict] || "#8b949e";
  const verdictLabel = t(`niah.verdict.${result.verdict}`) || result.verdict;
  const reco = t(`niah.reco.${result.verdict}`) || "";
  const safeText = result.safe_context
    ? tFmt("niah.safe_context", { ctx: result.safe_context })
    : (t("niah.safe_context_none") || "No safe context found below your target — model fails reasoning even at small contexts.");

  // RULER calibration block — appears only when KB lookup hits.
  // Shows measured RULER aggregate, derived NIAH/reasoning, and the
  // delta vs the heuristic so users see when the predictor was off.
  let calibBlock = "";
  if (calib) {
    const fmtPct = (v) => `${(v * 100).toFixed(0)}%`;
    const fmtDelta = (d) => {
      if (d == null) return "—";
      const pp = Math.round(d * 100);
      const sign = pp > 0 ? "+" : "";
      const col = Math.abs(pp) >= 10 ? "#f0883e" : Math.abs(pp) >= 5 ? "#d29922" : "#8b949e";
      return `<span style="color:${col};">${sign}${pp} pp</span>`;
    };
    const extrapNote = calib.extrapolated
      ? `<span class="subtle" style="color:#d29922;font-size:0.85em;"> ⚠ ${t("niah.calib.extrapolated") || "extrapolated outside RULER's measured range"}</span>`
      : "";
    calibBlock = `
      <details class="unmask-panel" open style="border-left:3px solid #3fb950;">
        <summary class="unmask-panel-title">📊 ${t("niah.calib.heading") || "RULER-calibrated (NVIDIA published data)"}</summary>
        <p>${tFmt("niah.calib.matched", {
          alias: escapeHtml(calib.matched_alias),
          canonical: escapeHtml(calib.canonical_id),
        }) || `Matched <code>${escapeHtml(calib.matched_alias)}</code> → KB row <code>${escapeHtml(calib.canonical_id)}</code>.`}</p>
        <p>
          <strong>${t("niah.calib.aggregate") || "RULER aggregate"} @ ${fmtN(result.T_eval)}:</strong>
          <code>${calib.ruler_avg_pct}%</code>
          <span class="subtle">(${t("niah.calib.interp") || "interpolated between"} ${calib.interp_anchor})</span>${extrapNote}
        </p>
        <table class="arena-table" style="margin-top:0.5em;">
          <thead><tr>
            <th></th>
            <th>${t("niah.calib.col.heuristic") || "Heuristic"}</th>
            <th>${t("niah.calib.col.calibrated") || "RULER-calibrated"}</th>
            <th>${t("niah.calib.col.delta") || "Δ"}</th>
          </tr></thead>
          <tbody>
            <tr>
              <td><strong>NIAH</strong></td>
              <td>${fmtPct(result.niah_rate)}</td>
              <td><strong>${fmtPct(calib.niah_calibrated)}</strong></td>
              <td>${fmtDelta(calib.delta_niah)}</td>
            </tr>
            <tr>
              <td><strong>${t("niah.label.reasoning") || "Reasoning"}</strong></td>
              <td>${fmtPct(result.reasoning_rate)}</td>
              <td><strong>${fmtPct(calib.reasoning_calibrated)}</strong></td>
              <td>${fmtDelta(calib.delta_reasoning)}</td>
            </tr>
          </tbody>
        </table>
        <p class="recipe-desc subtle" style="font-size:0.82em;">
          ${t("niah.calib.factors") || "Per-task factors from RULER paper Appendix Tables 13-16:"}
          retrieval = ${calib.retrieval_factor}× aggregate,
          reasoning = ${calib.reasoning_factor}× aggregate
          (${t("niah.calib.factors_caveat") || "honest range: retrieval 0.95-1.10×, reasoning 0.60-0.85×"}).
        </p>
        <p class="recipe-desc subtle" style="font-size:0.82em;">
          ${t("niah.calib.claimed_vs_effective") || "Paper-reported"}:
          ${t("niah.calib.claimed") || "claimed"} ${fmtN(calib.claimed_context)} /
          ${t("niah.calib.effective") || "effective"} ${fmtN(calib.effective_context)}.
          ${t("niah.calib.source") || "Source"}:
          <a href="${calib.source_url}" target="_blank" rel="noopener noreferrer">RULER paper (Hsieh et al., COLM 2024)</a>
        </p>
      </details>
    `;
  } else if (modelId) {
    // KB miss — explicitly state we're heuristic-only.
    calibBlock = `
      <p class="recipe-desc subtle" style="font-size:0.85em;margin-top:0.5em;">
        💡 ${t("niah.calib.miss") || "RULER calibration unavailable for this model — using architectural heuristic only. Add to data/ruler_kb.json if you have measured numbers."}
      </p>
    `;
  }

  return `
    <div class="unmask-result">
      <div class="unmask-hero" style="border-color: ${color};">
        <div class="unmask-verdict" style="color: ${color};">${verdictLabel}</div>
        <div class="unmask-model"><code>${escapeHtml(modelId)}</code> @ <code>${fmtN(result.T_eval)}</code> tokens</div>
        <div class="unmask-numbers">
          <div><span class="unmask-num-label">${t("niah.label.niah") || "NIAH pass rate"}</span><span class="unmask-num-val">${(result.niah_rate * 100).toFixed(0)}%</span></div>
          <div><span class="unmask-num-label">${t("niah.label.reasoning") || "Reasoning pass rate"}</span><span class="unmask-num-val">${(result.reasoning_rate * 100).toFixed(0)}%</span></div>
          <div><span class="unmask-num-label">${t("niah.label.gap") || "Gap"}</span><span class="unmask-num-val">${(result.gap * 100).toFixed(0)} pts</span></div>
        </div>
      </div>
      <div class="unmask-details">
        ${calibBlock}
        <details class="unmask-panel" open>
          <summary class="unmask-panel-title">${t("niah.section.breakdown") || "Architecture breakdown"}</summary>
          <ul>
            <li><strong>γ_Padé @ T_eval:</strong> ${result.gamma_pade}</li>
            <li><strong>${t("niah.field.extrap") || "Extrapolation (T_eval / T_train)"}:</strong> ${result.extrapolation_ratio}×</li>
            <li><strong>${t("niah.field.arch_pressure") || "Arch pressure (small d_head + GQA + SWA)"}:</strong> ×${result.arch_pressure}</li>
            <li><strong>${t("niah.field.theta") || "RoPE θ"}:</strong> ${fmtN(result.theta)}</li>
            <li><strong>${t("niah.field.t_train") || "T_train (claimed)"}:</strong> ${fmtN(result.T_train)}</li>
          </ul>
        </details>
        <details class="unmask-panel" open>
          <summary class="unmask-panel-title">${t("niah.section.reco") || "Recommendation"}</summary>
          <p class="unmask-reco">${reco}</p>
          <p class="unmask-reco"><strong>${t("niah.label.safe_ctx") || "Safe reasoning context"}:</strong> ${safeText}</p>
        </details>
      </div>
    </div>
  `;
}

function renderNIAHSweep(rows, modelId) {
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmtN = (x) => x === null || x === undefined ? "—" : Number(x).toLocaleString();
  let body = "";
  for (const r of rows) {
    const color = NIAH_VERDICT_COLOR[r.verdict] || "#8b949e";
    const label = t(`niah.verdict.${r.verdict}`) || r.verdict;
    body += `<tr>
      <td><strong>${fmtN(r.T_eval)}</strong></td>
      <td class="arena-elo">${(r.niah_rate * 100).toFixed(0)}%</td>
      <td class="arena-elo">${(r.reasoning_rate * 100).toFixed(0)}%</td>
      <td class="arena-spread">${(r.gap * 100).toFixed(0)} pts</td>
      <td style="color: ${color};"><strong>${label}</strong></td>
    </tr>`;
  }
  return `
    <div class="arena-result">
      <div class="unmask-hero" style="border-color: #58a6ff;">
        <div class="unmask-verdict" style="color: #58a6ff;">${tFmt("niah.summary.sweep", { modelId })}</div>
      </div>
      <div class="unmask-details">
        <details class="unmask-panel" open>
          <summary class="unmask-panel-title">${t("niah.section.sweep") || "Pass rate sweep across context lengths"}</summary>
          <table class="arena-table">
            <thead><tr>
              <th>${t("niah.col.context") || "T_eval"}</th>
              <th>${t("niah.col.niah") || "NIAH"}</th>
              <th>${t("niah.col.reasoning") || "Reasoning"}</th>
              <th>${t("niah.col.gap") || "Gap"}</th>
              <th>${t("niah.col.verdict") || "Verdict"}</th>
            </tr></thead>
            <tbody>${body}</tbody>
          </table>
        </details>
      </div>
    </div>
  `;
}

async function runNIAHPredict() {
  const cfg = __niahLastConfig || await niahFetchConfig();
  if (!cfg) return;
  const T_eval = parseInt($("niah-teval").value, 10);
  if (Number.isNaN(T_eval) || T_eval < 512) {
    $("niah-status").textContent = t("niah.status.bad_teval") || "⚠ Enter a target context (≥512).";
    return;
  }
  const result = predictNIAHReasoning(cfg, T_eval);
  // Ensure RULER KB is loaded once; idempotent. No-op if already loaded.
  await loadRulerKB();
  // Calibrate against published RULER measurements if available.
  const calib = calibrateNIAH(__niahLastModelId, T_eval, result);
  $("niah-output").innerHTML = renderNIAHCard(result, __niahLastModelId, calib);
  $("niah-status").textContent = tFmt("niah.status.done", {
    verdict: t(`niah.verdict.${result.verdict}`) || result.verdict,
    niah: (result.niah_rate * 100).toFixed(0),
    reasoning: (result.reasoning_rate * 100).toFixed(0),
  });
}

async function runNIAHSweep() {
  const cfg = __niahLastConfig || await niahFetchConfig();
  if (!cfg) return;
  const rows = sweepContextLengths(cfg);
  $("niah-output").innerHTML = renderNIAHSweep(rows, __niahLastModelId);
  $("niah-status").textContent = tFmt("niah.status.sweep_done", { n: rows.length });
}

$("niah-fetch-btn")?.addEventListener("click", niahFetchConfig);
$("niah-run-btn")?.addEventListener("click", runNIAHPredict);
$("niah-sweep-btn")?.addEventListener("click", runNIAHSweep);
$("niah-id")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); niahFetchConfig(); }
});

function configToPreset(cfg, modelId) {
  const n_attn = cfg.num_attention_heads || cfg.n_head || 0;
  const n_kv = cfg.num_key_value_heads || cfg.num_attention_heads || cfg.n_head || 0;
  const hidden = cfg.hidden_size || cfg.d_model || cfg.n_embd || 0;
  const d_head = cfg.head_dim || (n_attn > 0 ? Math.floor(hidden / n_attn) : 0);
  const theta = cfg.rope_theta || cfg.rotary_emb_base ||
                (cfg.alibi ? null : (cfg.position_embedding_type === "absolute" ? null : 10000));
  const T_train = cfg.max_position_embeddings || cfg.max_sequence_length ||
                  cfg.n_positions || cfg.n_ctx || 0;
  const n_layers = cfg.num_hidden_layers || cfg.n_layer || 0;
  const has_SWA = !!(cfg.sliding_window || cfg.use_sliding_window);

  let family = "rope-mha";
  if (cfg.alibi) family = "alibi";
  else if (cfg.model_type === "mamba" || cfg.model_type === "mamba2") family = "ssm";
  else if (theta == null) family = "abspe";
  else if (n_kv < n_attn) family = "rope-gqa";

  const n_params_est = estimateParams(cfg);
  return {
    theta: theta || 10000, T_train: T_train || 2048,
    n_attention_heads: n_attn, n_kv_heads: n_kv, d_head: d_head,
    n_layers: n_layers, n_params: n_params_est, has_SWA: has_SWA,
    _family: family, _model_id: modelId,
  };
}

function estimateParams(cfg) {
  const h = cfg.hidden_size || cfg.d_model || 0;
  const L = cfg.num_hidden_layers || cfg.n_layer || 0;
  const V = cfg.vocab_size || 32000;
  return Math.round(12 * h * h * L + 2 * V * h);
}

// ════════════════════════════════════════════════════════════════════
// Run recipe (manual mode)
// ════════════════════════════════════════════════════════════════════
$("run-btn").addEventListener("click", async () => {
  if (!state.currentRecipe) {
    alert("Select a recipe first.");
    return;
  }
  const rid = state.currentRecipe.id;
  const params = collectParams(state.currentRecipe.params);
  await runAndDisplay(rid, params);
});

function collectParams(paramNames) {
  const p = {};
  paramNames.forEach(name => {
    const el = $("param_" + name);
    if (!el || el.value === "") return;
    let v = el.value;
    if (v === "true" || v === "false") {
      p[name] = (v === "true");
    } else if (!isNaN(parseFloat(v)) && isFinite(v)) {
      p[name] = parseFloat(v);
    } else {
      p[name] = v;
    }
  });
  return p;
}

// ════════════════════════════════════════════════════════════════════
// Ask mode (free-form question via router)
// ════════════════════════════════════════════════════════════════════
$("ask-btn").addEventListener("click", async () => {
  const q = $("question").value.trim();
  if (!q) {
    alert("Please type a question.");
    return;
  }
  $("ask-btn").disabled = true;
  setStatus("🤔 Asking the in-browser LLM to pick a recipe...");

  try {
    const route = await routeQuestion(q);
    setStatus(`📋 Selected recipe ${route.recipe_id}. Running...`);
    await runAndDisplay(route.recipe_id, route.params, q);
  } catch (err) {
    setStatus(`❌ Routing failed: ${err.message}`);
    $("output-section").style.display = "block";
    $("verdict-box").className = "verdict-no";
    $("verdict-box").innerHTML = `<strong>Could not route question.</strong><br>${escapeHtml(err.message)}<br><br>Try the Recipe mode for full manual control.`;
  } finally {
    $("ask-btn").disabled = false;
  }
});

$("example-btn").addEventListener("click", () => {
  const ex = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
  $("question").value = ex;
});

async function routeQuestion(question) {
  const engine = await loadWebLLM();
  const recipesDesc = state.recipes.map(r =>
    `  ${r.id}: ${r.name} — ${r.description}\n    params: ${r.params.join(", ")}`
  ).join("\n");
  const systemPrompt = `You are a routing function. Given a user's free-form question
about transformer LLM viability, you MUST output a single JSON object with two fields:
  - recipe_id: one of [${state.recipes.map(r => r.id).join(", ")}]
  - params: an object with parameter values inferred from the question

Available recipes:
${recipesDesc}

Common model facts you may use:
  Meta-Llama-3-8B: theta=500000, T_train=8192, n_attention_heads=32, n_kv_heads=8, d_head=128, n_layers=32, n_params=8e9
  Mistral-7B-v0.1: theta=10000, T_train=8192, n_attention_heads=32, n_kv_heads=8, d_head=128, n_layers=32, n_params=7e9, has_SWA=true
  Qwen2.5-7B: theta=1000000, T_train=32768, n_attention_heads=28, n_kv_heads=4, d_head=128, n_layers=28, n_params=7.6e9
  Llama-3.3-70B-Instruct: theta=500000, T_train=131072, n_attention_heads=64, n_kv_heads=8, d_head=128, n_layers=80, n_params=70e9

Respond with ONLY the JSON object. No prose, no markdown fences, no explanation.`;

  const reply = await engine.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
    max_tokens: 400,
    temperature: 0.0,
    response_format: { type: "json_object" },
  });
  const raw = reply.choices[0].message.content.trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // Try extracting JSON from markdown fences
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`LLM returned non-JSON: ${raw.slice(0, 200)}`);
    parsed = JSON.parse(m[0]);
  }
  if (!parsed.recipe_id || !state.recipesById[parsed.recipe_id]) {
    throw new Error(`Unknown recipe: ${parsed.recipe_id}`);
  }
  return parsed;
}

// ════════════════════════════════════════════════════════════════════
// Run + display + synthesize
// ════════════════════════════════════════════════════════════════════
async function runAndDisplay(recipeId, params, originalQuestion=null) {
  setStatus("🧮 Computing TAF chain...");
  state.pyodide.globals.set("__rid", recipeId);
  state.pyodide.globals.set("__params", state.pyodide.toPy(params));
  const resultJSON = state.pyodide.runPython(`
import json
result = run_recipe(__rid, **__params)
json.dumps(result)
`);
  const result = JSON.parse(resultJSON);
  result._original_question = originalQuestion;
  renderResult(result);
  $("output-section").style.display = "block";
  $("profile-output").style.display = "none";
  $("compare-output").style.display = "none";
  state.lastResult = { type: "recipe", recipeId, params };
  state.lastFullResult = result;
  setStatus("✅ Done. Numbers below.");
  if (ENABLE_WEBLLM) {
    await synthesizeAnswer(result);
  }
}

function renderResult(r) {
  console.log("[TAF] renderResult called with:", r);
  if (r.error) {
    $("verdict-box").className = "verdict-no";
    $("verdict-box").innerHTML = `<strong>Error</strong>: ${escapeHtml(r.error)}`;
    $("chain-box").innerHTML = "";
    return;
  }
  const vBox = $("verdict-box");
  if (!vBox) {
    console.error("[TAF] verdict-box element not found!");
    return;
  }
  const verdictStr = String(r.verdict || "UNKNOWN");
  let vClass = "";
  if (verdictStr.startsWith("YES") || verdictStr === "GO" || verdictStr.startsWith("USE SOFT")) vClass = "verdict-yes";
  else if (verdictStr.startsWith("NO") || verdictStr.startsWith("MEMORY") || verdictStr === "TINY-MODEL") vClass = "verdict-no";
  else vClass = "verdict-degraded";
  vBox.className = vClass;
  const verdictEmoji = vClass === "verdict-yes" ? "✅" : (vClass === "verdict-no" ? "❌" : "⚠");
  vBox.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; gap:1rem; flex-wrap:wrap;">
      <div style="font-size:1.6rem; font-weight:800;">${verdictEmoji} ${escapeHtml(verdictStr)}</div>
      <div class="recipe-tag">${escapeHtml(r.recipe_id || "")} — ${escapeHtml(r.recipe_name || "")}</div>
    </div>
    <div style="margin-bottom:0.5rem;"><strong>Reason:</strong> ${escapeHtml(r.reason || "(none)")}</div>
    ${r.mitigation && r.mitigation !== "None required." && r.mitigation !== "None — proceed with Chinchilla-optimal recipe."
      ? `<div><strong>Action:</strong> ${escapeHtml(r.mitigation)}</div>`
      : ""}
    ${Array.isArray(r.caveats) && r.caveats.length
      ? `<div class="recipe-caveats" style="margin-top:0.6rem; padding:0.5rem 0.7rem; border-left:3px solid #d29922; background:rgba(210,153,34,0.08); font-size:0.85rem; border-radius:4px;">
           <strong>⚠ ${escapeHtml(t("caveat.title") || "Honesty notes")}</strong>
           <ul style="margin:0.3rem 0 0; padding-left:1.1rem;">
             ${r.caveats.map(k => `<li>${escapeHtml(t("caveat." + k) || k)}</li>`).join("")}
           </ul>
         </div>`
      : ""}
    ${confidenceHtml(r.confidence)}
  `;
  console.log("[TAF] verdict-box populated with class:", vClass, "verdict:", verdictStr);

  const cBox = $("chain-box");
  cBox.innerHTML = "";
  r.chain.forEach(step => {
    const div = document.createElement("details");
    div.className = "chain-step";
    div.innerHTML = `
      <summary>
        <span><strong>Step ${step.step}</strong> — ${escapeHtml(step.name)}</span>
        <span class="step-section">${escapeHtml(step.section)}</span>
      </summary>
      <div class="step-formula">${escapeHtml(step.formula)}</div>
      <div><strong>Inputs:</strong> ${escapeHtml(JSON.stringify(step.inputs))}</div>
      <div class="step-result"><strong>Result:</strong> ${formatResult(step.result)}</div>
      ${step.interpretation ? `<div class="step-interp">${escapeHtml(step.interpretation)}</div>` : ""}
    `;
    cBox.appendChild(div);
  });
}

// Confidence widget (#5) — shared renderer for recipes + Memory Reality + others.
// Takes { pct, band, factors:[{key,status}] } (from Python _confidence or JS computeConfidence).
function confidenceHtml(conf) {
  if (!conf || !Array.isArray(conf.factors)) return "";
  const ICON = { ok: "✓", warn: "⚠", miss: "✗" };
  const FCOLOR = { ok: "#3fb950", warn: "#d29922", miss: "#f85149" };
  const BCOLOR = { high: "#3fb950", medium: "#d29922", low: "#f85149" };
  const c = BCOLOR[conf.band] || "#8b949e";
  const items = conf.factors.map((f) =>
    `<li><span style="color:${FCOLOR[f.status] || "#8b949e"}">${ICON[f.status] || "·"}</span> ${escapeHtml(t("conf.factor." + f.key) || f.key)}</li>`).join("");
  return `<div class="taf-confidence" style="margin-top:0.6rem; padding:0.5rem 0.7rem; border-left:3px solid ${c}; background:rgba(110,118,129,0.08); border-radius:4px; font-size:0.85rem;">
      <strong>${escapeHtml(t("conf.label") || "Confidence")}: <span style="color:${c}">${conf.pct}% · ${escapeHtml(t("conf.band." + conf.band) || conf.band)}</span></strong>
      <ul style="margin:0.3rem 0 0; padding-left:1.1rem; list-style:none;">${items}</ul>
    </div>`;
}

function formatResult(r) {
  if (r === null || r === undefined) return "n/a (not applicable)";
  if (typeof r === "number") return r.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (typeof r === "object") return `<pre>${escapeHtml(JSON.stringify(r, null, 2))}</pre>`;
  return String(r);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ════════════════════════════════════════════════════════════════════
// WebLLM (synthesis + router)
// ════════════════════════════════════════════════════════════════════
async function loadWebLLM() {
  if (state.webllm) return state.webllm;

  // Request persistent storage to avoid quota issues with cached model weights
  if (navigator.storage && navigator.storage.persist) {
    try {
      const persistent = await navigator.storage.persist();
      console.log(persistent ? "Persistent storage granted" : "Persistent storage denied");
    } catch (e) {
      console.warn("storage.persist() failed:", e);
    }
  }

  setStatus(`⏳ Loading WebLLM library + ${WEBLLM_MODEL.split("-")[0]} (~350MB first time, cached after)...`);
  const { CreateMLCEngine } = await import("https://esm.run/@mlc-ai/web-llm");

  const tryLoad = async (modelId) => {
    return await CreateMLCEngine(modelId, {
      initProgressCallback: (info) => setStatus(`⏳ ${info.text || "Loading model..."}`),
    });
  };

  try {
    state.webllm = await tryLoad(WEBLLM_MODEL);
  } catch (err) {
    if (String(err).includes("QuotaExceeded") || String(err).includes("storage")) {
      setStatus(`⚠ Quota exceeded for ${WEBLLM_MODEL}. Trying smaller fallback ${WEBLLM_FALLBACK}...`);
      try {
        state.webllm = await tryLoad(WEBLLM_FALLBACK);
      } catch (err2) {
        throw new Error(
          `Both models failed. Browser storage too constrained. ` +
          `Try: (1) Settings → Privacy → Site settings → allow more storage for this site, ` +
          `(2) clear browser cache, (3) use Chrome/Edge in non-incognito mode. ` +
          `Original error: ${err2.message || err2}`
        );
      }
    } else {
      throw err;
    }
  }
  return state.webllm;
}

async function synthesizeAnswer(result) {
  $("answer-header").style.display = "block";
  $("answer-box").style.display = "block";
  $("answer-box").innerHTML = '<em style="color:var(--fg-dim);">Generating plain-English summary...</em>';

  let engine;
  try {
    engine = await loadWebLLM();
  } catch (err) {
    $("answer-box").innerHTML = `<em style="color:var(--warning);">⚠ WebLLM failed: ${escapeHtml(String(err))}<br>Numbers above are still correct.</em>`;
    return;
  }
  const prompt = buildSynthesisPrompt(result);
  let answer = "";
  try {
    const reply = await engine.chat.completions.create({
      messages: [
        { role: "system", content: t("synthesis.system") },
        { role: "user", content: prompt },
      ],
      max_tokens: 400,
      temperature: 0.2,
    });
    answer = reply.choices[0].message.content;
  } catch (err) {
    $("answer-box").innerHTML = `<em style="color:var(--warning);">⚠ Synthesis failed: ${escapeHtml(String(err))}</em>`;
    return;
  }
  $("answer-box").innerHTML = `
    <div style="white-space:pre-wrap; line-height:1.7;">${escapeHtml(answer)}</div>
    <div style="margin-top:0.75rem; font-size:0.85rem; color:var(--fg-dim);">
      ↑ Synthesised by Llama-3.2-1B in your browser. Numbers are deterministic Python.
    </div>
  `;
  setStatus("✅ Done.");
}

function buildSynthesisPrompt(r) {
  const numbersBlock = r.chain.map(s =>
    `Step ${s.step} (${s.section}) ${s.name}: ${formatResultPlain(s.result)} — ${s.interpretation || ""}`
  ).join("\n");
  return `Recipe: ${r.recipe_id} — ${r.recipe_name}
${r._original_question ? `User question: "${r._original_question}"\n` : ""}
Computed chain:
${numbersBlock}

Verdict: ${r.verdict}
Reason: ${r.reason}
Action: ${r.mitigation}

Summarize for non-technical user in 4-6 sentences. Cite section numbers (§X.Y). Mention verdict and most important action.`;
}

function formatResultPlain(r) {
  if (r === null || r === undefined) return "n/a";
  if (typeof r === "number") return r.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (typeof r === "object") return JSON.stringify(r);
  return String(r);
}

// ════════════════════════════════════════════════════════════════════
// INSPECTOR mode (paste raw config.json)
// ════════════════════════════════════════════════════════════════════
$("inspector-btn").addEventListener("click", async () => {
  const raw = $("inspector-json").value.trim();
  if (!raw) {
    $("inspector-status").textContent = "⚠ Paste a config.json first";
    return;
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    $("inspector-status").textContent = `❌ Invalid JSON: ${e.message}`;
    return;
  }
  $("inspector-status").textContent = "⏳ Parsing + profiling...";
  $("inspector-btn").disabled = true;
  try {
    const preset = configToPreset(cfg, cfg.model_type ? `<inspector:${cfg.model_type}>` : "<inspector>");
    state.lastModelId = preset._model_id || "<inspected>";
    const T_eval = parseInt($("inspector-T_eval").value) || preset.T_train;
    const params = {
      theta: preset.theta, T_train: preset.T_train, T_eval: T_eval,
      n_attention_heads: preset.n_attention_heads,
      n_kv_heads: preset.n_kv_heads,
      d_head: preset.d_head, n_layers: preset.n_layers,
      n_params: preset.n_params, has_SWA: preset.has_SWA,
    };
    state.pyodide.globals.set("__pp", state.pyodide.toPy(params));
    const json = state.pyodide.runPython(`
import json
result = profile_model(**__pp)
json.dumps(result)
`);
    const profile = JSON.parse(json);
    renderProfile(profile, params);
    state.lastResult = { type: "profile", params };
    state.lastFullResult = profile;
    $("inspector-status").innerHTML = `✅ Profiled: <strong>${preset._family}</strong> (${preset.n_params.toExponential(2)} params)`;
  } catch (err) {
    $("inspector-status").textContent = `❌ ${err.message}`;
    console.error(err);
  } finally {
    $("inspector-btn").disabled = false;
  }
});

// ════════════════════════════════════════════════════════════════════
// What-if T_eval slider — interactive exploration
// ════════════════════════════════════════════════════════════════════
function renderWhatIfSlider(profile, params, targetEl) {
  if (!profile || !params) return;
  const minL = 256;
  const maxL = Math.max(params.T_eval * 4, 200000);
  const initialL = params.T_eval;

  targetEl.innerHTML = `
    <h3 data-i18n="whatif.title">🎚 What-if: drag T_eval to see γ change live</h3>
    <p class="subtle" data-i18n="whatif.desc">Pure JS recompute (no Pyodide call). Shows the geometric γ_Padé and d_horizon as you slide. The full chain re-runs on click.</p>
    <input type="range" id="whatif-slider" class="whatif-slider"
      min="${minL}" max="${maxL}" step="${Math.round(maxL/200)}" value="${initialL}" />
    <div class="whatif-row"><span data-i18n="whatif.T_eval"><strong>T_eval</strong></span><span id="whatif-T_eval">${initialL.toLocaleString()}</span></div>
    <div class="whatif-row"><span data-i18n="whatif.gamma_pade"><strong>γ_Padé</strong></span><span id="whatif-gamma">—</span></div>
    <div class="whatif-row"><span data-i18n="whatif.d_horizon"><strong>d_horizon</strong></span><span id="whatif-dh">—</span></div>
    <div class="whatif-row"><span data-i18n="whatif.l_niah"><strong>L_NIAH ceiling</strong></span><span id="whatif-niah">—</span></div>
    <div class="whatif-row"><span data-i18n="whatif.predicted"><strong>Predicted geometric verdict</strong></span><span id="whatif-verdict" class="verdict-text">—</span></div>
    <button id="whatif-rerun" class="secondary" type="button" style="margin-top:0.5rem;" data-i18n="whatif.rerun">↻ Recompute full chain at this T_eval</button>
  `;

  if (window.__taf_applyTranslations) window.__taf_applyTranslations();

  const update = () => {
    const T = parseInt($("whatif-slider").value);
    const sqrt2 = Math.SQRT2;
    const g_pade = (2 * params.theta - T * sqrt2) / (2 * params.theta + T * sqrt2);
    // Apply same decomposition as Python
    const g_corr = g_pade
      + (params.n_kv_heads < params.n_attention_heads ? 0.11 : 0)
      + (params.has_SWA ? -0.21 : 0)
      + (params.n_params >= 4e8 ? -0.15 : 0);
    let dh = null, niah = null, verdict, vClass;
    if (g_corr > 0 && g_corr < 1) {
      dh = params.theta * (1 - g_corr) * sqrt2 / (1 + g_corr);
      niah = 2 * dh;
      if (T < dh) { verdict = `✅ YES (margin ${((1 - T / dh) * 100).toFixed(0)}%)`; vClass = "yes"; }
      else if (T < niah) { verdict = `⚠ DEGRADED`; vClass = "deg"; }
      else { verdict = `❌ NO (past NIAH ceiling)`; vClass = "no"; }
    } else {
      verdict = `❌ NO (Phase B)`; vClass = "no";
    }
    $("whatif-T_eval").textContent = T.toLocaleString();
    $("whatif-gamma").textContent = g_pade.toFixed(4) + (g_corr !== g_pade ? ` → ${g_corr.toFixed(4)}` : "");
    $("whatif-dh").textContent = dh !== null ? Math.round(dh).toLocaleString() : "n/a (Phase B)";
    $("whatif-niah").textContent = niah !== null ? Math.round(niah).toLocaleString() : "n/a";
    const vEl = $("whatif-verdict");
    vEl.textContent = verdict;
    vEl.className = "verdict-text " + vClass;
  };
  $("whatif-slider").addEventListener("input", update);
  $("whatif-rerun").addEventListener("click", () => {
    const T = parseInt($("whatif-slider").value);
    // Update params and trigger full re-profile
    $("profile-T_eval").value = T;
    $("profile-btn").click();
  });
  update();
}

// ════════════════════════════════════════════════════════════════════
// FALSIFICATION dashboard inline
// ════════════════════════════════════════════════════════════════════
const FALSIFICATION_STATUS = [
  { id: "F1",  claim: "γ_Padé MAE < 5% on non-anomalous Phase A models",                status: "confirmed", evidence: "n=9, paper Tab. 4" },
  { id: "F2",  claim: "d_horizon independently predicts NIAH collapse (claimed) — REFUTED as circular: it is the Padé inverse (≡ trained ctx, see F23)", status: "refuted", evidence: "dHorizon(θ,γ_Padé(θ,T))≡T by construction; the 'match' is Padé-fit precision, not an independent NIAH measurement" },
  { id: "F3",  claim: "Fisher info predicts forward-hook recovery within 0.2%",            status: "confirmed", evidence: "12.5% predicted vs 12.3% observed" },
  { id: "F4",  claim: "Layer asymmetry early/late ratio ≈ 13.5× (pythia-70m)",             status: "confirmed", evidence: "F2 thermostat experiment" },
  { id: "F5",  claim: "Area law S_γ = O(log N) for all γ > 0",                              status: "confirmed", evidence: "n=56, r=-0.954" },
  { id: "F6",  claim: "KV truncation at D_f gives ΔPPL ≤ 0 in γ ∈ [0.65, 0.85]",            status: "confirmed", evidence: "pythia-2.8b ΔPPL=-0.51" },
  { id: "F7",  claim: "Linear pruning cost: ΔPPL ≈ 0.18 × %Q/K_pruned",                    status: "confirmed", evidence: "pythia-1b 0.17, 2.8b 0.18" },
  { id: "F8",  claim: "Padé saturates at [1,1] in LLM regime z<<1",                        status: "confirmed", evidence: "sage round 4" },
  { id: "F9",  claim: "RoPE attention is Euclidean fractional (d_eff=1/γ), not hyperbolic", status: "confirmed", evidence: "EXP-METRIC-RoPE sage" },
  { id: "F10", claim: "Δγ < -0.1 in models ≥ 400M ⇒ GQA / induction-head dominance",       status: "confirmed", evidence: "n=20+ models" },
  { id: "F11", claim: "Δγ > +0.3 ⇒ alternating SWA (Gemma family signature)",              status: "confirmed", evidence: "Gemma-2-9b Δγ=+0.51" },
  { id: "F12", claim: "Mamba L_crit = 45, α = 0.703",                                       status: "confirmed", evidence: "3 seeds" },
  { id: "F13", claim: "Phase boundary at γ = 1 (Hagedorn)",                                 status: "confirmed", evidence: "χ → ∞" },
  { id: "F14", claim: "RLHF Δγ shift ≤ 0.072 (recipe-specific)",                            status: "partial",   evidence: "n=8 recipe-locked" },
  { id: "F15", claim: "R_c boundary at R_c★ ≈ 1.68",                                        status: "refuted",   evidence: "overlap zone [0.92, 3.08] n=9" },
  { id: "F16", claim: "Holographic pruning: alive bands in ℓ > L_crit ΔPPL ≈ 0",             status: "refuted",   evidence: "linear cost law instead" },
  { id: "F17", claim: "Soft d_horizon decay beats hard in regime d_h ≳ T_train/2",          status: "partial",   evidence: "n=2/3 (pythia-1b refuted)" },
  { id: "F18", claim: "Mittag-Leffler prefactor 1/Γ(1-γ) governs A_0",                       status: "refuted",   evidence: "n=39, ratio 0.23" },
  { id: "F19", claim: "γ_Padé predicts γ_obs across-model variance",                          status: "partial",   evidence: "centroid OK, ~0.1% var explained, see §sec:gamma_decomposition" },
  { id: "F20", claim: "β-flow exactly equivalent to logistic ODE",                            status: "confirmed", evidence: "sage symbolic check" },
  { id: "F21", claim: "tanh trajectory γ(t)~tanh(log step) on pythia-1b checkpoints",        status: "refuted",   evidence: "R²=0.15 on 4 checkpoints" },
  { id: "F22", claim: "χ(z*) = (5+√17)/4 closed form at Cayley fixed point",                 status: "confirmed", evidence: "sage symbolic, minimal poly 2y²-5y+1" },
  { id: "F23", claim: "T ↔ d_horizon involution: θ_design ∘ γ_Padé = id",                    status: "confirmed", evidence: "sage symbolic" },
];

function renderFalsificationDashboard() {
  const target = $("falsification-table");
  if (!target) return;
  const counts = { confirmed: 0, partial: 0, refuted: 0, untested: 0 };
  FALSIFICATION_STATUS.forEach(f => counts[f.status]++);
  const summary = `<p class="subtle">
    ✅ <strong>${counts.confirmed}</strong> confirmed ·
    ⚠ <strong>${counts.partial}</strong> partial ·
    ❌ <strong>${counts.refuted}</strong> refuted ·
    ⏳ <strong>${counts.untested}</strong> untested
    (out of ${FALSIFICATION_STATUS.length} total predictions)
  </p>`;
  let table = `<table class="falsification-table"><thead>
    <tr><th>ID</th><th>Claim</th><th>Status</th><th>Evidence</th></tr>
    </thead><tbody>`;
  FALSIFICATION_STATUS.forEach(f => {
    const icon = ({ confirmed: "✅", partial: "⚠", refuted: "❌", untested: "⏳" })[f.status];
    table += `<tr>
      <td><code>${f.id}</code></td>
      <td>${escapeHtml(f.claim)}</td>
      <td class="fal-status ${f.status}">${icon} ${f.status}</td>
      <td class="subtle">${escapeHtml(f.evidence)}</td>
    </tr>`;
  });
  table += "</tbody></table>";
  target.innerHTML = summary + table;
}

// ════════════════════════════════════════════════════════════════════
// Browse community submissions (live from GitHub Issues API)
// ════════════════════════════════════════════════════════════════════
async function loadCommunityFeed() {
  const target = $("community-feed");
  if (!target) return;
  try {
    const resp = await fetch(`https://api.github.com/repos/${REGISTRY_REPO}/issues?state=open&per_page=15&sort=created&direction=desc`);
    if (!resp.ok) {
      if (resp.status === 404) {
        target.innerHTML = `<em>The registry repo isn't created yet. Once <a href="https://github.com/${REGISTRY_REPO}" target="_blank"><code>${REGISTRY_REPO}</code></a> exists with submissions, they'll appear here live.</em>`;
        return;
      }
      throw new Error(`HTTP ${resp.status}`);
    }
    const issues = await resp.json();
    if (!issues || issues.length === 0) {
      target.innerHTML = `<em>No submissions yet. Be the first — generate a Profile and click <strong>📤 Submit to registry</strong>.</em>`;
      return;
    }
    const html = issues.map(issue => {
      const verdict = extractVerdictFromTitle(issue.title);
      const vClass = verdictClass(verdict);
      const time = relativeTime(new Date(issue.created_at));
      return `<div class="community-item">
        <span class="verdict-badge ${vClass}">${escapeHtml(verdict)}</span>
        <a href="${escapeHtml(issue.html_url)}" target="_blank">${escapeHtml(issue.title)}</a>
        <span class="item-time">${time}</span>
      </div>`;
    }).join("");
    target.innerHTML = html;
  } catch (err) {
    target.innerHTML = `<em>⚠ Couldn't load community feed: ${escapeHtml(err.message)}</em>`;
  }
}

function extractVerdictFromTitle(title) {
  const m = title.match(/→\s*(\S+)/);
  if (m) return m[1];
  if (title.includes("YES")) return "YES";
  if (title.includes("NO"))  return "NO";
  if (title.includes("DEGRADED")) return "DEG";
  if (title.includes("Profile")) return "📇";
  if (title.includes("Compare")) return "🆚";
  return "?";
}

function verdictClass(v) {
  if (v.startsWith("YES") || v === "GO") return "yes";
  if (v.startsWith("NO")) return "no";
  if (v === "DEG" || v === "DEGRADED") return "deg";
  return "";
}

function relativeTime(d) {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

// ════════════════════════════════════════════════════════════════════
// PROFILE mode
// ════════════════════════════════════════════════════════════════════
$("profile-preset").addEventListener("change", (e) => {
  if (!e.target.value) return;
  const modelId = e.target.value;
  state.lastModelId = modelId;  // remember for filename/hash
  // Preset keys ARE valid HF model ids (e.g. "meta-llama/Llama-3.2-1B"). Auto-fill
  // the HF id input so the user can also click 📥 Fetch to refresh from HF Hub
  // without retyping. Status hint clarifies the dual source of truth.
  if ($("profile-hf-id")) {
    $("profile-hf-id").value = modelId;
    if ($("profile-hf-status")) {
      $("profile-hf-status").textContent = tFmt("profile.preset_loaded", { id: modelId });
    }
  }
  const proxy = state.pyodide.runPython(`get_preset(${JSON.stringify(modelId)})`);
  const p = proxy.toJs ? proxy.toJs({ dict_converter: Object.fromEntries }) : proxy;
  if (!p || Object.keys(p).length === 0) return;
  $("profile-theta").value = p.theta;
  $("profile-T_train").value = p.T_train;
  $("profile-n_attn").value = p.n_attention_heads;
  $("profile-n_kv").value = p.n_kv_heads;
  $("profile-d_head").value = p.d_head;
  $("profile-n_layers").value = p.n_layers;
  $("profile-n_params").value = p.n_params.toExponential(2);
  $("profile-has_swa").value = String(p.has_SWA);
});

$("profile-fetch-btn").addEventListener("click", async () => {
  const id = $("profile-hf-id").value.trim();
  if (!id) { $("profile-hf-status").textContent = "⚠ Enter a model id"; return; }
  $("profile-hf-status").textContent = `⏳ Fetching ${id}...`;
  $("profile-fetch-btn").disabled = true;
  state.lastModelId = id;  // remember for filename/hash
  try {
    const cfg = await fetchHfConfig(id);
    const p = configToPreset(cfg, id);
    $("profile-theta").value = p.theta;
    $("profile-T_train").value = p.T_train;
    $("profile-n_attn").value = p.n_attention_heads;
    $("profile-n_kv").value = p.n_kv_heads;
    $("profile-d_head").value = p.d_head;
    $("profile-n_layers").value = p.n_layers;
    $("profile-n_params").value = p.n_params.toExponential(2);
    $("profile-has_swa").value = String(p.has_SWA);
    $("profile-hf-status").innerHTML = `✅ <strong>${escapeHtml(id)}</strong> (${p._family})`;
  } catch (err) {
    $("profile-hf-status").textContent = `❌ ${err.message}`;
  } finally {
    $("profile-fetch-btn").disabled = false;
  }
});

$("profile-btn").addEventListener("click", async () => {
  const params = {
    theta: parseFloat($("profile-theta").value),
    T_train: parseInt($("profile-T_train").value),
    T_eval: parseInt($("profile-T_eval").value),
    n_attention_heads: parseInt($("profile-n_attn").value),
    n_kv_heads: parseInt($("profile-n_kv").value),
    d_head: parseInt($("profile-d_head").value),
    n_layers: parseInt($("profile-n_layers").value),
    n_params: parseFloat($("profile-n_params").value),
    has_SWA: $("profile-has_swa").value === "true",
  };
  setStatus("🧮 Profiling — running all 5 recipes...");
  $("profile-btn").disabled = true;
  try {
    state.pyodide.globals.set("__pp", state.pyodide.toPy(params));
    const json = state.pyodide.runPython(`
import json
result = profile_model(**__pp)
json.dumps(result)
`);
    const profile = JSON.parse(json);
    renderProfile(profile, params);
    state.lastResult = { type: "profile", params };
    state.lastFullResult = profile;
    setStatus("✅ Profile ready.");
  } catch (err) {
    setStatus(`❌ ${err.message}`);
    console.error(err);
  } finally {
    $("profile-btn").disabled = false;
  }
});

function renderProfile(p, params) {
  $("profile-output").style.display = "block";
  // Hide other outputs
  $("output-section").style.display = "none";
  $("compare-output").style.display = "none";

  const verdictClass = (v) => {
    if (v.startsWith("YES") || v === "GO" || v.startsWith("USE SOFT")) return "v-yes";
    if (v.startsWith("NO") || v.startsWith("MEMORY") || v === "TINY-MODEL") return "v-no";
    return "v-deg";
  };
  const verdictEmoji = (v) => verdictClass(v) === "v-yes" ? "✅"
                            : verdictClass(v) === "v-no" ? "❌" : "⚠";

  const ms = p.model_summary;
  const kn = p.key_numbers;
  const formatN = (x) => x === null || x === undefined ? "n/a"
                       : (typeof x === "number" ? x.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(x));

  const recipesHtml = Object.entries(p.recipes).map(([rid, r]) => `
    <div class="taf-recipe-tile ${verdictClass(r.verdict)}">
      <div class="tile-header">
        <span>${escapeHtml(rid)} — <span class="tile-name">${escapeHtml(r.name)}</span></span>
        <span class="tile-verdict">${verdictEmoji(r.verdict)} ${escapeHtml(r.verdict)}</span>
      </div>
      <div class="tile-reason">${escapeHtml(r.reason || "")}</div>
      ${r.mitigation && r.mitigation !== "None required." && r.mitigation !== "None — proceed with Chinchilla-optimal recipe."
        ? `<div class="tile-reason" style="margin-top:0.4rem; color:var(--fg-dim);"><strong>Action:</strong> ${escapeHtml(r.mitigation)}</div>`
        : ""}
    </div>
  `).join("");

  // Reusable tooltip helper — keeps tooltip pattern uniform across the card
  const ttip = (key, fallback) =>
    `<span class="info"><span class="tooltip" data-i18n="${key}">${fallback}</span></span>`;

  const numbersHtml = `
    <div class="num-row"><span class="num-label">γ_Padé(T_eval) ${ttip("tooltip.gamma_pade", "Closed-form prediction (2−z)/(2+z), z = T√2/θ. Paper §sec:gamma_decomposition.")}</span><span class="num-value">${formatN(kn.gamma_pade)}</span></div>
    <div class="num-row"><span class="num-label">γ_decomposed ${ttip("tooltip.gamma_decomposed", "γ from full architectural decomposition: Padé baseline + GQA shift + SWA shift + post-IH shift.")}</span><span class="num-value">${formatN(kn.gamma_decomposed)}</span></div>
    <div class="num-row"><span class="num-label">d_horizon ${ttip("tooltip.d_horizon", "Effective attention horizon at T_eval. Beyond this, attention scores fall below the noise floor (paper §26).")}</span><span class="num-value">${formatN(kn.d_horizon)}</span></div>
    <div class="num-row"><span class="num-label">L_NIAH ceiling ${ttip("tooltip.L_NIAH", "Predicted ceiling for needle-in-a-haystack retrieval reliability at the current d_horizon.")}</span><span class="num-value">${formatN(kn.L_NIAH_ceiling)}</span></div>
    <div class="num-row"><span class="num-label">χ susceptibility ${ttip("tooltip.chi", "Susceptibility exponent χ = 1/(1−γ). Diverges at the Hagedorn line γ=1.")}</span><span class="num-value">${formatN(kn.chi_susceptibility)}</span></div>
    <div class="num-row"><span class="num-label">KV memory @ T_eval (BF16) ${ttip("tooltip.kv_memory", "Per-request KV cache memory at T_eval in BF16 = 2 · n_layers · n_kv_heads · d_head · T_eval bytes.")}</span><span class="num-value">${formatN(kn.kv_memory_per_request_GB)} GB</span></div>
  `;

  const falsHtml = (p.falsification_status || []).map(f =>
    `<div class="taf-falsification"><strong>${escapeHtml(f.id)}</strong> — ${escapeHtml(f.claim)}: ${escapeHtml(f.status)}</div>`
  ).join("");

  // Per-verdict count breakdown — recipes test orthogonal axes (long-context,
  // budget, hardware, custom-vs-API, KV-compression). Worst-of-N would conflate
  // a "use API" recommendation with a long-context failure, so we show counts.
  const verdictCounts = Object.values(p.recipes).reduce((acc, r) => {
    const c = verdictClass(r.verdict);
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});
  const nYes = verdictCounts["v-yes"] || 0;
  const nDeg = verdictCounts["v-deg"] || 0;
  const nNo  = verdictCounts["v-no"]  || 0;
  const breakdownCls = nNo ? "v-no" : nDeg ? "v-deg" : "v-yes";
  const gammaForPill = kn.gamma_decomposed ?? kn.gamma_pade;
  const recipeCount = Object.keys(p.recipes).length;

  // v0.8.9: pre-compute γ Validity Gate state so we can auto-expand Diagnostics when banner fires.
  const _initGObs = kn.gamma_decomposed ?? kn.gamma_pade;
  const _initGCheck = (typeof _initGObs === "number" && Number.isFinite(_initGObs))
    ? gammaCheckAll({ theta: params.theta, T: params.T_eval, gObs: _initGObs, isRandom: false })
    : null;
  const _validitySet = new Set(["fraud", "compressed", "overpade", "swa", "unknown"]);
  const initialBannerActive = _initGCheck && (
    _validitySet.has(_initGCheck.regime) ||
    (Number.isFinite(_initGCheck.efficiency) && (_initGCheck.efficiency < 0.85 || _initGCheck.efficiency > 1.15))
  );
  const diagOpenAttr = initialBannerActive ? " open" : "";

  $("profile-box").innerHTML = `
    <div class="taf-card">
      <div class="taf-hero">
        <div class="hero-arch">${escapeHtml(ms.architecture_class)}</div>
        <div class="hero-meta">
          n_params=${formatN(ms.n_params)} ·
          T_train=${ms.T_train} · T_eval=${ms.T_eval} ·
          θ=${formatN(ms.rope_theta)} ·
          ${ms.has_GQA ? "GQA" : "MHA"}${ms.has_SWA ? " + SWA" : ""}
        </div>
        <div class="hero-row">
          <span class="hero-pill ${breakdownCls}">✅ ${nYes} · ⚠ ${nDeg} · ❌ ${nNo} ${ttip("tooltip.verdict_breakdown", "Per-recipe breakdown across the orthogonal axes (long-context, budget, hardware, custom-vs-API, KV-compression). Recipes are independent decisions — a ❌ on X-1 means \"use API\" not \"model fails\". Open the Recipes section for per-axis verdict.")}</span>
          ${gammaForPill !== null && gammaForPill !== undefined
            ? `<span class="hero-pill">γ = ${formatN(gammaForPill)} ${ttip("tooltip.gamma_pill", "γ_decomposed (full architectural decomposition) or γ_Padé as fallback. Range (0,1) = Phase A (anti-Ising). γ ≥ 1 = Hagedorn / Phase B.")}</span>`
            : ''}
          ${gammaForPill > 0 && gammaForPill < 1
            ? `<span class="hero-pill" style="background:rgba(110,80,200,0.15); border-color:rgba(110,80,200,0.45);"><span data-i18n="v05.antiising.badge">🧲 Anti-Ising (β=γ−1&lt;0, machine-verified)</span> ${ttip("tooltip.anti_ising", "Phase A class: β = γ−1 &lt; 0 (anti-Ising). Machine-verified by Sage Groebner basis + Lean Mathlib4. See §35 v0.5.")} ${badgesForUiBinding("anti_ising_pill")}</span>`
            : ''}
        </div>
      </div>

      <details class="taf-section" open>
        <summary>
          <span data-i18n="tafcard.recipes_title">📋 Recipes — verdict per dimension</span>
          <span class="section-count">${recipeCount} ${t("tafcard.recipes_count_label", "dimensions")}</span>
        </summary>
        <div class="taf-section-body">
          <div class="taf-recipes-grid">${recipesHtml}</div>
        </div>
      </details>

      <details class="taf-section" id="diag-section"${diagOpenAttr}>
        <summary>
          <span data-i18n="tafcard.diag_title">🔬 Diagnostics — numbers + γ check + what-if</span>
          <span id="diag-validity-pill" class="section-count" data-i18n="gamma_check.validity.summary_pill" style="${initialBannerActive ? 'background:rgba(210,153,34,0.18); color:#d29922; border:1px solid rgba(210,153,34,0.4);' : 'display:none;'}">⚠ Validity gate</span>
        </summary>
        <div class="taf-section-body">
          <h4 style="margin-top:0.3em;" data-i18n="tafcard.numbers_title">🔢 Key numbers (paper §26)</h4>
          <div class="taf-key-numbers">${numbersHtml}</div>

          <h4 style="margin-top:1.2em;" data-i18n="gamma_check.title">🔍 γ predicted vs observed</h4>
          <div class="recipe-desc" data-i18n="gamma_check.desc">
            Enter your empirically measured γ. Tool detects regime: fraud (θ inflated) / compressed / over-Padé / SWA-random / normal.
          </div>
          <div class="form-grid" style="margin:0.5em 0 0.6em;">
            <div class="form-field">
              <label><span data-i18n="gamma_check.gobs_label">γ_observed</span>
                <span class="info"><span class="tooltip" data-i18n="gamma_check.gobs_tip">Empirically measured γ from your model's attention scores. Use the Diagnose CLI to obtain this from real weights.</span></span>
              </label>
              <input type="number" id="gc-gobs" step="0.0001" value="${(() => { const v = kn.gamma_decomposed ?? kn.gamma_pade; return (typeof v === "number" && Number.isFinite(v)) ? v.toFixed(4) : ""; })()}" />
            </div>
            <div class="form-field">
              <label><span data-i18n="gamma_check.random_label">Random corpus?</span>
                <span class="info"><span class="tooltip" data-i18n="gamma_check.random_tip">Tick if γ_observed was measured on random/unstructured tokens. Distinguishes SWA signature (γ_obs &gt; 1) from anomaly.</span></span>
              </label>
              <select id="gc-random">
                <option value="false" selected data-i18n="common.no">No</option>
                <option value="true" data-i18n="common.yes">Yes</option>
              </select>
            </div>
          </div>
          <div id="gamma-check-results"></div>

          <h4 style="margin-top:1.2em;" data-i18n="tafcard.whatif_title">🎚️ What-if explorer</h4>
          <div id="whatif-container" class="whatif-box"></div>
        </div>
      </details>

      <details class="taf-section">
        <summary>
          <span data-i18n="tafcard.verify_title">✓ Verification — Lean + Sage + falsification</span>
        </summary>
        <div class="taf-section-body">
          <h4 style="margin-top:0.3em;" data-i18n="lean.table.title">📑 Lean+Mathlib theorem table</h4>
          <div style="margin-bottom: 0.6em; opacity: 0.85; font-size: 0.92em;" data-i18n="lean.table.desc">
            Every entry below is machine-proven against Lean 4 + Mathlib4. Click any L# link to jump to the source line on GitHub. The table is grouped by topic; click a header to expand.
          </div>
          <div id="lean-table-host"></div>

          <h4 style="margin-top:1.2em;" data-i18n="v05.consistency.title">🔬 Algebraic consistency (Sage + Lean v0.5)</h4>
          <div style="margin-bottom: 0.6em; opacity: 0.85; font-size: 0.92em;" data-i18n="v05.consistency.desc">
            Verifies 12 D-SAGE algebraic identities of TAF critical exponents (machine-proof Sage Groebner basis + Lean Mathlib4). Pass = framework intact. Fail = bf16 outlier / quantization artifact.
          </div>
          <div class="lean-badges-row">${badgesForUiBinding("algebraic_consistency_check")}</div>
          <button class="secondary" id="verify-consistency-btn" data-i18n="v05.consistency.btn">
            🔬 Verify algebraic consistency
          </button>
          <div id="consistency-result" style="margin-top: 0.8em;"></div>

          <h4 style="margin-top:1.2em;" data-i18n="tafcard.fals_title">🔬 Falsification status (F1-F23)</h4>
          ${falsHtml || '<div class="subtle" data-i18n="tafcard.fals_none">No falsifications applicable.</div>'}
        </div>
      </details>

      <details class="taf-section">
        <summary>
          <span data-i18n="tafcard.share_title">📂 Provenance & share</span>
        </summary>
        <div class="taf-section-body">
          <details style="margin:0.4em 0 0.8em; padding:0.6em 0.8em; border:1px solid rgba(241,196,15,0.5); border-radius:6px; background:rgba(241,196,15,0.07); font-size:0.88em;">
            <summary style="cursor:pointer; font-weight:600;" data-i18n="v053.calibration.title">🔬 v0.5.3 — Calibration audit (2026-05-02)</summary>
            <div style="margin-top:0.5em; line-height:1.45;" data-i18n="v053.calibration.note"></div>
          </details>

          <div class="share-bar">
            <button class="secondary" id="profile-share-btn" data-i18n="share.btn">🔗 Copy share link</button>
            <button class="secondary" id="profile-download-btn" data-i18n="share.download">💾 Download JSON</button>
            <button class="secondary" id="profile-download-md-btn" data-i18n="share.download_md">📝 Markdown</button>
            <button class="secondary" id="profile-download-tex-btn" data-i18n="share.download_tex">📜 LaTeX</button>
            <button class="secondary" id="profile-submit-btn" data-i18n="share.submit">📤 Submit to registry</button>
            <span id="profile-share-status" class="subtle"></span>
          </div>
        </div>
      </details>
    </div>
  `;

  // Render the what-if slider for interactive exploration
  renderWhatIfSlider(p, params, $("whatif-container"));

  // Render Lean+Mathlib theorem table (graceful no-op if manifest missed).
  // Loaded async at bootstrap; if Profile clicked before fetch resolves we
  // wait once and then render.
  const renderLeanTable = () => {
    const host = $("lean-table-host");
    if (!host) return;
    if (getManifest()) {
      host.innerHTML = renderTheoremTable();
      if (window.__taf_applyTranslations) window.__taf_applyTranslations();
    } else {
      host.innerHTML = `<div class="subtle" data-i18n="lean.manifest.loading">Loading Lean manifest…</div>`;
      loadLeanManifest()
        .then(() => { host.innerHTML = renderTheoremTable(); if (window.__taf_applyTranslations) window.__taf_applyTranslations(); })
        .catch(err => { host.innerHTML = `<div class="subtle" data-i18n="lean.manifest.error">Lean manifest unavailable: ${escapeHtml(String(err.message))}</div>`; });
    }
  };
  renderLeanTable();

  // Re-apply translations to dynamically inserted buttons
  if (window.__taf_applyTranslations) window.__taf_applyTranslations();

  // Wire share/download/submit buttons
  $("profile-share-btn").addEventListener("click", () => copyShareLink("profile", params));
  $("profile-download-btn").addEventListener("click", async () => {
    const filename = await makeFilename("profile", p);
    const data = await exportableData("profile", p);
    downloadJSON(filename, data);
    $("profile-share-status").textContent = `✅ Downloaded ${filename}`;
    setTimeout(() => $("profile-share-status").textContent = "", 5000);
  });
  $("profile-download-md-btn").addEventListener("click", async () => {
    const hash = await inputHash("profile", p);
    const base = (await makeFilename("profile", p)).replace(/\.json$/, "");
    downloadText(`${base}.md`, profileToMarkdown(p, hash), "text/markdown;charset=utf-8");
    $("profile-share-status").textContent = `✅ Downloaded ${base}.md`;
    setTimeout(() => $("profile-share-status").textContent = "", 5000);
  });
  $("profile-download-tex-btn").addEventListener("click", async () => {
    const hash = await inputHash("profile", p);
    const base = (await makeFilename("profile", p)).replace(/\.json$/, "");
    downloadText(`${base}.tex`, profileToLatex(p, hash), "application/x-tex;charset=utf-8");
    $("profile-share-status").textContent = `✅ Downloaded ${base}.tex`;
    setTimeout(() => $("profile-share-status").textContent = "", 5000);
  });
  $("profile-submit-btn").addEventListener("click", async () => {
    await submitToRegistry("profile", p, $("profile-share-status"));
    setTimeout(() => $("profile-share-status").textContent = "", 8000);
  });

  // v0.6: γ predicted-vs-observed panel — interactive
  const updateGammaCheck = () => {
    const gObs = parseFloat($("gc-gobs").value);
    const isRandom = $("gc-random").value === "true";
    const r = gammaCheckAll({ theta: params.theta, T: params.T_eval, gObs, isRandom });
    const meta = REGIME_META[r.regime] || REGIME_META.unknown;
    const fmt = (x, d=4) => (x === null || x === undefined || Number.isNaN(x))
      ? "n/a"
      : (!Number.isFinite(x) ? "∞" : Number(x).toLocaleString(undefined, { maximumFractionDigits: d }));
    const validityRegimes = new Set(["fraud", "compressed", "overpade", "swa", "unknown"]);
    const effOutOfBand = Number.isFinite(r.efficiency) && (r.efficiency < 0.85 || r.efficiency > 1.15);
    const showValidity = validityRegimes.has(r.regime) || effOutOfBand;
    const validityBanner = showValidity ? `
      <div class="gc-validity-warning" style="margin-top:0.6em; padding:0.7em 0.9em; border-left:3px solid #d29922; background:rgba(210,153,34,0.08); border-radius:4px;">
        <div style="font-weight:600; margin-bottom:0.3em;" data-i18n="gamma_check.validity.title">⚠ Closed-form γ may not apply to this model</div>
        <div style="font-size:0.92em;" data-i18n="gamma_check.validity.body"></div>
        <div style="font-size:0.85em; margin-top:0.3em; opacity:0.85;" data-i18n="gamma_check.validity.${r.regime}.hint"></div>
      </div>
    ` : "";
    $("gamma-check-results").innerHTML = `
      <div class="taf-key-numbers">
        <div class="num-row"><span class="num-label">γ_Padé(T_eval) ${ttip("tooltip.gamma_pade", "Closed-form prediction (2−z)/(2+z), z = T√2/θ.")}</span><span class="num-value">${fmt(r.gammaPade)}</span></div>
        <div class="num-row"><span class="num-label">θ_eff (observed) ${ttip("tooltip.theta_eff_obs", "Effective θ implied by your γ_observed: T√2 / (1 − γ_obs).")}</span><span class="num-value">${fmt(r.thetaEffObs, 1)}</span></div>
        <div class="num-row"><span class="num-label">θ_eff (Padé) ${ttip("tooltip.theta_eff_pade", "Effective θ predicted by closed-form: θ + T/√2.")}</span><span class="num-value">${fmt(r.thetaEffPade, 1)}</span></div>
        <div class="num-row"><span class="num-label">η = θ_eff_obs / θ_eff_Padé ${ttip("tooltip.efficiency", "Efficiency ratio. ≈1 = normal · &lt;0.01 = fraud · &lt;0.5 = compressed · &gt;1.5 = over-Padé.")}</span><span class="num-value">${fmt(r.efficiency)}</span></div>
        <div class="num-row"><span class="num-label">ΔH_Cardy = log(θ_eff_obs / θ_nominal) ${ttip("tooltip.delta_h_cardy", "Cardy entropy shift. Negative = compression entropy. ~0 = nominal match.")}</span><span class="num-value">${fmt(r.deltaHCardy)}</span></div>
      </div>
      ${validityBanner}
      <div class="taf-recipe-tile ${meta.cls}" style="margin-top:0.6em;">
        <div class="tile-header">
          <span data-i18n="gamma_check.regime">Regime</span>
          <span class="tile-verdict">${meta.emoji} <span data-i18n="gamma_check.regime.${r.regime}">${r.regime}</span></span>
        </div>
        <div class="tile-reason" data-i18n="gamma_check.regime.${r.regime}.desc"></div>
      </div>
      <details style="margin-top:0.6em;">
        <summary style="cursor:pointer; font-weight:600;" data-i18n="gamma_check.glossary.title">ⓘ What do these mean?</summary>
        <ul class="gc-glossary" style="margin:0.5em 0 0 1.2em; line-height:1.55;">
          <li data-i18n="gamma_check.glossary.gamma_pade"></li>
          <li data-i18n="gamma_check.glossary.gamma_obs"></li>
          <li data-i18n="gamma_check.glossary.theta_eff_obs"></li>
          <li data-i18n="gamma_check.glossary.theta_eff_pade"></li>
          <li data-i18n="gamma_check.glossary.efficiency"></li>
          <li data-i18n="gamma_check.glossary.delta_h"></li>
          <li data-i18n="gamma_check.glossary.regime"></li>
        </ul>
      </details>
    `;
    // v0.8.9: keep summary pill + Diagnostics auto-open in sync with current γ_obs.
    const diagSection = document.getElementById("diag-section");
    const validityPill = document.getElementById("diag-validity-pill");
    if (validityPill) {
      validityPill.style.cssText = showValidity
        ? "background:rgba(210,153,34,0.18); color:#d29922; border:1px solid rgba(210,153,34,0.4);"
        : "display:none;";
    }
    if (diagSection && showValidity && !diagSection.open) {
      diagSection.open = true;
    }
    if (window.__taf_applyTranslations) window.__taf_applyTranslations();
  };
  $("gc-gobs").addEventListener("input", updateGammaCheck);
  $("gc-random").addEventListener("change", updateGammaCheck);
  updateGammaCheck();

  // v0.5.1: Algebraic consistency check button
  $("verify-consistency-btn").addEventListener("click", () => {
    const gammaVal = kn.gamma_decomposed ?? kn.gamma_pade;
    if (gammaVal === null || gammaVal === undefined) {
      $("consistency-result").innerHTML = `<div class="subtle">⚠ No γ value available for verification.</div>`;
      return;
    }
    if (gammaVal <= 0 || gammaVal >= 1) {
      $("consistency-result").innerHTML = `
        <div style="padding:0.6em; border-left:3px solid #d29922; background:rgba(210,153,34,0.08);">
          ⚠ <strong>γ = ${gammaVal.toFixed(4)} out of Phase A</strong> — verification requires γ ∈ (0, 1).
          ${gammaVal >= 1 ? "Hagedorn boundary reached." : "Phase B / negative regime."}
        </div>`;
      return;
    }
    try {
      const json = state.pyodide.runPython(`
import json
result = verify_algebraic_consistency(${gammaVal})
json.dumps(result)
`);
      const r = JSON.parse(json);
      const passed = r.n_checks_passed;
      const total = r.n_checks_total;
      const allOk = r.all_consistent;
      const tooltipText = (id) => {
        const key = `v05.tooltip.${id.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const tip = t(key);
        return (tip === key) ? '' : tip;
      };
      const checksRows = Object.entries(r.checks).map(([id, c]) => {
        const tip = tooltipText(id);
        return `<div class="num-row" style="padding:0.25em 0;" ${tip ? `title="${escapeHtml(tip)}"` : ''}>
          <span class="num-label" style="font-family:monospace;font-size:0.85em;${tip ? 'cursor:help;border-bottom:1px dotted rgba(110,180,255,0.5);' : ''}">${escapeHtml(id)}: ${escapeHtml(c.claim)}</span>
          <span class="num-value" style="color:${c.passes ? "#3fb950" : "#f85149"};">${c.passes ? "✓" : "✗"}</span>
        </div>`;
      }).join("");
      $("consistency-result").innerHTML = `
        <div style="padding:0.7em; border-left:3px solid ${allOk ? "#3fb950" : "#f85149"}; background:rgba(${allOk ? "63,185,80" : "248,81,73"},0.08); margin-bottom:0.5em;">
          <strong>${allOk ? "✅" : "❌"} ${passed}/${total} D-SAGE identities ${allOk ? "consistent" : "FAILED"}</strong>
          <div style="font-size:0.9em; opacity:0.85; margin-top:0.3em;">${escapeHtml(r.interpretation)}</div>
          <div style="font-size:0.82em; opacity:0.75; margin-top:0.3em; font-style:italic;">Verified by: ${escapeHtml(r.framework_verified_by)}</div>
        </div>
        <details style="margin-top:0.4em;">
          <summary style="cursor:pointer; font-size:0.9em;">🔍 Per-identity details (${total} checks)</summary>
          <div style="padding:0.5em 0;">${checksRows}</div>
        </details>
      `;
    } catch (err) {
      $("consistency-result").innerHTML = `<div style="color:#f85149;">❌ Error: ${escapeHtml(err.message || String(err))}</div>`;
      console.error(err);
    }
  });
}

// ════════════════════════════════════════════════════════════════════
// COMPARE mode
// ════════════════════════════════════════════════════════════════════
$("compare-recipe").addEventListener("change", () => {
  $("compare-btn").disabled = !$("compare-recipe").value;
});

document.querySelectorAll(".compare-preset").forEach(sel => {
  sel.addEventListener("change", (e) => {
    const slot = e.target.closest(".compare-slot");
    if (e.target.value) {
      slot.querySelector(".compare-hf-id").value = e.target.value;
    }
  });
});

$("compare-btn").addEventListener("click", async () => {
  const recipeId = $("compare-recipe").value;
  if (!recipeId) { alert("Pick a recipe first."); return; }
  const T_eval = parseInt($("compare-T_eval").value);
  const slots = document.querySelectorAll(".compare-slot");
  const specs = [];
  setStatus("⏳ Fetching configs for compared models...");
  $("compare-btn").disabled = true;

  for (const slot of slots) {
    const id = slot.querySelector(".compare-hf-id").value.trim();
    if (!id) continue;
    try {
      let preset = null;
      const presetProxy = state.pyodide.runPython(`get_preset(${JSON.stringify(id)})`);
      const p = presetProxy.toJs ? presetProxy.toJs({ dict_converter: Object.fromEntries }) : presetProxy;
      if (p && Object.keys(p).length > 0) {
        preset = p;
      } else {
        const cfg = await fetchHfConfig(id);
        preset = configToPreset(cfg, id);
      }
      specs.push({ ...preset, label: id.split("/").pop() });
    } catch (err) {
      console.error("compare fetch fail for", id, err);
      setStatus(`⚠ Skipped ${id}: ${err.message}`);
    }
  }

  if (specs.length < 2) {
    setStatus("❌ Need at least 2 models to compare.");
    $("compare-btn").disabled = false;
    return;
  }

  setStatus(`🧮 Comparing ${specs.length} models on ${recipeId}...`);
  try {
    state.pyodide.globals.set("__cspecs", state.pyodide.toPy(specs));
    state.pyodide.globals.set("__crid", recipeId);
    state.pyodide.globals.set("__cshared", state.pyodide.toPy({ T_eval }));
    const json = state.pyodide.runPython(`
import json
result = compare_models(__cspecs.to_py(), __crid, __cshared.to_py())
json.dumps(result)
`);
    const cmp = JSON.parse(json);
    renderCompare(cmp);
    state.lastResult = { type: "compare", recipeId, T_eval, specs };
    state.lastFullResult = cmp;
    setStatus("✅ Comparison ready.");
  } catch (err) {
    setStatus(`❌ ${err.message}`);
    console.error(err);
  } finally {
    $("compare-btn").disabled = false;
  }
});

function renderCompare(cmp) {
  $("compare-output").style.display = "block";
  $("output-section").style.display = "none";
  $("profile-output").style.display = "none";

  const verdictClass = (v) => {
    if (v.startsWith("YES") || v === "GO" || v.startsWith("USE SOFT")) return "v-yes";
    if (v.startsWith("NO") || v.startsWith("MEMORY")) return "v-no";
    return "v-deg";
  };

  // Collect all unique key_numbers across rows
  const allKeys = new Set();
  cmp.rows.forEach(r => Object.keys(r.key_numbers || {}).forEach(k => allKeys.add(k)));

  let html = `
    <p class="recipe-desc"><strong>Recipe:</strong> ${escapeHtml(cmp.recipe_id)} — ${escapeHtml(cmp.recipe_name)}</p>
    <p class="recipe-desc"><strong>Shared params:</strong> ${escapeHtml(JSON.stringify(cmp.shared_params))}</p>
    <table class="compare-table">
      <thead>
        <tr><th>Model</th><th>Verdict</th><th>Reason</th>
  `;
  allKeys.forEach(k => html += `<th>${escapeHtml(k)}</th>`);
  html += "</tr></thead><tbody>";

  cmp.rows.forEach(r => {
    const cls = verdictClass(r.verdict);
    html += `<tr><td><strong>${escapeHtml(r.label)}</strong></td>`;
    html += `<td class="${cls}">${escapeHtml(r.verdict)}</td>`;
    html += `<td>${escapeHtml(r.reason)}</td>`;
    allKeys.forEach(k => {
      const v = r.key_numbers ? r.key_numbers[k] : null;
      html += `<td>${v === undefined || v === null ? "—" : (typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : escapeHtml(String(v)))}</td>`;
    });
    html += "</tr>";
  });
  html += `</tbody></table>
    <div class="share-bar">
      <button class="secondary" id="compare-share-btn" data-i18n="share.btn">🔗 Copy share link</button>
      <button class="secondary" id="compare-download-btn" data-i18n="share.download">💾 Download JSON</button>
      <button class="secondary" id="compare-download-md-btn" data-i18n="share.download_md">📝 Markdown</button>
      <button class="secondary" id="compare-download-tex-btn" data-i18n="share.download_tex">📜 LaTeX</button>
      <button class="secondary" id="compare-submit-btn" data-i18n="share.submit">📤 Submit to registry</button>
      <span id="compare-share-status" class="subtle"></span>
    </div>
  `;
  $("compare-box").innerHTML = html;
  if (window.__taf_applyTranslations) window.__taf_applyTranslations();
  $("compare-share-btn").addEventListener("click", () => {
    const params = { recipeId: cmp.recipe_id, T_eval: cmp.shared_params.T_eval,
                     models: cmp.rows.map(r => r.label) };
    copyShareLink("compare", params);
  });
  $("compare-download-btn").addEventListener("click", async () => {
    const filename = await makeFilename("compare", cmp);
    const data = await exportableData("compare", cmp);
    downloadJSON(filename, data);
    $("compare-share-status").textContent = `✅ Downloaded ${filename}`;
    setTimeout(() => $("compare-share-status").textContent = "", 5000);
  });
  $("compare-download-md-btn").addEventListener("click", async () => {
    const hash = await inputHash("compare", cmp);
    const base = (await makeFilename("compare", cmp)).replace(/\.json$/, "");
    downloadText(`${base}.md`, compareToMarkdown(cmp, hash), "text/markdown;charset=utf-8");
    $("compare-share-status").textContent = `✅ Downloaded ${base}.md`;
    setTimeout(() => $("compare-share-status").textContent = "", 5000);
  });
  $("compare-download-tex-btn").addEventListener("click", async () => {
    const hash = await inputHash("compare", cmp);
    const base = (await makeFilename("compare", cmp)).replace(/\.json$/, "");
    downloadText(`${base}.tex`, compareToLatex(cmp, hash), "application/x-tex;charset=utf-8");
    $("compare-share-status").textContent = `✅ Downloaded ${base}.tex`;
    setTimeout(() => $("compare-share-status").textContent = "", 5000);
  });
  $("compare-submit-btn").addEventListener("click", async () => {
    await submitToRegistry("compare", cmp, $("compare-share-status"));
    setTimeout(() => $("compare-share-status").textContent = "", 8000);
  });
}

// ════════════════════════════════════════════════════════════════════
// SHARE — encode current state to URL
// ════════════════════════════════════════════════════════════════════
function copyShareLink(mode, params) {
  const url = new URL(window.location.href.split("?")[0]);
  url.searchParams.set("mode", mode);
  url.searchParams.set("p", btoa(JSON.stringify(params)));
  navigator.clipboard.writeText(url.toString()).then(
    () => {
      const tgt = $("share-status") || $("profile-share-status") || $("compare-share-status");
      if (tgt) {
        tgt.textContent = "✅ Copied to clipboard!";
        setTimeout(() => tgt.textContent = "", 3000);
      }
    },
    () => alert("Copy failed. Manually copy: " + url.toString())
  );
}

function parseUrlState() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const pData = params.get("p");
  if (!mode || !pData) return;
  try {
    const decoded = JSON.parse(atob(pData));
    // Switch to right mode tab
    const btn = document.querySelector(`.mode-btn[data-mode="${mode}"]`);
    if (btn) btn.click();
    // Wait a tick for tab to render
    setTimeout(() => {
      if (mode === "profile") {
        Object.entries(decoded).forEach(([k, v]) => {
          const map = { theta: "profile-theta", T_train: "profile-T_train",
                        T_eval: "profile-T_eval",
                        n_attention_heads: "profile-n_attn", n_kv_heads: "profile-n_kv",
                        d_head: "profile-d_head", n_layers: "profile-n_layers",
                        n_params: "profile-n_params", has_SWA: "profile-has_swa" };
          const id = map[k];
          if (id && $(id)) $(id).value = String(v);
        });
        setTimeout(() => $("profile-btn").click(), 200);
      }
      // Other modes: future
    }, 200);
  } catch (e) {
    console.warn("Failed to parse URL state:", e);
  }
}

// Wire single-recipe share/download/submit buttons
$("share-btn").addEventListener("click", () => {
  if (!state.lastResult) return;
  copyShareLink(state.lastResult.type || "recipe", state.lastResult.params || {});
});
$("recipe-download-btn").addEventListener("click", async () => {
  if (!state.lastFullResult) return;
  const filename = await makeFilename("recipe", state.lastFullResult);
  const data = await exportableData("recipe", state.lastFullResult);
  downloadJSON(filename, data);
  $("share-status").textContent = `✅ Downloaded ${filename}`;
  setTimeout(() => $("share-status").textContent = "", 5000);
});
$("recipe-download-md-btn").addEventListener("click", async () => {
  if (!state.lastFullResult) return;
  const r = state.lastFullResult;
  const hash = await inputHash("recipe", r);
  const base = (await makeFilename("recipe", r)).replace(/\.json$/, "");
  downloadText(`${base}.md`, recipeToMarkdown(r, hash), "text/markdown;charset=utf-8");
  $("share-status").textContent = `✅ Downloaded ${base}.md`;
  setTimeout(() => $("share-status").textContent = "", 5000);
});
$("recipe-download-tex-btn").addEventListener("click", async () => {
  if (!state.lastFullResult) return;
  const r = state.lastFullResult;
  const hash = await inputHash("recipe", r);
  const base = (await makeFilename("recipe", r)).replace(/\.json$/, "");
  downloadText(`${base}.tex`, recipeToLatex(r, hash), "application/x-tex;charset=utf-8");
  $("share-status").textContent = `✅ Downloaded ${base}.tex`;
  setTimeout(() => $("share-status").textContent = "", 5000);
});
$("recipe-submit-btn").addEventListener("click", async () => {
  if (!state.lastFullResult) return;
  await submitToRegistry("recipe", state.lastFullResult, $("share-status"));
  setTimeout(() => $("share-status").textContent = "", 8000);
});

// ════════════════════════════════════════════════════════════════════
// Help modal
// ════════════════════════════════════════════════════════════════════
// a11y: focus trap + restore + Esc handling, generalized to any modal that follows
// the [role="dialog"] + .open pattern. Each call to wireModal() returns { open, close }
// and registers the modal so the global keyboard handler can find the active one.
const __modalCloseFns = new Map();
function wireModal(modalId, btnId, closeId) {
  const modal = $(modalId);
  if (!modal) return null;
  let returnFocus = null;
  const open = () => {
    returnFocus = document.activeElement;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    setTimeout(() => $(closeId)?.focus(), 0);
  };
  const close = () => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
    returnFocus = null;
  };
  $(btnId)?.addEventListener("click", open);
  $(closeId)?.addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target.id === modalId) close(); });
  __modalCloseFns.set(modalId, close);
  return { open, close };
}

wireModal("help-modal", "help-btn", "help-close");
wireModal("quickstart-modal", "quickstart-btn", "quickstart-close");
wireModal("inventory-modal", "inventory-btn", "inventory-close");

// Manual is now static <details class="inv-card"> cards in index.html (same as the
// "🧰 What it gives you" inventory). FALLBACK: if a stale/cached index.html still serves
// the old flat <h3> manual, convert those sections to the same cards on open. No-op when
// the static cards are already present.
function buildHelpAccordionFallback() {
  const content = document.querySelector("#help-modal .help-content");
  if (!content) return;
  if (![...content.children].some((n) => n.tagName === "H3")) return; // already static cards
  const nodes = [...content.children];
  const frag = document.createDocumentFragment();
  let cards = null, current = null;
  for (const node of nodes) {
    if (node.tagName === "H3") {
      if (!cards) { cards = document.createElement("div"); cards.className = "help-cards"; frag.appendChild(cards); }
      const det = document.createElement("details"); det.className = "inv-card";
      const sum = document.createElement("summary"); sum.className = "inv-card-title";
      const key = node.getAttribute("data-i18n");
      if (key) sum.setAttribute("data-i18n", key);
      sum.innerHTML = node.innerHTML;
      det.appendChild(sum); cards.appendChild(det); current = det;
    } else if (current) { current.appendChild(node); }
    else { frag.appendChild(node); }
  }
  const firstCard = frag.querySelector(".inv-card");
  if (firstCard) firstCard.open = true;
  content.innerHTML = "";
  content.appendChild(frag);
}
$("help-btn")?.addEventListener("click", buildHelpAccordionFallback);

// Quick-start modal "↓ Start now" link should also close the modal so user lands on mode-section.
$("qs-start-link")?.addEventListener("click", () => __modalCloseFns.get("quickstart-modal")?.());

// Esc closes whichever modal is open; Tab cycles within it.
document.addEventListener("keydown", (e) => {
  const openModal = document.querySelector('[role="dialog"].open');
  if (!openModal) return;
  if (e.key === "Escape") {
    e.preventDefault();
    __modalCloseFns.get(openModal.id)?.();
    return;
  }
  if (e.key !== "Tab") return;
  const focusables = openModal.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

// ════════════════════════════════════════════════════════════════════
// SHARING — Download / Upload / Submit to registry
// ════════════════════════════════════════════════════════════════════
const REGISTRY_REPO = "karlesmarin/tafagent-registry";

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

function downloadText(filename, text, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// LaTeX-escape a plain string for inclusion in a tabular cell.
function latexEscape(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/[#$%&_{}]/g, m => "\\" + m)
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/</g, "\\textless{}")
    .replace(/>/g, "\\textgreater{}");
}

function profileToLatex(p, hash = "") {
  const ms = p.model_summary || {};
  const kn = p.key_numbers || {};
  let tex = `% TAF Profile — auto-generated by TAF Agent\n`;
  if (hash) tex += `% input hash: #${hash}\n`;
  tex += `\\begin{table}[ht]\n\\centering\n`;
  tex += `\\caption{TAF Profile — ${latexEscape(ms.architecture_class || "?")}${hash ? ` (\\#${latexEscape(hash)})` : ""}}\n`;
  tex += `\\begin{tabular}{lll}\n\\toprule\nRecipe & Verdict & Reason \\\\\n\\midrule\n`;
  Object.entries(p.recipes || {}).forEach(([rid, r]) => {
    tex += `${latexEscape(rid)} & ${latexEscape(r.verdict || "")} & ${latexEscape((r.reason || "").slice(0, 80))} \\\\\n`;
  });
  tex += `\\bottomrule\n\\end{tabular}\n\\end{table}\n\n`;
  tex += `% Key numbers (JSON):\n`;
  for (const [k, v] of Object.entries(kn)) {
    tex += `% ${k} = ${typeof v === "object" ? JSON.stringify(v) : v}\n`;
  }
  return tex;
}

function compareToLatex(c, hash = "") {
  let tex = `% TAF Comparison — ${c.recipe_id} (${c.recipe_name})\n`;
  if (hash) tex += `% input hash: #${hash}\n`;
  tex += `\\begin{table}[ht]\n\\centering\n`;
  tex += `\\caption{TAF Comparison — ${latexEscape(c.recipe_id)} ${latexEscape(c.recipe_name || "")}${hash ? ` (\\#${latexEscape(hash)})` : ""}}\n`;
  tex += `\\begin{tabular}{lll}\n\\toprule\nModel & Verdict & Reason \\\\\n\\midrule\n`;
  c.rows.forEach(r => {
    tex += `${latexEscape(r.label)} & ${latexEscape(r.verdict)} & ${latexEscape((r.reason || "").slice(0, 80))} \\\\\n`;
  });
  tex += `\\bottomrule\n\\end{tabular}\n\\end{table}\n`;
  return tex;
}

function recipeToLatex(r, hash = "") {
  let tex = `% TAF Recipe ${r.recipe_id} — ${r.recipe_name}\n`;
  if (hash) tex += `% input hash: #${hash}\n`;
  tex += `\\begin{table}[ht]\n\\centering\n`;
  tex += `\\caption{TAF Recipe \\texttt{${latexEscape(r.recipe_id)}} — verdict: ${latexEscape(r.verdict)}${hash ? ` (\\#${latexEscape(hash)})` : ""}}\n`;
  tex += `\\begin{tabular}{rll}\n\\toprule\nStep & Formula & Result \\\\\n\\midrule\n`;
  (r.chain || []).forEach(s => {
    tex += `${latexEscape(s.step)} & \\texttt{${latexEscape(s.formula || "")}} & ${latexEscape(formatResultPlain(s.result))} \\\\\n`;
  });
  tex += `\\bottomrule\n\\end{tabular}\n\\end{table}\n\n`;
  tex += `% Reason: ${latexEscape(r.reason || "")}\n`;
  if (r.mitigation) tex += `% Mitigation: ${latexEscape(r.mitigation)}\n`;
  return tex;
}

// Sort object keys recursively for deterministic JSON
function sortKeys(o) {
  if (Array.isArray(o)) return o.map(sortKeys);
  if (o && typeof o === "object") {
    return Object.keys(o).sort().reduce((acc, k) => { acc[k] = sortKeys(o[k]); return acc; }, {});
  }
  return o;
}

// Compute 8-char hex hash of canonical inputs.
// Identical inputs → identical hash (forever). Different inputs → different hash.
async function inputHash(type, data) {
  let canonical;
  if (type === "profile") {
    const ms = data.model_summary || data;
    canonical = sortKeys({
      type: "profile",
      theta: ms.rope_theta ?? ms.theta,
      T_train: ms.T_train,
      T_eval: ms.T_eval,
      n_attn: ms.n_attention_heads ?? ms.n_attn,
      n_kv: ms.n_kv_heads ?? ms.n_kv,
      d_head: ms.d_head,
      n_layers: ms.n_layers,
      n_params: ms.n_params,
      has_SWA: ms.has_SWA,
    });
  } else if (type === "compare") {
    canonical = sortKeys({
      type: "compare",
      recipe: data.recipe_id,
      T_eval: (data.shared_params || {}).T_eval,
      models: (data.rows || []).map(r => r.label).sort(),
    });
  } else {
    canonical = sortKeys({
      type: "recipe",
      recipe: data.recipe_id,
      inputs: data.inputs || {},
    });
  }
  const text = JSON.stringify(canonical);
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf)).slice(0, 4)
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

function safeFilename(s) {
  return String(s).replace(/[/\\?%*:|"<>]/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function modelShortName(data, fallback="model") {
  // Try to get from various places
  if (state.lastModelId) return safeFilename(state.lastModelId);
  if (data && data.model_summary) {
    const ms = data.model_summary;
    return safeFilename(`m${ms.n_params || 0}-θ${ms.rope_theta || 0}`);
  }
  if (data && data.inputs) {
    const i = data.inputs;
    return safeFilename(`m${i.n_params || ""}-θ${i.theta || ""}`);
  }
  return fallback;
}

async function exportableData(type, data) {
  const hash = await inputHash(type, data);
  return {
    _taf_export: true,
    _taf_type: type,
    _taf_version: "0.2",
    _taf_input_hash: hash,        // identical inputs ⇒ identical hash
    _taf_timestamp: new Date().toISOString(),
    payload: data,
  };
}

async function makeFilename(type, data) {
  const hash = await inputHash(type, data);
  const name = modelShortName(data);
  let suffix;
  if (type === "profile" && data.model_summary?.T_eval) suffix = `T${data.model_summary.T_eval}`;
  else if (type === "compare" && data.shared_params?.T_eval) suffix = `T${data.shared_params.T_eval}`;
  else if (type === "recipe" && data.inputs?.T_eval) suffix = `T${data.inputs.T_eval}`;
  else suffix = data.recipe_id || "result";
  return `taf-${type}-${name}-${suffix}-${hash}.json`;
}

// v0.6 privacy fix: previously placed full JSON body in URL params → GH server logs +
// referer headers captured user data. Now copy body to clipboard, open issue page
// with title only, user pastes body manually. Title is non-sensitive (model name +
// hash). On clipboard failure, fall back to console log so user can grab body.
async function submitToRegistry(type, data, statusEl) {
  const hash = await inputHash(type, data);
  const modelName = modelShortName(data, "model");
  let title, body;
  if (type === "profile") {
    const ms = data.model_summary || {};
    title = `[TAF Profile] ${modelName} @ T=${ms.T_eval || "?"}  #${hash}`;
    body = profileToMarkdown(data, hash);
  } else if (type === "compare") {
    title = `[TAF Compare] ${data.recipe_id} × ${data.rows.length} models  #${hash}`;
    body = compareToMarkdown(data, hash);
  } else {
    title = `[TAF ${data.recipe_id}] ${modelName} → ${data.verdict}  #${hash}`;
    body = recipeToMarkdown(data, hash);
  }
  const dedupNote = `\n\n> **Input hash**: \`#${hash}\` — search this hash in registry issues to find independent verifications. Same inputs always produce the same hash.`;
  const fullBody = body + dedupNote + "\n\n---\n*Submitted via [TAF Agent](https://karlesmarin.github.io/tafagent)*";

  let clipboardOk = false;
  try {
    await navigator.clipboard.writeText(fullBody);
    clipboardOk = true;
  } catch (e) {
    console.warn("Clipboard write failed; body logged below:", e);
    console.log("[TAF Agent] Issue body to paste:\n\n" + fullBody);
  }

  // Title-only URL — body intentionally omitted to avoid leaking via GH server logs / referer.
  const params = new URLSearchParams({ title });
  window.open(`https://github.com/${REGISTRY_REPO}/issues/new?${params.toString()}`, "_blank");

  if (statusEl) {
    statusEl.textContent = clipboardOk
      ? (t("share.submit_clip_ok") || "↗ Opened GitHub. Body copied to clipboard — paste it into the issue body.")
      : (t("share.submit_clip_fail") || "↗ Opened GitHub. Clipboard blocked — body logged in browser console (F12).");
  }
}

function profileToMarkdown(p, hash="") {
  const ms = p.model_summary || {};
  const kn = p.key_numbers || {};
  let md = `## TAF Profile`;
  if (hash) md += ` \`#${hash}\``;
  md += `\n\n`;
  md += `**Architecture**: ${ms.architecture_class || "?"}\n`;
  md += `**Params**: ${ms.n_params}, **T_train**: ${ms.T_train}, **T_eval**: ${ms.T_eval}\n`;
  md += `**θ**: ${ms.rope_theta}, GQA=${ms.has_GQA}, SWA=${ms.has_SWA}\n\n`;
  md += `### Recipes\n\n`;
  Object.entries(p.recipes || {}).forEach(([rid, r]) => {
    md += `- **${rid}** (${r.name || ""}): ${r.verdict} — ${r.reason}\n`;
  });
  md += `\n### Key numbers\n\n\`\`\`json\n${JSON.stringify(kn, null, 2)}\n\`\`\`\n`;
  md += `\n### Full data\n\n<details><summary>Click to expand</summary>\n\n\`\`\`json\n${JSON.stringify(p, null, 2)}\n\`\`\`\n\n</details>\n`;
  return md;
}

function compareToMarkdown(c, hash="") {
  let md = `## TAF Comparison — ${c.recipe_id} (${c.recipe_name})`;
  if (hash) md += ` \`#${hash}\``;
  md += `\n\n`;
  md += `**Shared params**: \`${JSON.stringify(c.shared_params)}\`\n\n`;
  md += `| Model | Verdict | Reason |\n|-------|---------|--------|\n`;
  c.rows.forEach(r => {
    md += `| ${r.label} | ${r.verdict} | ${r.reason.slice(0, 80)}${r.reason.length > 80 ? "..." : ""} |\n`;
  });
  md += `\n<details><summary>Full data</summary>\n\n\`\`\`json\n${JSON.stringify(c, null, 2)}\n\`\`\`\n\n</details>\n`;
  return md;
}

function recipeToMarkdown(r, hash="") {
  let md = `## TAF Recipe ${r.recipe_id} — ${r.recipe_name}`;
  if (hash) md += ` \`#${hash}\``;
  md += `\n\n`;
  md += `**Verdict**: ${r.verdict}\n`;
  md += `**Reason**: ${r.reason}\n`;
  if (r.mitigation) md += `**Action**: ${r.mitigation}\n`;
  md += `\n### Inputs\n\n\`\`\`json\n${JSON.stringify(r.inputs, null, 2)}\n\`\`\`\n`;
  md += `\n### Computation chain\n\n`;
  (r.chain || []).forEach(s => {
    md += `**Step ${s.step} ${s.section}** — ${s.name}: \`${s.formula}\` → ${formatResultPlain(s.result)}\n`;
  });
  md += `\n<details><summary>Full data</summary>\n\n\`\`\`json\n${JSON.stringify(r, null, 2)}\n\`\`\`\n\n</details>\n`;
  return md;
}

function importJSON(file, statusEl) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data._taf_export) {
        statusEl.innerHTML = "❌ Not a TAF export file (missing _taf_export marker).";
        return;
      }
      const type = data._taf_type;
      const payload = data.payload;
      if (type === "profile") {
        renderProfile(payload, payload.model_summary || {});
        statusEl.innerHTML = `✅ Profile loaded (${data._taf_timestamp || "?"})`;
      } else if (type === "compare") {
        renderCompare(payload);
        statusEl.innerHTML = `✅ Comparison loaded (${data._taf_timestamp || "?"})`;
      } else if (type === "recipe") {
        renderResult(payload);
        $("output-section").style.display = "block";
        statusEl.innerHTML = `✅ Recipe result loaded (${data._taf_timestamp || "?"})`;
      } else {
        statusEl.innerHTML = `❌ Unknown TAF type: ${type}`;
      }
    } catch (err) {
      statusEl.innerHTML = `❌ Failed to parse JSON: ${escapeHtml(String(err.message))}`;
    }
  };
  reader.readAsText(file);
}

// Wire import button (always available)
document.addEventListener("DOMContentLoaded", () => {
  const importBtn = document.getElementById("import-btn");
  const importFile = document.getElementById("import-file");
  if (importBtn && importFile) {
    importBtn.addEventListener("click", () => importFile.click());
    importFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) importJSON(file, document.getElementById("import-status"));
    });
  }
  // Lean+Mathlib manifest — load in parallel with everything else; badges
  // appear once it resolves, but app stays usable if it fails.
  loadLeanManifest().catch(err => console.warn("Lean manifest unavailable:", err));
});

// ════════════════════════════════════════════════════════════════════
// Language switcher
// ════════════════════════════════════════════════════════════════════
document.querySelectorAll(".lang-btn").forEach(btn => {
  btn.addEventListener("click", () => setLang(btn.dataset.lang));
});

// ════════════════════════════════════════════════════════════════════
// 📈 Benchmark Saturation Detector (v0.8.0 anti-bullshit pack #6)
// ════════════════════════════════════════════════════════════════════
const SATURATION_VERDICT_COLOR = {
  saturated: "#f85149",
  near_saturated: "#d29922",
  discriminative: "#3fb950",
  sparse_data: "#8b949e",
  unknown_benchmark: "#8b949e",
};

let __saturationInited = false;

async function initSaturation() {
  if (__saturationInited) return;
  __saturationInited = true;
  try {
    await loadSaturationKB();
  } catch (e) {
    $("saturation-status").textContent = (t("saturation.status.kb_fail") || "⚠ Could not load saturation KB.") + " " + (e.message || e);
    return;
  }
  const sel = $("saturation-select");
  if (sel) {
    sel.innerHTML = "";
    const allOpt = document.createElement("option");
    allOpt.value = "__all__";
    allOpt.textContent = t("saturation.select.all") || "— show all benchmarks —";
    sel.appendChild(allOpt);
    listBenchmarks().forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  }
  // Try live fetch in the background; results that come back update _liveData.
  // If CORS / network fails the tool transparently uses the baked snapshot.
  tryFetchLive().then(live => {
    if (live) {
      $("saturation-status").textContent = tFmt("saturation.status.live", { count: live.model_count || (live.models?.length ?? 0) });
    } else {
      $("saturation-status").textContent = t("saturation.status.baked") || "ℹ Using baked snapshot (live fetch unavailable).";
    }
  });
}

function renderSaturationCard(result) {
  if (result.code === "unknown_benchmark") {
    return `<div class="recipe-desc">${t("saturation.unknown") || "Unknown benchmark."}</div>`;
  }
  const color = SATURATION_VERDICT_COLOR[result.code] || "#8b949e";
  const verdictLabel = t(`saturation.verdict.${result.code}`) || result.code;
  const top3Rows = (result.top3 || [])
    .filter(x => typeof x.score === "number")
    .map((x, i) => `<tr><td>${i + 1}</td><td>${x.model}</td><td class="arena-elo">${x.score.toFixed(1)}</td></tr>`)
    .join("");
  const recoItems = (result.recommendations || [])
    .map(r => `<li>${r}</li>`)
    .join("");
  const borderlineNote = result.borderline
    ? `<p class="recipe-desc" style="color:#d29922; font-size:0.9em;">⚠ ${t("saturation.borderline") || "Borderline — within ±1pp of a threshold cutoff. Treat verdict as 'check carefully'."}</p>`
    : "";
  const sourceTag = result.source === "live"
    ? `<span class="badge" style="background:#0969da;">live</span>`
    : (result.source === "baked_consensus"
      ? `<span class="badge" style="background:#6e7781;">consensus</span>`
      : `<span class="badge" style="background:#8b949e;">baked</span>`);
  const spreadStr = result.params.spread != null ? `${result.params.spread.toFixed(1)} pp` : "n/a";
  const meanStr = result.params.mean != null ? `${result.params.mean.toFixed(1)}%` : "n/a";

  return `
    <div class="arena-result">
      <div class="unmask-hero" style="border-color: ${color};">
        <div class="unmask-verdict" style="color: ${color};">${result.params.name} — ${verdictLabel} ${sourceTag}</div>
        <div class="unmask-num-grid">
          <div><span class="unmask-num-label">${t("saturation.col.spread") || "Top-3 spread"}</span><span class="unmask-num-val">${spreadStr}</span></div>
          <div><span class="unmask-num-label">${t("saturation.col.mean") || "Top-3 mean"}</span><span class="unmask-num-val">${meanStr}</span></div>
          <div><span class="unmask-num-label">${t("saturation.col.n") || "Models"}</span><span class="unmask-num-val">${result.params.n || 0}</span></div>
        </div>
      </div>
      ${borderlineNote}
      <div class="unmask-details">
        ${top3Rows ? `<details class="unmask-panel" open>
          <summary class="unmask-panel-title">${t("saturation.section.top3") || "Top-3 frontier scores"}</summary>
          <table class="arena-table">
            <thead><tr>
              <th>#</th>
              <th>${t("saturation.col.model") || "Model"}</th>
              <th>${t("saturation.col.score") || "Score"}</th>
            </tr></thead>
            <tbody>${top3Rows}</tbody>
          </table>
        </details>` : ""}
        ${recoItems ? `<details class="unmask-panel" open>
          <summary class="unmask-panel-title">${t("saturation.section.recommendations") || "Recommended alternatives"}</summary>
          <ul>${recoItems}</ul>
        </details>` : ""}
        ${result.note ? `<details class="unmask-panel">
          <summary class="unmask-panel-title">${t("saturation.section.note") || "Notes"}</summary>
          <p class="recipe-desc">${result.note}</p>
        </details>` : ""}
      </div>
    </div>
  `;
}

function renderSaturationAll(results) {
  const rows = results.map(r => {
    if (r.code === "unknown_benchmark") return "";
    const color = SATURATION_VERDICT_COLOR[r.code] || "#8b949e";
    const verdictLabel = t(`saturation.verdict.${r.code}`) || r.code;
    const spread = r.params.spread != null ? r.params.spread.toFixed(1) + " pp" : "—";
    const mean = r.params.mean != null ? r.params.mean.toFixed(1) + "%" : "—";
    const reco = (r.recommendations || []).slice(0, 2).join(", ") || "—";
    const borderlineMark = r.borderline ? " ⚠" : "";
    return `<tr>
      <td><strong>${r.params.name}</strong></td>
      <td>${spread}</td>
      <td>${mean}</td>
      <td style="color:${color};"><strong>${verdictLabel}${borderlineMark}</strong></td>
      <td>${reco}</td>
    </tr>`;
  }).join("");
  return `
    <div class="arena-result">
      <div class="unmask-details">
        <details class="unmask-panel" open>
          <summary class="unmask-panel-title">${t("saturation.section.all") || "All tracked benchmarks"}</summary>
          <table class="arena-table">
            <thead><tr>
              <th>${t("saturation.col.bench") || "Benchmark"}</th>
              <th>${t("saturation.col.spread") || "Spread"}</th>
              <th>${t("saturation.col.mean") || "Mean"}</th>
              <th>${t("saturation.col.verdict") || "Verdict"}</th>
              <th>${t("saturation.col.reco") || "Top reco"}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </details>
      </div>
    </div>
  `;
}

function runSaturationOne() {
  const sel = $("saturation-select");
  const name = sel?.value;
  if (!name || name === "__all__") { runSaturationAll(); return; }
  const result = classifyBenchmark(name);
  $("saturation-output").innerHTML = renderSaturationCard(result);
  $("saturation-status").textContent = tFmt("saturation.status.done", {
    name,
    verdict: t(`saturation.verdict.${result.code}`) || result.code,
  });
}

function runSaturationAll() {
  const results = classifyAll();
  $("saturation-output").innerHTML = renderSaturationAll(results);
  $("saturation-status").textContent = tFmt("saturation.status.all_done", { n: results.length });
}

$("saturation-run-btn")?.addEventListener("click", runSaturationOne);
$("saturation-all-btn")?.addEventListener("click", runSaturationAll);

// ════════════════════════════════════════════════════════════════════
// 🧭 Solutions Hub (v0.8.1) — integrator portal
// ════════════════════════════════════════════════════════════════════
const HUB_TYPE_BADGE = {
  tool: "🔧",
  leaderboard: "📊",
  paper: "📄",
  article: "📝",
  docs: "📘",
  issue: "🐛",
  spec: "📐",
  benchmark: "🧪",
};

let __hubInited = false;

async function initHub() {
  if (__hubInited) return;
  __hubInited = true;
  try {
    await loadHub();
  } catch (e) {
    $("hub-status").textContent = (t("hub.status.fail") || "⚠ Could not load Solutions Hub.") + " " + (e.message || e);
    return;
  }
  const stats = hubStats();
  $("hub-status").textContent = tFmt("hub.status.loaded", stats);
  renderHubAll();
}

function renderEntry(e) {
  const modeBadge = e.tafagent_mode
    ? `<span class="badge" style="background:#3fb950;color:#fff;border-color:#3fb950;">${e.tafagent_mode}</span>`
    : (e.tafagent_planned_mode
        ? `<span class="badge" style="background:#d29922;color:#1a1a1a;border-color:#d29922;">${t("hub.planned") || "planned:"} ${e.tafagent_planned_mode}</span>`
        : `<span class="badge" style="background:#6e7781;color:#fff;border-color:#6e7781;">${t("hub.no_mode") || "external"}</span>`);
  const tools = (e.external_tools || [])
    .map(tl => {
      const icon = HUB_TYPE_BADGE[tl.type] || "🔗";
      return `<li>${icon} <a href="${tl.url}" target="_blank" rel="noopener noreferrer">${tl.name}</a> <span class="subtle" style="font-size:0.82em;">(${tl.type})</span></li>`;
    })
    .join("");
  const bestFor = e.best_for ? `<p><strong>${t("hub.best_for") || "Best for"}:</strong> ${e.best_for}</p>` : "";
  const notFor = e.not_for ? `<p><strong>${t("hub.not_for") || "Not for"}:</strong> ${e.not_for}</p>` : "";
  return `
    <details class="unmask-panel" style="margin: 0.5em 0;">
      <summary class="unmask-panel-title">${e.pain} ${modeBadge}</summary>
      ${bestFor}
      ${notFor}
      ${tools ? `<p><strong>${t("hub.tools") || "External tools"}:</strong></p><ul>${tools}</ul>` : ""}
    </details>
  `;
}

function renderHubAll() {
  const cats = listCategories();
  const html = cats.map(c => {
    const entries = listEntries(c.key);
    if (entries.length === 0) return "";
    const inner = entries.map(renderEntry).join("");
    return `
      <details class="unmask-panel" open style="margin-top: 1em;">
        <summary class="unmask-panel-title" style="font-size:1.05em;">
          ${c.icon} ${c.label} <span class="subtle" style="font-size:0.85em;">(${c.count})</span>
        </summary>
        <p class="recipe-desc" style="font-style:italic;">${c.description}</p>
        ${inner}
      </details>
    `;
  }).join("");
  $("hub-output").innerHTML = `<div class="arena-result">${html}</div>`;
}

function renderHubSearch(query) {
  const matches = searchEntries(query);
  if (matches.length === 0) {
    $("hub-output").innerHTML = `<p class="recipe-desc">${tFmt("hub.search.empty", { query })}</p>`;
    return;
  }
  const html = matches.map(renderEntry).join("");
  $("hub-output").innerHTML = `<div class="arena-result">
    <p class="recipe-desc">${tFmt("hub.search.results", { n: matches.length, query })}</p>
    ${html}
  </div>`;
}

let __hubSearchTimer = null;
$("hub-search")?.addEventListener("input", (e) => {
  clearTimeout(__hubSearchTimer);
  const q = e.target.value;
  __hubSearchTimer = setTimeout(() => {
    if (!q.trim()) renderHubAll();
    else renderHubSearch(q);
  }, 200);
});
$("hub-clear-btn")?.addEventListener("click", () => {
  $("hub-search").value = "";
  renderHubAll();
});

// ════════════════════════════════════════════════════════════════════
// 📋 JSON CoT-aware Linter (v0.8.2 anti-bullshit pack #8)
// ════════════════════════════════════════════════════════════════════
const COT_FIELD_TYPE_BADGE = {
  reasoning: "🧠",
  answer: "🎯",
  other: "·",
};

const COT_VERDICT_BADGE_BG = {
  good_order: "#3fb950",          // green
  anti_pattern: "#f85149",        // red
  missing_reasoning: "#d29922",   // amber
  missing_answer: "#d29922",      // amber
  no_cot_fields: "#8b949e",       // gray
  non_object: "#8b949e",
  empty_fields: "#8b949e",
  invalid_json: "#f85149",        // red
};

let __cotInited = false;

function initCot() {
  if (__cotInited) return;
  __cotInited = true;
  // No-op (no async data); placeholder kept for symmetry with other modes.
}

function renderCotResult(result, originalText) {
  const verdict = t(`cot.verdict.${result.code}`) || result.code;
  const verdictBg = COT_VERDICT_BADGE_BG[result.code] || "#8b949e";
  const verdictBadge = `<span class="badge" style="background:${verdictBg};">${verdict}</span>`;

  // Failure cases short-circuit: just show the verdict + reason.
  if (result.code === "invalid_json") {
    const reason = result.params?.error || "";
    return `<div class="arena-result">
      <p style="font-size:1.1em;">${verdictBadge}</p>
      <pre style="background:#21262d;padding:0.75em;border-radius:4px;color:#f0883e;">${escapeHtml(reason)}</pre>
    </div>`;
  }
  if (result.code === "empty_fields" || result.code === "non_object") {
    return `<div class="arena-result">
      <p style="font-size:1.1em;">${verdictBadge}</p>
      <p class="recipe-desc">${t(`cot.hint.${result.code}`) || ""}</p>
    </div>`;
  }

  const fields = result.params?.fields || [];
  const fieldRows = fields.map(f => {
    const icon = COT_FIELD_TYPE_BADGE[f.type] || "·";
    const typeLabel = t(`cot.field.${f.type}`) || f.type;
    const color = f.type === "reasoning" ? "#3fb950"
                : f.type === "answer"    ? "#f0883e"
                : "#8b949e";
    return `<tr>
      <td style="text-align:right;color:#8b949e;">${f.idx}</td>
      <td><code>${escapeHtml(f.name)}</code></td>
      <td><span style="color:${color};">${icon} ${typeLabel}</span></td>
    </tr>`;
  }).join("");
  const fieldTable = `
    <table class="lean-table" style="margin-top:0.5em;">
      <thead><tr>
        <th>#</th>
        <th data-i18n="cot.col.field">Field</th>
        <th data-i18n="cot.col.type">Type</th>
      </tr></thead>
      <tbody>${fieldRows}</tbody>
    </table>
  `;

  // Suggested-fix block — only when there's a meaningful reorder.
  let fixBlock = "";
  if (result.code === "anti_pattern") {
    const suggested = result.params?.suggested_order || [];
    const fixed = reorderJsonText(originalText, suggested);
    if (fixed) {
      fixBlock = `
        <details open style="margin-top:1em;">
          <summary style="cursor:pointer;color:#3fb950;">
            <strong>${t("cot.suggested_fix.title") || "✓ Suggested fix"}</strong>
          </summary>
          <p class="recipe-desc">${t("cot.suggested_fix.desc") || ""}</p>
          <pre style="background:#0d1117;padding:0.75em;border-radius:4px;overflow-x:auto;"><code>${escapeHtml(fixed)}</code></pre>
          <button type="button" class="secondary" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent).then(()=>{this.textContent='${t("cot.suggested_fix.copied") || "✓ Copied"}';setTimeout(()=>{this.textContent='${t("cot.suggested_fix.copy") || "📋 Copy"}';},1500);})">${t("cot.suggested_fix.copy") || "📋 Copy"}</button>
        </details>
      `;
    }
  }

  // Verdict explainer
  const explainer = t(`cot.explain.${result.code}`) || "";
  const explainerBlock = explainer
    ? `<p class="recipe-desc">${explainer}</p>`
    : "";

  // Source attribution footer
  const attribution = `
    <p class="recipe-desc subtle" style="font-size:0.82em;margin-top:1em;">
      ${t("cot.attribution") || ""}
      <a href="https://collinwilkins.com/articles/structured-output" target="_blank" rel="noopener noreferrer">collinwilkins.com</a> ·
      <a href="https://github.com/guidance-ai/jsonschemabench" target="_blank" rel="noopener noreferrer">JSONSchemaBench</a> ·
      <a href="https://github.com/guidance-ai/llguidance" target="_blank" rel="noopener noreferrer">llguidance</a>
    </p>
  `;

  return `<div class="arena-result">
    <p style="font-size:1.1em;">${verdictBadge}
      <span class="subtle" style="font-size:0.9em;">(${tFmt("cot.field_count", { n: result.params.field_count }) || `${result.params.field_count} fields`})</span>
    </p>
    ${explainerBlock}
    ${fieldTable}
    ${fixBlock}
    ${attribution}
  </div>`;
}

function runCotLint() {
  const text = $("cot-input")?.value || "";
  const result = lintJsonCot(text);
  $("cot-output").innerHTML = renderCotResult(result, text);
  $("cot-status").textContent = tFmt("cot.status.done", {
    verdict: t(`cot.verdict.${result.code}`) || result.code,
  });
}

const COT_EXAMPLE_GOOD = JSON.stringify({
  type: "object",
  properties: {
    reasoning: {
      type: "string",
      description: "Step-by-step rationale before committing to an answer.",
    },
    answer: {
      type: "string",
      description: "Final answer, derived from the reasoning above.",
    },
  },
  required: ["reasoning", "answer"],
}, null, 2);

const COT_EXAMPLE_BAD = JSON.stringify({
  type: "object",
  properties: {
    final_answer: {
      type: "string",
      description: "The model's final answer.",
    },
    chain_of_thought: {
      type: "string",
      description: "Justification for the answer above.",
    },
  },
  required: ["final_answer", "chain_of_thought"],
}, null, 2);

$("cot-lint-btn")?.addEventListener("click", runCotLint);
$("cot-example-good-btn")?.addEventListener("click", () => {
  $("cot-input").value = COT_EXAMPLE_GOOD;
  runCotLint();
});
$("cot-example-bad-btn")?.addEventListener("click", () => {
  $("cot-input").value = COT_EXAMPLE_BAD;
  runCotLint();
});

// ════════════════════════════════════════════════════════════════════
// 🔧 PEFT Anti-Pattern Checker (v0.8.3 anti-bullshit pack #9)
// ════════════════════════════════════════════════════════════════════
const PEFT_SEVERITY_BG = {
  error:   "#f85149",
  warning: "#d29922",
  info:    "#58a6ff",
};
const PEFT_VERDICT_BG = {
  errors_found:   "#f85149",
  warnings_only:  "#d29922",
  info_only:      "#58a6ff",
  clean:          "#3fb950",
  no_peft_calls:  "#8b949e",
  empty_input:    "#8b949e",
};

let __peftInited = false;

function initPeft() {
  if (__peftInited) return;
  __peftInited = true;
  // No-op (no async data); placeholder kept for symmetry with other modes.
}

function renderPeftFinding(f) {
  const sevBg = PEFT_SEVERITY_BG[f.severity] || "#8b949e";
  const sevBadge = `<span class="badge" style="background:${sevBg};">${f.severity.toUpperCase()}</span>`;
  const ruleLabel = t(`peft.rule.${f.rule}.label`) || f.rule;
  const lineLabel = f.line != null
    ? `<span class="subtle" style="font-size:0.85em;">${tFmt("peft.line", { n: f.line }) || `line ${f.line}`}</span>`
    : "";
  const explainer = t(`peft.rule.${f.rule}.explain`) || "";
  const fixHint = t(`peft.rule.${f.rule}.fix`) || "";
  // Per-rule rendering details
  let detail = "";
  if (f.rule === "silent_base_load") {
    detail = `<p><code>${escapeHtml(f.params.checkpoint_hint)}</code> ${t("peft.detected_at_line") || "appears at line"} ${f.params.checkpoint_line}</p>
              <p><strong>${t("peft.suggested_fix") || "Suggested:"}</strong> <code>${escapeHtml(f.params.fix)}</code></p>`;
  } else if (f.rule === "qlora_order") {
    detail = `<p>${tFmt("peft.qlora_order.detail", f.params) || `prepare_model_for_kbit_training (line ${f.params.prepare_line}) runs AFTER get_peft_model (line ${f.params.get_peft_model_line}). Reverse the order.`}</p>`;
  } else if (f.rule === "target_modules_mismatch") {
    detail = `
      <p><strong>${t("peft.detected_arch") || "Detected arch"}:</strong> <code>${escapeHtml(f.params.detected_arch)}</code> ${t("peft.from_model_id") || "(from model id"} <code>${escapeHtml(f.params.detected_from)}</code>)</p>
      <p><strong>${t("peft.your_modules") || "Your target_modules"}:</strong> <code>${escapeHtml(f.params.user_modules.join(", "))}</code></p>
      <p><strong>${t("peft.expected_modules") || "Expected for this arch"}:</strong> <code>${escapeHtml(f.params.expected_modules.join(", "))}</code></p>
      <p class="subtle" style="font-size:0.85em;">${tFmt("peft.match_ratio", f.params) || `${f.params.hits} of ${f.params.total} match.`}</p>
    `;
  } else if (f.rule === "alpha_not_2r") {
    detail = `<p><code>r=${f.params.r}, lora_alpha=${f.params.lora_alpha}</code> → ${t("peft.ratio") || "ratio"} ${f.params.ratio}× (${t("peft.alpha.convention") || "convention is α=2r or α=r"})</p>`;
  } else if (f.rule === "no_peft_calls") {
    detail = `<p>${t("peft.no_peft_calls.detail") || "No get_peft_model / PeftModel.from_pretrained / LoraConfig calls detected. Paste a PEFT/LoRA setup snippet."}</p>`;
  }
  return `
    <details open class="unmask-panel" style="margin: 0.5em 0;">
      <summary class="unmask-panel-title">
        ${sevBadge} <strong>${ruleLabel}</strong> ${lineLabel}
      </summary>
      ${explainer ? `<p>${explainer}</p>` : ""}
      ${detail}
      ${fixHint ? `<p class="recipe-desc" style="margin-top:0.5em;">${fixHint}</p>` : ""}
    </details>
  `;
}

function renderPeftResult(result) {
  const verdict = t(`peft.verdict.${result.code}`) || result.code;
  const verdictBg = PEFT_VERDICT_BG[result.code] || "#8b949e";
  const verdictBadge = `<span class="badge" style="background:${verdictBg};">${verdict}</span>`;
  const findings = result.findings || [];
  const findingsHtml = findings.map(renderPeftFinding).join("");
  const summary = result.summary
    ? `<p class="subtle" style="font-size:0.9em;">${tFmt("peft.summary", result.summary) || `${result.summary.total} finding(s)`}</p>`
    : "";

  // Source attribution
  const attribution = `
    <p class="recipe-desc subtle" style="font-size:0.82em;margin-top:1em;">
      ${t("peft.attribution") || "Refs:"}
      <a href="https://github.com/huggingface/peft/issues/2115" target="_blank" rel="noopener noreferrer">peft #2115</a> ·
      <a href="https://huggingface.co/docs/peft/main/en/developer_guides/troubleshooting" target="_blank" rel="noopener noreferrer">PEFT troubleshooting</a> ·
      <a href="https://huggingface.co/docs/peft/main/en/package_reference/peft_model" target="_blank" rel="noopener noreferrer">get_layer_status / get_model_status</a>
    </p>
  `;

  return `<div class="arena-result">
    <p style="font-size:1.1em;">${verdictBadge}</p>
    ${summary}
    ${findingsHtml}
    ${attribution}
  </div>`;
}

function runPeftLint() {
  const text = $("peft-input")?.value || "";
  const result = lintPeftCode(text);
  $("peft-output").innerHTML = renderPeftResult(result);
  $("peft-status").textContent = tFmt("peft.status.done", {
    verdict: t(`peft.verdict.${result.code}`) || result.code,
    n: result.findings?.length || 0,
  });
}

const PEFT_EXAMPLE_BUG = `from peft import LoraConfig, get_peft_model
from transformers import AutoModelForCausalLM

base = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3-8B")
config = LoraConfig(
    r=16,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
)
model = get_peft_model(base, config)
# resume from saved checkpoint?
model.load_state_dict("./outputs/checkpoint-1000/adapter_model.bin")
`;

const PEFT_EXAMPLE_QLORA = `from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import AutoModelForCausalLM, BitsAndBytesConfig

bnb = BitsAndBytesConfig(load_in_4bit=True)
base = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3-8B",
    quantization_config=bnb,
)
config = LoraConfig(r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"])
model = get_peft_model(base, config)
# WRONG ORDER: prepare_model_for_kbit_training must come BEFORE get_peft_model
model = prepare_model_for_kbit_training(model)
`;

const PEFT_EXAMPLE_CLEAN = `from peft import PeftModel
from transformers import AutoModelForCausalLM

base = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3-8B")
# Resume from saved adapter — correct PEFT pattern.
model = PeftModel.from_pretrained(base, "./outputs/checkpoint-1000")
`;

$("peft-lint-btn")?.addEventListener("click", runPeftLint);
$("peft-example-bug-btn")?.addEventListener("click", () => {
  $("peft-input").value = PEFT_EXAMPLE_BUG;
  runPeftLint();
});
$("peft-example-qlora-btn")?.addEventListener("click", () => {
  $("peft-input").value = PEFT_EXAMPLE_QLORA;
  runPeftLint();
});
$("peft-example-clean-btn")?.addEventListener("click", () => {
  $("peft-input").value = PEFT_EXAMPLE_CLEAN;
  runPeftLint();
});

// ════════════════════════════════════════════════════════════════════
// 🔁 Prompt-Cache Diff Predictor (v0.8.4 anti-bullshit pack #10)
// ════════════════════════════════════════════════════════════════════
const CACHE_VERDICT_BG = {
  identical:           "#3fb950",
  divergent_can_cache: "#d29922",
  divergent_below_min: "#f0883e",
  fully_divergent:     "#f85149",
  empty_input:         "#8b949e",
};

let __cacheInited = false;

function initCacheDiff() {
  if (__cacheInited) return;
  __cacheInited = true;
  // No-op (no async data); placeholder kept for symmetry.
}

function fmtUsd(n) {
  if (n == null || isNaN(n)) return "—";
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(6)}`;
  if (n < 1)    return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function renderCacheProvider(p) {
  const bgRow = p.reason === "below_min" ? "#21262d" : "#161b22";
  const noteHtml = [];
  if (p.requires_explicit && p.reason !== "below_min") {
    noteHtml.push(`<span class="subtle" style="font-size:0.8em;">${t("cache.note.requires_marker") || "(requires cache_control marker)"}</span>`);
  }
  if (p.reason === "below_min") {
    noteHtml.push(`<span class="subtle" style="font-size:0.8em;color:#f0883e;">${tFmt("cache.note.below_min", { min: p.min_cache_tokens.toLocaleString() }) || `(prefix < ${p.min_cache_tokens.toLocaleString()} tokens — provider min)`}</span>`);
  }
  const noteCell = noteHtml.length ? `<br>${noteHtml.join(" ")}` : "";

  const ttlMin = p.cache_ttl_seconds >= 3600
    ? `${Math.round(p.cache_ttl_seconds / 3600)}h`
    : `${Math.round(p.cache_ttl_seconds / 60)}min`;

  const savingsColor = p.savings_usd > 0 ? "#3fb950" : (p.reason ? "#8b949e" : "#d29922");
  const writeRow = p.cache_write_surcharge_usd && p.cache_write_surcharge_usd > 0
    ? `<tr style="background:${bgRow};"><td colspan="4" class="subtle" style="font-size:0.8em;padding-left:1em;">${tFmt("cache.write_surcharge", { cost: fmtUsd(p.cache_write_surcharge_usd) }) || `+ ${fmtUsd(p.cache_write_surcharge_usd)} cache-write surcharge first time (Anthropic)`}</td></tr>`
    : "";

  return `
    <tr style="background:${bgRow};">
      <td><strong>${escapeHtml(p.provider_name)}</strong>${noteCell}<br><span class="subtle" style="font-size:0.78em;">TTL ${ttlMin}</span></td>
      <td style="text-align:right;">${fmtPct(p.hit_ratio)}</td>
      <td style="text-align:right;">${fmtUsd(p.base_cost_usd)} → ${fmtUsd(p.cached_cost_usd)}</td>
      <td style="text-align:right;color:${savingsColor};"><strong>${fmtUsd(p.savings_usd)}</strong> (${fmtPct(p.savings_pct ?? 0)})</td>
    </tr>
    ${writeRow}
  `;
}

function renderCacheDiffVisualization(oldText, newText, lcpChars) {
  // Truncate context — show last 200 chars of common prefix, and the
  // first 200 chars of each diverging suffix. Keeps UI tight.
  const ctxBefore = 200;
  const startCommon = Math.max(0, lcpChars - ctxBefore);
  const commonTail = oldText.slice(startCommon, lcpChars);
  const oldDiv = oldText.slice(lcpChars);
  const newDiv = newText.slice(lcpChars);
  const commonLeader = startCommon > 0 ? "…" : "";

  return `
    <details style="margin-top:1em;">
      <summary style="cursor:pointer;"><strong>${t("cache.diff.title") || "Where the cache breaks"}</strong></summary>
      <div style="background:#0d1117;padding:0.75em;border-radius:4px;font-family:monospace;font-size:0.85em;line-height:1.4;overflow-x:auto;white-space:pre-wrap;">
<span style="color:#3fb950;">${escapeHtml(commonLeader + commonTail)}</span><span style="color:#f85149;text-decoration:underline;">${escapeHtml(oldDiv.slice(0, 200))}</span><span class="subtle">  ← old</span>
<span style="color:#3fb950;">${escapeHtml(commonLeader + commonTail)}</span><span style="color:#3fb950;text-decoration:underline;">${escapeHtml(newDiv.slice(0, 200))}</span><span class="subtle">  ← new</span>
      </div>
      <p class="subtle" style="font-size:0.82em;">${t("cache.diff.legend") || "Green = shared prefix (cacheable). Red = first edit (everything from here is re-billed)."}</p>
    </details>
  `;
}

function renderCacheResult(result, oldText, newText) {
  const verdict = t(`cache.verdict.${result.code}`) || result.code;
  const verdictBg = CACHE_VERDICT_BG[result.code] || "#8b949e";
  const verdictBadge = `<span class="badge" style="background:${verdictBg};">${verdict}</span>`;

  if (result.code === "empty_input") {
    return `<div class="arena-result">
      <p style="font-size:1.1em;">${verdictBadge}</p>
      <p class="recipe-desc">${t("cache.hint.empty") || "Paste two prompts, then Predict."}</p>
    </div>`;
  }

  const p = result.params;
  const summary = `
    <p class="recipe-desc">
      ${tFmt("cache.summary.tokens", { common: p.tokens_common.toLocaleString(), total: p.tokens_total.toLocaleString(), pct: Math.round(p.hit_ratio * 100) })
        || `Common prefix ${p.tokens_common.toLocaleString()} / ${p.tokens_total.toLocaleString()} tokens (${Math.round(p.hit_ratio * 100)}% theoretical hit ratio).`}
    </p>
    <p class="recipe-desc subtle">
      ${tFmt("cache.summary.diff_at", { line: p.diff_point.line }) || `First difference at line ${p.diff_point.line}.`}
    </p>
  `;

  const rows = (result.providers || []).map(renderCacheProvider).join("");
  const table = rows ? `
    <table class="lean-table" style="margin-top:1em;width:100%;">
      <thead><tr>
        <th style="text-align:left;">${t("cache.col.provider") || "Provider"}</th>
        <th style="text-align:right;">${t("cache.col.hit") || "Hit"}</th>
        <th style="text-align:right;">${t("cache.col.cost") || "Base → cached"}</th>
        <th style="text-align:right;">${t("cache.col.savings") || "Savings"}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  ` : "";

  const diffViz = result.code !== "identical"
    ? renderCacheDiffVisualization(oldText, newText, p.lcp_chars)
    : "";

  const attribution = `
    <p class="recipe-desc subtle" style="font-size:0.82em;margin-top:1em;">
      ${t("cache.attribution") || "Refs:"}
      <a href="https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching" target="_blank" rel="noopener noreferrer">Anthropic prompt caching</a> ·
      <a href="https://platform.openai.com/docs/guides/prompt-caching" target="_blank" rel="noopener noreferrer">OpenAI prompt caching</a> ·
      <a href="https://ai.google.dev/gemini-api/docs/caching" target="_blank" rel="noopener noreferrer">Gemini context caching</a>
      <br><em>${t("cache.attribution.snapshot") || "Prices snapshot 2026-01; verify against current provider docs before acting on $."}</em>
    </p>
  `;

  return `<div class="arena-result">
    <p style="font-size:1.1em;">${verdictBadge}</p>
    ${summary}
    ${table}
    ${diffViz}
    ${attribution}
  </div>`;
}

function runCacheDiff() {
  const oldText = $("cache-old")?.value || "";
  const newText = $("cache-new")?.value || "";
  const profile = $("cache-profile")?.value || "english";
  const outputTokens = parseInt($("cache-output-tokens")?.value || "500", 10);

  const result = diffPromptCache(oldText, newText, {
    profile,
    outputTokensEstimate: outputTokens,
  });
  $("cache-output").innerHTML = renderCacheResult(result, oldText, newText);
  $("cache-status").textContent = tFmt("cache.status.done", {
    verdict: t(`cache.verdict.${result.code}`) || result.code,
    hit: Math.round((result.params?.hit_ratio || 0) * 100),
  });
}

const CACHE_LONG_SYS = "You are a helpful, harmless, and honest assistant. " +
  "Always cite your sources. ".repeat(40) +
  "Always show your reasoning step by step. ".repeat(40) +
  "Be concise. Format code with backticks. ".repeat(40) +
  "\n\nUser tools available:\n- search\n- calculator\n- code_runner\n";

const CACHE_EXAMPLE_GOOD_OLD = CACHE_LONG_SYS + "\nUser: What is 2 + 2?";
const CACHE_EXAMPLE_GOOD_NEW = CACHE_LONG_SYS + "\nUser: What is 2 + 3?";

const CACHE_EXAMPLE_BROKEN_OLD = CACHE_LONG_SYS.replace("helpful, harmless, and honest", "helpful AND honest")
  + "\nUser: What is 2 + 2?";
const CACHE_EXAMPLE_BROKEN_NEW = CACHE_LONG_SYS + "\nUser: What is 2 + 2?";

const CACHE_EXAMPLE_BELOWMIN_OLD = "Q: name 3 colors";
const CACHE_EXAMPLE_BELOWMIN_NEW = "Q: name 4 colors";

$("cache-diff-btn")?.addEventListener("click", runCacheDiff);
$("cache-example-good-btn")?.addEventListener("click", () => {
  $("cache-old").value = CACHE_EXAMPLE_GOOD_OLD;
  $("cache-new").value = CACHE_EXAMPLE_GOOD_NEW;
  runCacheDiff();
});
$("cache-example-broken-btn")?.addEventListener("click", () => {
  $("cache-old").value = CACHE_EXAMPLE_BROKEN_OLD;
  $("cache-new").value = CACHE_EXAMPLE_BROKEN_NEW;
  runCacheDiff();
});
$("cache-example-belowmin-btn")?.addEventListener("click", () => {
  $("cache-old").value = CACHE_EXAMPLE_BELOWMIN_OLD;
  $("cache-new").value = CACHE_EXAMPLE_BELOWMIN_NEW;
  runCacheDiff();
});

// ════════════════════════════════════════════════════════════════════
// 🔬 Speculative-Decode Compatibility (v0.8.5 anti-bullshit pack #11)
// ════════════════════════════════════════════════════════════════════
const SPEC_VERDICT_BG = {
  compatible:                 "#3fb950",
  compatible_with_caveats:    "#3fb950",
  partial_compatible:         "#d29922",
  type_mismatch:              "#f85149",
  vocab_size_mismatch:        "#f85149",
  incompatible:               "#f85149",
  fetch_failed:               "#8b949e",
  identical_models:           "#58a6ff",
  missing_input:              "#8b949e",
};

let __specInited = false;

function initSpeculative() {
  if (__specInited) return;
  __specInited = true;
  // No-op (no async preload); placeholder kept for symmetry.
}

function fmtParams(p) {
  if (!p) return "—";
  if (p >= 1e9) return `${(p / 1e9).toFixed(1)}B`;
  if (p >= 1e6) return `${(p / 1e6).toFixed(1)}M`;
  return p.toLocaleString();
}

function renderSpecResult(result) {
  const verdict = t(`speculative.verdict.${result.code}`) || result.code;
  const verdictBg = SPEC_VERDICT_BG[result.code] || "#8b949e";
  const verdictBadge = `<span class="badge" style="background:${verdictBg};">${verdict}</span>`;

  // Failure-mode short-circuits
  if (result.code === "missing_input" || result.code === "identical_models") {
    return `<div class="arena-result">
      <p style="font-size:1.1em;">${verdictBadge}</p>
      <p class="recipe-desc">${t(`speculative.hint.${result.code}`) || ""}</p>
    </div>`;
  }
  if (result.code === "fetch_failed") {
    const errs = (result.errors || []).map(e => {
      const sideLabel = e.side === "target" ? (t("speculative.side.target") || "Target") : (t("speculative.side.draft") || "Draft");
      const reason = t(`speculative.fetch_error.${e.error}`) || e.error;
      return `<li><strong>${sideLabel}</strong>: ${reason}${e.status ? ` (HTTP ${e.status})` : ""}</li>`;
    }).join("");
    return `<div class="arena-result">
      <p style="font-size:1.1em;">${verdictBadge}</p>
      <ul>${errs}</ul>
      <p class="recipe-desc subtle">${t("speculative.fetch_error.hint") || "Check the model id spelling. For gated models you'll need to view the tokenizer file via your HF account — this tool can't auth."}</p>
    </div>`;
  }

  const p = result.params;

  // Mirror banner — when a gated model was fetched via an open mirror.
  let mirrorBanner = "";
  if (p.target_via_mirror || p.draft_via_mirror) {
    const lines = [];
    if (p.target_via_mirror) {
      lines.push(tFmt("speculative.mirror.target_used", {
        original: escapeHtml(p.targetId),
        mirror: escapeHtml(p.target_via_mirror),
      }) || `Target was gated; used mirror <code>${escapeHtml(p.target_via_mirror)}</code>.`);
    }
    if (p.draft_via_mirror) {
      lines.push(tFmt("speculative.mirror.draft_used", {
        original: escapeHtml(p.draftId),
        mirror: escapeHtml(p.draft_via_mirror),
      }) || `Draft was gated; used mirror <code>${escapeHtml(p.draft_via_mirror)}</code>.`);
    }
    mirrorBanner = `
      <div style="margin-bottom:0.75em;padding:0.6em;background:#332b00;border-left:3px solid #d29922;border-radius:4px;font-size:0.92em;">
        <strong>ℹ ${t("speculative.mirror.heading") || "Open-mirror fallback"}</strong>
        ${lines.map(l => `<br>${l}`).join("")}
        <br><span class="subtle" style="font-size:0.85em;">${t("speculative.mirror.warn") || "Mirror tokenizers (e.g. unsloth/) are usually byte-identical to the gated original because quantization touches weights, not tokens. Verify chat-template if exact match is required."}</span>
      </div>
    `;
  }

  // Section 1 — vocab summary
  const typeBadge = (label, val, bg) =>
    `<span class="badge" style="background:${bg};">${label}: <code>${val ?? "—"}</code></span>`;
  const typeRow = `
    ${typeBadge(t("speculative.target_label_short") || "target", p.target_type, p.type_match ? "#3fb950" : "#f85149")}
    ${typeBadge(t("speculative.draft_label_short") || "draft",  p.draft_type,  p.type_match ? "#3fb950" : "#f85149")}
    ${p.type_match ? "" : `<span class="subtle"> ← ${t("speculative.type_mismatch_note") || "tokenizer types differ; spec-dec impossible"}</span>`}
  `;

  const sizeRow = `
    <strong>${t("speculative.vocab_size") || "Vocab size"}:</strong>
    target = <code>${p.target_vocab_size.toLocaleString()}</code>,
    draft = <code>${p.draft_vocab_size.toLocaleString()}</code>
    ${p.vocab_size_match ? "" : `<span style="color:#f85149;"> ← ${t("speculative.size_diff") || "differ — every reused id is a misalignment"}</span>`}
  `;

  // Sampled match
  const matchPct = p.sampled_total > 0 ? Math.round(p.sampled_match_ratio * 100) : 0;
  const matchColor = matchPct >= 99.9 ? "#3fb950" : matchPct >= 95 ? "#d29922" : "#f85149";
  const sampleRow = `
    <strong>${t("speculative.sampled") || "Token-id sample match"}:</strong>
    <span style="color:${matchColor};font-weight:600;">${matchPct}%</span>
    <span class="subtle">(${p.sampled_match_count.toLocaleString()} / ${p.sampled_total.toLocaleString()} tokens)</span>
    ${p.first_mismatch ? `<br><span class="subtle">${t("speculative.first_mismatch") || "First mismatch"}: <code>${escapeHtml(p.first_mismatch.token).slice(0, 40)}</code> → target id ${p.first_mismatch.target_id ?? "—"}, draft id ${p.first_mismatch.draft_id ?? "—"}</span>` : ""}
  `;

  // Special / added token diffs
  const specDiffRows = (p.special_tokens_diff || []).map(d =>
    `<li><code>${d.name}</code>: target=<code>${escapeHtml(String(d.target ?? "—"))}</code>, draft=<code>${escapeHtml(String(d.draft ?? "—"))}</code></li>`
  ).join("");
  const specDiffBlock = specDiffRows
    ? `<details style="margin-top:0.5em;"><summary>${t("speculative.special_diff") || "Special-token differences"} (${p.special_tokens_diff.length})</summary><ul>${specDiffRows}</ul></details>`
    : "";

  const addedDiffPreview = (p.added_tokens_diff || []).slice(0, 12).map(d =>
    `<li><span class="subtle">${d.side === "target_only" ? "target only" : "draft only"}:</span> <code>${escapeHtml(d.token).slice(0, 40)}</code></li>`
  ).join("");
  const addedDiffBlock = addedDiffPreview
    ? `<details style="margin-top:0.5em;"><summary>${t("speculative.added_diff") || "Added-token differences"} (${(p.added_tokens_diff||[]).length})</summary><ul>${addedDiffPreview}${p.added_tokens_diff.length > 12 ? `<li class="subtle">${t("speculative.added_diff_more") || "+ more …"}</li>` : ""}</ul></details>`
    : "";

  // Section 2 — speedup band (only when compatible-ish)
  let speedupBlock = "";
  if (p.speedup_expected != null) {
    const ratio = p.param_ratio ? `${(p.param_ratio * 100).toFixed(1)}%` : "—";
    speedupBlock = `
      <div style="margin-top:1em;padding:0.75em;background:#161b22;border-left:3px solid #3fb950;border-radius:4px;">
        <strong>${t("speculative.speedup.title") || "Estimated speedup band"}</strong><br>
        <span class="subtle" style="font-size:0.85em;">${tFmt("speculative.speedup.params", { target: fmtParams(p.target_params), draft: fmtParams(p.draft_params), ratio }) || `target ${fmtParams(p.target_params)} / draft ${fmtParams(p.draft_params)} (param ratio ${ratio})`}</span>
        <div style="margin-top:0.5em;display:flex;gap:1em;flex-wrap:wrap;">
          <div>${t("speculative.speedup.low") || "Low (α=0.50)"}:<br><strong style="font-size:1.2em;">${p.speedup_low}×</strong></div>
          <div>${t("speculative.speedup.expected") || "Expected (α=0.70)"}:<br><strong style="font-size:1.4em;color:#3fb950;">${p.speedup_expected}×</strong></div>
          <div>${t("speculative.speedup.high") || "High (α=0.85)"}:<br><strong style="font-size:1.2em;">${p.speedup_high}×</strong></div>
        </div>
        <p class="subtle" style="font-size:0.78em;margin-top:0.5em;">${t("speculative.speedup.disclaimer") || "α = draft acceptance rate. Real speedup depends on prompt domain, lookahead K, and engine overhead. Bands assume ideal verifier batching."}</p>
      </div>
    `;
  } else if (p.target_params && p.draft_params && p.param_ratio >= 1) {
    speedupBlock = `<p class="recipe-desc" style="color:#f85149;margin-top:1em;">${t("speculative.speedup.draft_not_smaller") || "Draft is not smaller than target — spec-dec is misuse here."}</p>`;
  }

  // Attribution
  const attribution = `
    <p class="recipe-desc subtle" style="font-size:0.82em;margin-top:1em;">
      ${t("speculative.attribution") || "Refs:"}
      <a href="https://docs.vllm.ai/en/latest/serving/speculative_decoding.html" target="_blank" rel="noopener noreferrer">vLLM spec-dec docs</a> ·
      <a href="https://docs.sglang.ai/router/router.html" target="_blank" rel="noopener noreferrer">SGLang</a> ·
      <a href="https://huggingface.co/docs/transformers/main/en/llm_optims#speculative-decoding" target="_blank" rel="noopener noreferrer">transformers assistant_model</a> ·
      <a href="https://arxiv.org/abs/2211.17192" target="_blank" rel="noopener noreferrer">Leviathan et al. 2022</a>
    </p>
  `;

  return `<div class="arena-result">
    <p style="font-size:1.1em;">${verdictBadge}</p>
    ${mirrorBanner}
    <p>${typeRow}</p>
    <p>${sizeRow}</p>
    <p>${sampleRow}</p>
    ${specDiffBlock}
    ${addedDiffBlock}
    ${speedupBlock}
    ${attribution}
  </div>`;
}

async function runSpecCheck() {
  const targetId = $("spec-target-id")?.value?.trim() || "";
  const draftId  = $("spec-draft-id")?.value?.trim() || "";
  $("spec-status").textContent = t("speculative.status.fetching") || "🔄 Fetching tokenizer.json from HF Hub for both models…";
  $("spec-output").innerHTML = "";
  try {
    const result = await specCheckCompat(targetId, draftId);
    $("spec-output").innerHTML = renderSpecResult(result);
    $("spec-status").textContent = tFmt("speculative.status.done", {
      verdict: t(`speculative.verdict.${result.code}`) || result.code,
    });
  } catch (e) {
    $("spec-status").textContent = (t("speculative.status.error") || "❌ Error") + " " + (e.message || e);
  }
}

$("spec-check-btn")?.addEventListener("click", runSpecCheck);
// Examples mix gated + open: gated ids (Llama) trigger the open-mirror
// fallback (unsloth/...) so the user sees both the demo result AND the
// mirror-resolution mechanism. Pure open-weight pairs (Qwen + Phi)
// stay as the "no fallback needed" path for the second example.
$("spec-example-good-btn")?.addEventListener("click", () => {
  // Gated → triggers unsloth mirror fallback for both sides.
  $("spec-target-id").value = "meta-llama/Llama-3.1-70B-Instruct";
  $("spec-draft-id").value  = "meta-llama/Llama-3.1-8B-Instruct";
  runSpecCheck();
});
$("spec-example-bad-btn")?.addEventListener("click", () => {
  // Open-weight cross-family → no fallback, plain incompatibility demo.
  $("spec-target-id").value = "Qwen/Qwen2.5-7B-Instruct";
  $("spec-draft-id").value  = "microsoft/Phi-3.5-mini-instruct";
  runSpecCheck();
});

// (HF autocomplete on spec-target-id / spec-draft-id is registered via
// the known-id list in hf_autocomplete.js; no extra wiring needed here.)

// ════════════════════════════════════════════════════════════════════
// 🌍 Multilingual Tokenizer Tax (v0.8.7 anti-bullshit pack #13)
// ════════════════════════════════════════════════════════════════════
let __taxInited = false;

function initTax() {
  if (__taxInited) return;
  __taxInited = true;
  // No async preload — transformers.js + tokenizer.json are lazy-loaded
  // on the first Tokenize click so users don't pay download cost just
  // for opening the tab. Status string explains the wait.
}

function fmtBlocks(blocks) {
  // Build a compact "60% latin · 35% cjk · 5% other" string from the
  // detector output. Drops zero-counts and orders by descending size.
  if (!blocks || !blocks.blocks || !blocks.total_chars) return "";
  const total = blocks.total_chars;
  const entries = Object.entries(blocks.blocks)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "";
  const parts = entries.map(([name, n]) => {
    const pct = Math.round((n / total) * 100);
    return `${pct}% ${name}`;
  });
  return parts.join(" · ");
}

function renderTaxResult(res, presetMeta) {
  if (res.code === "empty_input") {
    return `<div class="arena-result"><p>${t("tax.hint.empty") || "Paste some text and click Tokenize."}</p></div>`;
  }
  if (res.code === "all_failed") {
    const errLines = res.results.map(r => {
      const meta = presetMeta.find(p => p.id === r.modelId);
      return `<li><code>${escapeHtml(r.modelId)}</code> ${meta ? `<span class="subtle">(${escapeHtml(meta.label)})</span>` : ""}: ${t(`tax.error.${r.error}`) || r.error}</li>`;
    }).join("");
    return `<div class="arena-result"><p style="color:#f85149;"><strong>❌ ${t("tax.all_failed") || "All tokenizers failed to load."}</strong></p><ul>${errLines}</ul></div>`;
  }

  const baselineCount = res.baseline_count;
  const blocks = detectLanguageBlocks($("tax-input").value);
  const ratioColor = (r) => {
    if (r == null) return "#8b949e";
    if (r >= 1.5)  return "#f85149";          // big tax — red
    if (r >= 1.15) return "#f0883e";          // moderate
    if (r >= 0.85) return "#3fb950";          // about same
    return "#58a6ff";                         // BETTER than baseline (rare)
  };
  const fmtRatio = (r) => r == null ? "—" : `${r.toFixed(2)}×`;

  const rows = res.results.map(r => {
    const meta = presetMeta.find(p => p.id === r.modelId) || { label: r.modelId, family: "" };
    if (!r.ok) {
      return `<tr style="opacity:0.5;">
        <td><strong>${escapeHtml(meta.label)}</strong><br><span class="subtle" style="font-size:0.8em;">${escapeHtml(meta.family)}</span></td>
        <td colspan="3" style="color:#f0883e;">${t(`tax.error.${r.error}`) || r.error}</td>
      </tr>`;
    }
    const isBaseline = r.modelId === res.baseline_id;
    const baselineMark = isBaseline ? `<span class="subtle" style="font-size:0.8em;"> (baseline)</span>` : "";
    return `<tr ${isBaseline ? 'style="background:#1f2933;"' : ""}>
      <td><strong>${escapeHtml(meta.label)}</strong>${baselineMark}<br><span class="subtle" style="font-size:0.8em;">${escapeHtml(meta.family)}</span></td>
      <td style="text-align:right;font-family:monospace;"><strong>${r.token_count.toLocaleString()}</strong></td>
      <td style="text-align:right;font-family:monospace;">${r.chars_per_token != null ? r.chars_per_token.toFixed(2) : "—"}</td>
      <td style="text-align:right;font-family:monospace;color:${ratioColor(r.ratio_vs_baseline)};"><strong>${fmtRatio(r.ratio_vs_baseline)}</strong></td>
    </tr>`;
  }).join("");

  // Worst-tax explanation — find the tokenizer that scored ≥1.5× baseline.
  const worst = res.results
    .filter(r => r.ok && r.ratio_vs_baseline != null)
    .sort((a, b) => b.ratio_vs_baseline - a.ratio_vs_baseline)[0];
  let interpretation = "";
  if (worst && worst.ratio_vs_baseline >= 1.3) {
    const meta = presetMeta.find(p => p.id === worst.modelId);
    const pct = Math.round((worst.ratio_vs_baseline - 1) * 100);
    interpretation = `<p style="color:#f0883e;margin-top:0.5em;">⚠ <strong>${tFmt("tax.interp.worst", {
      label: meta?.label || worst.modelId,
      pct,
    }) || `${meta?.label || worst.modelId} costs ${pct}% more tokens than baseline for this text.`}</strong></p>`;
  } else if (worst && worst.ratio_vs_baseline <= 1.05) {
    interpretation = `<p style="color:#3fb950;margin-top:0.5em;">${t("tax.interp.uniform") || "✓ All tokenizers within ±5% — text is well-handled across vendors."}</p>`;
  }

  return `<div class="arena-result">
    <p>
      <strong>${tFmt("tax.summary.input", { chars: res.chars.toLocaleString(), bytes: res.bytes.toLocaleString() }) || `Input: ${res.chars.toLocaleString()} chars, ${res.bytes.toLocaleString()} bytes`}</strong>
      ${blocks.dominant ? `<span class="subtle"> · ${t("tax.script_breakdown") || "scripts"}: ${fmtBlocks(blocks)}</span>` : ""}
    </p>
    ${interpretation}
    <table class="lean-table" style="margin-top:0.5em;width:100%;">
      <thead><tr>
        <th style="text-align:left;">${t("tax.col.tokenizer") || "Tokenizer"}</th>
        <th style="text-align:right;">${t("tax.col.tokens") || "Tokens"}</th>
        <th style="text-align:right;">${t("tax.col.cpt") || "Chars/tok"}</th>
        <th style="text-align:right;">${t("tax.col.ratio") || "Ratio"}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="recipe-desc subtle" style="font-size:0.82em;margin-top:1em;">
      ${t("tax.attribution") || "Tokenizers via"}
      <a href="https://github.com/huggingface/transformers.js" target="_blank" rel="noopener noreferrer">@huggingface/transformers</a>
      (browser BPE runtime).
      ${t("tax.attribution.privacy") || "Text is tokenized locally — never leaves the browser."}
    </p>
  </div>`;
}

async function runTaxTokenize() {
  const text = $("tax-input")?.value || "";
  if (!text) {
    $("tax-status").textContent = t("tax.hint.empty") || "⚠ Paste some text first.";
    return;
  }
  $("tax-status").textContent = t("tax.status.loading") || "⏳ Loading transformers.js + tokenizers (first run can take 5-15s)…";
  $("tax-output").innerHTML = "";
  const ids = TAX_PRESETS.map(p => p.id);
  try {
    const t0 = Date.now();
    const res = await tokenizeAll(ids, text);
    const ms = Date.now() - t0;
    $("tax-output").innerHTML = renderTaxResult(res, TAX_PRESETS);
    const okN = res.results.filter(r => r.ok).length;
    $("tax-status").textContent = tFmt("tax.status.done", {
      n: okN, total: ids.length, ms,
    }) || `✅ ${okN}/${ids.length} tokenizers ran in ${ms}ms`;
  } catch (e) {
    $("tax-status").textContent = `❌ ${e.message || e}`;
  }
}

$("tax-tokenize-btn")?.addEventListener("click", runTaxTokenize);
$("tax-sample-en-btn")?.addEventListener("click", () => {
  $("tax-input").value = TAX_SAMPLES.english;
  runTaxTokenize();
});
$("tax-sample-zh-btn")?.addEventListener("click", () => {
  $("tax-input").value = TAX_SAMPLES.chinese;
  runTaxTokenize();
});
$("tax-sample-ar-btn")?.addEventListener("click", () => {
  $("tax-input").value = TAX_SAMPLES.arabic;
  runTaxTokenize();
});
$("tax-sample-mixed-btn")?.addEventListener("click", () => {
  $("tax-input").value = TAX_SAMPLES.mixed;
  runTaxTokenize();
});
$("tax-sample-code-btn")?.addEventListener("click", () => {
  $("tax-input").value = TAX_SAMPLES.code;
  runTaxTokenize();
});

// ════════════════════════════════════════════════════════════════════
// LongScore mode (v0.8.8 anti-bullshit pack #14)
// ════════════════════════════════════════════════════════════════════
let __longscoreInited = false;

function initLongscore() {
  if (__longscoreInited) return;
  __longscoreInited = true;
  // Eager-load KB so the first lookup is instant (KB is ~70KB, no real cost)
  loadLongscoreKB().catch(e => {
    console.warn("longscore_kb preload failed", e);
  });
}

function lsFmtPct(x, sign) {
  if (x == null) return "—";
  const v = (x * 100);
  return `${sign && v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function lcColor(avg) {
  if (avg == null) return "#8b949e";
  if (avg >= -0.02) return "#3fb950";       // green: no degradation
  if (avg >= -0.10) return "#a5d36a";       // light green
  if (avg >= -0.20) return "#f0883e";       // orange
  if (avg >= -0.30) return "#f85149";       // red
  return "#a01b1b";                          // dark red: extreme
}

function renderLongscoreResult(res) {
  if (res.code === "miss") {
    return `<div class="arena-result">
      <p style="color:#f0883e;"><strong>${t("longscore.miss.title") || "Model not found in KB"}</strong></p>
      <p>${tFmt("longscore.miss.body", { id: res.normalized_id, n: res.n_kb_total }) || `Looked up <code>${res.normalized_id}</code>. KB has ${res.n_kb_total} models. Try a canonical HF id (e.g. <code>Qwen2.5-72B-Instruct</code>, <code>Llama-3.1-70B-Instruct</code>, <code>Jamba-1.5-Mini</code>).`}</p>
      <p class="subtle" style="font-size:0.85em;">${t("longscore.miss.suggest") || "Check coverage at"} <a href="https://github.com/NVIDIA/RULER" target="_blank">RULER</a> · <a href="https://github.com/princeton-nlp/HELMET" target="_blank">HELMET</a>.</p>
    </div>`;
  }

  const verdictMap = {
    no_degradation: { color: "#3fb950", label: t("longscore.verdict.no_degradation") || "✅ No degradation past short context" },
    mild:           { color: "#a5d36a", label: t("longscore.verdict.mild")           || "🟢 Mild degradation (<10%)" },
    moderate:       { color: "#f0883e", label: t("longscore.verdict.moderate")       || "🟠 Moderate degradation (10-20%)" },
    severe:         { color: "#f85149", label: t("longscore.verdict.severe")         || "🔴 Severe degradation (20-30%)" },
    extreme:        { color: "#a01b1b", label: t("longscore.verdict.extreme")        || "🚨 Extreme degradation (>30%)" },
  };

  let html = `<div class="arena-result">`;
  html += `<p><strong>${escapeHtml(res.display_name)}</strong>`;
  if (res.params_b) html += ` <span class="subtle">· ${res.params_b}B params</span>`;
  if (res.recipe_class) html += ` <span class="subtle">· ${escapeHtml(res.recipe_class)}</span>`;
  if (res.native_context_k) html += ` <span class="subtle">· native ctx ${res.native_context_k}K</span>`;
  html += `</p>`;

  // RULER per-length + LongScore
  if (res.ruler_long_score) {
    const ls = res.ruler_long_score;
    const v = verdictMap[res.verdict] || { color: "#8b949e", label: res.verdict };
    html += `<p style="margin-top:0.8em;font-size:1.1em;">
      <strong>${t("longscore.score_label") || "LongScore"}:</strong>
      <span style="color:${lcColor(ls.avg_lc)};font-family:monospace;font-size:1.2em;font-weight:bold;">${lsFmtPct(ls.avg_lc, true)}</span>
      <span class="subtle">· Base = ${ls.base.toFixed(1)}% (mean of 4K, 8K)</span>
    </p>`;
    html += `<p style="color:${v.color};font-weight:bold;">${v.label}</p>`;

    // Per-length bars
    html += `<table class="lean-table" style="margin-top:0.8em;width:100%;">
      <thead><tr>
        <th style="text-align:left;">${t("longscore.col.ctx") || "Context"}</th>
        <th style="text-align:right;">${t("longscore.col.score") || "Score"}</th>
        <th style="text-align:right;">${t("longscore.col.lc") || "LC"}</th>
      </tr></thead><tbody>`;
    const ctxKeys = ["4k", "8k", "16k", "32k", "64k", "128k"];
    for (const k of ctxKeys) {
      const score = res.ruler_per_ctx?.[k];
      if (score == null) continue;
      const isShort = k === "4k" || k === "8k";
      const lc = ls.per_length_lc?.[k];
      html += `<tr ${isShort ? 'style="opacity:0.7;"' : ""}>
        <td><strong>${k.toUpperCase()}</strong>${isShort ? ` <span class="subtle" style="font-size:0.8em;">(base)</span>` : ""}</td>
        <td style="text-align:right;font-family:monospace;">${score.toFixed(1)}%</td>
        <td style="text-align:right;font-family:monospace;color:${lcColor(lc)};">${lc != null ? lsFmtPct(lc, true) : "—"}</td>
      </tr>`;
    }
    html += `</tbody></table>`;
  } else {
    // Helmet-only or partial
    html += `<p style="margin-top:0.8em;color:#f0883e;">${t("longscore.no_ruler") || "⚠ No per-length data — LongScore not computable. Showing HELMET aggregate at 128K instead."}</p>`;
  }

  // HELMET breakdown if available
  if (res.helmet) {
    html += `<details style="margin-top:1em;" open>
      <summary><strong>${t("longscore.helmet_label") || "HELMET 7-task breakdown"} (at 128K)</strong></summary>
      <table class="lean-table" style="margin-top:0.5em;width:100%;">
        <thead><tr>
          <th style="text-align:left;">${t("longscore.col.task") || "Task"}</th>
          <th style="text-align:right;">${t("longscore.col.score") || "Score"}</th>
        </tr></thead><tbody>`;
    if (res.helmet.overall != null) {
      html += `<tr style="background:#1f2933;"><td><strong>Overall</strong></td><td style="text-align:right;font-family:monospace;"><strong>${res.helmet.overall.toFixed(1)}</strong></td></tr>`;
    }
    if (res.helmet.categories) {
      for (const [task, score] of Object.entries(res.helmet.categories)) {
        html += `<tr><td>${escapeHtml(task)}</td><td style="text-align:right;font-family:monospace;">${score != null ? score.toFixed(1) : "—"}</td></tr>`;
      }
    }
    html += `</tbody></table></details>`;
  }

  html += `<p class="recipe-desc subtle" style="font-size:0.82em;margin-top:1em;">
    ${t("longscore.source_note") || "Data source"}: ${escapeHtml(res.source)} ·
    <a href="https://arxiv.org/abs/2505.19293" target="_blank">LongScore metric</a>
  </p>`;
  html += `</div>`;
  return html;
}

async function runLongscoreLookup() {
  const id = $("longscore-input")?.value?.trim();
  if (!id) {
    $("longscore-status").textContent = t("longscore.hint.empty") || "⚠ Paste a model id first.";
    return;
  }
  $("longscore-status").textContent = t("longscore.status.lookup") || "⏳ Looking up…";
  $("longscore-output").innerHTML = "";
  try {
    const res = await longscoreLookup(id);
    $("longscore-output").innerHTML = renderLongscoreResult(res);
    if (res.code === "miss") {
      $("longscore-status").textContent = t("longscore.status.miss") || "ℹ Model not in KB";
    } else if (res.code === "ruler_hit") {
      $("longscore-status").textContent = t("longscore.status.ruler_hit") || "✅ RULER per-length data found";
    } else {
      $("longscore-status").textContent = t("longscore.status.helmet_only") || "ℹ HELMET aggregate only (no per-length data)";
    }
  } catch (e) {
    $("longscore-status").textContent = `❌ ${e.message || e}`;
    console.error(e);
  }
}

$("longscore-lookup-btn")?.addEventListener("click", runLongscoreLookup);
$("longscore-input")?.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    runLongscoreLookup();
  }
});
$("longscore-example-good-btn")?.addEventListener("click", () => {
  $("longscore-input").value = "Jamba-1.5-Large";
  runLongscoreLookup();
});
$("longscore-example-mid-btn")?.addEventListener("click", () => {
  $("longscore-input").value = "Llama-3.1-70B-Instruct";
  runLongscoreLookup();
});
$("longscore-example-bad-btn")?.addEventListener("click", () => {
  $("longscore-input").value = "dbrx";
  runLongscoreLookup();
});

// ════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════
// 🧵 YaRN / RoPE Context-Extension Planner (v0.9)
// ════════════════════════════════════════════════════════════════════
let _yarnWired = false;
function initYarn() {
  if (_yarnWired) return;
  _yarnWired = true;

  const fetchBtn = $("yarn-fetch-btn");
  const planBtn = $("yarn-plan-btn");

  fetchBtn?.addEventListener("click", async () => {
    const modelId = ($("yarn-model").value || "").trim();
    if (!modelId) { $("yarn-status").textContent = "⚠ " + t("yarn.need_id"); return; }
    $("yarn-status").textContent = "⏳ " + t("yarn.fetching");
    fetchBtn.disabled = true;
    state.lastModelId = modelId;
    try {
      const cfg = await fetchHfConfig(modelId);
      const rs = (cfg.rope_scaling && typeof cfg.rope_scaling === "object") ? cfg.rope_scaling : {};
      // If the model already ships a rope_scaling block, original_max_position_embeddings
      // is the TRUE trained context; max_position_embeddings is the already-extended figure.
      const orig = rs.original_max_position_embeddings ?? cfg.max_position_embeddings ?? null;
      const theta = cfg.rope_theta ?? 10000;
      if (orig) $("yarn-orig").value = orig;
      $("yarn-theta").value = theta;
      const via = cfg.__via_mirror ? ` (via ${escapeHtml(cfg.__via_mirror)})` : "";
      $("yarn-status").innerHTML =
        `✅ <strong>${escapeHtml(modelId)}</strong>${via}: θ=${theta}, orig=${orig ?? "?"}. ${t("yarn.loaded_hint")}`;
    } catch (err) {
      $("yarn-status").textContent = `❌ ${err.message}`;
    } finally {
      fetchBtn.disabled = false;
    }
  });

  planBtn?.addEventListener("click", () => {
    const plan = planExtension({
      originalCtx: parseFloat($("yarn-orig").value),
      theta: parseFloat($("yarn-theta").value),
      targetCtx: parseFloat($("yarn-target").value),
      ropeType: $("yarn-type").value || null,
    });
    renderYarnPlan(plan);
  });
}

// Context / horizon lengths: binary-K so 32768→32K, 131072→128K, 8192→8K
// (the convention everyone uses for context windows), not decimal-K (→33K).
function _yarnFmtK(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1048576) return (n / 1048576).toFixed(1) + "M";
  if (n >= 1024) return Math.round(n / 1024) + "K";
  return String(Math.round(n));
}
// RoPE θ is an arbitrary base, not a power of two → decimal M/K reads naturally
// (1000000→1M, 500000→500K, 40000→40K).
function _thetaFmt(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "K";
  return String(Math.round(n));
}
function _yarnFmtG(g) {
  return (g == null || !Number.isFinite(g)) ? "—" : g.toFixed(3);
}
function _yarnWarnText(w) {
  switch (w.code) {
    case "theta_eff_estimate": return t("yarn.warn.theta_eff_estimate");
    case "aggressive_factor":  return `${t("yarn.warn.aggressive")} (${w.params.factor}×)`;
    case "gamma_collapse":     return `${t("yarn.warn.gamma_collapse")} (γ_eff ${_yarnFmtG(w.params.gammaEff)} @ L ${_yarnFmtK(w.params.target)})`;
    case "finetune_note":      return t("yarn.warn.finetune");
    default: return w.code;
  }
}

function renderYarnPlan(p) {
  const out = $("yarn-output");
  if (!out) return;
  out.style.display = "";

  const errMap = {
    no_original_ctx: "yarn.err.no_orig",
    no_theta:        "yarn.err.no_theta",
    no_target:       "yarn.err.no_target",
  };
  if (errMap[p.verdict]) {
    out.innerHTML = `<div class="gc-validity-warning">⚠ ${t(errMap[p.verdict])}</div>`;
    return;
  }

  if (p.verdict === "no_extension_needed") {
    out.innerHTML =
      `<div class="gc-validity-warning" style="border-left-color:#3fb950;">✅ ${t("yarn.verdict.no_extension_needed")}
        <br><span class="subtle">L=${_yarnFmtK(p.targetCtx)} ≤ trained ${_yarnFmtK(p.originalCtx)}. γ_Padé=${_yarnFmtG(p.gammaNaive)}.</span></div>`;
    return;
  }

  const meta = ({
    healthy:          { emoji: "✅", cls: "v-yes" },
    usable_with_care: { emoji: "⚠️", cls: "v-deg" },
    needs_finetune:   { emoji: "🔧", cls: "v-deg" },
    degrades:         { emoji: "🚨", cls: "v-no"  },
  })[p.verdict] || { emoji: "❓", cls: "v-deg" };

  const cfgJson = JSON.stringify({ rope_scaling: p.config }, null, 2);
  const warnHtml = p.warnings.map(w => `<li>${_yarnWarnText(w)}</li>`).join("");
  const td = "padding:3px 10px 3px 0;";

  out.innerHTML = `
    <p><span class="verdict-badge ${meta.cls}">${meta.emoji} ${t("yarn.verdict." + p.verdict)}</span></p>
    <table style="border-collapse:collapse;font-size:0.95em;margin:0.5em 0;">
      <tr><td style="${td}">${t("yarn.r.factor")}</td><td><strong>${p.factor}×</strong> (${_yarnFmtK(p.originalCtx)} → ${_yarnFmtK(p.targetCtx)})</td></tr>
      <tr><td style="${td}">${t("yarn.r.method")}</td><td><code>${p.ropeType}</code></td></tr>
      <tr><td style="${td}">γ ${t("yarn.r.naive")}</td><td>${_yarnFmtG(p.gammaNaive)}${p.gammaNaive <= 0 ? ` 🚨 ${t("yarn.r.collapsed")}` : ""}</td></tr>
      <tr><td style="${td}">γ ${t("yarn.r.eff")}</td><td><strong>${_yarnFmtG(p.gammaEff)}</strong></td></tr>
      <tr><td style="${td}">θ_eff</td><td>${_thetaFmt(p.thetaEff)}${p.thetaEff > p.theta ? ` (↑ ${t("yarn.r.from")} ${_thetaFmt(p.theta)})` : ""}</td></tr>
    </table>
    <h3>${t("yarn.r.snippet")}</h3>
    <pre class="diag-cmd-box">${escapeHtml(cfgJson)}</pre>
    <button id="yarn-copy-btn" class="secondary">📋 ${t("yarn.copy_btn")}</button>
    ${warnHtml ? `<ul style="font-size:0.9em;margin-top:0.8em;opacity:0.9;">${warnHtml}</ul>` : ""}`;

  $("yarn-copy-btn")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(cfgJson);
      $("yarn-copy-btn").textContent = "✓ " + t("yarn.copied");
    } catch (e) { /* clipboard blocked */ }
  });
}

// ════════════════════════════════════════════════════════════════════
// 🧊 GGUF Validity Bridge (v0.9.1)
// ════════════════════════════════════════════════════════════════════
let _ggufWired = false;
let _ggufFiles = [];
let _ggufCfgCache = {}; // "repo|file" → ggufToConfig result (geometry is shared across quants)

// Parse a .gguf header once and cache. The architecture/θ/context/head geometry
// is identical across every quant of the same model — only the quant scheme
// differs — so one parsed file is enough to score the whole repo.
async function ggufGetCfg(repo, file) {
  const key = `${repo}|${file}`;
  if (_ggufCfgCache[key]) return _ggufCfgCache[key];
  const url = `https://huggingface.co/${repo}/resolve/main/${file}`;
  const meta = await fetchGgufMetadata(url);
  const cfg = ggufToConfig(meta);
  if (!cfg.quant_scheme) {
    const q = quantFromFilename(file);
    cfg.quant_label = cfg.quant_label || q.label;
    cfg.quant_scheme = q.scheme;
  }
  cfg.__bytesRead = meta.bytesRead;
  _ggufCfgCache[key] = cfg;
  return cfg;
}

function initGguf() {
  if (_ggufWired) return;
  _ggufWired = true;

  const listBtn = $("gguf-list-btn");
  const analyzeBtn = $("gguf-analyze-btn");
  const allBtn = $("gguf-all-btn");
  const fileSel = $("gguf-file");

  // GGUF-tag-filtered autocomplete; picking a repo auto-lists its quant files
  // so the flow matches the other modes (select → it just works).
  const repoEl = $("gguf-repo");
  if (repoEl) attachHfAutocomplete(repoEl, { pipeline: "gguf", onSelect: () => listBtn?.click() });

  listBtn?.addEventListener("click", async () => {
    const repo = ($("gguf-repo").value || "").trim();
    if (!repo) { $("gguf-status").textContent = "⚠ " + t("gguf.need_repo"); return; }
    $("gguf-status").textContent = "⏳ " + t("gguf.listing");
    listBtn.disabled = true;
    state.lastModelId = repo;
    try {
      const files = await listGgufFiles(repo);
      if (!files.length) { $("gguf-status").textContent = "⚠ " + t("gguf.no_files"); fileSel.disabled = true; analyzeBtn.disabled = true; return; }
      fileSel.innerHTML = files.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join("");
      // Default-select a Q4_K_M (the community sweet spot) if present.
      const def = files.find(f => /q4_k_m/i.test(f)) || files[0];
      fileSel.value = def;
      fileSel.disabled = false;
      analyzeBtn.disabled = false;
      $("gguf-all-btn").disabled = false;
      _ggufFiles = files;
      $("gguf-status").innerHTML = `✅ ${files.length} ${t("gguf.found")} — ${t("gguf.pick_hint")}`;
    } catch (err) {
      // Clear any stale file list from a previous repo so a failed lookup
      // never leaves the old repo's quants showing.
      fileSel.innerHTML = ""; fileSel.disabled = true;
      analyzeBtn.disabled = true; $("gguf-all-btn").disabled = true;
      $("gguf-output").style.display = "none";
      $("gguf-status").textContent = `❌ ${err.message}`;
    } finally {
      listBtn.disabled = false;
    }
  });

  analyzeBtn?.addEventListener("click", async () => {
    const repo = ($("gguf-repo").value || "").trim();
    const file = fileSel.value;
    if (!repo || !file) return;
    $("gguf-status").textContent = "⏳ " + t("gguf.reading");
    analyzeBtn.disabled = true;
    try {
      const cfg = await ggufGetCfg(repo, file);
      const target = parseFloat($("gguf-target").value) || null;
      const result = analyzeGguf(cfg, target);
      $("gguf-status").innerHTML = `✅ ${t("gguf.read_ok")} (${(cfg.__bytesRead / 1024 / 1024).toFixed(1)} MB header)`;
      renderGgufResult(cfg, result);
    } catch (err) {
      $("gguf-status").textContent = `❌ ${ggufErrMsg(err)}`;
    } finally {
      analyzeBtn.disabled = false;
    }
  });

  allBtn?.addEventListener("click", async () => {
    const repo = ($("gguf-repo").value || "").trim();
    const file = fileSel.value;
    if (!repo || !file) return;
    $("gguf-status").textContent = "⏳ " + t("gguf.reading");
    allBtn.disabled = true; analyzeBtn.disabled = true;
    try {
      // One header parse gives the shared geometry; score every quant from it.
      const cfg = await ggufGetCfg(repo, file);
      const target = parseFloat($("gguf-target").value) || null;
      // Dedupe repo files to one row per quant label (drop shard suffixes).
      const seen = new Set();
      const rows = [];
      for (const f of _ggufFiles) {
        const q = quantFromFilename(f);
        if (q.label === "?" || seen.has(q.label)) continue;
        seen.add(q.label);
        const res = analyzeGguf({ ...cfg, quant_label: q.label, quant_scheme: q.scheme }, target);
        rows.push({ label: q.label, scheme: q.scheme, res });
      }
      // Best precision first: lowest γ-shift (baseline F16 = 0) at the top.
      rows.sort((a, b) => (a.res.quant?.gamma_shift ?? 0) - (b.res.quant?.gamma_shift ?? 0));
      $("gguf-status").innerHTML = `✅ ${t("gguf.read_ok")} (${(cfg.__bytesRead / 1024 / 1024).toFixed(1)} MB header)`;
      renderGgufComparison(cfg, rows);
    } catch (err) {
      $("gguf-status").textContent = `❌ ${ggufErrMsg(err)}`;
    } finally {
      allBtn.disabled = false; analyzeBtn.disabled = false;
    }
  });
}

function ggufErrMsg(err) {
  return ({
    not_a_gguf_file: t("gguf.err.not_gguf"),
    gguf_metadata_too_large: t("gguf.err.too_large"),
  })[err.message] || err.message;
}

function renderGgufResult(cfg, r) {
  const out = $("gguf-output");
  if (!out) return;
  out.style.display = "";

  if (r.verdict === "incomplete") {
    out.innerHTML = `<div class="gc-validity-warning">⚠ ${t("gguf.err.incomplete")}</div>`;
    return;
  }

  const meta = ({
    healthy:          { emoji: "✅", cls: "v-yes" },
    usable_with_care: { emoji: "⚠️", cls: "v-deg" },
    degrades:         { emoji: "🚨", cls: "v-no"  },
  })[r.verdict] || { emoji: "❓", cls: "v-deg" };

  const td = "padding:3px 12px 3px 0;";
  const gqa = (cfg.num_attention_heads && cfg.num_key_value_heads && cfg.num_key_value_heads < cfg.num_attention_heads)
    ? `GQA ${cfg.num_attention_heads}:${cfg.num_key_value_heads}` : "MHA";

  // Quant block (may be null for F16/F32 files).
  let quantHtml = "";
  if (r.quant) {
    const regimeEmoji = ({ safe: "✅", mild: "🟡", significant: "🟠", cliff: "🚨" })[r.quant.regime] || "";
    const dp = r.quant.delta_ppl;
    quantHtml = `
      <tr><td style="${td}">${t("gguf.r.quant")}</td><td><code>${r.quantLabel || "?"}</code></td></tr>
      <tr><td style="${td}">${t("gguf.r.gamma_shift")}</td><td>−${_yarnFmtG(r.quant.gamma_shift)} ${regimeEmoji} <span class="subtle">${t("quant.regime." + r.quant.regime) || r.quant.regime}</span></td></tr>
      <tr><td style="${td}">ΔPPL</td><td>≈ +${dp.mid} <span class="subtle">(${dp.low}–${dp.high})</span></td></tr>`;
  } else {
    quantHtml = `<tr><td style="${td}">${t("gguf.r.quant")}</td><td><code>${r.quantLabel || "F16/F32"}</code> <span class="subtle">${t("gguf.r.no_quant_shift")}</span></td></tr>`;
  }

  out.innerHTML = `
    <p><span class="verdict-badge ${meta.cls}">${meta.emoji} ${t("gguf.verdict." + r.verdict)}</span></p>
    <table style="border-collapse:collapse;font-size:0.95em;margin:0.5em 0;">
      <tr><td style="${td}">${t("gguf.r.arch")}</td><td><code>${escapeHtml(r.arch)}</code> · ${gqa} · θ=${_thetaFmt(r.theta)}</td></tr>
      <tr><td style="${td}">${t("gguf.r.ctx_train")}</td><td>${_yarnFmtK(r.nCtx)}</td></tr>
      <tr><td style="${td}">${t("gguf.r.gamma_train")}</td><td>${_yarnFmtG(r.gammaTrain)} <span class="subtle">${t("gguf.r.gamma_train_note")}</span></td></tr>
      ${quantHtml}
      <tr><td style="${td}"><strong>γ @ L=${_yarnFmtK(r.L)}</strong> ${t("gguf.r.after_quant")}</td><td><strong>${_yarnFmtG(r.gammaQuant)}</strong> <span class="subtle">(fp16: ${_yarnFmtG(r.gammaAtL)})</span></td></tr>
    </table>
    <p class="subtle" style="font-size:0.88em;">${t("gguf.r.note")}</p>`;
}

function renderGgufComparison(cfg, rows) {
  const out = $("gguf-output");
  if (!out) return;
  out.style.display = "";
  const gqa = (cfg.num_attention_heads && cfg.num_key_value_heads && cfg.num_key_value_heads < cfg.num_attention_heads)
    ? `GQA ${cfg.num_attention_heads}:${cfg.num_key_value_heads}` : "MHA";
  // Short verdict label = the word before the em-dash of the full verdict string
  // (works in every language: "HEALTHY — …", "SANO — …", "健康 —— …").
  const short = v => (t("gguf.verdict." + v) || v).split(/——|—| - /)[0].trim();
  const emo = v => ({ healthy: "✅", usable_with_care: "⚠️", degrades: "🚨" })[v] || "❓";
  const td = "padding:3px 14px 3px 0;";
  const head = `<tr style="text-align:left;border-bottom:1px solid var(--border);">
    <th style="${td}">${t("gguf.r.quant")}</th><th style="${td}">${t("gguf.r.gamma_shift")}</th>
    <th style="${td}">${t("gguf.col.gamma_at_l")}</th><th style="${td}">${t("gguf.col.verdict")}</th></tr>`;
  const body = rows.map(({ label, res }) => {
    const shift = res.quant ? "−" + _yarnFmtG(res.quant.gamma_shift) : "—";
    return `<tr><td style="${td}"><code>${escapeHtml(label)}</code></td><td style="${td}">${shift}</td>
      <td style="${td}">${_yarnFmtG(res.gammaQuant)}</td>
      <td style="${td}">${emo(res.verdict)} ${short(res.verdict)}</td></tr>`;
  }).join("");
  // γ_Padé is θ-set → identical for every quant; show it once in the header line.
  out.innerHTML = `<h3>${t("gguf.compare_title")}</h3>
    <p class="subtle">${escapeHtml(cfg.architecture)} · ${gqa} · θ=${_thetaFmt(cfg.rope_theta)} · ctx ${_yarnFmtK(cfg.context_length)} · γ_train ${_yarnFmtG(rows[0]?.res.gammaTrain)} · L=${_yarnFmtK(rows[0]?.res.L)}</p>
    <table style="border-collapse:collapse;font-size:0.93em;">${head}${body}</table>
    <p class="subtle" style="font-size:0.88em;">${t("gguf.r.note")}</p>`;
}

// ════════════════════════════════════════════════════════════════════
// 🚀 Launch-Flag Generator (v0.9.4)
// ════════════════════════════════════════════════════════════════════
let _launchWired = false;
let _launchGeom = null; // fetched model geometry
function initLaunch() {
  if (_launchWired) return;
  _launchWired = true;

  // Populate GPU presets.
  const gpuSel = $("launch-gpu");
  if (gpuSel && !gpuSel.options.length) {
    gpuSel.innerHTML = GPU_PRESETS.map(g => `<option value="${g.vram}">${escapeHtml(g.label)}</option>`).join("");
    gpuSel.value = "24"; // sensible default (4090)
  }

  const fetchBtn = $("launch-fetch-btn");
  const modelEl = $("launch-model");
  // Picking from autocomplete auto-fetches geometry (matches the other modes).
  if (modelEl) attachHfAutocomplete(modelEl, { onSelect: () => fetchBtn?.click() });

  fetchBtn?.addEventListener("click", async () => {
    const id = (modelEl.value || "").trim();
    if (!id) { $("launch-status").textContent = "⚠ " + t("launch.need_id"); return; }
    $("launch-status").textContent = "⏳ " + t("launch.fetching");
    fetchBtn.disabled = true;
    state.lastModelId = id;
    try {
      const cfg = await fetchHfConfig(id);
      const nAttn = cfg.num_attention_heads ?? null;
      const rs = (cfg.rope_scaling && typeof cfg.rope_scaling === "object") ? cfg.rope_scaling : {};
      _launchGeom = {
        nLayers: cfg.num_hidden_layers ?? null,
        nKvHeads: cfg.num_key_value_heads ?? nAttn,
        headDim: cfg.head_dim ?? (cfg.hidden_size && nAttn ? cfg.hidden_size / nAttn : null),
        hidden: cfg.hidden_size ?? null,
        vocab: cfg.vocab_size ?? null,
        intermediate: cfg.intermediate_size ?? null,
        tieEmbeddings: cfg.tie_word_embeddings ?? false,
        nParams: cfg.num_parameters ?? null,
        ropeTheta: cfg.rope_theta ?? 10000,
        ctxTrain: rs.original_max_position_embeddings ?? cfg.max_position_embeddings ?? null,
      };
      if (!$("launch-ctx").value && _launchGeom.ctxTrain) $("launch-ctx").value = _launchGeom.ctxTrain;
      const via = cfg.__via_mirror ? ` (via ${escapeHtml(cfg.__via_mirror)})` : "";
      $("launch-status").innerHTML = `✅ <strong>${escapeHtml(id)}</strong>${via}: ${_launchGeom.nLayers} ${t("launch.layers")}, ` +
        `GQA ${nAttn}:${_launchGeom.nKvHeads}, θ=${_thetaFmt(_launchGeom.ropeTheta)}, ctx ${_yarnFmtK(_launchGeom.ctxTrain)}. ${t("launch.fetched_hint")}`;
    } catch (err) {
      $("launch-status").textContent = `❌ ${err.message}`;
    } finally {
      fetchBtn.disabled = false;
    }
  });

  $("launch-gen-btn")?.addEventListener("click", () => {
    if (!_launchGeom) { $("launch-status").textContent = "⚠ " + t("launch.need_fetch"); return; }
    const vram = parseFloat($("launch-vram").value) || parseFloat(gpuSel.value);
    const plan = planLaunch({
      ..._launchGeom,
      quant: $("launch-quant").value,
      vramGB: vram,
      targetCtx: parseFloat($("launch-ctx").value),
      cacheType: $("launch-cache").value,
      flashAttn: $("launch-fa").checked,
    });
    renderLaunch(plan);
  });
}

function _launchWarnText(w) {
  switch (w.code) {
    case "kv_wasted":        return `${t("launch.warn.kv_wasted")} (trained ${_yarnFmtK(w.params.ctxTrain)}, L=${_yarnFmtK(w.params.target)})`;
    case "beyond_trained":   return `${t("launch.warn.beyond_trained")} (${_yarnFmtK(w.params.ctxTrain)} → ${_yarnFmtK(w.params.target)})`;
    case "no_mmap_blackwell":return t("launch.warn.no_mmap");
    case "partial_offload":  return `${t("launch.warn.partial")} (${w.params.ngl}/${w.params.nLayers})`;
    case "cpu_only":         return t("launch.warn.cpu_only");
    case "no_params":        return t("launch.warn.no_params");
    default: return w.code;
  }
}

function renderLaunch(p) {
  const out = $("launch-output");
  if (!out) return;
  out.style.display = "";
  const errMap = { no_geometry: "launch.err.no_geom", no_gpu: "launch.err.no_gpu", no_ctx: "launch.err.no_ctx" };
  if (errMap[p.verdict]) { out.innerHTML = `<div class="gc-validity-warning">⚠ ${t(errMap[p.verdict])}</div>`; return; }

  const meta = ({
    fits:    { emoji: "✅", cls: "v-yes" },
    partial: { emoji: "⚠️", cls: "v-deg" },
    too_big: { emoji: "🚨", cls: "v-no"  },
  })[p.verdict] || { emoji: "❓", cls: "v-deg" };

  const cmds = launchCommands(p);
  const td = "padding:3px 12px 3px 0;";
  const gb = n => (n == null ? "—" : n.toFixed(1) + " GB");
  const warnHtml = p.warnings.map(w => `<li>${_launchWarnText(w)}</li>`).join("");

  out.innerHTML = `
    <p><span class="verdict-badge ${meta.cls}">${meta.emoji} ${t("launch.verdict." + p.verdict)}</span></p>
    <table style="border-collapse:collapse;font-size:0.95em;margin:0.5em 0;">
      <tr><td style="${td}">${t("launch.r.weights")}</td><td>${gb(p.weightsGB)} <span class="subtle">(${p.quant}, ${p.bpw} bpw)</span></td></tr>
      <tr><td style="${td}">${t("launch.r.kv")}</td><td>${gb(p.kvGB)} <span class="subtle">(${p.cacheType}${p.flashAttn ? ", -fa" : ""})</span></td></tr>
      <tr><td style="${td}">${t("launch.r.overhead")}</td><td>${gb(p.overheadGB)}</td></tr>
      <tr style="border-top:1px solid var(--border);"><td style="${td}"><strong>${t("launch.r.total")}</strong></td><td><strong>${gb(p.totalGB)}</strong> / ${gb(p.vramGB)} VRAM</td></tr>
      <tr><td style="${td}">${t("launch.r.ngl")}</td><td><strong>${p.allOnGpu ? `${p.nLayers} (${t("launch.r.all")})` : `${p.ngl} / ${p.nLayers}`}</strong></td></tr>
    </table>
    <h3>llama.cpp</h3>
    <pre class="diag-cmd-box">${escapeHtml(cmds.llamacpp)}</pre>
    <button id="launch-copy-llama" class="secondary">📋 ${t("launch.copy")}</button>
    <h3 style="margin-top:0.8em;">Ollama</h3>
    <pre class="diag-cmd-box">${escapeHtml(cmds.ollama)}</pre>
    ${warnHtml ? `<ul style="font-size:0.9em;margin-top:0.8em;opacity:0.9;">${warnHtml}</ul>` : ""}
    <p class="subtle" style="font-size:0.86em;">${t("launch.r.note")}</p>`;

  $("launch-copy-llama")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(cmds.llamacpp); $("launch-copy-llama").textContent = "✓ " + t("yarn.copied"); } catch (e) {}
  });
}

// ════════════════════════════════════════════════════════════════════
// Bootstrap
// ════════════════════════════════════════════════════════════════════
initI18n();
// Pyodide-independent panels: render immediately so they survive a Pyodide
// load failure (CDN blocked / offline / slow region). These use only fetch +
// DOM, never state.pyodide — must NOT be gated behind enableUI().
renderFalsificationDashboard();
loadCommunityFeed();
loadPyodideAndTaf().catch(err => {
  setStatus(`❌ Failed to initialise: ${err.message || err}`);
  console.error(err);
});
