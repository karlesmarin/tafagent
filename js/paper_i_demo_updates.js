// Current Paper I scope for guided demos. Keep all four UI languages in one table.
const rows = {
  "profile.s4": [
    "Click «🚀 Generate» to inspect configuration candidates and declared diagnostics",
    "Pulsa «🚀 Generate» para ver candidatos de configuración y diagnósticos declarados",
    "Cliquez «🚀 Generate» pour examiner les candidats de configuration et les diagnostics déclarés",
    "点击 «🚀 Generate» 查看配置候选值和声明的诊断结果",
  ],
  "pvr.s2": [
    "Click «📊 Compare measured vs candidate»",
    "Pulsa «📊 Comparar medida y candidato»",
    "Cliquez «📊 Comparer mesure et candidat»",
    "点击 «📊 比较实测值与候选值»",
  ],
  "paper.scope": [
    "📄 Demo scope: saved or illustrative inputs. Configuration calculations are candidates; measured attention needs a stated protocol, and task quality needs a separate test.",
    "📄 Alcance de la demo: entradas guardadas o ilustrativas. Los cálculos de configuración son candidatos; medir atención exige un protocolo y evaluar calidad requiere una prueba aparte.",
    "📄 Portée de la démo : données enregistrées ou illustratives. Les calculs de configuration sont des candidats ; mesurer l’attention exige un protocole et la qualité exige un test distinct.",
    "📄 演示范围：使用保存的或示例输入。配置计算只是候选值；注意力测量需要明确协议，任务质量需要单独测试。",
  ],
  "profile.x.gammaLow": [
    "γ &lt; 1 describes a heavy tail in the declared finite family; it does not establish retrieval quality for this model.",
    "γ &lt; 1 describe una cola pesada en la familia finita declarada; no demuestra la calidad de recuperación de este modelo.",
    "γ &lt; 1 décrit une queue lourde dans la famille finie déclarée ; cela ne prouve pas la qualité de récupération du modèle.",
    "γ &lt; 1 描述所声明有限分布的重尾；不能证明该模型的检索质量。",
  ],
  "profile.x.gammaHigh": [
    "A high γ concentrates the declared finite family near short distances; check measured attention before describing this model.",
    "Un γ alto concentra la familia finita declarada en distancias cortas; comprueba la atención medida antes de describir el modelo.",
    "Un γ élevé concentre la famille finie déclarée sur les courtes distances ; vérifiez l’attention mesurée avant de décrire le modèle.",
    "较高 γ 使所声明有限分布集中在短距离；描述模型前须检查实测注意力。",
  ],
  "profile.x.gammaFallback": [
    "The displayed γ is a configuration candidate unless a measured profile with protocol is supplied.",
    "El γ mostrado es un candidato de configuración salvo que se aporte un perfil medido con protocolo.",
    "Le γ affiché est un candidat de configuration sauf si un profil mesuré avec protocole est fourni.",
    "显示的 γ 是配置候选值，除非提供带协议的实测分布。",
  ],
  "profile.x.phasePost": [
    " — a label for the declared calculation, not a measured physical phase.",
    " — una etiqueta del cálculo declarado, no una fase física medida.",
    " — une étiquette du calcul déclaré, pas une phase physique mesurée.",
    " — 所声明计算的标签，并非实测物理相。",
  ],
  "profile.x.diag": [
    "📐 <b>Diagnostics</b> — configuration candidates, finite-family values and optional measured profiles are labeled separately. The what-if panel is not a task test.",
    "📐 <b>Diagnósticos</b> — se separan candidatos de configuración, valores de familia finita y perfiles medidos opcionales. El panel hipotético no prueba una tarea.",
    "📐 <b>Diagnostics</b> — candidats de configuration, valeurs de famille finie et profils mesurés facultatifs sont séparés. Le scénario hypothétique n’est pas un test de tâche.",
    "📐 <b>诊断</b> — 配置候选值、有限分布计算和可选实测分布分别标注。假设分析不是任务测试。",
  ],
  "profile.x.verif": [
    "✓ <b>Verification</b> — mathematical checks apply to their stated assumptions; they do not certify a trained model or the demo result.",
    "✓ <b>Verificación</b> — las pruebas matemáticas valen bajo sus hipótesis; no certifican un modelo entrenado ni el resultado de la demo.",
    "✓ <b>Vérification</b> — les preuves mathématiques suivent leurs hypothèses ; elles ne certifient ni un modèle entraîné ni la démo.",
    "✓ <b>验证</b> — 数学检验仅适用于其明示假设；不认证训练模型或演示结果。",
  ],
  "diagnose.x.l1": [
    "The browser computes a γ candidate from configuration. The CLI can estimate an observed γ from attention data under its chosen prompts, layers, mask and fit protocol.",
    "El navegador calcula un candidato γ desde la configuración. La CLI puede estimar γ observado con datos de atención y un protocolo de prompts, capas, máscara y ajuste.",
    "Le navigateur calcule un candidat γ depuis la configuration. La CLI peut estimer γ observé avec des données d’attention et un protocole de prompts, couches, masque et ajustement.",
    "浏览器根据配置计算 γ 候选值。CLI 可按指定提示、层、掩码和拟合协议从注意力数据估计实测 γ。",
  ],
  "diagnose.x.l2": [
    "Run the command locally and keep the model revision, tokenization, query population, mask, aggregation and fit range with the resulting JSON.",
    "Ejecuta el comando localmente y conserva revisión, tokenización, consultas, máscara, agregación y rango de ajuste junto al JSON.",
    "Exécutez la commande localement et conservez révision, tokenisation, requêtes, masque, agrégation et plage d’ajustement avec le JSON.",
    "在本地运行命令，并将模型版本、分词、查询集合、掩码、聚合和拟合区间与 JSON 一同保存。",
  ],
  "pvr.x.l1": [
    "It compares a configuration candidate with an imported measured value; agreement in one row is not a validated prediction rule.",
    "Compara un candidato de configuración con un valor medido importado; una fila concordante no valida una regla predictiva.",
    "Il compare un candidat de configuration à une valeur mesurée importée ; un accord sur une ligne ne valide pas une règle prédictive.",
    "它比较配置候选值与导入的实测值；单行吻合不构成预测规则的验证。",
  ],
  "pvr.x.l2": [
    "Differences show agreement under the two stated protocols. Inspect the null control, uncertainty and held-out models before drawing conclusions.",
    "Las diferencias muestran acuerdo bajo los dos protocolos declarados. Revisa el control nulo, la incertidumbre y modelos reservados antes de concluir.",
    "Les écarts montrent l’accord sous les deux protocoles déclarés. Examinez le contrôle nul, l’incertitude et des modèles réservés avant de conclure.",
    "差值只显示两种明示协议下的吻合程度。下结论前应检查空值对照、不确定性和留出模型。",
  ],
  "pvr.x.l4": [
    "⚠ γ_Padé is an unvalidated candidate; there is no established natural regime in which it predicts all trained models.",
    "⚠ γ_Padé es un candidato sin validar; no hay un régimen natural establecido en el que prediga todos los modelos entrenados.",
    "⚠ γ_Padé est un candidat non validé ; aucun régime naturel établi ne garantit sa prédiction pour tous les modèles entraînés.",
    "⚠ γ_Padé 是未经验证的候选式；尚无已确立的自然区间可保证预测所有训练模型。",
  ],
  "yarn.x.l2": [
    "The panel shows configuration-derived scenarios. Whether quality survives extension must be measured on the target tasks.",
    "El panel muestra escenarios calculados desde la configuración. La calidad tras extender el contexto debe medirse en las tareas objetivo.",
    "Le panneau montre des scénarios dérivés de la configuration. La qualité après extension doit être mesurée sur les tâches cibles.",
    "面板展示配置推导的情景。扩展后质量是否保持，须在目标任务上测量。",
  ],
  "yarn.x.l4": [
    "⚠ A syntactically valid scaling block and a candidate γ do not certify accuracy or a need for fine-tuning.",
    "⚠ Un bloque de escalado válido y un γ candidato no certifican precisión ni necesidad de ajuste fino.",
    "⚠ Un bloc de mise à l’échelle valide et un γ candidat ne certifient ni la précision ni le besoin d’ajustement fin.",
    "⚠ 有效的缩放配置和 γ 候选值不能证明准确率或微调需求。",
  ],
  "inspector.x.l2": [
    "Useful for checking a private or proposed configuration; behavior after training remains an empirical question.",
    "Sirve para revisar una configuración privada o propuesta; el comportamiento tras entrenar sigue siendo una cuestión empírica.",
    "Utile pour examiner une configuration privée ou proposée ; le comportement après entraînement reste empirique.",
    "可用于检查私有或拟议配置；训练后的行为仍须实测。",
  ],
  "inspector.x.l4": [
    "⚠ A pasted configuration does not supply measured γ or task outcomes; check the model revision, measurement protocol and held-out evaluation.",
    "⚠ Una configuración pegada no aporta γ medido ni resultados de tarea; comprueba revisión, protocolo de medición y evaluación reservada.",
    "⚠ Une configuration collée ne fournit ni γ mesuré ni résultat de tâche ; vérifiez révision, protocole de mesure et évaluation réservée.",
    "⚠ 粘贴的配置不能提供实测 γ 或任务结果；须核查模型版本、测量协议和留出评估。",
  ],
  "recipe.x.l1": [
    "Recipes combine declared inputs and conditional calculations. Their labels are prompts for evaluation, not decisions certified by Paper I.",
    "Las recetas combinan entradas declaradas y cálculos condicionales. Sus etiquetas orientan la evaluación, no son decisiones certificadas por la Parte I.",
    "Les recettes combinent entrées déclarées et calculs conditionnels. Leurs étiquettes guident l’évaluation, sans décision certifiée par la Partie I.",
    "配方结合声明输入和条件计算；标签用于指导评估，并非论文第一部分认证的决策。",
  ],
  "recipe.x.l4": [
    "⚠ For long context and KV interventions, test task outcomes against a matched baseline; a configuration candidate cannot supply that evidence.",
    "⚠ En contexto largo e intervenciones KV, prueba la tarea frente a una referencia emparejada; un candidato de configuración no aporta esa evidencia.",
    "⚠ Pour le long contexte et les interventions KV, testez la tâche face à une référence appariée ; un candidat de configuration ne fournit pas cette preuve.",
    "⚠ 长上下文和 KV 干预需要与匹配基线比较任务结果；配置候选值无法提供这类证据。",
  ],
};

export function applyPaperIDemoUpdates(demoStrings) {
  for (const [index, language] of ["en", "es", "fr", "zh"].entries()) {
    for (const [key, values] of Object.entries(rows)) demoStrings[language][key] = values[index];
  }
}
