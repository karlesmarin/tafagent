export const measurementRows={
  "measurement_title": [
    "Import memory measurement",
    "Importar medición de memoria",
    "Importer une mesure mémoire",
    "导入内存测量"
  ],
  "measurement_help": [
    "Load a taf-memory-measurement JSON report (up to 64 KiB). Preview its declared conditions before attaching the peak. Your model, phase and workload settings are not changed.",
    "Carga un informe JSON taf-memory-measurement (hasta 64 KiB). Revisa sus condiciones declaradas antes de incorporar el pico. No se cambian tu modelo, fase ni ajustes de carga.",
    "Chargez un rapport JSON taf-memory-measurement (64 Kio maximum). Vérifiez ses conditions déclarées avant de joindre le pic. Modèle, phase et réglages de charge restent inchangés.",
    "加载 taf-memory-measurement JSON 报告（最大 64 KiB）。附加峰值前请预览声明条件。不会更改模型、阶段或负载设置。"
  ],
  "measurement_file": [
    "Measurement JSON file",
    "Archivo JSON de medición",
    "Fichier JSON de mesure",
    "测量 JSON 文件"
  ],
  "measurement_checks": [
    "Declared conditions versus this case",
    "Condiciones declaradas frente a este caso",
    "Conditions déclarées comparées à ce cas",
    "声明条件与当前案例的比较"
  ],
  "measurement_unverified": [
    "File contents are unverified. Matching fields do not prove that the measurement or isolation was correct.",
    "El contenido del archivo no está verificado. Coincidir en los campos no demuestra que la medición o el aislamiento sean correctos.",
    "Le contenu du fichier n’est pas vérifié. Des champs identiques ne prouvent pas la qualité de la mesure ou de son isolation.",
    "文件内容未经验证。字段匹配并不能证明测量或阶段隔离正确。"
  ],
  "measurement_example": [
    "Illustrative file: no numerical baseline comparison is enabled.",
    "Archivo ilustrativo: no habilita una comparación numérica con la estimación.",
    "Fichier illustratif : aucune comparaison numérique à l’estimation n’est activée.",
    "示例文件：不会启用与估算基线的数值比较。"
  ],
  "measurement_apply": [
    "Attach peak to this case",
    "Incorporar pico a este caso",
    "Joindre le pic à ce cas",
    "将峰值附加到案例"
  ],
  "measurement_peak": [
    "Imported peak",
    "Pico importado",
    "Pic importé",
    "导入的峰值"
  ],
  "measurement_confirm": [
    "Peak attached. Check the same-workload and isolated-phase declarations yourself, then run the check again. Missing or differing file conditions still block a numerical comparison.",
    "Pico incorporado. Revisa y confirma tú mismo la misma carga y el aislamiento de la fase; después repite la comprobación. Las condiciones ausentes o diferentes del archivo siguen bloqueando la comparación numérica.",
    "Pic joint. Vérifiez vous-même les déclarations de même charge et de phase isolée, puis relancez la vérification. Les conditions absentes ou différentes bloquent toujours la comparaison numérique.",
    "峰值已附加。请自行核实并确认相同负载和阶段隔离，然后重新检查。文件中缺失或不同的条件仍会阻止数值比较。"
  ],
  "measurement_invalid": [
    "Invalid or unsupported measurement report. The current case is unchanged.",
    "Informe de medición inválido o no compatible. El caso actual no ha cambiado.",
    "Rapport de mesure invalide ou non pris en charge. Le cas actuel reste inchangé.",
    "测量报告无效或不受支持，当前案例未改变。"
  ],
  "measurement_large": [
    "The measurement file exceeds 64 KiB. The current case is unchanged.",
    "El archivo de medición supera 64 KiB. El caso actual no ha cambiado.",
    "Le fichier de mesure dépasse 64 Kio. Le cas actuel reste inchangé.",
    "测量文件超过 64 KiB，当前案例未改变。"
  ],
  "measurement_match": [
    "Declared match",
    "Coincidencia declarada",
    "Correspondance déclarée",
    "声明匹配"
  ],
  "measurement_different": [
    "Different",
    "Diferente",
    "Différent",
    "不同"
  ],
  "measurement_missing": [
    "Not documented",
    "Sin documentar",
    "Non documenté",
    "未记录"
  ],
  "measurement_not_applicable": [
    "Not used for loading",
    "No se usa para carga",
    "Non utilisé au chargement",
    "加载阶段不使用"
  ],
  "measurement_guide": [
    "How to measure and import",
    "Cómo medir e importar",
    "Comment mesurer et importer",
    "如何测量并导入"
  ],
  "peak_block_measurement": [
    "No numerical difference: file conditions are missing, different or illustrative. Review the comparison below.",
    "Sin diferencia numérica: las condiciones del archivo faltan, difieren o son ilustrativas. Revisa la comparación de abajo.",
    "Pas d’écart numérique : conditions absentes, différentes ou illustratives. Consultez la comparaison ci-dessous.",
    "不计算数值差异：文件条件缺失、不同或属于示例。请查看下方比较。"
  ],
  "measurement_help_summary": [
    "Memory cases can attach a local measurement JSON with a preview of model, revision, phase and workload matches. A local PyTorch helper collects a peak around your own code. Raw runtime details stay in private cases; reduced reports retain only comparison categories. No browser GPU execution or independent validation.",
    "Los casos de memoria admiten un JSON local con revisión de modelo, revisión, fase y carga. Un auxiliar local de PyTorch recoge un pico alrededor de tu propio código. Los detalles del entorno quedan en el caso privado; el informe reducido solo conserva categorías de comparación. El navegador no ejecuta la GPU ni valida la medida de forma independiente.",
    "Les cas mémoire acceptent un JSON local avec comparaison du modèle, de la révision, de la phase et de la charge. Un outil PyTorch local recueille le pic autour de votre code. Les détails restent dans le cas privé ; le rapport réduit ne conserve que les catégories. Ni exécution GPU dans le navigateur ni validation indépendante.",
    "内存案例可附加本地 JSON，并比较模型、版本、阶段与负载。本地 PyTorch 辅助工具围绕您自己的代码采集峰值。运行环境详情保留在私密案例中；精简报告仅保留比较类别。浏览器不会执行 GPU 操作或独立验证测量。"
  ],
  "measurement_field_model": [
    "Model",
    "Modelo",
    "Modèle",
    "模型"
  ],
  "measurement_field_revision": [
    "Revision",
    "Revisión",
    "Révision",
    "版本"
  ],
  "measurement_field_phase": [
    "Phase",
    "Fase",
    "Phase",
    "阶段"
  ],
  "measurement_field_precision": [
    "Weight format",
    "Formato de pesos",
    "Format des poids",
    "权重格式"
  ],
  "measurement_field_tokens": [
    "Tokens",
    "Tokens",
    "Tokens",
    "词元"
  ],
  "measurement_field_gpu_count": [
    "GPU count",
    "Número de GPU",
    "Nombre de GPU",
    "GPU 数量"
  ],
  "measurement_field_batch_size": [
    "Sequence count",
    "Número de secuencias",
    "Nombre de séquences",
    "序列数量"
  ],
  "measurement_field_resident_weights": [
    "Resident weights",
    "Pesos residentes",
    "Poids résidents",
    "权重常驻"
  ],
  "measurement_field_kv_dtype": [
    "KV dtype",
    "Tipo de KV",
    "Type KV",
    "KV 数据类型"
  ],
  "measurement_field_isolation": [
    "Isolated phase",
    "Fase aislada",
    "Phase isolée",
    "阶段隔离"
  ],
  "measurement_field_peak_value": [
    "Peak value",
    "Valor del pico",
    "Valeur du pic",
    "峰值"
  ],
  "measurement_field_peak_unit": [
    "Peak unit",
    "Unidad del pico",
    "Unité du pic",
    "峰值单位"
  ],
  "measurement_field_peak_metric": [
    "Peak metric",
    "Métrica del pico",
    "Métrique du pic",
    "峰值指标"
  ]
};
