// Current Paper I wording for live help. Keep every override in EN/ES/FR/ZH.
const rows = {
  "paper.scope": [
    "📄 Current Paper I: configuration calculations are candidates; observed attention needs a stated protocol, and task outcomes need separate evaluation. 🗺️ The Blueprint maps the formal results and their limits.",
    "📄 Parte I actual: los cálculos de configuración son candidatos; la atención observada exige un protocolo y los resultados de tarea requieren evaluación aparte. 🗺️ El Blueprint muestra los resultados formales y sus límites.",
    "📄 Partie I actuelle : les calculs de configuration sont des candidats ; l’attention observée exige un protocole et les résultats de tâche une évaluation distincte. 🗺️ Le Blueprint expose les résultats formels et leurs limites.",
    "📄 最新论文第一部分：配置计算只是候选值；实测注意力需要明确协议，任务结果需要单独评估。🗺️ Blueprint 展示形式化结果及其范围。",
  ],
  "help.v06.gamma_check.body": [
    "Enter a γ measured under a stated attention protocol. The panel compares it with a configuration candidate; η is descriptive and does not validate the candidate:",
    "Introduce un γ medido con un protocolo de atención declarado. El panel lo compara con un candidato de configuración; η es descriptivo y no valida el candidato:",
    "Saisissez un γ mesuré selon un protocole d’attention déclaré. Le panneau le compare à un candidat de configuration ; η est descriptif et ne valide pas le candidat :",
    "输入按明确注意力协议测得的 γ。面板将它与配置候选值比较；η 仅用于描述，不能验证候选值：",
  ],
  "help.v06.gamma_check.validity_gate.body": [
    "The warning marks a large discrepancy between candidate and measurement. Even a small discrepancy is not independent validation: inspect the null control, fit protocol and uncertainty. See the current Paper I and docs/LIMITATIONS.md.",
    "El aviso marca una gran diferencia entre candidato y medida. Tampoco una diferencia pequeña valida el candidato por sí sola: revisa el control nulo, el protocolo de ajuste y la incertidumbre. Consulta la Parte I actual y docs/LIMITATIONS.md.",
    "L’avertissement signale un grand écart entre candidat et mesure. Même un petit écart ne valide rien indépendamment : examinez le contrôle nul, le protocole d’ajustement et l’incertitude. Voir la Partie I actuelle et docs/LIMITATIONS.md.",
    "警告表示候选值与测量值偏差较大。即使偏差较小，也不构成独立验证：应检查空值对照、拟合协议和不确定性。参见最新论文第一部分及 docs/LIMITATIONS.md。",
  ],
  "help.v09.yarn.body": [
    "Enter the declared RoPE settings, trained context and target length to inspect a candidate scaling configuration. The γ values are configuration calculations, not measured attention or evidence that task quality survives extension. Check the actual runtime schedule and evaluate target tasks against a matched baseline.",
    "Introduce la configuración RoPE declarada, el contexto entrenado y la longitud objetivo para examinar un escalado candidato. Los valores γ son cálculos de configuración, no atención medida ni prueba de que la tarea conserve calidad. Comprueba la agenda real del motor y evalúa las tareas frente a una referencia emparejada.",
    "Saisissez les paramètres RoPE déclarés, le contexte entraîné et la longueur cible pour examiner une configuration candidate. Les valeurs γ sont des calculs de configuration, pas des mesures d’attention ni une preuve de qualité. Vérifiez le moteur et les tâches face à une référence appariée.",
    "输入声明的 RoPE 参数、训练上下文和目标长度以检查候选缩放配置。γ 值是配置计算，不是实测注意力，也不能证明任务质量。请核查运行时频率安排，并与匹配基线比较目标任务。",
  ],
  "help.recipe.x19.example": [
    "Example: compare candidate KV policies at 32K. A finite-family mass quantile is a calculation; choose a policy only after measuring task quality and real resource use.",
    "Ejemplo: compara políticas KV candidatas a 32K. El cuantil de masa de la familia finita es un cálculo; elige una política tras medir calidad y recursos reales.",
    "Exemple : comparez des politiques KV candidates à 32K. Le quantile de masse de la famille finie est un calcul ; choisissez après avoir mesuré qualité et ressources réelles.",
    "示例：比较 32K 下的候选 KV 策略。有限分布的质量分位数只是计算结果；选择策略前须测量任务质量和实际资源使用。",
  ],
  "mode_desc.depth": [
    "Config-only depth landmarks and geometric candidates (Part III); trained-model transitions require measurement.",
    "Referencias de profundidad y candidatos geométricos desde la configuración (Parte III); las transiciones entrenadas requieren medición.",
    "Repères de profondeur et candidats géométriques issus de la configuration (Partie III) ; les transitions du modèle entraîné exigent une mesure.",
    "仅依据配置计算深度标志与几何候选值（第三部分）；训练模型的转变需要实测。",
  ],
  "depth.out.axes_body": [
    "The configuration defines candidate distance and depth coordinates. It does not establish a measured attention slope or a trained transition layer.",
    "La configuración define coordenadas candidatas de distancia y profundidad. No establece una pendiente de atención medida ni una capa de transición entrenada.",
    "La configuration définit des coordonnées candidates de distance et profondeur. Elle n’établit ni pente d’attention mesurée ni couche de transition entraînée.",
    "配置给出距离和深度的候选坐标；不能确立实测注意力斜率或训练后的转变层。",
  ],
};

export function applyPaperIHelpUpdates(translations) {
  for (const [index, language] of ["en", "es", "fr", "zh"].entries()) {
    for (const [key, values] of Object.entries(rows)) translations[language][key] = values[index];
  }
}
