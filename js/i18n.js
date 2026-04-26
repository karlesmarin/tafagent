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

    "status.loading_pyodide":  "⏳ Loading Python runtime (~10MB, first time only)...",
    "status.loading_taf":      "⏳ Loading TAF formulas + recipes...",
    "status.ready":            "✅ Ready. Pick a model and click Profile to start.",
    "status.computing":        "🧮 Computing TAF chain...",
    "status.done":             "✅ Done.",

    "profile.hf_placeholder":  "e.g. meta-llama/Meta-Llama-3-8B or Qwen/Qwen2.5-7B",
    "compare.hf_placeholder":  "HF model id (e.g. meta-llama/Meta-Llama-3-8B)",

    // Form parameters
    "param.theta":         "θ (rope_theta)",
    "param.theta.tip":     "<strong>RoPE base frequency</strong> from <code>config.rope_theta</code>. Higher = more long-range capacity.",
    "param.T_train":       "T_train",
    "param.T_train.tip":   "<strong>Max training context</strong>. From <code>max_position_embeddings</code>. Beyond this is extrapolation.",
    "param.T_eval":        "T_eval (your target)",
    "param.T_eval.tip":    "<strong>Your target inference context</strong>. The whole question is: will the model behave well at THIS length?",
    "param.n_attn":        "num_attention_heads",
    "param.n_kv":          "num_key_value_heads",
    "param.d_head":        "head_dim",
    "param.n_layers":      "num_hidden_layers",
    "param.n_params":      "n_params (e.g. 8e9)",
    "param.has_swa":       "Has SWA?",
    "common.yes":          "Yes",
    "common.no":           "No",

    // Mode tooltips
    "modes.tip":           "<strong>Four ways to use the tool</strong>.<br><strong>📇 Profile</strong>: paste a model id → all 5 recipes at once = TAF Card.<br><strong>🆚 Compare</strong>: 2-3 models side-by-side on one recipe.<br><strong>💬 Ask</strong>: free-form question, browser LLM picks the recipe.<br><strong>📋 Recipe</strong>: manual selection with full form control.",
    "profile.tip":         "<strong>One-click full diagnosis</strong>. Paste any HF model id (or pick preset). Tool runs all 5 recipes (long-context, KV-compression, custom-vs-API, budget, hardware) and produces a single <strong>TAF Card</strong> with verdict per dimension + key numbers + architecture classification.<br><br><strong>Use case</strong>: \"I'm evaluating Qwen2.5-32B for production — what's its full viability profile?\" → paste id → Profile → done.",
    "compare.tip":         "<strong>Same recipe, multiple models</strong>. Pick 2-3 candidate models and one recipe. See verdicts in a single comparison table.<br><br><strong>Use case</strong>: \"I need long-context retrieval at 16K — which is best: Llama-3-8B, Mistral-7B, or Qwen-7B?\" → pick 3 + X-2 + 16K → see winner.",

    // Help modal
    "help.title":               "📘 TAF Agent — User Manual",
    "help.what.title":          "What does it do?",
    "help.what.body":           "Predicts <strong>practical viability</strong> of any transformer LLM <em>before you spend GPU/$</em>. Answers questions like \"will this model work at L=32K?\" or \"should I train custom or use API?\" using deterministic Python formulas (TAF — Thermodynamic Attention Framework).",
    "help.modes.title":         "How to use — 4 modes",
    "help.modes.profile":       "<strong>📇 Profile</strong>: paste model id → all recipes at once = TAF Card. <strong>Best starting point</strong>.",
    "help.modes.compare":       "<strong>🆚 Compare</strong>: 2-3 models side-by-side on same recipe. Best when choosing between candidates.",
    "help.modes.ask":           "<strong>💬 Ask plain English</strong>: free-form question, in-browser LLM picks the recipe. Best for casual exploration.",
    "help.modes.recipe":        "<strong>📋 Recipe + form</strong>: manual selection, full parameter control. Best when you want exact control.",
    "help.recipes.title":       "The 5 recipes available",
    "help.add_models.title":    "Adding new models (3 ways)",
    "help.add_models.preset":   "<strong>Preset list</strong>: 11 popular models curated. Just select from dropdown.",
    "help.add_models.hf":       "<strong>HF Hub fetch</strong>: paste any model id (e.g. <code>Qwen/Qwen2.5-32B-Instruct</code>), click 📥 Fetch. Browser downloads <code>config.json</code> directly from HuggingFace, fills the form. Works for any public model.",
    "help.add_models.manual":   "<strong>Manual</strong>: fill the form fields directly with values from the model card.",
    "help.audit.title":         "The audit chain",
    "help.audit.body":          "Every result shows the full <strong>Computation Chain</strong> — each formula step with its inputs, output, and interpretation. Click any step to expand. Cite section numbers (§26.1, §19.1, etc.) refer to the underlying paper for derivation.",
    "help.synthesis.title":     "The plain-English answer",
    "help.synthesis.body":      "After the deterministic chain runs, an in-browser LLM (Qwen2.5-0.5B, ~350MB cached after first load) synthesizes a plain-English summary. The numbers above are <em>always correct</em> (deterministic Python); the synthesis is LLM-generated — verify against the chain if in doubt.",
    "help.params.title":        "Common parameters explained",
    "help.verdicts.title":      "What to look for in verdicts",
    "help.verdict.yes":         "<strong style=\"color:#3fb950;\">YES / GO</strong> — proceed with confidence; numbers support the choice.",
    "help.verdict.deg":         "<strong style=\"color:#d29922;\">DEGRADED / TINY-MODEL</strong> — works but with caveats; read the action.",
    "help.verdict.no":          "<strong style=\"color:#f85149;\">NO / MEMORY-LIMITED</strong> — don't proceed as-is; mitigation provided.",
    "help.privacy.title":       "Privacy",
    "help.privacy.body":        "Everything runs in your browser. No telemetry, no analytics, no data sent anywhere. Even the LLM model runs locally via WebGPU/WebAssembly. Your model_ids and questions never leave this page.",
    "help.source.title":        "Source & paper",
    "help.source.body":         "Source code: <a href=\"https://github.com/karlesmarin/tafagent\" target=\"_blank\">github.com/karlesmarin/tafagent</a><br>Paper: <em>Marin 2026 — Transformer Thermodynamics</em> (arXiv forthcoming)",

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

    "status.loading_pyodide":  "⏳ Cargando runtime Python (~10MB, solo primera vez)...",
    "status.loading_taf":      "⏳ Cargando fórmulas TAF + recetas...",
    "status.ready":            "✅ Listo. Elige un modelo y click Perfilar para empezar.",
    "status.computing":        "🧮 Calculando cadena TAF...",
    "status.done":             "✅ Hecho.",

    "profile.hf_placeholder":  "ej. meta-llama/Meta-Llama-3-8B o Qwen/Qwen2.5-7B",
    "compare.hf_placeholder":  "ID modelo HF (ej. meta-llama/Meta-Llama-3-8B)",

    // Parámetros del formulario
    "param.theta":         "θ (rope_theta)",
    "param.theta.tip":     "<strong>Frecuencia base RoPE</strong> de <code>config.rope_theta</code>. Mayor = más capacidad de largo alcance.",
    "param.T_train":       "T_train",
    "param.T_train.tip":   "<strong>Contexto máximo de entrenamiento</strong>. De <code>max_position_embeddings</code>. Más allá es extrapolación.",
    "param.T_eval":        "T_eval (tu objetivo)",
    "param.T_eval.tip":    "<strong>Tu contexto de inferencia objetivo</strong>. La pregunta clave: ¿se comportará bien el modelo a ESTA longitud?",
    "param.n_attn":        "num_attention_heads",
    "param.n_kv":          "num_key_value_heads",
    "param.d_head":        "head_dim",
    "param.n_layers":      "num_hidden_layers",
    "param.n_params":      "n_params (ej. 8e9)",
    "param.has_swa":       "¿Tiene SWA?",
    "common.yes":          "Sí",
    "common.no":           "No",

    // Tooltips de modos
    "modes.tip":           "<strong>Cuatro formas de usar la herramienta</strong>.<br><strong>📇 Perfil</strong>: pega un id → las 5 recetas a la vez = TAF Card.<br><strong>🆚 Comparar</strong>: 2-3 modelos lado a lado en una receta.<br><strong>💬 Pregunta</strong>: pregunta libre, el LLM del navegador elige la receta.<br><strong>📋 Receta</strong>: selección manual con control total del formulario.",
    "profile.tip":         "<strong>Diagnóstico completo en un click</strong>. Pega cualquier id de modelo HF (o elige preset). La herramienta ejecuta las 5 recetas (contexto largo, compresión KV, custom vs API, presupuesto, hardware) y produce una única <strong>TAF Card</strong> con veredicto por dimensión + números clave + clasificación arquitectónica.<br><br><strong>Caso de uso</strong>: \"Estoy evaluando Qwen2.5-32B para producción — ¿cuál es su perfil completo de viabilidad?\" → pega id → Perfilar → listo.",
    "compare.tip":         "<strong>Misma receta, múltiples modelos</strong>. Elige 2-3 modelos candidatos y una receta. Ve los veredictos en una única tabla comparativa.<br><br><strong>Caso de uso</strong>: \"Necesito recuperación de contexto largo a 16K — ¿cuál es mejor: Llama-3-8B, Mistral-7B o Qwen-7B?\" → elige 3 + X-2 + 16K → ve el ganador.",

    // Modal de ayuda
    "help.title":               "📘 TAF Agent — Manual de Usuario",
    "help.what.title":          "¿Qué hace?",
    "help.what.body":           "Predice la <strong>viabilidad práctica</strong> de cualquier LLM transformer <em>antes de gastar GPU/€</em>. Responde preguntas como \"¿funcionará este modelo a L=32K?\" o \"¿debería entrenar custom o usar API?\" usando fórmulas Python deterministas (TAF — Thermodynamic Attention Framework).",
    "help.modes.title":         "Cómo usar — 4 modos",
    "help.modes.profile":       "<strong>📇 Perfilar</strong>: pega id de modelo → todas las recetas a la vez = TAF Card. <strong>Mejor punto de inicio</strong>.",
    "help.modes.compare":       "<strong>🆚 Comparar</strong>: 2-3 modelos lado a lado en la misma receta. Mejor al elegir entre candidatos.",
    "help.modes.ask":           "<strong>💬 Pregunta libre</strong>: pregunta en lenguaje natural, el LLM del navegador elige la receta. Mejor para exploración casual.",
    "help.modes.recipe":        "<strong>📋 Receta + formulario</strong>: selección manual, control total de parámetros. Mejor cuando quieres control exacto.",
    "help.recipes.title":       "Las 5 recetas disponibles",
    "help.add_models.title":    "Añadir nuevos modelos (3 maneras)",
    "help.add_models.preset":   "<strong>Lista de presets</strong>: 11 modelos populares curados. Selecciona del dropdown.",
    "help.add_models.hf":       "<strong>HF Hub fetch</strong>: pega cualquier id (ej. <code>Qwen/Qwen2.5-32B-Instruct</code>), click 📥 Cargar. El navegador descarga <code>config.json</code> directamente de HuggingFace, llena el formulario. Funciona con cualquier modelo público.",
    "help.add_models.manual":   "<strong>Manual</strong>: rellena los campos directamente con valores de la model card.",
    "help.audit.title":         "La cadena auditable",
    "help.audit.body":          "Cada resultado muestra la <strong>Cadena de Cálculo</strong> completa — cada paso de fórmula con sus entradas, salida e interpretación. Click en cualquier paso para expandir. Las referencias de sección (§26.1, §19.1, etc.) apuntan al paper para la derivación.",
    "help.synthesis.title":     "La respuesta en lenguaje natural",
    "help.synthesis.body":      "Tras ejecutar la cadena determinista, un LLM en el navegador (Qwen2.5-0.5B, ~350MB cacheado tras primera carga) sintetiza un resumen en lenguaje natural. Los números arriba son <em>siempre correctos</em> (Python determinista); la síntesis la genera el LLM — verifica contra la cadena si dudas.",
    "help.params.title":        "Parámetros comunes explicados",
    "help.verdicts.title":      "Qué mirar en los veredictos",
    "help.verdict.yes":         "<strong style=\"color:#3fb950;\">SÍ / GO</strong> — procede con confianza; los números apoyan la elección.",
    "help.verdict.deg":         "<strong style=\"color:#d29922;\">DEGRADADO / TINY-MODEL</strong> — funciona con caveats; lee la acción.",
    "help.verdict.no":          "<strong style=\"color:#f85149;\">NO / MEMORY-LIMITED</strong> — no procedas tal cual; se da mitigación.",
    "help.privacy.title":       "Privacidad",
    "help.privacy.body":        "Todo corre en tu navegador. Sin telemetría, sin analytics, sin datos enviados a ningún sitio. Incluso el modelo LLM corre localmente vía WebGPU/WebAssembly. Tus model_ids y preguntas nunca abandonan esta página.",
    "help.source.title":        "Código fuente y paper",
    "help.source.body":         "Código: <a href=\"https://github.com/karlesmarin/tafagent\" target=\"_blank\">github.com/karlesmarin/tafagent</a><br>Paper: <em>Marin 2026 — Transformer Thermodynamics</em> (arXiv próximamente)",

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

    "status.loading_pyodide":  "⏳ Chargement du runtime Python (~10MB, première fois)...",
    "status.loading_taf":      "⏳ Chargement des formules TAF + recettes...",
    "status.ready":            "✅ Prêt. Choisissez un modèle et cliquez Profiler pour commencer.",
    "status.computing":        "🧮 Calcul de la chaîne TAF...",
    "status.done":             "✅ Terminé.",

    "profile.hf_placeholder":  "ex. meta-llama/Meta-Llama-3-8B ou Qwen/Qwen2.5-7B",
    "compare.hf_placeholder":  "ID modèle HF (ex. meta-llama/Meta-Llama-3-8B)",

    // Paramètres du formulaire
    "param.theta":         "θ (rope_theta)",
    "param.theta.tip":     "<strong>Fréquence de base RoPE</strong> de <code>config.rope_theta</code>. Plus haut = plus de capacité longue portée.",
    "param.T_train":       "T_train",
    "param.T_train.tip":   "<strong>Contexte max d'entraînement</strong>. De <code>max_position_embeddings</code>. Au-delà c'est de l'extrapolation.",
    "param.T_eval":        "T_eval (votre cible)",
    "param.T_eval.tip":    "<strong>Votre contexte d'inférence cible</strong>. La question clé : le modèle se comportera-t-il bien à CETTE longueur ?",
    "param.n_attn":        "num_attention_heads",
    "param.n_kv":          "num_key_value_heads",
    "param.d_head":        "head_dim",
    "param.n_layers":      "num_hidden_layers",
    "param.n_params":      "n_params (ex. 8e9)",
    "param.has_swa":       "A SWA ?",
    "common.yes":          "Oui",
    "common.no":           "Non",

    // Tooltips des modes
    "modes.tip":           "<strong>Quatre façons d'utiliser l'outil</strong>.<br><strong>📇 Profil</strong>: collez un id → les 5 recettes à la fois = TAF Card.<br><strong>🆚 Comparer</strong>: 2-3 modèles côte à côte sur une recette.<br><strong>💬 Question</strong>: question libre, le LLM du navigateur choisit la recette.<br><strong>📋 Recette</strong>: sélection manuelle avec contrôle total du formulaire.",
    "profile.tip":         "<strong>Diagnostic complet en un clic</strong>. Collez n'importe quel id de modèle HF (ou choisissez préréglage). L'outil exécute les 5 recettes (contexte long, compression KV, custom vs API, budget, hardware) et produit une <strong>TAF Card</strong> unique avec verdict par dimension + nombres clés + classification architecturale.<br><br><strong>Cas d'usage</strong>: « J'évalue Qwen2.5-32B pour la production — quel est son profil complet de viabilité ? » → collez id → Profiler → fait.",
    "compare.tip":         "<strong>Même recette, plusieurs modèles</strong>. Choisissez 2-3 modèles candidats et une recette. Voyez les verdicts dans un seul tableau comparatif.<br><br><strong>Cas d'usage</strong>: « J'ai besoin de récupération longue contexte à 16K — quel est le meilleur : Llama-3-8B, Mistral-7B ou Qwen-7B ? » → choisissez 3 + X-2 + 16K → voyez le gagnant.",

    // Modal d'aide
    "help.title":               "📘 TAF Agent — Manuel d'utilisation",
    "help.what.title":          "Que fait-il ?",
    "help.what.body":           "Prédit la <strong>viabilité pratique</strong> de tout LLM transformer <em>avant de dépenser du GPU/€</em>. Répond à des questions comme « ce modèle fonctionnera-t-il à L=32K ? » ou « dois-je entraîner sur mesure ou utiliser une API ? » via des formules Python déterministes (TAF — Thermodynamic Attention Framework).",
    "help.modes.title":         "Comment l'utiliser — 4 modes",
    "help.modes.profile":       "<strong>📇 Profiler</strong>: collez id de modèle → toutes les recettes à la fois = TAF Card. <strong>Meilleur point de départ</strong>.",
    "help.modes.compare":       "<strong>🆚 Comparer</strong>: 2-3 modèles côte à côte sur la même recette. Mieux pour choisir entre candidats.",
    "help.modes.ask":           "<strong>💬 Question libre</strong>: question en langage naturel, le LLM du navigateur choisit la recette. Mieux pour exploration casuelle.",
    "help.modes.recipe":        "<strong>📋 Recette + formulaire</strong>: sélection manuelle, contrôle total des paramètres. Mieux quand vous voulez un contrôle exact.",
    "help.recipes.title":       "Les 5 recettes disponibles",
    "help.add_models.title":    "Ajouter de nouveaux modèles (3 façons)",
    "help.add_models.preset":   "<strong>Liste de préréglages</strong>: 11 modèles populaires curés. Sélectionnez dans le dropdown.",
    "help.add_models.hf":       "<strong>HF Hub fetch</strong>: collez n'importe quel id (ex. <code>Qwen/Qwen2.5-32B-Instruct</code>), cliquez 📥 Charger. Le navigateur télécharge <code>config.json</code> directement de HuggingFace, remplit le formulaire. Fonctionne avec tout modèle public.",
    "help.add_models.manual":   "<strong>Manuel</strong>: remplissez les champs directement avec les valeurs de la model card.",
    "help.audit.title":         "La chaîne auditable",
    "help.audit.body":          "Chaque résultat montre la <strong>Chaîne de Calcul</strong> complète — chaque étape de formule avec ses entrées, sortie et interprétation. Cliquez sur n'importe quelle étape pour développer. Les références de section (§26.1, §19.1, etc.) renvoient au paper pour la dérivation.",
    "help.synthesis.title":     "La réponse en langage naturel",
    "help.synthesis.body":      "Après exécution de la chaîne déterministe, un LLM dans le navigateur (Qwen2.5-0.5B, ~350MB cachés après premier chargement) synthétise un résumé en langage naturel. Les nombres ci-dessus sont <em>toujours corrects</em> (Python déterministe) ; la synthèse est générée par LLM — vérifiez contre la chaîne en cas de doute.",
    "help.params.title":        "Paramètres communs expliqués",
    "help.verdicts.title":      "Quoi regarder dans les verdicts",
    "help.verdict.yes":         "<strong style=\"color:#3fb950;\">OUI / GO</strong> — procédez avec confiance ; les nombres soutiennent le choix.",
    "help.verdict.deg":         "<strong style=\"color:#d29922;\">DÉGRADÉ / TINY-MODEL</strong> — fonctionne avec caveats ; lisez l'action.",
    "help.verdict.no":          "<strong style=\"color:#f85149;\">NON / MEMORY-LIMITED</strong> — ne procédez pas tel quel ; mitigation fournie.",
    "help.privacy.title":       "Confidentialité",
    "help.privacy.body":        "Tout s'exécute dans votre navigateur. Pas de télémétrie, pas d'analytique, pas de données envoyées ailleurs. Même le modèle LLM s'exécute localement via WebGPU/WebAssembly. Vos model_ids et questions ne quittent jamais cette page.",
    "help.source.title":        "Code source et paper",
    "help.source.body":         "Code : <a href=\"https://github.com/karlesmarin/tafagent\" target=\"_blank\">github.com/karlesmarin/tafagent</a><br>Paper : <em>Marin 2026 — Transformer Thermodynamics</em> (arXiv à venir)",

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

    "status.loading_pyodide":  "⏳ 加载 Python 运行时 (~10MB,首次加载)...",
    "status.loading_taf":      "⏳ 加载 TAF 公式 + 配方...",
    "status.ready":            "✅ 就绪。选择一个模型并点击画像开始。",
    "status.computing":        "🧮 计算 TAF 链...",
    "status.done":             "✅ 完成。",

    "profile.hf_placeholder":  "例如: meta-llama/Meta-Llama-3-8B 或 Qwen/Qwen2.5-7B",
    "compare.hf_placeholder":  "HF 模型 id (例如: meta-llama/Meta-Llama-3-8B)",

    // 表单参数
    "param.theta":         "θ (rope_theta)",
    "param.theta.tip":     "<strong>RoPE 基础频率</strong> 来自 <code>config.rope_theta</code>。越高 = 长程能力越强。",
    "param.T_train":       "T_train",
    "param.T_train.tip":   "<strong>训练最大上下文</strong>。来自 <code>max_position_embeddings</code>。超出此范围属于外推。",
    "param.T_eval":        "T_eval (您的目标)",
    "param.T_eval.tip":    "<strong>您的目标推理上下文</strong>。关键问题: 模型在 <em>这个</em> 长度下表现是否良好?",
    "param.n_attn":        "num_attention_heads",
    "param.n_kv":          "num_key_value_heads",
    "param.d_head":        "head_dim",
    "param.n_layers":      "num_hidden_layers",
    "param.n_params":      "n_params (例如 8e9)",
    "param.has_swa":       "有 SWA 吗?",
    "common.yes":          "是",
    "common.no":           "否",

    // 模式提示
    "modes.tip":           "<strong>四种使用方式</strong>。<br><strong>📇 画像</strong>: 粘贴模型 id → 一次运行所有 5 个配方 = TAF 卡。<br><strong>🆚 比较</strong>: 2-3 个模型在一个配方上并排比较。<br><strong>💬 提问</strong>: 自由形式问题,浏览器 LLM 选择配方。<br><strong>📋 配方</strong>: 手动选择,完全控制表单。",
    "profile.tip":         "<strong>一键完整诊断</strong>。粘贴任意 HF 模型 id (或选择预设)。工具运行所有 5 个配方 (长上下文、KV 压缩、自定义 vs API、预算、硬件),生成单个 <strong>TAF 卡</strong>,显示每个维度的判定 + 关键数字 + 架构分类。<br><br><strong>用例</strong>: \"我正在为生产评估 Qwen2.5-32B — 它的完整可行性概况是什么?\" → 粘贴 id → 画像 → 完成。",
    "compare.tip":         "<strong>同一配方,多个模型</strong>。选择 2-3 个候选模型和一个配方。在单个比较表中查看判定。<br><br><strong>用例</strong>: \"我需要在 16K 进行长上下文检索 — 哪个最好: Llama-3-8B、Mistral-7B 或 Qwen-7B?\" → 选择 3 个 + X-2 + 16K → 看赢家。",

    // 帮助模态框
    "help.title":               "📘 TAF Agent — 用户手册",
    "help.what.title":          "它做什么?",
    "help.what.body":           "在<em>花费 GPU/$ 之前</em>,预测任意 transformer LLM 的<strong>实际可行性</strong>。回答诸如 \"这个模型能在 L=32K 工作吗?\" 或 \"我应该自定义训练还是使用 API?\" 等问题,使用确定性 Python 公式 (TAF — Thermodynamic Attention Framework)。",
    "help.modes.title":         "如何使用 — 4 种模式",
    "help.modes.profile":       "<strong>📇 画像</strong>: 粘贴模型 id → 同时运行所有配方 = TAF 卡。<strong>最佳起点</strong>。",
    "help.modes.compare":       "<strong>🆚 比较</strong>: 2-3 个模型在同一配方上并排。最适合在候选者之间选择。",
    "help.modes.ask":           "<strong>💬 自由提问</strong>: 自然语言问题,浏览器 LLM 选择配方。最适合随意探索。",
    "help.modes.recipe":        "<strong>📋 配方 + 表单</strong>: 手动选择,完全控制参数。最适合需要精确控制时。",
    "help.recipes.title":       "可用的 5 个配方",
    "help.add_models.title":    "添加新模型 (3 种方式)",
    "help.add_models.preset":   "<strong>预设列表</strong>: 11 个流行模型已策划。从下拉菜单选择。",
    "help.add_models.hf":       "<strong>HF Hub 获取</strong>: 粘贴任意 id (例如 <code>Qwen/Qwen2.5-32B-Instruct</code>),点击 📥 获取。浏览器直接从 HuggingFace 下载 <code>config.json</code>,填充表单。适用于任何公共模型。",
    "help.add_models.manual":   "<strong>手动</strong>: 用模型卡的值直接填充表单字段。",
    "help.audit.title":         "可审计链",
    "help.audit.body":          "每个结果都显示完整的<strong>计算链</strong> — 每个公式步骤及其输入、输出和解释。点击任意步骤展开。引用的章节号 (§26.1、§19.1 等) 指向论文中的推导。",
    "help.synthesis.title":     "自然语言回答",
    "help.synthesis.body":      "在确定性链运行后,浏览器中的 LLM (Qwen2.5-0.5B,首次加载后约 350MB 缓存) 综合自然语言摘要。上面的数字<em>始终正确</em> (确定性 Python);综合由 LLM 生成 — 如有疑问,请对照链验证。",
    "help.params.title":        "常见参数解释",
    "help.verdicts.title":      "判定中要看什么",
    "help.verdict.yes":         "<strong style=\"color:#3fb950;\">是 / GO</strong> — 自信地继续;数字支持选择。",
    "help.verdict.deg":         "<strong style=\"color:#d29922;\">降级 / TINY-MODEL</strong> — 有警告地工作;阅读操作。",
    "help.verdict.no":          "<strong style=\"color:#f85149;\">否 / MEMORY-LIMITED</strong> — 不要按原样进行;提供缓解措施。",
    "help.privacy.title":       "隐私",
    "help.privacy.body":        "一切都在您的浏览器中运行。无遥测,无分析,无数据发送到任何地方。即使是 LLM 模型也通过 WebGPU/WebAssembly 在本地运行。您的 model_ids 和问题永不离开此页面。",
    "help.source.title":        "源代码和论文",
    "help.source.body":         "源代码: <a href=\"https://github.com/karlesmarin/tafagent\" target=\"_blank\">github.com/karlesmarin/tafagent</a><br>论文: <em>Marin 2026 — Transformer Thermodynamics</em> (arXiv 即将)",

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
