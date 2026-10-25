export const memoryRows={
 "generate": [
  "After loading — phase unknown",
  "Después de cargar — fase desconocida",
  "Après chargement — phase inconnue",
  "加载后 — 阶段未知"
 ],
 "prefill": [
  "Prefill — processing the prompt",
  "Prefill — procesamiento del prompt",
  "Prefill — traitement du prompt",
  "Prefill — 处理输入提示"
 ],
 "decode": [
  "Decode — generating subsequent tokens",
  "Decodificación — generación de tokens posteriores",
  "Décodage — génération des tokens suivants",
  "Decode — 逐步生成后续 token"
 ],
 "context": [
  "Tokens at the comparison point (prompt for prefill; prompt + generated tokens for decode)",
  "Tokens en el punto comparado (prompt en prefill; prompt + tokens generados en decodificación)",
  "Tokens au point comparé (prompt en prefill ; prompt + tokens générés en décodage)",
  "比较时的 token 数（prefill 为输入；decode 为输入加已生成 token）"
 ],
 "peak_title": [
  "Observed memory peak (optional)",
  "Pico de memoria observado (opcional)",
  "Pic mémoire observé (facultatif)",
  "观测到的内存峰值（可选）"
 ],
 "peak_help": [
  "Enter a peak you measured on the same GPU, with its unit and metric. TAF does not read GPU memory. Leave blank if unavailable; an OOM message’s requested allocation is not a peak.",
  "Introduce un pico medido en la misma GPU, con unidad y métrica. TAF no lee la memoria de la GPU. Déjalo vacío si no lo tienes; la asignación solicitada en un error OOM no es un pico.",
  "Saisissez un pic mesuré sur le même GPU, avec unité et métrique. TAF ne lit pas la mémoire GPU. Laissez vide si inconnu ; une allocation demandée dans une erreur OOM n’est pas un pic.",
  "输入在同一 GPU 上测得的峰值、单位及指标。TAF 不读取 GPU 内存。未知时留空；OOM 错误中请求分配的大小不是峰值。"
 ],
 "peak_value": [
  "Reported peak",
  "Pico declarado",
  "Pic déclaré",
  "所报告峰值"
 ],
 "peak_unit": [
  "Measurement unit",
  "Unidad de la medida",
  "Unité de mesure",
  "测量单位"
 ],
 "peak_metric": [
  "What was measured?",
  "¿Qué se midió?",
  "Quelle mesure ?",
  "测量的指标"
 ],
 "peak_unknown": [
  "Unknown metric",
  "Métrica desconocida",
  "Métrique inconnue",
  "未知指标"
 ],
 "peak_allocated": [
  "Peak tensor memory allocated by PyTorch",
  "Pico de memoria de tensores asignada por PyTorch",
  "Pic de mémoire des tenseurs allouée par PyTorch",
  "PyTorch 张量已分配内存峰值"
 ],
 "peak_reserved": [
  "Peak memory reserved by the PyTorch allocator",
  "Pico de memoria reservada por el asignador de PyTorch",
  "Pic de mémoire réservée par l’allocateur PyTorch",
  "PyTorch 分配器预留内存峰值"
 ],
 "peak_device": [
  "Device memory used (sampled, e.g. nvidia-smi)",
  "Memoria usada del dispositivo (muestreo, p. ej. nvidia-smi)",
  "Mémoire utilisée sur le GPU (échantillonnée, p. ex. nvidia-smi)",
  "设备已用内存（采样，例如 nvidia-smi）"
 ],
 "peak_same": [
  "Same model, weight format and token count; one GPU, one sequence, resident weights and FP16 KV cache",
  "Mismo modelo, formato de pesos y tokens; una GPU, una secuencia, pesos residentes y caché KV FP16",
  "Même modèle, format de poids et nombre de tokens ; un GPU, une séquence, poids résidents et cache KV FP16",
  "相同模型、权重格式和 token 数；单 GPU、单序列、权重常驻、FP16 KV 缓存"
 ],
 "peak_isolated": [
  "Peak isolated to the selected phase (counters reset before it)",
  "Pico aislado de la fase elegida (contadores reiniciados antes)",
  "Pic isolé pour la phase choisie (compteurs réinitialisés avant)",
  "峰值仅对应所选阶段（此前已重置峰值计数器）"
 ],
 "peak_reset": [
  "Changing model, budget, tokens, precision or phase clears the measurement. Applying an alternative requires a new measurement.",
  "Cambiar modelo, presupuesto, tokens, precisión o fase borra la medida. Aplicar una alternativa requiere medir de nuevo.",
  "Changer de modèle, budget, tokens, précision ou phase efface la mesure. Une alternative nécessite une nouvelle mesure.",
  "更改模型、预算、token 数、精度或阶段会清除测量值。应用替代方案后需要重新测量。"
 ],
 "peak_provenance": [
  "User-reported measurement; not independently verified or executed by TAF.",
  "Medida declarada por el usuario; TAF no la ejecuta ni la verifica de forma independiente.",
  "Mesure déclarée par l’utilisateur ; ni exécutée ni vérifiée indépendamment par TAF.",
  "用户报告的测量值；TAF 未执行测量，也未独立验证。"
 ],
 "peak_resident_weights": [
  "Resident weights baseline (not a loading peak prediction)",
  "Referencia de pesos residentes (no predice el pico de carga)",
  "Référence des poids résidents (ne prédit pas le pic de chargement)",
  "常驻权重基线（并非加载峰值预测）"
 ],
 "peak_steady_estimate": [
  "Steady memory estimate (not a phase peak prediction)",
  "Estimación de memoria estable (no predice el pico de la fase)",
  "Estimation de mémoire stable (ne prédit pas le pic de la phase)",
  "稳态内存估算（并非阶段峰值预测）"
 ],
 "peak_difference": [
  "Reported peak minus baseline",
  "Pico declarado menos referencia",
  "Pic déclaré moins référence",
  "报告峰值减去基线"
 ],
 "peak_boundary": [
  "The difference is descriptive, not an estimate of fragmentation or proof of an OOM cause. A failed allocation is not counted as successfully allocated memory; a peak below the budget does not rule out OOM.",
  "La diferencia es descriptiva: no estima fragmentación ni prueba la causa del OOM. Una asignación fallida no cuenta como memoria asignada; un pico inferior al presupuesto no descarta OOM.",
  "L’écart est descriptif : il ne mesure pas la fragmentation et ne prouve pas la cause d’un OOM. Une allocation échouée n’est pas comptée comme allouée ; un pic sous le budget n’exclut pas un OOM.",
  "差值仅用于描述，不是碎片化估算，也不能证明 OOM 原因。失败的分配不计入已分配内存；峰值低于预算也不能排除 OOM。"
 ],
 "peak_block_phase": [
  "No difference calculated: identify loading, prefill or decode first.",
  "Sin diferencia calculada: identifica primero carga, prefill o decodificación.",
  "Écart non calculé : identifiez d’abord chargement, prefill ou décodage.",
  "未计算差值：请先确定加载、prefill 或 decode 阶段。"
 ],
 "peak_block_metric": [
  "No difference calculated: reserved memory and device usage cover different quantities from tensor allocations; an unknown metric cannot be compared.",
  "Sin diferencia calculada: memoria reservada y uso del dispositivo miden cantidades distintas de las asignaciones de tensores; una métrica desconocida no se puede comparar.",
  "Écart non calculé : mémoire réservée et usage du GPU diffèrent des allocations de tenseurs ; une métrique inconnue ne peut pas être comparée.",
  "未计算差值：预留内存和设备用量与张量分配统计范围不同；未知指标无法比较。"
 ],
 "peak_block_workload": [
  "No difference calculated: confirm the same workload and supported assumptions. Otherwise retain the measurement only as context.",
  "Sin diferencia calculada: confirma la misma carga y los supuestos admitidos. En otro caso, la medida queda solo como contexto.",
  "Écart non calculé : confirmez la même charge et les hypothèses prises en charge. Sinon la mesure reste contextuelle.",
  "未计算差值：请确认相同工作负载且符合支持的假设。否则该测量仅作为背景信息。"
 ],
 "peak_block_isolated": [
  "No difference calculated: a whole-run peak cannot be assigned to this phase. Reset peak counters before measuring that phase.",
  "Sin diferencia calculada: un pico de toda la ejecución no puede atribuirse a esta fase. Reinicia los contadores de pico antes de medirla.",
  "Écart non calculé : un pic global ne peut pas être attribué à cette phase. Réinitialisez les compteurs de pic avant sa mesure.",
  "未计算差值：整个运行的峰值无法归属到此阶段。请在测量该阶段前重置峰值计数器。"
 ],
 "peak_block_scope": [
  "No baseline comparison: this architecture or its metadata is outside the supported estimate.",
  "Sin comparación de referencia: esta arquitectura o sus metadatos quedan fuera de la estimación admitida.",
  "Pas de comparaison : cette architecture ou ses métadonnées sortent du périmètre de l’estimation.",
  "无法比较基线：此架构或元数据不在估算支持范围内。"
 ],
 "peak_over_budget": [
  "The reported value exceeds the entered budget. Check that the budget, device and measurement refer to the same run; this alone does not establish a cause.",
  "El valor declarado supera el presupuesto introducido. Comprueba que presupuesto, dispositivo y medida corresponden a la misma ejecución; esto por sí solo no establece una causa.",
  "La valeur déclarée dépasse le budget saisi. Vérifiez budget, GPU et mesure pour la même exécution ; cela seul n’établit pas une cause.",
  "报告值超过输入预算。请核对预算、设备和测量是否来自同一次运行；仅凭此不能确定原因。"
 ],
 "peak_phase_load": [
  "Loading: compare resident weights only as a baseline. Inspect temporary copies, conversion buffers and the device’s free memory before loading. The steady estimate does not predict the loading peak.",
  "Carga: compara los pesos residentes solo como referencia. Revisa copias temporales, buffers de conversión y memoria libre antes de cargar. La estimación estable no predice el pico de carga.",
  "Chargement : les poids résidents sont une référence. Examinez copies temporaires, buffers de conversion et mémoire libre avant chargement. L’estimation stable ne prédit pas ce pic.",
  "加载：常驻权重仅作基线。检查临时副本、转换缓冲区及加载前空闲内存。稳态估算不能预测加载峰值。"
 ],
 "peak_phase_prefill": [
  "Prefill: isolate prompt processing before subsequent-token decoding. Compare with prompt tokens only; inspect temporary attention/logit buffers and the backend actually used. Shorten only the prompt in a controlled rerun.",
  "Prefill: aísla el procesamiento del prompt previo a la decodificación posterior. Compara solo con los tokens del prompt; revisa buffers temporales de atención/logits y el backend realmente usado. Acorta solo el prompt en una repetición controlada.",
  "Prefill : isolez le traitement du prompt avant le décodage suivant. Comparez avec les tokens du prompt ; examinez buffers temporaires d’attention/logits et backend réellement utilisé. Réduisez uniquement le prompt lors d’un nouvel essai contrôlé.",
  "Prefill：单独测量后续解码前的提示处理阶段，仅使用输入 token 数比较。检查注意力/logits 临时缓冲区及实际后端。在受控重试中仅缩短输入。"
 ],
 "peak_phase_decode": [
  "Decode: measure after prefill with fresh peak counters. Compare at the actual cached token count, then check KV growth, retained outputs and concurrency. Keep the prompt fixed while varying generated length.",
  "Decodificación: mide después del prefill con contadores de pico reiniciados. Compara con los tokens realmente almacenados; revisa crecimiento KV, salidas retenidas y concurrencia. Mantén el prompt fijo al variar la longitud generada.",
  "Décodage : mesurez après le prefill avec compteurs de pic réinitialisés. Comparez au nombre réel de tokens en cache ; examinez croissance KV, sorties conservées et concurrence. Gardez le prompt fixe en variant la longueur générée.",
  "Decode：在 prefill 后重置峰值计数器再测量。按实际缓存 token 数比较，然后检查 KV 增长、保留输出及并发。固定输入，仅改变生成长度。"
 ],
 "peak_phase_generate": [
  "First locate the failure: loading, prompt prefill or subsequent-token decoding. A single generate() call can include both prefill and decode; its peak cannot distinguish them.",
  "Localiza primero el fallo: carga, prefill del prompt o decodificación posterior. Una llamada a generate() puede incluir prefill y decodificación; su pico no permite distinguirlos.",
  "Localisez d’abord l’échec : chargement, prefill du prompt ou décodage suivant. Un appel à generate() peut englober prefill et décodage ; son pic ne permet pas de les distinguer.",
  "先定位失败阶段：加载、输入 prefill 或后续 decode。一次 generate() 调用可能包含 prefill 和 decode，其峰值无法区分两者。"
 ],
 "checks_memory_prefill": [
  "Prefill peak",
  "Pico de prefill",
  "Pic de prefill",
  "Prefill 峰值"
 ],
 "checks_memory_decode": [
  "Decode peak",
  "Pico de decodificación",
  "Pic de décodage",
  "Decode 峰值"
 ],
 "checks_memory_peak": [
  "Example: fits on paper, higher prefill peak",
  "Ejemplo: cabe según la estimación, pico mayor en prefill",
  "Exemple : estimation compatible, pic de prefill supérieur",
  "示例：估算可容纳，但 prefill 峰值更高"
 ],
 "check_memory_prefill": [
  "Prefill: isolate prompt processing before subsequent-token decoding. Compare with prompt tokens only; inspect temporary attention/logit buffers and the backend actually used. Shorten only the prompt in a controlled rerun.",
  "Prefill: aísla el procesamiento del prompt previo a la decodificación posterior. Compara solo con los tokens del prompt; revisa buffers temporales de atención/logits y el backend realmente usado. Acorta solo el prompt en una repetición controlada.",
  "Prefill : isolez le traitement du prompt avant le décodage suivant. Comparez avec les tokens du prompt ; examinez buffers temporaires d’attention/logits et backend réellement utilisé. Réduisez uniquement le prompt lors d’un nouvel essai contrôlé.",
  "Prefill：单独测量后续解码前的提示处理阶段，仅使用输入 token 数比较。检查注意力/logits 临时缓冲区及实际后端。在受控重试中仅缩短输入。"
 ],
 "check_memory_decode": [
  "Decode: measure after prefill with fresh peak counters. Compare at the actual cached token count, then check KV growth, retained outputs and concurrency. Keep the prompt fixed while varying generated length.",
  "Decodificación: mide después del prefill con contadores de pico reiniciados. Compara con los tokens realmente almacenados; revisa crecimiento KV, salidas retenidas y concurrencia. Mantén el prompt fijo al variar la longitud generada.",
  "Décodage : mesurez après le prefill avec compteurs de pic réinitialisés. Comparez au nombre réel de tokens en cache ; examinez croissance KV, sorties conservées et concurrence. Gardez le prompt fixe en variant la longueur générée.",
  "Decode：在 prefill 后重置峰值计数器再测量。按实际缓存 token 数比较，然后检查 KV 增长、保留输出及并发。固定输入，仅改变生成长度。"
 ],
 "check_memory_fit": [
  "First locate the failure: loading, prompt prefill or subsequent-token decoding. A single generate() call can include both prefill and decode; its peak cannot distinguish them.",
  "Localiza primero el fallo: carga, prefill del prompt o decodificación posterior. Una llamada a generate() puede incluir prefill y decodificación; su pico no permite distinguirlos.",
  "Localisez d’abord l’échec : chargement, prefill du prompt ou décodage suivant. Un appel à generate() peut englober prefill et décodage ; son pic ne permet pas de les distinguer.",
  "先定位失败阶段：加载、输入 prefill 或后续 decode。一次 generate() 调用可能包含 prefill 和 decode，其峰值无法区分两者。"
 ],
 "check_memory_observe": [
  "Isolate loading, prefill and decode. For a baseline comparison, record peak tensor allocations on the same device and workload. Reserved memory and sampled device usage have different scopes. TAF does not measure them.",
  "Aísla carga, prefill y decodificación. Para comparar con la referencia, registra el pico de asignaciones de tensores en el mismo dispositivo y carga. La memoria reservada y el uso muestreado del dispositivo tienen otro alcance. TAF no los mide.",
  "Isolez chargement, prefill et décodage. Pour comparer à la référence, relevez le pic des allocations de tenseurs sur le même GPU et la même charge. Mémoire réservée et usage échantillonné du GPU ont un autre périmètre. TAF ne les mesure pas.",
  "分别测量加载、prefill 和 decode。基线比较需要同一设备、同一工作负载的张量分配峰值。预留内存和设备用量采样的统计范围不同。TAF 不执行这些测量。"
 ],
 "review_memory_limit": [
  "Assumes one GPU, one sequence, resident weights and FP16 KV cache. TAF does not measure free memory, phase peaks, buffers or concurrency. An optional reported peak remains unverified; an estimated fit is not proof of successful execution.",
  "Supone una GPU, una secuencia, pesos residentes y caché KV FP16. TAF no mide memoria libre, picos por fase, buffers ni concurrencia. El pico opcional declarado sigue sin verificar; que la estimación quepa no demuestra una ejecución correcta.",
  "Hypothèses : un GPU, une séquence, poids résidents et cache KV FP16. TAF ne mesure ni mémoire libre, ni pics par phase, buffers ou concurrence. Le pic déclaré facultatif reste non vérifié ; une estimation compatible ne prouve pas une exécution réussie.",
  "假设单 GPU、单序列、权重常驻及 FP16 KV 缓存。TAF 不测量空闲内存、阶段峰值、缓冲区或并发。可选的报告峰值仍未经验证；估算可容纳不能证明运行成功。"
 ],
 "triage_note_memory": [
  "Next: model ID, available GiB, weight format, token count and failure phase. You can add an observed peak. This estimate assumes one GPU and one sequence.",
  "Siguiente: ID, GiB disponibles, formato de pesos, tokens y fase del fallo. Puedes añadir un pico observado. La estimación supone una GPU y una secuencia.",
  "Ensuite : identifiant, Gio disponibles, format des poids, tokens et phase de l’échec. Vous pouvez ajouter un pic observé. L’estimation suppose un GPU et une séquence.",
  "下一步：模型 ID、可用 GiB、权重格式、token 数及失败阶段。可添加观测峰值。估算假设单 GPU、单序列。"
 ],
 "memory_peak_help": [
  "Memory checks distinguish loading, prompt prefill, subsequent-token decode and an unknown phase. Optionally enter an observed peak and its metric. Comparable tensor peaks are shown against a baseline, with explicit limits. Explore the saved higher-prefill-peak example; it is synthetic, not a model run.",
  "La ruta de memoria distingue carga, prefill del prompt, decodificación posterior y fase desconocida. Puedes indicar un pico observado y su métrica. Los picos de tensores comparables se contrastan con una referencia, con límites explícitos. Explora el ejemplo guardado de pico mayor en prefill: es sintético, no una ejecución.",
  "Le parcours mémoire distingue chargement, prefill du prompt, décodage suivant et phase inconnue. Vous pouvez saisir un pic observé et sa métrique. Les pics de tenseurs comparables sont rapprochés d’une référence, avec limites explicites. Explorez l’exemple enregistré de pic de prefill supérieur : il est synthétique, sans exécution.",
  "内存路线区分加载、提示 prefill、后续 decode 及未知阶段。可输入观测峰值及指标。可比的张量峰值会与基线对照，并明确限制。可探索已保存的较高 prefill 峰值示例；它是合成数据，不是模型运行结果。"
 ],
 "load_other": [
  "The resident-weight estimate alone does not explain this loading failure. Review the phase peak and other allocations; TAF does not independently verify them.",
  "La estimación de pesos residentes por sí sola no explica este fallo de carga. Revisa el pico de la fase y otras asignaciones; TAF no los verifica de forma independiente.",
  "L’estimation des poids résidents seule n’explique pas cet échec de chargement. Examinez le pic de la phase et les autres allocations ; TAF ne les vérifie pas indépendamment.",
  "仅凭常驻权重估算无法解释加载失败。请检查该阶段峰值及其他分配；TAF 不会独立验证这些数据。"
 ]
};
