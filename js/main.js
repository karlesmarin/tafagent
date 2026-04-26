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
async function loadPyodideAndTaf() {
  setStatus("⏳ Loading Pyodide (Python runtime ~10MB)...");
  state.pyodide = await loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
  });
  setStatus("⏳ Loading TAF formulas + recipes...");
  const tafCode = await fetch(TAF_BROWSER_URL).then(r => r.text());
  await state.pyodide.runPythonAsync(tafCode);

  state.presets = JSON.parse(state.pyodide.runPython("list_presets()"));
  state.recipes = JSON.parse(state.pyodide.runPython("list_recipes()"));
  state.recipesById = Object.fromEntries(state.recipes.map(r => [r.id, r]));

  populatePresets();
  populateRecipes();
  enableUI();
  setStatus("✅ Ready. Ask a question or pick a recipe.");
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
    }
  });
});

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
        { role: "system", content: "You are a precise transformer LLM diagnostic assistant. Summarise pre-computed TAF results in 4-6 sentences. Cite section numbers. Always recommend an action. Never invent numbers." },
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
// PROFILE mode
// ════════════════════════════════════════════════════════════════════
$("profile-preset").addEventListener("change", (e) => {
  if (!e.target.value) return;
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

      <h3>📋 Recipes (verdict per dimension)</h3>
      <div class="taf-recipes-grid">${recipesHtml}</div>

      <h3>🔢 Key numbers (paper §26)</h3>
      <div class="taf-key-numbers">${numbersHtml}</div>

      <h3>🔬 Falsification status (FALSIFICATION.md F1-F23)</h3>
      ${falsHtml || '<div class="subtle">No falsifications applicable.</div>'}

      <div style="margin-top: 1rem;">
        <button class="secondary" id="profile-share-btn">🔗 Copy share link</button>
        <span id="profile-share-status" class="subtle" style="margin-left:0.75rem;"></span>
      </div>
    </div>
  `;

  // Wire share button
  $("profile-share-btn").addEventListener("click", () => copyShareLink("profile", params));
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
    <div style="margin-top: 1rem;">
      <button class="secondary" id="compare-share-btn">🔗 Copy share link</button>
      <span id="compare-share-status" class="subtle" style="margin-left:0.75rem;"></span>
    </div>
  `;
  $("compare-box").innerHTML = html;
  $("compare-share-btn").addEventListener("click", () => {
    const params = { recipeId: cmp.recipe_id, T_eval: cmp.shared_params.T_eval,
                     models: cmp.rows.map(r => r.label) };
    copyShareLink("compare", params);
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

// Wire single-recipe share button
$("share-btn").addEventListener("click", () => {
  if (!state.lastResult) return;
  copyShareLink(state.lastResult.type || "recipe", state.lastResult.params || {});
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
