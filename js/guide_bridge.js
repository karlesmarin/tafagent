// Shared by TAF and the Quarto guide. No inference or tracking.
// The optional guide model picker queries HF only when the user focuses/types.
// All navigation and interpretation use this versioned, deterministic catalog.
import { chapterTitles } from './guide_chapters.js';
import { attachHfAutocomplete } from './hf_autocomplete.js';
export const BRIDGE_VERSION = 1;
export const GUIDE_BASE = 'https://karlesmarin.github.io/transformers-guide/';
export const TAF_BASE = 'https://karlesmarin.github.io/tafagent/';
export const HF_BASE = 'https://karlexmarin-taf-agent.static.hf.space/';
export const modeNames={diagnose:'Diagnose CLI',longscore:'LongScore',fitcheck:'Fit Check',pvr:'Prediction vs Reality',depth:'Depth map',phase:'Phase Diagram',quant:'Quant',template:'Chat-template Sniffer',adapter:'Adapter Reality',memreal:'Memory Reality',tax:'Token Tax'};
const languages = ['en', 'es', 'fr', 'zh'];
export const words = {
  title: ['Understand this result', 'Entender este resultado', 'Comprendre ce résultat', '理解此结果'],
  choose: ['What would you like to understand?', '¿Qué quieres entender?', 'Que souhaitez-vous comprendre ?', '你想了解什么？'],
  read: ['Read the explanation', 'Leer la explicación', 'Lire les explications', '阅读解释'],
  next: ['Next step', 'Siguiente paso', 'Étape suivante', '下一步'],
  back: ['Return to TAF', 'Volver a TAF', 'Retour à TAF', '返回 TAF'],
  route: ['Choose a route', 'Elegir una ruta', 'Choisir un parcours', '选择路径'],
  guide: ['Guide', 'Guía', 'Guide', '指南'],
  fallback: ['Guide: English / Spanish.', 'Guía: español / inglés.', 'Guide disponible en anglais et en espagnol ; liens en anglais.', '指南提供英文和西班牙文；以下链接为英文。'],
  task: ['What do you want to do?', '¿Qué quieres hacer?', 'Que voulez-vous faire ?', '你想做什么？'],
  model: ['Hugging Face model ID (optional)', 'ID de modelo de Hugging Face (opcional)', 'Identifiant du modèle Hugging Face (facultatif)', 'Hugging Face 模型 ID（可选）'],
  modelSearchNote: ['Click to see popular models or type to search Hugging Face. Results are ordered by downloads, not release date. Selection does not confirm TAF compatibility or start analysis.', 'Pulsa para ver modelos populares o escribe para buscar en Hugging Face. Se ordenan por descargas, no por fecha. Elegir un modelo no confirma su compatibilidad con TAF ni inicia el análisis.', 'Cliquez pour voir les modèles populaires ou saisissez une recherche Hugging Face. Tri par téléchargements, pas par date. Le choix ne confirme pas la compatibilité TAF et ne lance aucune analyse.', '点击查看热门模型，或输入文字搜索 Hugging Face。结果按下载量而非发布日期排序。选择模型不代表 TAF 兼容性确认，也不会启动分析。'],
  modelLoading: ['Searching Hugging Face…', 'Buscando en Hugging Face…', 'Recherche Hugging Face…', '正在搜索 Hugging Face…'],
  modelEmpty: ['No matches. Try another name or type the full ID.', 'Sin coincidencias. Prueba otro nombre o escribe el ID completo.', 'Aucun résultat. Essayez un autre nom ou saisissez l’identifiant complet.', '无匹配结果。请尝试其他名称或输入完整 ID。'],
  modelError: ['Search unavailable. You can still type the full model ID; click the field to retry.', 'Búsqueda no disponible. Puedes escribir el ID completo; pulsa el campo para reintentar.', 'Recherche indisponible. Vous pouvez saisir l’identifiant complet ; cliquez dans le champ pour réessayer.', '搜索暂不可用。仍可输入完整模型 ID；点击输入框重试。'],
  modelRate: ['Hugging Face is limiting requests. Wait a moment or type the full ID.', 'Hugging Face está limitando las consultas. Espera un momento o escribe el ID completo.', 'Hugging Face limite les requêtes. Patientez ou saisissez l’identifiant complet.', 'Hugging Face 正在限制请求。请稍候或输入完整 ID。'],
  modelPrivacy: ['Search text is sent to huggingface.co/api · results cached in this tab for 5 min.', 'La búsqueda se envía a huggingface.co/api · resultados en caché en esta pestaña durante 5 min.', 'La recherche est envoyée à huggingface.co/api · résultats conservés dans cet onglet pendant 5 min.', '搜索文字发送至 huggingface.co/api；结果在当前标签页缓存 5 分钟。'],
  noModel: ['This tool does not need a model ID. Configure its inputs in TAF.', 'Esta herramienta no necesita un ID de modelo. Configura sus entradas en TAF.', 'Cet outil ne nécessite pas d’identifiant de modèle. Configurez ses entrées dans TAF.', '此工具不需要模型 ID。请在 TAF 中配置输入。'],
  open: ['Open the tool', 'Abrir la herramienta', 'Ouvrir l’outil', '打开工具'],
  demo: ['Try an example', 'Probar un ejemplo', 'Essayer un exemple', '试用示例'],
  demoNote: ['Example prepared. You choose when to open TAF; nothing has been measured.', 'Ejemplo preparado. Tú decides cuándo abrir TAF; no se ha medido nada.', 'Exemple préparé. Vous choisissez quand ouvrir TAF ; aucune mesure effectuée.', '示例已准备好。由你决定何时打开 TAF；尚未进行任何测量。'],
  note: ['Choose a task, read why it fits, then open TAF. The model ID only prefills the form; analysis starts when you request it.', 'Elige una tarea, lee para qué sirve y abre TAF. El ID solo rellena el formulario; el análisis empieza cuando tú lo pides.', 'Choisissez une tâche, lisez son objectif, puis ouvrez TAF. L’identifiant préremplit le formulaire ; vous lancez l’analyse.', '选择任务，了解用途，然后打开 TAF。模型 ID 仅预填表单；分析由你主动启动。'],
  invalid: ['Use a model name or owner/model; URLs and local paths are not accepted here.', 'Usa un nombre de modelo o autor/modelo; aquí no se aceptan URL ni rutas locales.', 'Utilisez un nom ou auteur/modèle ; les URL et chemins locaux ne sont pas acceptés ici.', '请使用模型名称或 owner/model；此处不接受网址或本地路径。'],
  snapshot: ['Value carried from TAF, not recalculated by this page.', 'Valor recibido de TAF, no recalculado por esta página.', 'Valeur transmise par TAF, non recalculée sur cette page.', '此值由 TAF 传入，本页未重新计算。'],
  returnNote: ['Returning opens a prepared form. Keep the original TAF tab to retain its full results.', 'Volver abre el formulario preparado. Conserva la pestaña original de TAF para mantener sus resultados completos.', 'Le retour ouvre un formulaire préparé. Gardez l’onglet TAF d’origine pour conserver les résultats complets.', '返回将打开预填表单。请保留原始 TAF 标签页，以保留完整结果。'],
  predicted: ['Configuration-based estimate', 'Estimación desde la configuración', 'Estimation à partir de la configuration', '基于配置的估计'],
  measured: ['Imported measurement; check its protocol', 'Medición importada; revisa su protocolo', 'Mesure importée ; vérifiez son protocole', '导入的测量值；请检查其协议'],
  mismatch: ['These measurement protocols differ. Read R4 before interpreting the difference as a model effect.', 'Los protocolos de estas mediciones difieren. Lee R4 antes de atribuir la diferencia al modelo.', 'Les protocoles de mesure diffèrent. Lisez R4 avant d’attribuer l’écart au modèle.', '这些测量协议不同。将差异归因于模型之前，请先阅读 R4。'],
  help: ['Every mode offers a reading route. In Profile and Prediction vs Reality, choose a metric to carry its value and source into the guide. The guide explains it and links back to TAF. Reading routes do not validate predictions. FR/ZH readers receive English chapter links.', 'Cada modo ofrece una ruta de lectura. En Profile y Prediction vs Reality puedes elegir una métrica y llevar su valor y procedencia a la guía. Allí se explica y puedes volver a TAF. Las rutas no validan predicciones. Los lectores FR/ZH reciben enlaces a capítulos en inglés.', 'Chaque mode propose un parcours de lecture. Dans Profile et Prediction vs Reality, choisissez une métrique pour transmettre sa valeur et sa provenance au guide, puis revenir à TAF. Ces parcours ne valident pas les prédictions. Les liens FR/ZH ouvrent les chapitres anglais.', '每个模式都有阅读路径。在 Profile 和 Prediction vs Reality 中，可选择指标，将其数值及来源带入指南，再返回 TAF。阅读路径不验证预测。FR/ZH 的章节链接使用英文。'],
};
export function local(key, lang = 'en') { return words[key][Math.max(0, languages.indexOf(lang))]; }
export function guideLanguage(lang) { return lang === 'es' ? 'es' : 'en'; }
export const topics = {
  gamma: {
    label: ['γ: attention decay', 'γ: decaimiento de atención', 'γ : décroissance de l’attention', 'γ：注意力衰减'],
    text: ['A fitted γ describes a distance profile for a specific sample, layer, head and protocol. A RoPE-based γ is a theoretical baseline, not that measurement. Entropy alone cannot determine the distance slope.', 'Una γ ajustada describe un perfil por distancia para una muestra, capa, cabeza y protocolo concretos. La γ desde RoPE es una referencia teórica, no esa medición. La entropía por sí sola no determina la pendiente por distancia.', 'Un γ ajusté décrit un profil selon la distance pour un échantillon, une couche, une tête et un protocole précis. Le γ issu de RoPE est une référence théorique, pas cette mesure. L’entropie seule ne détermine pas cette pente.', '拟合的 γ 描述特定样本、层、头及协议下的距离分布。基于 RoPE 的 γ 是理论基线，而非该测量值。仅凭熵无法确定距离斜率。'],
    chapters: ['15-ley-gamma', 'R4-medir-gamma'], next: 'diagnose',
  },
  horizon: {
    label: ['Context horizon', 'Horizonte de contexto', 'Horizon de contexte', '上下文范围'],
    text: ['This derived horizon is not a tested context limit. Substituting γ_Padé returns T_eval by construction. Verify retrieval and reasoning separately with your data.', 'Este horizonte derivado no es un límite de contexto probado. Al sustituir γ_Padé se recupera T_eval por construcción. Verifica recuperación y razonamiento por separado con tus datos.', 'Cet horizon dérivé n’est pas une limite de contexte testée. Substituer γ_Padé redonne T_eval par construction. Vérifiez séparément récupération et raisonnement sur vos données.', '该推导范围不是经过测试的上下文上限。代入 γ_Padé 按构造会得到 T_eval。请用自己的数据分别验证检索与推理。'],
    chapters: ['19-contexto-largo', '40-evaluacion'], next: 'longscore',
  },
  memory: {
    label: ['KV cache and memory', 'Caché KV y memoria', 'Cache KV et mémoire', 'KV 缓存与内存'],
    text: ['KV memory grows with sequence length, batch size, KV heads and precision. A cache estimate is only part of VRAM: weights, temporary buffers and runtime overhead also matter.', 'La memoria KV crece con longitud, lote, cabezas KV y precisión. La estimación de caché es solo parte de la VRAM: también cuentan pesos, buffers temporales y sobrecostes del motor.', 'La mémoire KV dépend de la longueur, du lot, des têtes KV et de la précision. Elle n’est qu’une partie de la VRAM : poids, tampons temporaires et surcoût du moteur comptent aussi.', 'KV 内存随序列长度、批量大小、KV 头数及精度变化。缓存估计只是显存的一部分；权重、临时缓冲区和运行时开销也需计入。'],
    chapters: ['20-kv-cache', '36-serving'], next: 'fitcheck',
  },
  evidence: {
    label: ['Evidence and evaluation', 'Evidencia y evaluación', 'Preuves et évaluation', '证据与评估'],
    text: ['Separate measured scores, uncertainty and heuristic warnings. A contamination prior does not establish training-set overlap; a drift bound does not identify a bug. Compare controlled evaluations before concluding.', 'Separa puntuaciones medidas, incertidumbre y avisos heurísticos. Un prior de contaminación no demuestra solapamiento con el entrenamiento; una cota de drift no identifica un bug. Compara evaluaciones controladas antes de concluir.', 'Distinguez scores mesurés, incertitude et avertissements heuristiques. Un a priori de contamination ne prouve pas un chevauchement avec l’entraînement ; une borne de dérive n’identifie pas un bug. Comparez des évaluations contrôlées.', '区分测量分数、不确定性与启发式警告。污染先验不能证明训练集重叠；漂移界限不能定位错误。请比较受控评估后再下结论。'],
    chapters: ['40-evaluacion', '38-audit'], next: 'pvr',
  },
  depth: {
    label: ['Depth and residual computation', 'Profundidad y cómputo residual', 'Profondeur et calcul résiduel', '深度与残差计算'],
    text: ['Distance decay and computation across layers are different axes. Configuration-derived depth landmarks are hypotheses; they are not measured activations or a Jacobian-lens analysis.', 'El decaimiento por distancia y el cómputo entre capas son ejes distintos. Los hitos de profundidad derivados de la configuración son hipótesis; no son activaciones medidas ni un análisis con lente Jacobiana.', 'La décroissance avec la distance et le calcul entre couches sont deux axes distincts. Les repères de profondeur issus de la configuration sont des hypothèses, pas des activations mesurées ni une analyse par lentille jacobienne.', '距离衰减与跨层计算是不同维度。基于配置的深度标记属于假设，并非测得的激活或雅可比透镜分析。'],
    chapters: ['09-bloque', '42-workspace'], next: 'depth',
  },
  phase: {
    label: ['Phase diagram and susceptibility', 'Diagrama de fases y susceptibilidad', 'Diagramme de phases et susceptibilité', '相图与敏感度'],
    text: ['The phase interpretation belongs to an idealized distance model. χ = 1/(1−γ) is singular at γ=1; a predicted γ does not prove a physical transition in a trained model. The atlas contains stored measurements, not a new forward pass.', 'La interpretación de fases pertenece a un modelo idealizado por distancia. χ = 1/(1−γ) es singular en γ=1; una γ predicha no demuestra una transición física en un modelo entrenado. El atlas contiene mediciones almacenadas, no una nueva inferencia.', 'Les phases relèvent d’un modèle idéalisé selon la distance. χ = 1/(1−γ) est singulier à γ=1 ; un γ prédit ne prouve pas une transition physique. L’atlas contient des mesures enregistrées, pas une nouvelle inférence.', '相位解释属于理想化距离模型。χ = 1/(1−γ) 在 γ=1 处奇异；预测 γ 不能证明已训练模型发生物理相变。图谱包含已有测量，并非新执行的推理。'],
    chapters: ['21-fases', '16-atlas'], next: 'phase',
  },
  quant: {
    label: ['Quantization', 'Cuantización', 'Quantification', '量化'],
    text: ['Weight precision affects storage and numerical error; it does not specify KV-cache precision. Predicted quality shifts need validation for the actual model, quantizer, tasks and runtime.', 'La precisión de pesos afecta al almacenamiento y al error numérico; no fija la precisión de la caché KV. Los cambios de calidad predichos requieren validación con el modelo, cuantizador, tareas y motor reales.', 'La précision des poids affecte stockage et erreur numérique ; elle ne fixe pas celle du cache KV. Validez les variations de qualité prédites avec le modèle, le quantificateur, les tâches et le moteur réels.', '权重精度影响存储和数值误差，但不指定 KV 缓存精度。预测的质量变化需用实际模型、量化器、任务和运行时验证。'],
    chapters: ['35-compresion', '36-serving'], next: 'quant',
  },
  setup: {
    label: ['Prompts and evaluation setup', 'Prompts y configuración de evaluación', 'Prompts et configuration d’évaluation', '提示与评估配置'],
    text: ['Keep chat template, tokenization, generation settings and scoring consistent. A config check can find mismatches; it cannot replace testing the complete evaluation pipeline.', 'Mantén consistentes plantilla de chat, tokenización, generación y puntuación. Revisar la configuración ayuda a detectar discrepancias; no sustituye probar el proceso completo de evaluación.', 'Gardez cohérents le format de chat, la tokenisation, la génération et le calcul des scores. Vérifier la configuration ne remplace pas un test de toute la chaîne d’évaluation.', '保持聊天模板、分词、生成设置和评分一致。配置检查可以发现不一致，但不能替代完整评估流程测试。'],
    chapters: ['30-prompting', '40-evaluacion'], next: 'template',
  },
  adaptation: {
    label: ['Adapters and training', 'Adaptadores y entrenamiento', 'Adaptateurs et entraînement', '适配器与训练'],
    text: ['Compatibility and training choices are separate from measured quality. Rank, target modules and base model matter, but forgetting must be evaluated on retained tasks.', 'Compatibilidad y decisiones de entrenamiento son distintas de la calidad medida. Importan rango, módulos objetivo y modelo base; el olvido debe evaluarse en las tareas que quieras conservar.', 'Compatibilité et choix d’entraînement ne sont pas la qualité mesurée. Rang, modules cibles et modèle de base comptent ; évaluez l’oubli sur les tâches à conserver.', '兼容性和训练选择不同于实测质量。秩、目标模块和基础模型很重要；遗忘需在需要保留的任务上评估。'],
    chapters: ['28-peft', '11-entrenamiento'], next: 'adapter',
  },
  architecture: {
    label: ['Architecture and mechanisms', 'Arquitectura y mecanismos', 'Architecture et mécanismes', '架构与机制'],
    text: ['Identify the mechanism before applying a formula: dense attention, sliding windows, recurrent state and external memory have different constraints. A model name alone is insufficient.', 'Identifica el mecanismo antes de aplicar una fórmula: atención densa, ventanas, estado recurrente y memoria externa tienen restricciones distintas. El nombre del modelo no basta.', 'Identifiez le mécanisme avant d’appliquer une formule : attention dense, fenêtres, état récurrent et mémoire externe ont des contraintes distinctes. Le nom du modèle ne suffit pas.', '应用公式前先识别机制：稠密注意力、滑动窗口、循环状态和外部记忆具有不同约束。仅靠模型名称并不够。'],
    chapters: ['18-taxonomia', '32-agentes'], next: 'memreal',
  },
  tokens: {
    label: ['Tokens and decoding', 'Tokens y decodificación', 'Tokens et décodage', '词元与解码'],
    text: ['Token counts depend on tokenizer and language. Speculative decoding additionally needs compatible models and runtime support; configuration compatibility alone cannot promise a speedup.', 'El número de tokens depende del tokenizador y del idioma. La decodificación especulativa requiere modelos compatibles y soporte del motor; la compatibilidad de configuración no promete aceleración.', 'Le nombre de tokens dépend du tokenizer et de la langue. Le décodage spéculatif exige aussi des modèles compatibles et le support du moteur ; la configuration ne garantit pas une accélération.', '词元数量取决于分词器和语言。推测解码还需要兼容的模型及运行时支持；配置兼容不保证加速。'],
    chapters: ['02-tokens', '12-inferencia'], next: 'tax',
  },
};
export function topicText(topic, field, lang) { return topics[topic][field][Math.max(0, languages.indexOf(lang))]; }
export const modeTopics = {
  profile: ['gamma','horizon','memory','phase'], compare: ['gamma','evidence'], inspector: ['architecture','gamma'],
  ask: ['evidence','gamma'], recipe: ['horizon','memory','adaptation'], diagnose: ['gamma','evidence'],
  pvr: ['gamma','evidence'], phase: ['phase','gamma'], depth: ['depth','evidence'], unmask: ['horizon','architecture'],
  memreal: ['architecture','memory'], adapter: ['adaptation','evidence'], template: ['setup','tokens'],
  arena: ['evidence'], contam: ['evidence'], quant: ['quant','memory'], drift: ['evidence','setup'],
  niah: ['horizon','evidence'], saturation: ['evidence'], cot: ['setup','evidence'], peft: ['adaptation'],
  cache: ['memory','setup'], speculative: ['tokens','memory'], tax: ['tokens'], longscore: ['horizon','evidence'],
  hub: ['architecture','evidence'], research: ['evidence','architecture'], yarn: ['horizon','gamma'], gguf: ['quant','memory'],
  launch: ['memory','quant'], fitcheck: ['memory','quant'],
};
export const modelInputs = {profile:'profile-hf-id',diagnose:'diag-model',pvr:'pvr-id',depth:'depth-hf-id',recipe:'hf-id',unmask:'unmask-id',memreal:'memreal-id',template:'template-id',quant:'quant-id',niah:'niah-id',yarn:'yarn-model',launch:'launch-model',fitcheck:'fitcheck-model',gguf:'gguf-repo',adapter:'adapter-id',longscore:'longscore-input',speculative:'spec-target-id'};
export const metrics = {
  gamma_pade: {label:'γ_Padé',topic:'gamma',kind:'predicted'},
  gamma_decomposed: {label:'γ_decomposed',topic:'gamma',kind:'predicted'},
  gamma_obs: {label:'γ_obs',topic:'gamma',kind:'measured'},
  gamma_obs_a: {label:'γ_obs (A)',topic:'gamma',kind:'measured'},
  gamma_obs_b: {label:'γ_obs (B)',topic:'gamma',kind:'measured'},
  d_horizon: {label:'d_horizon',topic:'horizon',kind:'predicted'},
  L_NIAH_ceiling: {label:'L_NIAH',topic:'horizon',kind:'predicted'},
  chi_susceptibility: {label:'χ',topic:'phase',kind:'predicted'},
  kv_memory_per_request_GB: {label:'KV (GB, BF16)',topic:'memory',kind:'predicted'},
};
export function validModel(value) {
  return typeof value === 'string' && value.length <= 200 && /^[A-Za-z0-9][A-Za-z0-9_.-]*(?:\/[A-Za-z0-9][A-Za-z0-9_.-]*)?$/.test(value) && !value.includes('..');
}
export function readContext(search) {
  const q = new URLSearchParams(search);
  const mode = Object.hasOwn(modeTopics,q.get('mode')) ? q.get('mode') : null;
  const topic = Object.hasOwn(topics,q.get('topic')) ? q.get('topic') : mode ? modeTopics[mode][0] : 'gamma';
  const metric = Object.hasOwn(metrics,q.get('metric')) ? q.get('metric') : null;
  const raw = q.get('value');
  const value = raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
  return {mode,topic:metric && value !== null ? metrics[metric].topic : topic,metric:metric && value !== null ? metric : null,value,
    model:validModel(q.get('model')) ? q.get('model') : '',lang:languages.includes(q.get('lang')) ? q.get('lang') : null,
    app:q.get('app')==='hf'?'hf':'github'};
}
export function tafLink({mode='profile',model='',lang='en',demo=false,app='github'}={}, base=app==='hf'?HF_BASE:TAF_BASE) {
  const url = new URL(base);
  url.search=''; url.hash='';
  url.searchParams.set('mode',Object.hasOwn(modeTopics,mode)?mode:'profile');
  if(validModel(model)) url.searchParams.set('model',model);
  if(languages.includes(lang)) url.searchParams.set('lang',lang);
  if(demo) url.searchParams.set('demo',mode);
  return url.href;
}
export function guideLink(topic, chapterIndex=0, context={}) {
  const route=topics[topic] || topics.gamma;
  const url=new URL(`${guideLanguage(context.lang)}/chapters/${route.chapters[chapterIndex] || route.chapters[0]}.html`,GUIDE_BASE);
  url.searchParams.set('topic',Object.hasOwn(topics,topic)?topic:'gamma');
  if(Object.hasOwn(modeTopics,context.mode)) url.searchParams.set('mode',context.mode);
  if(validModel(context.model)) url.searchParams.set('model',context.model);
  if(languages.includes(context.lang)) url.searchParams.set('lang',context.lang);
  if(context.app==='hf') url.searchParams.set('app','hf');
  if(Object.hasOwn(metrics,context.metric) && typeof context.value==='number' && Number.isFinite(context.value)) {
    url.searchParams.set('metric',context.metric); url.searchParams.set('value',context.value);
  }
  return url.href;
}
function node(tag,text) { const el=document.createElement(tag); if(text) el.textContent=text; return el; }
function link(text,href) { const a=node('a',text); a.href=href; return a; }
export function explanation(host,topic,context={},lang='en') {
  host.replaceChildren();
  if(context.metric && metrics[context.metric] && Number.isFinite(context.value)) {
    host.append(node('p',`${metrics[context.metric].label} = ${context.value.toLocaleString(lang,{maximumSignificantDigits:7})} · ${local(metrics[context.metric].kind,lang)}`));
  }
  host.append(node('p',topicText(topic,'text',lang)));
  const list=node('ol');
  topics[topic].chapters.forEach((chapter,i)=>{
    const li=node('li');
    const a=link(chapterTitles[chapter]?.[guideLanguage(lang)] || local('read',lang),guideLink(topic,i,{...context,lang}));
    a.target='_blank'; a.rel='noopener';
    li.append(a);
    list.append(li);
  });
  host.append(list);
  if(!['en','es'].includes(lang)) host.append(node('small',local('fallback',lang)));
}
export const tasks = [
  ['profile','gamma',['Understand a model profile','Entender el perfil de un modelo','Comprendre le profil d’un modèle','理解模型概况']],
  ['diagnose','gamma',['Measure attention and entropy','Medir atención y entropía','Mesurer attention et entropie','测量注意力与熵']],
  ['pvr','evidence',['Compare predictions and measurements','Comparar predicciones y mediciones','Comparer prédictions et mesures','比较预测与测量']],
  ['fitcheck','memory',['Estimate GPU memory','Estimar memoria de GPU','Estimer la mémoire GPU','估计 GPU 显存']],
  ['longscore','horizon',['Check long-context evidence','Consultar evidencia de contexto largo','Consulter les preuves sur le contexte long','查看长上下文证据']],
  ['template','setup',['Prepare an evaluation','Preparar una evaluación','Préparer une évaluation','准备评估']],
  ['contam','evidence',['Review benchmark risks','Revisar riesgos de benchmarks','Examiner les risques des benchmarks','检查基准测试风险']],
  ['depth','depth',['Explore the depth axis','Explorar el eje de profundidad','Explorer l’axe de profondeur','探索深度维度']],
  ['research','evidence',['Explore research and experiments','Explorar estudios y experimentos','Explorer études et expériences','探索研究与实验']],
];
// Progressive enhancement: the guide keeps its static links if JavaScript is disabled.
export function initGuidePage() {
  const lang=guideLanguage(document.documentElement.lang);
  const ctx=readContext(location.search);
  const main=document.querySelector('main');
  if(main && new URLSearchParams(location.search).has('topic') && ctx.mode) {
    const panel=node('aside'); panel.className='taf-guide-context'; panel.id='taf-reading-context';
    panel.append(node('h2',local('title',lang)));
    const body=node('div'); explanation(body,ctx.topic,ctx,lang); panel.append(body);
    if(ctx.metric) panel.append(node('small',local('snapshot',lang)));
    panel.append(node('p')); panel.lastChild.append(link(local('back',lang),tafLink({...ctx,lang:ctx.lang || lang})));
    panel.append(node('p',local('returnNote',lang)));
    const routeURL=new URL(`${lang}/chapters/R5-tafagent.html`,GUIDE_BASE);
    if(ctx.model) routeURL.searchParams.set('model',ctx.model);
    if(ctx.app==='hf') routeURL.searchParams.set('app','hf');
    routeURL.hash='taf-routes'; panel.append(link(local('route',lang),routeURL.href));
    main.prepend(panel);
  }
  if(main && !document.querySelector('[data-taf-selector]') && !document.getElementById('taf-reading-context')) {
    const slug=location.pathname.split('/').pop().replace(/\.html$/,'');
    const topic=Object.keys(topics).find(key=>topics[key].chapters.includes(slug));
    const panel=node('aside'); panel.className='taf-guide-context';
    panel.append(node('strong',local('next',lang)));
    if(topic) {
      panel.append(node('p',topicText(topic,'text',lang)));
      panel.append(link(`${local('open',lang)} · ${modeNames[topics[topic].next]}`,tafLink({mode:topics[topic].next,lang,app:ctx.app})));
    }
    const routes=new URL(`${lang}/chapters/R5-tafagent.html#taf-routes`,GUIDE_BASE);
    panel.append(node('p')); panel.lastChild.append(link(local('route',lang),routes.href));
    main.append(panel);
  }
  document.querySelectorAll('[data-taf-selector]').forEach(host=>{
    const section=node('section'); section.className='taf-guide-context';
    const label=node('label',local('task',lang));
    const select=node('select'); select.id='taf-route-task'; label.htmlFor=select.id;
    tasks.forEach(([mode,,labels])=>{ const opt=node('option',labels[languages.indexOf(lang)]); opt.value=mode; select.append(opt); });
    if(tasks.some(t=>t[0]===ctx.mode)) select.value=ctx.mode;
    const modelLabel=node('label',local('model',lang)); const model=node('input'); model.id='taf-route-model'; modelLabel.htmlFor=model.id; model.type='text'; model.maxLength=200; model.value=ctx.model; model.placeholder='EleutherAI/pythia-70m';
    const info=node('div'),actions=node('p'),message=node('p'); message.setAttribute('role','status');
    const open=link(local('open',lang),TAF_BASE); const demo=node('button',local('demo',lang)); demo.type='button';
    actions.append(open,document.createTextNode(' · '),demo);
    const update=()=>{
      const task=tasks.find(t=>t[0]===select.value);
      model.disabled=!Object.hasOwn(modelInputs,task[0]);
      const id=model.disabled?'':model.value.trim();
      const valid=!id || validModel(id); model.setCustomValidity(valid?'':local('invalid',lang));
      explanation(info,task[1],{mode:task[0],model:valid?id:'',lang},lang);
      if(valid) open.href=tafLink({mode:task[0],model:id,lang,app:ctx.app}); else open.removeAttribute('href');
      open.setAttribute('aria-disabled',String(!valid)); message.textContent=valid?(model.disabled?local('noModel',lang):''):local('invalid',lang);
    };
    select.addEventListener('change',update); model.addEventListener('input',update);
    demo.addEventListener('click',()=>{select.value='diagnose'; model.value='EleutherAI/pythia-70m'; update(); message.textContent=local('demoNote',lang);});
    const searchNote=node('small',`${local('modelSearchNote',lang)} ${local('modelPrivacy',lang)}`);
    searchNote.id='taf-route-model-help'; model.setAttribute('aria-describedby',searchNote.id);
    section.append(node('p',local('note',lang)),label,select,modelLabel,model,searchNote,info,actions,message);
    host.append(section); update();
    if (!document.querySelector('link[data-guide-hf]')) {
      const css=node('link'); css.rel='stylesheet'; css.href=new URL('./guide_hf.css',import.meta.url).href;
      css.dataset.guideHf=''; document.head.append(css);
    }
    attachHfAutocomplete(model,{onSelect:update,dropdownClass:'hf-guide-dropdown',messages:{
      loading:local('modelLoading',lang),empty:local('modelEmpty',lang),error:local('modelError',lang),
      rateLimited:local('modelRate',lang),privacy:local('modelPrivacy',lang),
    }});
  });
}
