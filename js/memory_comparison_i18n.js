export const comparisonRows={
  "comparison_title": [
    "Compare before and after",
    "Comparar antes y después",
    "Comparer avant et après",
    "比较前后测量"
  ],
  "comparison_help": [
    "The attached measurement is Before. Select a second local report (up to 64 KiB) as After. Both records stay in this case; attaching or confirming recalculates locally and clears follow-up.",
    "La medición adjunta es Antes. Selecciona un segundo informe local (hasta 64 KiB) como Después. Ambos quedan en el caso; incorporar o confirmar recalcula localmente y reinicia el seguimiento.",
    "La mesure jointe est Avant. Choisissez un second rapport local (64 Kio maximum) comme Après. Les deux restent dans le cas ; joindre ou confirmer recalcule localement et réinitialise le suivi.",
    "已附加的测量为“之前”。选择第二份本地报告（最大 64 KiB）作为“之后”。两份记录保留在案例中；附加或确认会在本地重新计算并清除后续跟踪。"
  ],
  "comparison_file": [
    "After measurement JSON",
    "JSON de la medición posterior",
    "JSON de la mesure après",
    "之后测量的 JSON"
  ],
  "comparison_apply": [
    "Attach as After",
    "Incorporar como Después",
    "Joindre comme Après",
    "附加为“之后”"
  ],
  "comparison_confirm": [
    "I checked both runs: same input/workload, physical hardware and protocol; isolated phases. Matching device labels alone is insufficient.",
    "He comprobado ambas ejecuciones: misma entrada/carga, equipo físico y protocolo; fases aisladas. Coincidir en el nombre del dispositivo no basta.",
    "J’ai vérifié les deux exécutions : mêmes entrée/charge, matériel physique et protocole ; phases isolées. Un même nom de périphérique ne suffit pas.",
    "我已核查两次运行：相同输入/负载、物理硬件和协议，且阶段已隔离。仅设备标签相同并不足够。"
  ],
  "comparison_limit": [
    "Two unverified declarations. A delta is descriptive: it does not establish causality, repeatability, output quality or a resolved OOM. Repeat controlled runs; file dates and device labels are not authenticated.",
    "Dos declaraciones sin verificar. La diferencia es descriptiva: no demuestra causalidad, repetibilidad, calidad ni que un OOM esté resuelto. Repite ejecuciones controladas; las fechas y etiquetas de dispositivo no están autenticadas.",
    "Deux déclarations non vérifiées. L’écart est descriptif : il ne prouve ni causalité, ni répétabilité, ni qualité, ni résolution d’un OOM. Répétez des essais contrôlés ; dates et noms de périphériques ne sont pas authentifiés.",
    "两份未经验证的声明。差值仅作描述，不能证明因果关系、可重复性、输出质量或 OOM 已解决。请重复受控运行；文件日期和设备标签均未认证。"
  ],
  "comparison_before": [
    "Before peak",
    "Pico antes",
    "Pic avant",
    "之前峰值"
  ],
  "comparison_after": [
    "After peak",
    "Pico después",
    "Pic après",
    "之后峰值"
  ],
  "comparison_delta": [
    "Difference: after − before",
    "Diferencia: después − antes",
    "Écart : après − avant",
    "差值：之后 − 之前"
  ],
  "comparison_percent": [
    "Change relative to Before",
    "Variación respecto a Antes",
    "Variation par rapport à Avant",
    "相对于“之前”的变化"
  ],
  "comparison_zero": [
    "Undefined: the Before peak is zero.",
    "No definido: el pico anterior es cero.",
    "Non définie : le pic avant est nul.",
    "未定义：“之前”峰值为零。"
  ],
  "comparison_lower": [
    "The declared After peak is lower.",
    "El pico posterior declarado es menor.",
    "Le pic après déclaré est inférieur.",
    "声明的之后峰值更低。"
  ],
  "comparison_higher": [
    "The declared After peak is higher.",
    "El pico posterior declarado es mayor.",
    "Le pic après déclaré est supérieur.",
    "声明的之后峰值更高。"
  ],
  "comparison_equal": [
    "The two declared peaks are equal.",
    "Los dos picos declarados son iguales.",
    "Les deux pics déclarés sont égaux.",
    "两个声明峰值相等。"
  ],
  "comparison_conditions": [
    "Review both records against this case",
    "Revisar ambos informes frente al caso",
    "Vérifier les deux rapports par rapport au cas",
    "核查两份记录与案例的条件"
  ],
  "comparison_clear": [
    "Remove After measurement",
    "Quitar medición posterior",
    "Retirer la mesure après",
    "移除之后测量"
  ],
  "comparison_guide": [
    "How to compare two memory runs",
    "Cómo comparar dos ejecuciones de memoria",
    "Comment comparer deux mesures mémoire",
    "如何比较两次内存测量"
  ],
  "comparison_field_engine": [
    "Runtime engine",
    "Motor de ejecución",
    "Moteur d’exécution",
    "运行引擎"
  ],
  "comparison_field_version": [
    "Runtime version",
    "Versión del motor",
    "Version du moteur",
    "引擎版本"
  ],
  "comparison_field_device": [
    "Device label",
    "Etiqueta de dispositivo",
    "Nom du périphérique",
    "设备标签"
  ],
  "comparison_field_order": [
    "After timestamp is later",
    "Fecha posterior más reciente",
    "Date après plus récente",
    "之后时间晚于之前"
  ],
  "comparison_block_before": [
    "Before does not match the case or has missing conditions.",
    "Antes no coincide con el caso o tiene condiciones sin documentar.",
    "Avant ne correspond pas au cas ou des conditions manquent.",
    "之前记录与案例不符或缺少条件。"
  ],
  "comparison_block_after": [
    "After does not match the case or has missing conditions.",
    "Después no coincide con el caso o tiene condiciones sin documentar.",
    "Après ne correspond pas au cas ou des conditions manquent.",
    "之后记录与案例不符或缺少条件。"
  ],
  "comparison_block_phase": [
    "A whole generation peak cannot isolate prefill or decode.",
    "Un pico de generación completa no aísla prefill ni decodificación.",
    "Un pic de génération complète n’isole ni prefill ni décodage.",
    "完整生成峰值无法隔离预填充或解码。"
  ],
  "comparison_block_metric": [
    "This comparison requires allocated tensor peaks in both files.",
    "Esta comparación exige picos de tensores asignados en ambos archivos.",
    "Cette comparaison exige des pics de tenseurs alloués dans les deux fichiers.",
    "此比较要求两份文件均为已分配张量峰值。"
  ],
  "comparison_block_scope": [
    "The current memory case is outside the supported scope.",
    "El caso de memoria actual queda fuera del alcance admitido.",
    "Le cas mémoire actuel dépasse le périmètre pris en charge.",
    "当前内存案例超出支持范围。"
  ],
  "comparison_block_confirmation": [
    "Confirm both runs and the original peak’s workload/isolation before comparing.",
    "Confirma ambas ejecuciones y la carga/aislamiento del pico original antes de comparar.",
    "Confirmez les deux exécutions ainsi que la charge et l’isolation du pic initial avant de comparer.",
    "比较前，请确认两次运行及原始峰值的负载和隔离。"
  ],
  "comparison_block_runtime": [
    "Engine, version and device label must be documented and identical.",
    "Motor, versión y etiqueta de dispositivo deben estar documentados y coincidir.",
    "Moteur, version et nom du périphérique doivent être documentés et identiques.",
    "引擎、版本和设备标签必须有记录且一致。"
  ],
  "comparison_block_order": [
    "Both timestamps are required; After must be strictly later than Before.",
    "Se requieren ambas fechas; Después debe ser estrictamente posterior a Antes.",
    "Les deux dates sont requises ; Après doit être strictement postérieur à Avant.",
    "需要两个时间戳，且“之后”必须严格晚于“之前”。"
  ],
  "comparison_block_example": [
    "Illustrative data cannot establish a comparison of measured runs.",
    "Los datos ilustrativos no habilitan una comparación de ejecuciones medidas.",
    "Les données illustratives ne permettent pas une comparaison de mesures réelles.",
    "示例数据不能用于实测运行比较。"
  ],
  "comparison_help_summary": [
    "Memory cases can compare two declared measurements under matching conditions and retain both in a private case.",
    "Los casos de memoria pueden comparar dos mediciones declaradas con condiciones coincidentes y conservar ambas en un caso privado.",
    "Les cas mémoire peuvent comparer deux mesures déclarées aux conditions identiques et conserver les deux dans un cas privé.",
    "内存案例可在声明条件一致时比较两份测量，并将两份记录保存在私密案例中。"
  ],
  "comparison_range": [
    "Undefined: outside the supported numeric range.",
    "No definido: fuera del rango numérico admitido.",
    "Non définie : hors de la plage numérique prise en charge.",
    "未定义：超出支持的数值范围。"
  ]
};
