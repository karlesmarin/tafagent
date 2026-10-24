// Symptom-first routing, informed by public reports (docs/resolver-community.md).
// Selecting a symptom never certifies its cause or starts a network/model operation.
export const TRIAGE={
 memory:[['load','memory',null,'memory'],['generate','memory',null,'memory'],['training',null,null,'adaptation']],
 output:[['template_error','template',null,'setup'],['repetition','template',null,'setup'],['structured','cot',null,'setup']],
 adaptation:[['adapter_load','adapter',null,'adaptation'],['adapter_unchanged','peft',null,'adaptation'],['training_code','peft',null,'adaptation']],
 access:[['restricted',null,null,'setup','https://huggingface.co/docs/hub/models-gated'],['config_error','compatibility',null,'architecture'],['gguf',null,'gguf','quant']],
 context:[['context_memory','memory',null,'memory'],['context_quality',null,'longscore','horizon'],['context_extend',null,'yarn','horizon']],
 evaluation:[['score_gap','drift',null,'evidence'],['benchmark_risk',null,'contam','evidence']],
 performance:[['token_count',null,'tax','tokens'],['prefix','cache',null,'memory'],['slow',null,'launch','memory']],
};
export const triageRows={
 triage_help:['Start with a symptom and one follow-up question: 7 families, 20 situations. Loading, generation, training, access restrictions and quality issues are separated before suggesting a tool. The direct checks remain available for experienced users.','Empieza por un síntoma y una pregunta concreta: 7 familias, 20 situaciones. Se distinguen carga, generación, entrenamiento, acceso y calidad antes de proponer una herramienta. Las comprobaciones directas siguen disponibles para usuarios expertos.','Commencez par un symptôme et une question ciblée : 7 familles, 20 situations. Chargement, génération, entraînement, accès et qualité sont distingués avant de proposer un outil. Les vérifications directes restent disponibles.','先选择症状，再回答一个针对性问题：7 个类别、20 种情况。推荐工具前区分加载、生成、训练、访问和质量问题。熟悉工具的用户仍可直接选择检查。'],
 triage_title:['Let TAF guide me','Que TAF me guíe','Me laisser guider par TAF','让 TAF 引导我'],
 triage_category:['What are you having trouble with?','¿Con qué tienes dificultades?','Avec quoi avez-vous des difficultés ?','您遇到哪方面的问题？'],
 triage_question:['Which description fits your case?','¿Qué descripción encaja con tu caso?','Quelle description correspond à votre cas ?','哪个描述符合您的情况？'],
 triage_select:['Choose an option…','Elige una opción…','Choisissez une option…','请选择…'],
 triage_continue:['Continue with this check','Continuar con esta comprobación','Continuer avec cette vérification','继续此项检查'],
 triage_official:['Official access instructions','Instrucciones oficiales de acceso','Instructions officielles d’accès','官方访问说明'],
 triage_note:['This selects a useful check, not the cause of the error.','Esto elige una comprobación útil, no la causa del error.','Ceci sélectionne une vérification utile, pas la cause de l’erreur.','此操作选择适用的检查，不确定错误原因。'],
 triage_direct:['I already know what to check','Ya sé qué quiero comprobar','Je sais déjà quoi vérifier','我已知道要检查什么'],
 triage_memory:['Memory / CUDA OOM','Memoria / CUDA OOM','Mémoire / CUDA OOM','内存 / CUDA OOM'],
 triage_output:['Responses or chat formatting','Respuestas o formato de chat','Réponses ou format de chat','回答或聊天格式'],
 triage_adaptation:['LoRA adapter or training code','Adaptador LoRA o código de entrenamiento','Adaptateur LoRA ou code d’entraînement','LoRA 适配器或训练代码'],
 triage_access:['Downloading or loading a model','Descarga o carga del modelo','Téléchargement ou chargement du modèle','模型下载或加载'],
 triage_context:['Long documents or conversations','Documentos o conversaciones largas','Documents ou conversations longs','长文档或长对话'],
 triage_evaluation:['Evaluation results','Resultados de evaluación','Résultats d’évaluation','评估结果'],
 triage_performance:['Speed, tokens or prompt cache','Velocidad, tokens o caché de prompts','Vitesse, tokens ou cache de prompts','速度、词元或提示词缓存'],
 triage_load:['It runs out of memory while loading','Se queda sin memoria al cargar','La mémoire manque au chargement','加载时内存不足'],
 triage_generate:['It loads, but runs out of memory while generating','Carga, pero se queda sin memoria al generar','Il se charge, mais la mémoire manque à la génération','可以加载，但生成时内存不足'],
 triage_training:['It fails during training or on multiple GPUs','Falla entrenando o con varias GPU','Il échoue à l’entraînement ou avec plusieurs GPU','训练或使用多 GPU 时失败'],
 triage_template_error:['An error mentions chat_template','El error menciona chat_template','L’erreur mentionne chat_template','错误提及 chat_template'],
 triage_repetition:['It repeats the prompt or mixes conversation roles','Repite el prompt o mezcla los roles de conversación','Il répète le prompt ou mélange les rôles','重复提示词或混淆对话角色'],
 triage_structured:['The JSON response is not what I expected','La respuesta JSON no es como esperaba','La réponse JSON n’est pas celle attendue','JSON 回答不符合预期'],
 triage_adapter_load:['The adapter will not load or reports incompatible targets','El adaptador no carga o indica objetivos incompatibles','L’adaptateur ne se charge pas ou signale des cibles incompatibles','适配器无法加载或提示目标不兼容'],
 triage_adapter_unchanged:['The adapter seems to produce the same output as the base','El adaptador parece responder igual que la base','L’adaptateur semble répondre comme la base','适配器输出似乎与基础模型相同'],
 triage_training_code:['I want to check my PEFT / QLoRA setup code','Quiero revisar mi código de preparación PEFT / QLoRA','Je veux vérifier mon code de préparation PEFT / QLoRA','想检查 PEFT / QLoRA 设置代码'],
 triage_restricted:['I get 401 / 403 or a private / gated-model error','Aparece 401 / 403 o un error de modelo privado / restringido','Erreur 401 / 403 ou modèle privé / à accès restreint','出现 401 / 403 或私有/受限模型错误'],
 triage_config_error:['The architecture or config is not recognized','No se reconoce la arquitectura o configuración','L’architecture ou la configuration n’est pas reconnue','架构或配置无法识别'],
 triage_gguf:['I need to inspect a GGUF file','Necesito inspeccionar un archivo GGUF','Je dois examiner un fichier GGUF','需要检查 GGUF 文件'],
 triage_context_memory:['Longer input makes it run out of memory','Al alargar la entrada se queda sin memoria','Une entrée plus longue épuise la mémoire','输入变长后内存不足'],
 triage_context_quality:['It accepts the text but misses distant information','Acepta el texto pero pierde información lejana','Il accepte le texte mais perd l’information éloignée','接受文本却遗漏远处信息'],
 triage_context_extend:['I want to explore a longer context configuration','Quiero explorar una configuración de contexto más largo','Je veux explorer un contexte plus long','想探索更长上下文配置'],
 triage_score_gap:['Comparable runs give different scores','Ejecuciones comparables dan puntuaciones distintas','Des exécutions comparables donnent des scores différents','可比运行的分数不同'],
 triage_benchmark_risk:['I suspect the benchmark may overlap training data','Sospecho que el benchmark puede estar en los datos de entrenamiento','Je soupçonne un chevauchement avec les données d’entraînement','怀疑基准与训练数据重叠'],
 triage_token_count:['The same text uses more tokens with another model','El mismo texto usa más tokens con otro modelo','Le même texte utilise plus de tokens avec un autre modèle','相同文本在另一个模型中使用更多词元'],
 triage_prefix:['An edited prompt may have lost its cached prefix','Un cambio del prompt puede haber perdido el prefijo en caché','Un prompt modifié a peut-être perdu son préfixe en cache','修改提示词后可能丢失缓存前缀'],
 triage_slow:['I want to review runtime memory and launch settings','Quiero revisar memoria y ajustes de ejecución','Je veux vérifier la mémoire et les réglages du moteur','想检查运行时内存和启动设置'],
 triage_note_memory:['Next: model ID, available GiB, weight format and total tokens. This estimate assumes one GPU and one sequence.','Siguiente: ID, GiB disponibles, formato de pesos y tokens totales. La estimación supone una GPU y una secuencia.','Ensuite : identifiant, Gio disponibles, format des poids et tokens totaux. L’estimation suppose un GPU et une séquence.','下一步：模型 ID、可用 GiB、权重格式和总词元。估算假设单 GPU、单序列。'],
 triage_note_training:['The inference memory calculator cannot diagnose training or distributed allocation. Record per-GPU memory, optimizer, precision, batch/sequence length and sharding setup. Start with the training explanation below.','La calculadora de inferencia no diagnostica entrenamiento ni reparto entre GPU. Anota memoria por GPU, optimizador, precisión, lote/longitud y configuración de reparto. Empieza por la explicación de entrenamiento.','La calculatrice d’inférence ne diagnostique pas l’entraînement ni la répartition multi-GPU. Notez mémoire par GPU, optimiseur, précision, lot/longueur et partitionnement. Consultez l’explication de l’entraînement.','推理内存计算器无法诊断训练或分布式分配。请记录每个 GPU 的内存、优化器、精度、批量/序列长度和分片设置。先阅读训练说明。'],
 triage_note_template:['Next: the exact model ID. TAF checks its saved template. Keep model/tokenizer versions and the prompt-formatting call for your runtime check. Repetition has other possible causes too.','Siguiente: ID exacto del modelo. TAF revisa su plantilla guardada. Conserva versiones de modelo/tokenizador y la llamada de formato para comprobar el motor. La repetición también puede tener otras causas.','Ensuite : identifiant exact. TAF examine le modèle de chat enregistré. Conservez versions et appel de formatage pour vérifier le moteur. La répétition peut avoir d’autres causes.','下一步：确切模型 ID。TAF 检查保存的模板。保留模型/分词器版本和格式化调用以检查运行时。重复也可能有其他原因。'],
 triage_note_restricted:['TAF cannot verify your account permissions or repair authentication. Check the exact repository, access approval and authentication in your own environment. Do not paste access tokens here.','TAF no puede verificar los permisos de tu cuenta ni reparar la autenticación. Revisa repositorio exacto, aprobación de acceso y autenticación en tu entorno. No pegues tokens de acceso aquí.','TAF ne peut vérifier vos permissions ni réparer l’authentification. Vérifiez dépôt, autorisation et authentification dans votre environnement. Ne collez aucun jeton ici.','TAF 无法验证账户权限或修复身份认证。请在自己的环境检查确切仓库、访问批准及认证。不要在此粘贴访问令牌。'],
 triage_note_peft:['Next: the loading or training snippet, with secrets removed. TAF inspects recognizable PEFT calls. Confirm the adapter is active and compare controlled outputs in your environment.','Siguiente: fragmento de carga o entrenamiento sin secretos. TAF inspecciona llamadas PEFT reconocibles. Confirma que el adaptador está activo y compara salidas controladas en tu entorno.','Ensuite : extrait de chargement ou entraînement sans secrets. TAF examine les appels PEFT reconnus. Confirmez l’activation et comparez des sorties contrôlées dans votre environnement.','下一步：去除秘密信息的加载或训练片段。TAF 检查可识别的 PEFT 调用。请在实际环境确认适配器已启用并进行受控输出比较。'],
 triage_note_cot:['Next: paste a JSON object or schema to inspect recognized reasoning/answer field order. This is a partial check: it cannot validate every schema constraint or repair invented/missing tool arguments.','Siguiente: pega un objeto o esquema JSON para revisar el orden de los campos reconocidos de razonamiento/respuesta. Es una revisión parcial: no valida todas las restricciones ni repara argumentos de herramientas inventados o ausentes.','Ensuite : collez un objet ou schéma JSON pour examiner l’ordre des champs reconnus. Vérification partielle : elle ne valide pas toutes les contraintes ni ne répare les arguments d’outils inventés ou absents.','下一步：粘贴 JSON 对象或模式，检查识别的推理/答案字段顺序。此检查仅覆盖部分问题，不能验证所有约束或修复虚构/缺失的工具参数。'],
};
export function triageNoteKey(choice){
 const [key,route]=choice;
 if(key==='training'||key==='restricted')return 'triage_note_'+key;
 if(['memory','template','peft','cot'].includes(route))return 'triage_note_'+route;
 if(route==='compatibility')return 'compatibility_next';
 return route?'next_'+route:'catalog_note';
}
