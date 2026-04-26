// TAF Agent — main orchestration (v0.2 — i18n + Profile + Compare)
//
// Phases:
//  1. Pyodide loads + TAF formulas      → deterministic computation
//  2. WebLLM loads on demand            → plain-English synthesis
//  3. Router (LLM)                      → free-form question → recipe + params
//  4. Modes: Profile (all recipes) + Compare (multi-model side-by-side)
//  5. i18n: EN/ES/FR/ZH

import { initI18n, setLang, t } from "./i18n.js";

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
  // Render community feed + falsification (independent of Pyodide)
  renderFalsificationDashboard();
  loadCommunityFeed();
  // Restore from URL if present
  parseUrlState();
}

function setStatus(msg) { $("status").textContent = msg; }

// ════════════════════════════════════════════════════════════════════
// Mode toggle
// ════════════════════════════════════════════════════════════════════
document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const mode = btn.dataset.mode;
    state.currentMode = mode;
    // Hide all mode sections
    ["ask-section", "recipe-section", "form-section",
     "profile-section", "compare-section"].forEach(id => {
      const el = $(id);
      if (el) el.style.display = "none";
    });
    // Show selected
    if (mode === "ask") {
      $("ask-section").style.display = "";
      $("mode-desc").textContent =
        "Type a free-form question. The in-browser LLM picks the right recipe and runs it.";
    } else if (mode === "recipe") {
      $("recipe-section").style.display = "";
      $("mode-desc").textContent =
        "Pick a recipe directly and fill the form. Full manual control.";
    } else if (mode === "profile") {
      $("profile-section").style.display = "";
      $("mode-desc").textContent =
        "Quickest start: paste any HuggingFace model id, click Profile. See all 5 recipes scored in seconds.";
    } else if (mode === "compare") {
      $("compare-section").style.display = "";
      $("mode-desc").textContent =
        "Pick 2-3 candidate models + one recipe. See verdicts side-by-side in a comparison table.";
    } else if (mode === "inspector") {
      $("inspector-section").style.display = "";
      $("mode-desc").textContent =
        "Paste a config.json directly. Useful for private/in-development models not on HF Hub.";
    }
  });
});

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
  state.lastModelId = e.target.value;  // remember for filename/hash
  const proxy = state.pyodide.runPython(`get_preset(${JSON.stringify(e.target.value)})`);
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
async function fetchHfConfig(modelId) {
  const url = `https://huggingface.co/${modelId}/raw/main/config.json`;
  const resp = await fetch(url);
  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new Error(`Model is gated (${resp.status}). Accept license on HF Hub first, or fill manually.`);
    }
    throw new Error(`HTTP ${resp.status} — config.json not found at ${url}`);
  }
  return await resp.json();
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
    $("hf-status").innerHTML = `✅ Config loaded for <strong>${modelId}</strong> (family: ${preset._family}). Verify values, click Analyze.`;
  } catch (err) {
    $("hf-status").textContent = `❌ ${err.message}`;
  } finally {
    $("hf-fetch-btn").disabled = false;
  }
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
  { id: "F2",  claim: "d_horizon predicts NIAH collapse within 1% (pythia-70m)",          status: "confirmed", evidence: "predicted 4078, observed 4096" },
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
  state.lastModelId = e.target.value;  // remember for filename/hash
  const proxy = state.pyodide.runPython(`get_preset(${JSON.stringify(e.target.value)})`);
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
    $("profile-hf-status").innerHTML = `✅ <strong>${id}</strong> (${p._family})`;
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

  const numbersHtml = `
    <div class="num-row"><span class="num-label">γ_Padé(T_eval)</span><span class="num-value">${formatN(kn.gamma_pade)}</span></div>
    <div class="num-row"><span class="num-label">γ_decomposed</span><span class="num-value">${formatN(kn.gamma_decomposed)}</span></div>
    <div class="num-row"><span class="num-label">d_horizon</span><span class="num-value">${formatN(kn.d_horizon)}</span></div>
    <div class="num-row"><span class="num-label">L_NIAH ceiling</span><span class="num-value">${formatN(kn.L_NIAH_ceiling)}</span></div>
    <div class="num-row"><span class="num-label">χ susceptibility</span><span class="num-value">${formatN(kn.chi_susceptibility)}</span></div>
    <div class="num-row"><span class="num-label">KV memory @ T_eval (BF16)</span><span class="num-value">${formatN(kn.kv_memory_per_request_GB)} GB</span></div>
  `;

  const falsHtml = (p.falsification_status || []).map(f =>
    `<div class="taf-falsification"><strong>${escapeHtml(f.id)}</strong> — ${escapeHtml(f.claim)}: ${escapeHtml(f.status)}</div>`
  ).join("");

  $("profile-box").innerHTML = `
    <div class="taf-card">
      <div class="taf-card-summary">
        <div style="font-size:1.2rem; font-weight:700;">${escapeHtml(ms.architecture_class)}</div>
        <div class="subtle">
          n_params=${formatN(ms.n_params)} ·
          T_train=${ms.T_train} · T_eval=${ms.T_eval} ·
          θ=${formatN(ms.rope_theta)} ·
          ${ms.has_GQA ? "GQA" : "MHA"}${ms.has_SWA ? " + SWA" : ""}
        </div>
      </div>

      <h3 data-i18n="tafcard.recipes_title">📋 Recipes (verdict per dimension)</h3>
      <div class="taf-recipes-grid">${recipesHtml}</div>

      <h3 data-i18n="tafcard.numbers_title">🔢 Key numbers (paper §26)</h3>
      <div class="taf-key-numbers">${numbersHtml}</div>

      <div id="whatif-container" class="whatif-box"></div>

      <h3 data-i18n="tafcard.fals_title">🔬 Falsification status (FALSIFICATION.md F1-F23)</h3>
      ${falsHtml || '<div class="subtle">No falsifications applicable.</div>'}

      <div class="share-bar">
        <button class="secondary" id="profile-share-btn" data-i18n="share.btn">🔗 Copy share link</button>
        <button class="secondary" id="profile-download-btn" data-i18n="share.download">💾 Download JSON</button>
        <button class="secondary" id="profile-submit-btn" data-i18n="share.submit">📤 Submit to registry</button>
        <span id="profile-share-status" class="subtle"></span>
      </div>
    </div>
  `;

  // Render the what-if slider for interactive exploration
  renderWhatIfSlider(p, params, $("whatif-container"));

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
  $("profile-submit-btn").addEventListener("click", async () => {
    const url = await buildIssueUrl("profile", p);
    window.open(url, "_blank");
    $("profile-share-status").textContent = "↗ Opened GitHub registry (search hash before submitting to avoid duplicate)";
    setTimeout(() => $("profile-share-status").textContent = "", 6000);
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
  $("compare-submit-btn").addEventListener("click", async () => {
    const url = await buildIssueUrl("compare", cmp);
    window.open(url, "_blank");
    $("compare-share-status").textContent = "↗ Opened GitHub registry";
    setTimeout(() => $("compare-share-status").textContent = "", 6000);
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
$("recipe-submit-btn").addEventListener("click", async () => {
  if (!state.lastFullResult) return;
  const url = await buildIssueUrl("recipe", state.lastFullResult);
  window.open(url, "_blank");
  $("share-status").textContent = "↗ Opened GitHub registry (search hash before submitting to avoid duplicate)";
  setTimeout(() => $("share-status").textContent = "", 6000);
});

// ════════════════════════════════════════════════════════════════════
// Help modal
// ════════════════════════════════════════════════════════════════════
$("help-btn").addEventListener("click", () => $("help-modal").classList.add("open"));
$("help-close").addEventListener("click", () => $("help-modal").classList.remove("open"));
$("help-modal").addEventListener("click", (e) => {
  if (e.target.id === "help-modal") $("help-modal").classList.remove("open");
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

async function buildIssueUrl(type, data) {
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
  const params = new URLSearchParams({
    title: title,
    body: body + dedupNote + "\n\n---\n*Submitted via [TAF Agent](https://karlesmarin.github.io/tafagent)*",
  });
  return `https://github.com/${REGISTRY_REPO}/issues/new?${params.toString()}`;
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
      statusEl.innerHTML = `❌ Failed to parse JSON: ${err.message}`;
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
});

// ════════════════════════════════════════════════════════════════════
// Language switcher
// ════════════════════════════════════════════════════════════════════
document.querySelectorAll(".lang-btn").forEach(btn => {
  btn.addEventListener("click", () => setLang(btn.dataset.lang));
});

// ════════════════════════════════════════════════════════════════════
// Bootstrap
// ════════════════════════════════════════════════════════════════════
initI18n();
loadPyodideAndTaf().catch(err => {
  setStatus(`❌ Failed to initialise: ${err.message || err}`);
  console.error(err);
});
