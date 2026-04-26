// TAF Agent i18n — minimal translation system.
// Add languages by extending TRANSLATIONS. Set data-i18n="key" on any element.
// Persist user choice in localStorage.

export const LANGUAGES = [
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "es", flag: "🇪🇸", label: "Español" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
];

export const TRANSLATIONS = {
  en: {
    "hero.title":     "🔬 TAF Agent",
    "hero.tagline":   "Test <strong>ANY</strong> transformer LLM before you spend GPU/$.",
    "hero.subtitle":  "All computation runs locally in your browser. Free. Unlimited. Auditable.",
    "hero.help":      "📘 Help & examples",
    "hero.about":     "Built by an independent researcher. Open source. Not affiliated with any model vendor.",

    "modes.title":    "🎯 Mode",
    "modes.profile":  "📇 Profile a model",
    "modes.compare":  "🆚 Compare models",
    "modes.ask":      "💬 Ask plain English",
    "modes.recipe":   "📋 Pick recipe",
    "modes.desc":     "<strong>Quickest start</strong>: paste any HuggingFace model id (e.g. <code>meta-llama/Meta-Llama-3-8B</code>), click Profile. See all 5 recipes scored in seconds.",

    "profile.title":           "📇 Profile a model",
    "profile.desc":            "<strong>For technicians</strong>: when you need a complete viability snapshot of a candidate model. One-click runs all 5 recipes and produces a unified TAF Card.",
    "profile.preset_label":    "Preset:",
    "profile.preset_default":  "— or pick from list —",
    "profile.hf_label":        "HF model id:",
    "profile.fetch_btn":       "📥 Fetch",
    "profile.btn":             "🚀 Generate full profile",
    "profile.quickstart":      "💡 Quick start: pick any preset → click Generate. Or paste a model id from <a href='https://huggingface.co/models?library=transformers&sort=trending' target='_blank'>HF Hub trending</a> → 📥 Fetch → Generate.",

    "compare.title":           "🆚 Compare models side-by-side",
    "compare.desc":            "<strong>For technicians</strong>: when choosing between 2-3 candidate models for a specific deployment scenario. Same recipe, multiple models, side-by-side verdicts.",
    "compare.recipe_label":    "Recipe:",
    "compare.T_eval_label":    "T_eval (target context):",
    "compare.models_title":    "Models to compare (add up to 3)",
    "compare.btn":             "🚀 Compare",
    "compare.example":         "💡 Try: paste 3 popular 7-8B models (Meta-Llama-3-8B, Mistral-7B-v0.1, Qwen/Qwen2.5-7B), pick recipe X-2, T_eval=16000. See which best handles long context.",

    "ask.title":               "❓ Your question",
    "ask.placeholder":         "e.g. Will Mistral-7B handle 16K NIAH retrieval? Or: I have $5,000, what model can I train? Or: Cheapest GPU to serve Llama-70B at 100M tokens/day?",
    "ask.btn":                 "🚀 Analyze",
    "ask.example_btn":         "💡 Try an example",

    "recipe.title":            "📋 Recipe",
    "recipe.default":          "— select a recipe —",
    "recipe.input_title":      "🎯 Inputs",

    "verdict.title":           "📊 Verdict",
    "chain.title":             "🔍 Computation Chain",
    "chain.desc":              "Every number below is deterministic Python. Click a step to expand.",
    "answer.title":            "💬 Plain-English Answer",
    "share.btn":               "🔗 Copy share link",
    "share.copied":            "✅ Copied to clipboard!",

    "tafcard.title":           "📇 TAF Card — full model profile",
    "tafcard.recipes_title":   "📋 Recipes (verdict per dimension)",
    "tafcard.numbers_title":   "🔢 Key numbers (paper §26)",
    "tafcard.fals_title":      "🔬 Falsification status (FALSIFICATION.md F1-F23)",

    "compare.title_out":       "🆚 Comparison Table",

    "status.loading_pyodide":  "⏳ Loading Python runtime...",
    "status.loading_taf":      "⏳ Loading TAF formulas + recipes...",
    "status.ready":            "✅ Ready. Pick a model and click Profile to start.",
    "status.computing":        "🧮 Computing TAF chain...",
    "status.done":             "✅ Done.",

    "footer.text":             "© 2026 Carles Marin · Apache-2.0 · independent research · the tool that closes the loop of the paper.",
  },

  es: {
    "hero.title":     "🔬 TAF Agent",
    "hero.tagline":   "Prueba <strong>CUALQUIER</strong> LLM transformer antes de gastar GPU/€.",
    "hero.subtitle":  "Todo el cómputo corre localmente en tu navegador. Gratis. Sin límites. Auditable.",
    "hero.help":      "📘 Ayuda y ejemplos",
    "hero.about":     "Construido por un investigador independiente. Código abierto. Sin afiliación con ningún proveedor de modelos.",

    "modes.title":    "🎯 Modo",
    "modes.profile":  "📇 Perfilar un modelo",
    "modes.compare":  "🆚 Comparar modelos",
    "modes.ask":      "💬 Pregunta libre",
    "modes.recipe":   "📋 Elegir receta",
    "modes.desc":     "<strong>Inicio rápido</strong>: pega cualquier id de modelo HuggingFace (ej. <code>meta-llama/Meta-Llama-3-8B</code>), click Perfilar. Verás las 5 recetas evaluadas en segundos.",

    "profile.title":           "📇 Perfilar un modelo",
    "profile.desc":            "<strong>Para técnicos</strong>: cuando necesitas una foto completa de viabilidad de un modelo candidato. Un click ejecuta las 5 recetas y produce una TAF Card unificada.",
    "profile.preset_label":    "Preset:",
    "profile.preset_default":  "— o elige de la lista —",
    "profile.hf_label":        "ID modelo HF:",
    "profile.fetch_btn":       "📥 Cargar",
    "profile.btn":             "🚀 Generar perfil completo",
    "profile.quickstart":      "💡 Inicio rápido: elige cualquier preset → click Generar. O pega un id desde <a href='https://huggingface.co/models?library=transformers&sort=trending' target='_blank'>HF Hub trending</a> → 📥 Cargar → Generar.",

    "compare.title":           "🆚 Comparar modelos lado a lado",
    "compare.desc":            "<strong>Para técnicos</strong>: cuando eliges entre 2-3 modelos candidatos para un escenario de despliegue específico. Misma receta, múltiples modelos, veredictos lado a lado.",
    "compare.recipe_label":    "Receta:",
    "compare.T_eval_label":    "T_eval (contexto objetivo):",
    "compare.models_title":    "Modelos a comparar (hasta 3)",
    "compare.btn":             "🚀 Comparar",
    "compare.example":         "💡 Prueba: pega 3 modelos populares de 7-8B (Meta-Llama-3-8B, Mistral-7B-v0.1, Qwen/Qwen2.5-7B), receta X-2, T_eval=16000. Mira cuál maneja mejor contexto largo.",

    "ask.title":               "❓ Tu pregunta",
    "ask.placeholder":         "ej. ¿Mistral-7B aguanta 16K NIAH retrieval? O: Tengo 5,000$, ¿qué modelo puedo entrenar? O: ¿GPU más barato para servir Llama-70B a 100M tokens/día?",
    "ask.btn":                 "🚀 Analizar",
    "ask.example_btn":         "💡 Probar ejemplo",

    "recipe.title":            "📋 Receta",
    "recipe.default":          "— elige una receta —",
    "recipe.input_title":      "🎯 Entradas",

    "verdict.title":           "📊 Veredicto",
    "chain.title":             "🔍 Cadena de cálculo",
    "chain.desc":              "Cada número de abajo es Python determinista. Click en un paso para expandir.",
    "answer.title":            "💬 Respuesta en lenguaje natural",
    "share.btn":               "🔗 Copiar link",
    "share.copied":            "✅ ¡Copiado al portapapeles!",

    "tafcard.title":           "📇 TAF Card — perfil completo del modelo",
    "tafcard.recipes_title":   "📋 Recetas (veredicto por dimensión)",
    "tafcard.numbers_title":   "🔢 Números clave (paper §26)",
    "tafcard.fals_title":      "🔬 Estado de falsificación (FALSIFICATION.md F1-F23)",

    "compare.title_out":       "🆚 Tabla comparativa",

    "status.loading_pyodide":  "⏳ Cargando runtime Python...",
    "status.loading_taf":      "⏳ Cargando fórmulas TAF + recetas...",
    "status.ready":            "✅ Listo. Elige un modelo y click Perfilar para empezar.",
    "status.computing":        "🧮 Calculando cadena TAF...",
    "status.done":             "✅ Hecho.",

    "footer.text":             "© 2026 Carles Marin · Apache-2.0 · investigación independiente · la herramienta que cierra el círculo del paper.",
  },

  fr: {
    "hero.title":     "🔬 TAF Agent",
    "hero.tagline":   "Testez <strong>N'IMPORTE QUEL</strong> LLM transformer avant de dépenser du GPU/€.",
    "hero.subtitle":  "Tout le calcul s'exécute localement dans votre navigateur. Gratuit. Illimité. Auditable.",
    "hero.help":      "📘 Aide et exemples",
    "hero.about":     "Conçu par un chercheur indépendant. Open source. Non affilié à un fournisseur de modèles.",

    "modes.title":    "🎯 Mode",
    "modes.profile":  "📇 Profiler un modèle",
    "modes.compare":  "🆚 Comparer des modèles",
    "modes.ask":      "💬 Question libre",
    "modes.recipe":   "📋 Choisir une recette",
    "modes.desc":     "<strong>Démarrage rapide</strong>: collez n'importe quel id de modèle HuggingFace (ex. <code>meta-llama/Meta-Llama-3-8B</code>), cliquez Profiler. Voyez les 5 recettes évaluées en quelques secondes.",

    "profile.title":           "📇 Profiler un modèle",
    "profile.desc":            "<strong>Pour techniciens</strong>: quand vous avez besoin d'un instantané complet de viabilité d'un modèle candidat. Un clic exécute les 5 recettes et produit une TAF Card unifiée.",
    "profile.preset_label":    "Préréglage:",
    "profile.preset_default":  "— ou choisir dans la liste —",
    "profile.hf_label":        "ID modèle HF:",
    "profile.fetch_btn":       "📥 Charger",
    "profile.btn":             "🚀 Générer profil complet",
    "profile.quickstart":      "💡 Démarrage rapide: choisissez un préréglage → cliquez Générer. Ou collez un id depuis <a href='https://huggingface.co/models?library=transformers&sort=trending' target='_blank'>HF Hub tendances</a> → 📥 Charger → Générer.",

    "compare.title":           "🆚 Comparer côte à côte",
    "compare.desc":            "<strong>Pour techniciens</strong>: quand vous choisissez entre 2-3 modèles candidats pour un scénario de déploiement spécifique. Même recette, plusieurs modèles, verdicts côte à côte.",
    "compare.recipe_label":    "Recette:",
    "compare.T_eval_label":    "T_eval (contexte cible):",
    "compare.models_title":    "Modèles à comparer (jusqu'à 3)",
    "compare.btn":             "🚀 Comparer",
    "compare.example":         "💡 Essayez: collez 3 modèles populaires de 7-8B (Meta-Llama-3-8B, Mistral-7B-v0.1, Qwen/Qwen2.5-7B), recette X-2, T_eval=16000. Voyez lequel gère le mieux le contexte long.",

    "ask.title":               "❓ Votre question",
    "ask.placeholder":         "ex. Mistral-7B gérera-t-il 16K NIAH? Ou: J'ai 5,000$, quel modèle puis-je entraîner? Ou: GPU le moins cher pour servir Llama-70B à 100M tokens/jour?",
    "ask.btn":                 "🚀 Analyser",
    "ask.example_btn":         "💡 Essayer un exemple",

    "recipe.title":            "📋 Recette",
    "recipe.default":          "— choisir une recette —",
    "recipe.input_title":      "🎯 Entrées",

    "verdict.title":           "📊 Verdict",
    "chain.title":             "🔍 Chaîne de calcul",
    "chain.desc":              "Chaque nombre ci-dessous est du Python déterministe. Cliquez sur une étape pour développer.",
    "answer.title":            "💬 Réponse en langage naturel",
    "share.btn":               "🔗 Copier le lien",
    "share.copied":            "✅ Copié dans le presse-papiers!",

    "tafcard.title":           "📇 TAF Card — profil complet du modèle",
    "tafcard.recipes_title":   "📋 Recettes (verdict par dimension)",
    "tafcard.numbers_title":   "🔢 Nombres clés (paper §26)",
    "tafcard.fals_title":      "🔬 État de falsification (FALSIFICATION.md F1-F23)",

    "compare.title_out":       "🆚 Tableau comparatif",

    "status.loading_pyodide":  "⏳ Chargement du runtime Python...",
    "status.loading_taf":      "⏳ Chargement des formules TAF + recettes...",
    "status.ready":            "✅ Prêt. Choisissez un modèle et cliquez Profiler pour commencer.",
    "status.computing":        "🧮 Calcul de la chaîne TAF...",
    "status.done":             "✅ Terminé.",

    "footer.text":             "© 2026 Carles Marin · Apache-2.0 · recherche indépendante · l'outil qui ferme la boucle du paper.",
  },

  zh: {
    "hero.title":     "🔬 TAF Agent",
    "hero.tagline":   "在花费 GPU/$ 之前，测试<strong>任意</strong> Transformer LLM。",
    "hero.subtitle":  "所有计算在您的浏览器本地运行。免费。无限制。可审计。",
    "hero.help":      "📘 帮助和示例",
    "hero.about":     "由独立研究员构建。开源。不隶属于任何模型供应商。",

    "modes.title":    "🎯 模式",
    "modes.profile":  "📇 模型画像",
    "modes.compare":  "🆚 比较模型",
    "modes.ask":      "💬 自由提问",
    "modes.recipe":   "📋 选择配方",
    "modes.desc":     "<strong>最快开始</strong>: 粘贴任意 HuggingFace 模型 id (例如 <code>meta-llama/Meta-Llama-3-8B</code>),点击 画像。秒内看到所有 5 个配方的评分。",

    "profile.title":           "📇 模型画像",
    "profile.desc":            "<strong>面向技术人员</strong>: 当您需要候选模型的完整可行性快照时。一键运行所有 5 个配方,生成统一的 TAF 卡。",
    "profile.preset_label":    "预设:",
    "profile.preset_default":  "— 或从列表中选择 —",
    "profile.hf_label":        "HF 模型 id:",
    "profile.fetch_btn":       "📥 获取",
    "profile.btn":             "🚀 生成完整画像",
    "profile.quickstart":      "💡 快速开始: 选择任意预设 → 点击生成。或从 <a href='https://huggingface.co/models?library=transformers&sort=trending' target='_blank'>HF Hub 热门</a> 粘贴一个 id → 📥 获取 → 生成。",

    "compare.title":           "🆚 模型并排比较",
    "compare.desc":            "<strong>面向技术人员</strong>: 当为特定部署场景在 2-3 个候选模型之间选择时。同一配方,多个模型,并排判定。",
    "compare.recipe_label":    "配方:",
    "compare.T_eval_label":    "T_eval (目标上下文):",
    "compare.models_title":    "要比较的模型(最多 3 个)",
    "compare.btn":             "🚀 比较",
    "compare.example":         "💡 尝试: 粘贴 3 个流行的 7-8B 模型 (Meta-Llama-3-8B, Mistral-7B-v0.1, Qwen/Qwen2.5-7B),配方 X-2, T_eval=16000。查看哪个最适合长上下文。",

    "ask.title":               "❓ 您的问题",
    "ask.placeholder":         "例如: Mistral-7B 能处理 16K NIAH 检索吗?或: 我有 5,000 美元,可以训练什么模型?或: 以每天 1 亿 tokens 提供 Llama-70B 的最便宜 GPU?",
    "ask.btn":                 "🚀 分析",
    "ask.example_btn":         "💡 尝试示例",

    "recipe.title":            "📋 配方",
    "recipe.default":          "— 选择一个配方 —",
    "recipe.input_title":      "🎯 输入",

    "verdict.title":           "📊 判定",
    "chain.title":             "🔍 计算链",
    "chain.desc":              "下面每个数字都是确定性 Python。点击步骤展开。",
    "answer.title":            "💬 自然语言回答",
    "share.btn":               "🔗 复制分享链接",
    "share.copied":            "✅ 已复制到剪贴板!",

    "tafcard.title":           "📇 TAF 卡 — 完整模型画像",
    "tafcard.recipes_title":   "📋 配方(每个维度的判定)",
    "tafcard.numbers_title":   "🔢 关键数字 (paper §26)",
    "tafcard.fals_title":      "🔬 可证伪状态 (FALSIFICATION.md F1-F23)",

    "compare.title_out":       "🆚 比较表",

    "status.loading_pyodide":  "⏳ 加载 Python 运行时...",
    "status.loading_taf":      "⏳ 加载 TAF 公式 + 配方...",
    "status.ready":            "✅ 就绪。选择一个模型并点击画像开始。",
    "status.computing":        "🧮 计算 TAF 链...",
    "status.done":             "✅ 完成。",

    "footer.text":             "© 2026 Carles Marin · Apache-2.0 · 独立研究 · 闭合论文回路的工具。",
  },
};

let currentLang = "en";

export function getLang() {
  return currentLang;
}

export function setLang(code) {
  if (!TRANSLATIONS[code]) return;
  currentLang = code;
  try { localStorage.setItem("tafagent_lang", code); } catch (e) {}
  applyTranslations();
  // Highlight active flag
  document.querySelectorAll("[data-lang]").forEach(el => {
    el.classList.toggle("lang-active", el.dataset.lang === code);
  });
}

export function t(key) {
  return TRANSLATIONS[currentLang][key] ?? TRANSLATIONS.en[key] ?? key;
}

export function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    const value = t(key);
    // Allow HTML in translations (we control them)
    el.innerHTML = value;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

export function initI18n() {
  // Browser default lang detection or stored preference
  let stored = null;
  try { stored = localStorage.getItem("tafagent_lang"); } catch (e) {}
  if (stored && TRANSLATIONS[stored]) {
    currentLang = stored;
  } else {
    const browserLang = (navigator.language || "en").slice(0, 2);
    if (TRANSLATIONS[browserLang]) currentLang = browserLang;
  }
  applyTranslations();
  // Mark active flag
  document.querySelectorAll("[data-lang]").forEach(el => {
    el.classList.toggle("lang-active", el.dataset.lang === currentLang);
  });
}
