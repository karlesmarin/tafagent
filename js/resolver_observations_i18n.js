export const observationRows={
 "observation_title": [
  "What happened when you checked?",
  "¿Qué ocurrió al comprobarlo?",
  "Qu’avez-vous observé ?",
  "检查后发现了什么？"
 ],
 "observation_note": [
  "Report a step and an observation from your environment. TAF adapts the next instruction without verifying your report or changing the original analysis. The last 12 observations stay in this tab until inputs change, rerun or reload.",
  "Indica el paso y lo que observaste en tu entorno. TAF adapta la siguiente instrucción sin verificar tu declaración ni cambiar el análisis original. Las últimas 12 observaciones permanecen en esta pestaña hasta cambiar datos, recalcular o recargar.",
  "Indiquez l’étape et votre observation. TAF adapte la suite sans vérifier votre déclaration ni modifier l’analyse. Les 12 dernières observations restent dans cet onglet jusqu’à modification, recalcul ou rechargement.",
  "报告步骤及实际环境中的观察。TAF 调整后续指引，但不验证声明或改变原始分析。最近 12 条观察保留在当前标签页，直到修改输入、重新计算或刷新。"
 ],
 "observation_step": [
  "Check you tried",
  "Comprobación que intentaste",
  "Vérification tentée",
  "尝试的检查"
 ],
 "observation_question": [
  "What did you observe?",
  "¿Qué observaste?",
  "Qu’avez-vous constaté ?",
  "观察到了什么？"
 ],
 "observation_choose": [
  "Choose an observation…",
  "Elige una observación…",
  "Choisissez une observation…",
  "选择观察结果…"
 ],
 "observation_save": [
  "Use this observation",
  "Usar esta observación",
  "Utiliser cette observation",
  "使用此观察"
 ],
 "observation_invalid": [
  "Choose a step and an observation first.",
  "Elige primero un paso y una observación.",
  "Choisissez d’abord une étape et une observation.",
  "请先选择步骤及观察结果。"
 ],
 "observation_unavailable": [
  "I could not obtain the evidence",
  "No pude obtener la evidencia",
  "Je n’ai pas pu obtenir les éléments",
  "无法获得证据"
 ],
 "observation_next_unavailable": [
  "Recover the runtime records or settings requested by the selected step below. Leave it blocked if unavailable; do not substitute a successful example.",
  "Recupera los registros o ajustes reales que pide el paso seleccionado abajo. Déjalo bloqueado si no están disponibles; no los sustituyas por un ejemplo favorable.",
  "Récupérez les traces ou réglages demandés par l’étape ci-dessous. Laissez-la bloquée si indisponibles ; ne les remplacez pas par un exemple favorable.",
  "获取下方所选步骤要求的实际记录或设置。无法获取时保持受阻，不要用成功示例替代。"
 ],
 "observation_next": [
  "Next check based on your observation",
  "Siguiente comprobación según lo observado",
  "Suite selon votre observation",
  "根据观察结果进行下一项检查"
 ],
 "observation_history": [
  "Observations (latest last)",
  "Observaciones (última al final)",
  "Observations (dernière en bas)",
  "观察记录（最新在末尾）"
 ],
 "observation_clear": [
  "Clear observations",
  "Borrar observaciones",
  "Effacer les observations",
  "清除观察记录"
 ],
 "observation_tool": [
  "Prepare the suggested tool",
  "Preparar la herramienta sugerida",
  "Préparer l’outil proposé",
  "准备建议的工具"
 ],
 "observation_help": [
  "Report a specific observation after trying a check. On all nine routes, TAF adapts the next instruction and includes up to 12 observations in the case report. These are user declarations, not independently verified measurements.",
  "Indica una observación concreta tras intentar una comprobación. En las nueve rutas, TAF adapta la siguiente instrucción e incluye hasta 12 observaciones en el informe. Son declaraciones del usuario, no mediciones verificadas de forma independiente.",
  "Indiquez une observation après vérification. Dans les neuf parcours, TAF adapte la suite et inclut jusqu’à 12 observations au rapport. Ce sont des déclarations, pas des mesures vérifiées indépendamment.",
  "尝试检查后报告具体观察。九条路线均会据此调整指引，并在报告中包含最多 12 条观察。这些是用户声明，不是独立验证的测量。"
 ],
 "observation_memory_short_only": [
  "A short request works; a longer one fails",
  "Una petición corta funciona; una larga falla",
  "Une requête courte fonctionne, une longue échoue",
  "短请求成功，长请求失败"
 ],
 "observation_next_memory_short_only": [
  "Fix model, precision and concurrency. Increase total tokens gradually and record peak VRAM. Compare with the KV estimate; the trend alone does not identify a cause.",
  "Fija modelo, precisión y concurrencia. Aumenta tokens gradualmente y registra el pico de VRAM. Compara con la estimación KV; la tendencia no identifica por sí sola una causa.",
  "Fixez modèle, précision et concurrence. Augmentez les tokens et relevez le pic VRAM. Comparez au budget KV ; la tendance ne prouve pas une cause.",
  "固定模型、精度及并发数，逐步增加总词元并记录显存峰值。与 KV 估算比较；趋势本身不能确定原因。"
 ],
 "observation_memory_load_failure": [
  "It fails before generation starts",
  "Falla antes de empezar a generar",
  "Échec avant la génération",
  "生成开始前失败"
 ],
 "observation_next_memory_load_failure": [
  "Measure free VRAM before loading and peak usage during loading. Verify weight format and buffers; update the memory form with the actual loading settings.",
  "Mide VRAM libre antes de cargar y pico durante la carga. Verifica formato de pesos y buffers; actualiza el formulario con los ajustes reales de carga.",
  "Mesurez la VRAM libre avant chargement et le pic pendant celui-ci. Vérifiez format des poids et buffers, puis actualisez le formulaire.",
  "测量加载前可用显存及加载峰值，核实权重格式和缓冲区，再用实际加载设置更新表单。"
 ],
 "observation_memory_generation_failure": [
  "Even a short request fails during generation",
  "Incluso una petición corta falla al generar",
  "Même une requête courte échoue à la génération",
  "短请求也在生成时失败"
 ],
 "observation_next_memory_generation_failure": [
  "Test one sequence without other workloads. Record runtime version, cache dtype and peak VRAM; inspect buffers and allocation errors before attributing failure to context length.",
  "Prueba una secuencia sin otras cargas. Registra versión del motor, tipo de caché y pico de VRAM; revisa buffers y asignación antes de atribuirlo al contexto.",
  "Testez une séquence sans autre charge. Relevez version, type du cache et pic VRAM ; inspectez buffers et allocation avant d’accuser le contexte.",
  "无其他负载时测试单序列，记录运行时版本、缓存类型及显存峰值。先检查缓冲区和分配错误，再判断是否与上下文有关。"
 ],
 "observation_template_different": [
  "The applied template differs from the inspected one",
  "La plantilla aplicada difiere de la inspeccionada",
  "Le modèle de chat appliqué diffère de celui inspecté",
  "实际使用的模板与检查的模板不同"
 ],
 "observation_next_template_different": [
  "Pin model/tokenizer revisions and the template. Compare rendered roles, special tokens and generation prefix, then repeat the original task.",
  "Fija revisiones de modelo/tokenizador y plantilla. Compara roles, tokens especiales y prefijo de generación; después repite la tarea original.",
  "Fixez révisions et modèle de chat. Comparez rôles, tokens spéciaux et préfixe de génération, puis répétez la tâche initiale.",
  "固定模型、分词器版本及模板，比较角色、特殊词元和生成前缀，再重复原始任务。"
 ],
 "observation_template_not_applied": [
  "The runtime did not apply a chat template",
  "El motor no aplicó una plantilla de chat",
  "Le moteur n’a pas appliqué de modèle de chat",
  "运行时未应用聊天模板"
 ],
 "observation_next_template_not_applied": [
  "Check whether this checkpoint expects chat formatting. If so, apply its documented template once and check for duplicate special tokens before repeating the request.",
  "Comprueba si el checkpoint espera formato de chat. Si lo espera, aplica una vez su plantilla documentada y revisa tokens especiales duplicados antes de repetir.",
  "Vérifiez si le checkpoint attend un format de chat. Si oui, appliquez une fois le modèle documenté et cherchez les tokens spéciaux doublés.",
  "核实检查点是否要求聊天格式。若需要，只应用一次文档模板，检查重复特殊词元后重试。"
 ],
 "observation_template_same": [
  "Rendered roles and tokens match",
  "Los roles y tokens formateados coinciden",
  "Les rôles et tokens formatés correspondent",
  "格式化后的角色和词元一致"
 ],
 "observation_next_template_same": [
  "Keep rendering fixed. Compare generation settings and distinguish echoed input from repeated generated tokens. For quality differences, use controlled evaluations.",
  "Mantén el formato fijo. Compara ajustes de generación y distingue entrada devuelta de tokens generados repetidos. Para diferencias de calidad, usa evaluaciones controladas.",
  "Gardez le format fixe. Comparez les réglages et distinguez entrée renvoyée et répétitions générées. Évaluez les différences de qualité avec des contrôles.",
  "保持格式不变，比较生成设置，区分返回的输入与重复生成词元。质量差异应通过受控评估检查。"
 ],
 "observation_compatibility_unsupported": [
  "The runtime rejects the architecture or operator",
  "El motor rechaza la arquitectura o un operador",
  "Le moteur rejette l’architecture ou un opérateur",
  "运行时拒绝该架构或算子"
 ],
 "observation_next_compatibility_unsupported": [
  "Check the supported-model list for the exact runtime version and rejected operator. Dense geometry estimates cannot repair missing runtime support.",
  "Comprueba modelos admitidos para la versión exacta del motor y el operador rechazado. Estimar geometría densa no resuelve la falta de soporte.",
  "Consultez les modèles pris en charge pour la version exacte et l’opérateur refusé. Une estimation dense ne corrige pas un support absent.",
  "查阅确切运行时版本的模型支持列表及被拒绝算子。稠密几何估算不能修复缺失的运行时支持。"
 ],
 "observation_compatibility_missing": [
  "Required metadata is missing or inconsistent",
  "Faltan metadatos o son inconsistentes",
  "Des métadonnées manquent ou se contredisent",
  "所需元数据缺失或矛盾"
 ],
 "observation_next_compatibility_missing": [
  "Recover config.json from the exact checkpoint revision and reinspect it. Leave missing dimensions unknown; do not copy them from another model.",
  "Recupera config.json de la revisión exacta y vuelve a inspeccionarlo. Deja como desconocidas las dimensiones ausentes; no las copies de otro modelo.",
  "Récupérez config.json de la révision exacte et réinspectez-le. Ne copiez pas les dimensions manquantes d’un autre modèle.",
  "从确切检查点版本获取并重新检查 config.json。缺失维度保持未知，不要从其他模型复制。"
 ],
 "observation_compatibility_accepted": [
  "It loads, but the original task still fails",
  "Carga, pero la tarea original sigue fallando",
  "Il se charge, mais la tâche initiale échoue",
  "可以加载，但原始任务仍失败"
 ],
 "observation_next_compatibility_accepted": [
  "Record the failing stage and a minimal request. Check runtime/memory for allocation failures; use the symptom selector for output quality. Loading alone does not certify either.",
  "Anota fase del fallo y petición mínima. Revisa ejecución/memoria si falla la asignación; usa el selector de síntomas para calidad. Cargar no certifica ninguna de ambas.",
  "Relevez l’étape en échec et une requête minimale. Vérifiez mémoire/exécution pour l’allocation ; utilisez les symptômes pour la qualité. Le chargement ne certifie ni l’un ni l’autre.",
  "记录失败阶段和最小请求。分配失败检查内存及运行时；质量问题使用症状选择器。加载成功不证明二者正常。"
 ],
 "observation_cot_invalid": [
  "A JSON parser rejects the response",
  "Un parser JSON rechaza la respuesta",
  "Un parseur JSON rejette la réponse",
  "JSON 解析器拒绝回答"
 ],
 "observation_next_cot_invalid": [
  "Inspect the parser error, truncation and extra text. Check decoder structured-output support. Reordering properties does not repair JSON syntax.",
  "Revisa error del parser, truncamiento y texto extra. Comprueba salida estructurada del decodificador. Reordenar propiedades no repara sintaxis JSON.",
  "Inspectez erreur, troncature et texte ajouté. Vérifiez la sortie structurée du décodeur. Réordonner les propriétés ne corrige pas la syntaxe.",
  "检查解析错误、截断及额外文本，核实解码器结构化输出支持。重排属性不能修复 JSON 语法。"
 ],
 "observation_cot_schema": [
  "JSON parses, but schema validation fails",
  "El JSON se parsea, pero no cumple el esquema",
  "Le JSON est lisible, mais ne respecte pas le schéma",
  "JSON 可解析，但模式验证失败"
 ],
 "observation_next_cot_schema": [
  "Use your actual schema validator to identify the failing constraint. Check decoder support for it. This field-order checker does not perform full schema validation.",
  "Usa el validador de tu esquema real para identificar la restricción que falla. Comprueba si el decodificador la admite. Este revisor de orden no valida el esquema completo.",
  "Utilisez le validateur réel pour identifier la contrainte en échec. Vérifiez sa prise en charge. Cet outil d’ordre ne valide pas tout le schéma.",
  "用实际模式验证器确定失败约束，核实解码器支持。字段顺序检查不能完成整个模式验证。"
 ],
 "observation_cot_quality": [
  "JSON and schema pass, but the answer is wrong",
  "JSON y esquema pasan, pero la respuesta es incorrecta",
  "JSON et schéma passent, mais la réponse est fausse",
  "JSON 及模式均通过，但答案错误"
 ],
 "observation_next_cot_quality": [
  "Keep the valid format and compare task accuracy on fixed examples. Change one prompt or generation setting at a time; structure alone does not establish reasoning quality.",
  "Conserva el formato válido y compara aciertos en ejemplos fijos. Cambia un ajuste de prompt o generación cada vez; la estructura no demuestra calidad de razonamiento.",
  "Gardez le format valide et comparez l’exactitude sur des exemples fixes. Changez un réglage à la fois ; la structure ne prouve pas la qualité.",
  "保持有效格式，在固定示例上比较正确率，每次仅改变一个提示或生成设置。结构有效不证明推理质量。"
 ],
 "observation_peft_inactive": [
  "The intended trained adapter is not active",
  "El adaptador entrenado previsto no está activo",
  "L’adaptateur entraîné attendu n’est pas actif",
  "预期训练好的适配器未激活"
 ],
 "observation_next_peft_inactive": [
  "Distinguish creating an adapter from loading trained weights. Check the active adapter and exact base revision, then compare enabled/disabled outputs on the same inputs.",
  "Distingue crear un adaptador de cargar pesos entrenados. Comprueba adaptador activo y revisión de la base; compara salidas con y sin él en las mismas entradas.",
  "Distinguez création et chargement de poids entraînés. Vérifiez adaptateur actif et révision de base, puis comparez les mêmes entrées avec/sans.",
  "区分创建适配器与加载训练权重，核实激活适配器及基础模型版本，再比较启用和禁用时相同输入的输出。"
 ],
 "observation_peft_targets": [
  "Expected target modules or gradients are absent",
  "Faltan módulos objetivo o gradientes esperados",
  "Des modules cibles ou gradients attendus manquent",
  "缺少预期目标模块或梯度"
 ],
 "observation_next_peft_targets": [
  "During training, inspect module names, trainable parameters and gradients after one backward pass. Frozen parameters may be expected for inference. Compare with your intended method.",
  "Si entrenas, revisa módulos, parámetros entrenables y gradientes tras un backward. En inferencia puede ser normal congelarlos. Contrasta con el método previsto.",
  "En entraînement, inspectez modules, paramètres entraînables et gradients après rétropropagation. En inférence, le gel peut être normal. Comparez à la méthode prévue.",
  "训练时检查模块、可训练参数及一次反向传播后的梯度。推理时冻结可能正常，应对照所用方法。"
 ],
 "observation_peft_runtime": [
  "The code passes lint but fails at runtime",
  "El código pasa el linter, pero falla al ejecutar",
  "Le code passe le lint, mais échoue à l’exécution",
  "代码通过静态检查，但运行失败"
 ],
 "observation_next_peft_runtime": [
  "Capture the failing operation and library versions in a minimal example. Regex checks cannot evaluate control flow, aliases or kernel support. Investigate the actual failure.",
  "Registra operación que falla y versiones en un ejemplo mínimo. Las regex no evalúan flujo, alias ni kernels. Investiga el fallo real.",
  "Relevez opération fautive et versions dans un exemple minimal. Les regex n’évaluent pas flux, alias ou kernels. Examinez l’échec réel.",
  "用最小示例记录失败操作及库版本。正则检查不分析控制流、别名或内核支持，应检查实际故障。"
 ],
 "observation_cache_tokens_differ": [
  "Rendered token prefixes differ",
  "Los prefijos tokenizados realmente difieren",
  "Les préfixes de tokens réels diffèrent",
  "实际分词后的前缀不同"
 ],
 "observation_next_cache_tokens_differ": [
  "Compare final inputs with the same tokenizer and special-token policy. Locate the first differing token, including append boundaries. Text-prefix equality does not establish cache reuse.",
  "Compara entradas finales con igual tokenizador y política de tokens especiales. Localiza el primer token distinto, incluidos límites añadidos. El prefijo textual no demuestra reutilización.",
  "Comparez les entrées finales avec même tokenizer et tokens spéciaux. Localisez le premier token différent, y compris aux frontières. Le texte ne prouve pas la réutilisation.",
  "用相同分词器及特殊词元策略比较最终输入，定位首个不同词元及追加边界。文本前缀一致不证明缓存复用。"
 ],
 "observation_cache_no_hits": [
  "Token prefixes match, but cache hits stay at zero",
  "Los prefijos tokenizados coinciden, pero no hay aciertos de caché",
  "Les tokens correspondent, mais aucun hit de cache",
  "词元前缀一致，但缓存命中为零"
 ],
 "observation_next_cache_no_hits": [
  "Check cache enablement, shared cache scope, eviction, block thresholds and cache keys. Repeat controlled cold/warm requests and inspect runtime counters.",
  "Comprueba activación, ámbito compartido, expulsiones, umbrales de bloque y claves de caché. Repite peticiones frías/calientes controladas y consulta contadores reales.",
  "Vérifiez activation, périmètre partagé, évictions, seuils et clés. Répétez des requêtes contrôlées à froid/chaud et consultez les compteurs.",
  "检查缓存启用状态、共享范围、淘汰、块阈值及缓存键。重复受控冷暖请求并查看运行时计数。"
 ],
 "observation_cache_hits_slow": [
  "There are cache hits, but latency does not improve",
  "Hay aciertos de caché, pero la latencia no mejora",
  "Il y a des hits, mais la latence ne baisse pas",
  "有缓存命中，但延迟未改善"
 ],
 "observation_next_cache_hits_slow": [
  "Separate queueing, prefill and decoding time at fixed load and output length. Compare repeated cold/warm timings; hits alone do not guarantee end-to-end speedups.",
  "Separa cola, prefill y decodificación con carga y salida fijas. Compara tiempos fríos/calientes repetidos; los aciertos no garantizan menor latencia total.",
  "Séparez attente, prefill et décodage à charge et sortie fixes. Répétez les mesures à froid/chaud ; les hits ne garantissent pas l’accélération globale.",
  "在固定负载和输出长度下区分排队、预填充和解码，重复比较冷暖耗时。命中不保证端到端加速。"
 ],
 "observation_drift_controls_differ": [
  "I found different inputs, templates or settings",
  "Encontré entradas, plantillas o ajustes distintos",
  "J’ai trouvé des entrées, modèles de chat ou réglages différents",
  "发现输入、模板或设置不同"
 ],
 "observation_next_drift_controls_differ": [
  "Align dataset version, split, samples, metric and rendered inputs. Then vary one setting at a time. Correct the original form if its declared settings were wrong.",
  "Alinea versión del dataset, split, muestras, métrica y entradas. Varía después un ajuste cada vez. Corrige el formulario si los ajustes declarados eran erróneos.",
  "Alignez version, split, exemples, métrique et entrées. Variez ensuite un seul réglage. Corrigez les déclarations initiales erronées.",
  "对齐数据集版本、划分、样本、指标及输入，再逐项改变设置。原声明有误时更正表单。"
 ],
 "observation_drift_gap_persists": [
  "The gap persists with aligned controls",
  "La diferencia persiste con controles alineados",
  "L’écart persiste avec les contrôles alignés",
  "控制条件对齐后差异仍存在"
 ],
 "observation_next_drift_gap_persists": [
  "Repeat paired runs on the same samples and quantify variation. Inspect per-example differences before attributing a cause. The heuristic band is not a significance test.",
  "Repite ejecuciones emparejadas sobre las mismas muestras y cuantifica variación. Revisa diferencias por ejemplo antes de atribuir causas. La banda heurística no prueba significación.",
  "Répétez des essais appariés et quantifiez la variabilité. Inspectez les différences individuelles avant attribution. La bande heuristique n’est pas un test statistique.",
  "在相同样本上重复配对运行并量化波动。归因前检查逐例差异；启发式区间不是显著性检验。"
 ],
 "observation_drift_gap_gone": [
  "The gap disappeared in the controlled repeat",
  "La diferencia desapareció al repetir con controles",
  "L’écart a disparu lors de la répétition contrôlée",
  "受控重复后差异消失"
 ],
 "observation_next_drift_gap_gone": [
  "Preserve the aligned settings and repeat on more fixed examples. Record which controls changed; one disappearance neither isolates a cause nor establishes equivalence.",
  "Conserva ajustes alineados y repite en más ejemplos fijos. Anota qué controles cambiaron; desaparecer una vez no aísla causas ni establece equivalencia.",
  "Conservez les réglages et répétez sur d’autres exemples fixes. Notez les contrôles modifiés ; une disparition n’isole pas la cause et ne prouve pas l’équivalence.",
  "保留对齐设置，在更多固定示例上重复并记录改动条件。差异消失一次不能确定原因或证明等价。"
 ],
 "observation_pvr_protocol_differs": [
  "The actual protocol differs from the report",
  "El protocolo real difiere del informe",
  "Le protocole réel diffère du rapport",
  "实际协议与报告不同"
 ],
 "observation_next_pvr_protocol_differs": [
  "Recover actual settings from run records, generate a corrected measurement report and reimport it. Never fill fields merely to match the reference.",
  "Recupera ajustes reales de los registros, genera un informe corregido y vuelve a importarlo. No rellenes campos solo para coincidir con la referencia.",
  "Récupérez les réglages réels, corrigez le rapport et réimportez-le. Ne renseignez pas des champs simplement pour correspondre à la référence.",
  "从运行记录恢复真实设置，生成更正报告并重新导入。不要仅为匹配参考而填写字段。"
 ],
 "observation_pvr_curve_differs": [
  "Repeated curves or fitted slopes differ",
  "Las curvas o pendientes repetidas difieren",
  "Les courbes ou pentes répétées diffèrent",
  "重复曲线或拟合斜率不同"
 ],
 "observation_next_pvr_curve_differs": [
  "Fix samples, distance range, aggregation and precision. Inspect curves, residuals, sink/edge handling and repeat variation. A slope difference alone does not refute a theory.",
  "Fija muestras, distancias, agregación y precisión. Revisa curvas, residuos, sumideros/bordes y variación entre repeticiones. Una pendiente distinta no refuta por sí sola una teoría.",
  "Fixez échantillons, distances, agrégation et précision. Inspectez courbes, résidus, sinks/bords et variabilité. Une pente différente ne réfute pas seule une théorie.",
  "固定样本、距离、聚合及精度，检查曲线、残差、汇聚点和边界处理及重复波动。斜率差异本身不能否定理论。"
 ],
 "observation_pvr_stable": [
  "Protocol and repeated curves appear stable",
  "El protocolo y las curvas repetidas parecen estables",
  "Le protocole et les courbes répétées semblent stables",
  "协议及重复曲线看起来稳定"
 ],
 "observation_next_pvr_stable": [
  "Import documented repeats and compare fit ranges and uncertainty. Stability supports repeatability under this protocol, not a verified prediction or general validity.",
  "Importa repeticiones documentadas y compara rangos de ajuste e incertidumbre. La estabilidad respalda repetibilidad bajo este protocolo, no una predicción verificada ni validez general.",
  "Importez les répétitions documentées et comparez plages d’ajustement et incertitude. La stabilité soutient la répétabilité du protocole, pas la validité générale.",
  "导入有记录的重复测量，比较拟合范围及不确定性。稳定支持该协议下的可重复性，不证明预测正确或普遍有效。"
 ],
 "observation_adapter_base_differs": [
  "The loaded base differs from the adapter’s base",
  "La base cargada difiere de la del adaptador",
  "La base chargée diffère de celle de l’adaptateur",
  "加载的基础模型与适配器基础模型不同"
 ],
 "observation_next_adapter_base_differs": [
  "Verify exact checkpoint/revision, tokenizer and embedding dimensions against training records. Correct loading and repeat fixed inputs; a matching family is insufficient.",
  "Verifica checkpoint/revisión, tokenizador y embeddings contra los registros de entrenamiento. Corrige carga y repite entradas fijas; coincidir en familia no basta.",
  "Vérifiez checkpoint/révision, tokenizer et embeddings avec les traces d’entraînement. Corrigez le chargement et répétez ; la famille ne suffit pas.",
  "对照训练记录核实检查点及版本、分词器和嵌入维度，纠正加载后重复固定输入。同一模型家族不足。"
 ],
 "observation_adapter_inactive": [
  "The intended adapter is missing or disabled",
  "El adaptador previsto falta o está desactivado",
  "L’adaptateur attendu manque ou est désactivé",
  "预期适配器缺失或禁用"
 ],
 "observation_next_adapter_inactive": [
  "Inspect loading, active adapter name and enabled state in the process. Distinguish fresh adapters from trained weights, then compare controlled enabled/disabled outputs.",
  "Inspecciona carga, nombre activo y estado habilitado en el proceso. Distingue adaptadores nuevos de pesos entrenados; compara salidas controladas con y sin él.",
  "Inspectez chargement, nom actif et activation. Distinguez adaptateur neuf et poids entraînés, puis comparez des sorties contrôlées avec/sans.",
  "检查进程中的加载、激活名称及启用状态，区分新建适配器与训练权重，再进行启用和禁用的受控输出比较。"
 ],
 "observation_adapter_active_same": [
  "The adapter is active, but controlled outputs stay the same",
  "Está activo, pero las salidas controladas siguen iguales",
  "Il est actif, mais les sorties contrôlées restent identiques",
  "适配器已启用，但受控输出仍相同"
 ],
 "observation_next_adapter_active_same": [
  "Inspect loaded adapter tensors and compare enabled/disabled logits on several fixed inputs. Identical decoded text alone does not prove ignored weights or failed training.",
  "Inspecciona tensores cargados y compara logits con y sin adaptador en varias entradas fijas. Texto idéntico no demuestra pesos ignorados ni entrenamiento fallido.",
  "Inspectez les tenseurs et comparez les logits avec/sans sur plusieurs entrées fixes. Un texte identique ne prouve pas des poids ignorés ou un entraînement raté.",
  "检查加载的张量，在多个固定输入上比较启用和禁用时的 logits。文本相同不证明权重被忽略或训练失败。"
 ]
};

