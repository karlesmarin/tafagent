# Auditoría de los módulos para «Resolver mi problema»

Revisión de interacción de demos, 25-10-2026: 35 recorridos en EN/ES/FR/ZH.
[Detalle, incidencias del entorno y alcance](demo-validation-2026-10-25.md).
No supone validación empírica de las heurísticas ni disponibilidad futura.

## Memoria antes/después — 25 de octubre

Dos archivos declarados: identidad/carga compatibles, mismo motor/versión/etiqueta
de dispositivo, fechas crecientes y confirmación explícita. Diferencia descriptiva
en GiB y porcentaje; cero inicial deja porcentaje indefinido. No acredita equipo
físico, causalidad, calidad ni reparación. Caso privado v3 conserva ambos; informe
reducido excluye los dos registros crudos. Lectura v1/v2 preservada. No incorpora
resultados de las otras herramientas ni ejecuta GPU. Ver memory-measurement.md.

## Importación de mediciones de memoria — 25 de octubre

Puente limitado a memoria: JSON validado, previsualización, coincidencias declaradas y bloqueo por datos ausentes/diferentes. El auxiliar PyTorch mide contadores al ejecutarlo el usuario en su entorno; las pruebas usan contadores falsos, no GPU real. Archivo privado v2 con una sola medición y v3 con pareja actual o inicial; lector compatible con v1. Metadatos del entorno excluidos del informe reducido. Ver memory-measurement.md.



## Casos privados recuperables — 25 de octubre

Las nueve rutas permiten guardar un archivo privado y abrirlo tras previsualizar
ruta/fecha y confirmar la sustitución. Se conservan entradas iniciales/actuales,
metadatos, marcas, observaciones y respuesta final. Se recalcula localmente;
los resultados guardados no se aceptan como evidencia. El archivo no está cifrado
y puede contener código/textos privados, con aviso antes de descargarlo.
El informe reducido sigue separado y no recupera los datos que omite.
La importación marca la procedencia como no verificada, conserva ejemplos como
ejemplos y no consulta HF. El límite es 4 MiB; archivos inválidos no alteran el
caso abierto. Los planes incompatibles pierden su seguimiento obsoleto.
Interfaz/ayuda EN/ES/FR/ZH y guía ES/EN actualizadas. Ver resolver_session.js.


## Memoria por fases y picos declarados

`resolver_memory.js` convierte GiB/GB/MiB y limita la comparación a picos de
tensores, fase conocida, medición aislada y carga compatible. Carga usa pesos
residentes; prefill/decodificación usan la estimación estable. No calcula la
fragmentación ni verifica una causa. Reservada/dispositivo son solo contexto.
La UI borra medidas obsoletas al cambiar parámetros o aplicar alternativas.
Informe y revisión conservan procedencia no verificada. El quinto ejemplo de
memoria es sintético. Hay 41 prioridades y 33 escenarios seleccionables.

## Seguimiento según observaciones — 25 de octubre

`resolver_observations.js` selecciona el siguiente paso entre 27 resultados
específicos de las nueve rutas, más evidencia no disponible. Son categorías
declaradas por el usuario; no se leen logs ni se ejecutan pruebas. Se conserva un
historial máximo de 12 observaciones, separado del resultado y de las marcas de
progreso. «Sigue fallando» incorpora la última observación; los enlaces a
herramientas preparan su catálogo sin ejecutar ni importar resultados.
Los informes incluyen `observations` v1, sin texto libre. Mismos límites de
reinicio que el progreso. Interfaz, ayuda y demo EN/ES/FR/ZH; guía ES/EN.
La demo de Fit Check carga una configuración guardada y exige un presupuesto
visible antes de terminar, sin consulta HF ni dependencia de Pyodide.



Revisión de implementación: 25 de octubre de 2026. Esta auditoría describe el
código y sus datos incluidos; no constituye una nueva validación experimental de
las fórmulas. La interfaz conserva EN/ES/FR/ZH y los enlaces a la guía ES/EN.

## Qué se ha integrado

El resolutor contiene nueve comprobaciones directas, siete familias de síntomas
con veinte situaciones y un selector que conecta los 31 modos. Todas las rutas
explican datos necesarios, alcance y siguiente paso. Las seis nuevas comprobaciones
locales reutilizan funciones existentes; no descargan pesos ni necesitan Pyodide.

Los modos especializados conservan sus propios formularios y requisitos. Abrir
uno o ver su demo no equivale a haber diagnosticado el caso del usuario. Los
errores de acceso y la memoria de entrenamiento distribuido tienen límites
explícitos: no se introducen credenciales ni se aplican presupuestos de inferencia.

## Inventario funcional

Las nueve rutas directas incorporan **Revisar este resultado**. El módulo puro
`resolver_review.js` clasifica la evidencia disponible y reutiliza el siguiente
paso y enlace contextual del resumen. `resolver_review_i18n.js` define fundamento
y límites en EN/ES/FR/ZH; los avisos y el número de campos de protocolo ausentes
proceden del resultado actual. No ejecuta los 31 modos, asigna riesgo ni verifica
de forma independiente una medición. La demo abre el panel y la descarga lo
incluye como `review` versión 1 dentro del informe de caso versión 3.

En PVR, `resolver_protocol.js` reutiliza la detección de contexto y comparación
de protocolos. Enumera 19 condiciones conocidas, sin sus valores, y cuenta los
campos personalizados sin mostrar sus nombres. Prioriza contexto de A, contexto
de B, diferencias, documentación pendiente y repetición controlada, por ese orden.
No valida la exactitud de los metadatos ni modifica los informes originales.

Memoria, plantillas y adaptadores incorporan `resolver_checks.js`: 17 prioridades
con tres pasos ordenados, calculados desde el resultado actual. Los diez escenarios
de ejemplo son opcionales y están etiquetados; no se ejecutan modelos. El resumen,
la revisión, el seguimiento y el informe comparten el mismo plan. En adaptadores,
la evidencia exportada son categorías de base/objetivos, no valores privados.
Los métodos de soft prompts no reciben el aviso de objetivos LoRA ausentes.

El mismo seguimiento cubre caché de prompts y Drift: cinco prioridades y cinco
ejemplos adicionales por ruta, 27 prioridades y veinte ejemplos en total. Caché
clasifica la relación textual sin medir tokens ni reutilización. Drift prioriza
plantillas desconocidas/diferentes y ajustes cambiados antes de la banda
descriptiva; puntuaciones próximas no prueban equivalencia ni ausencia de errores.
Solo se exportan categorías y nombres de ajustes, no los prompts originales.

Arquitectura, JSON y código PEFT completan los pasos en ocho rutas: 41 prioridades
y 33 escenarios seleccionables. Atención conserva el protocolo específico. Los
ejemplos alternativos de arquitectura eliminan ID/revisión/fuentes anteriores y
usan configuraciones sintéticas. JSON no exige explicación ni valida todo un
esquema. PEFT ordena los avisos existentes sin convertir regex o convenciones de
escala en pruebas causales. Los capítulos 10/28/30 explican estos límites.

`resolver_progress.js` añade seguimiento declarado a las nueve rutas. Reutiliza
los pasos existentes y selecciona primero discrepancias, luego bloqueos y después
pendientes. No altera resultados ni condiciones del protocolo. Los ejemplos
simulan marcas y las exportan como ilustrativas; las marcas reales se etiquetan
como declaraciones del usuario, nunca pruebas verificadas. Se descartan al
cambiar datos o recalcular. No hay persistencia automática; Guardar caso privado
permite conservarlas y recuperarlas explícitamente.

| Modo | Implementación principal | Datos y operación | Uso en el resolutor y límite |
|---|---|---|---|
| Profile | `main.js`, `python/taf_browser.py:profile_model` | Configuración HF → tarjeta X-2/X-19/X-1/X-3/X-5 | Formulario especializado. Son fórmulas; no inferencia ni calidad medida. Pyodide. |
| Compare | `main.js`, `python/taf_browser.py:compare_models` | Dos configuraciones → resultados comparables de recetas | Especializado. Mismos supuestos; no clasificación empírica de capacidades. |
| Inspector | `main.js`, `model_compatibility.js` | config.json local → geometría y aplicabilidad | Especializado. No inventar campos ausentes ni aceptar geometría densa para toda arquitectura. |
| Ask | `main.js:routeQuestion` | Pregunta → parámetros/recetas mediante WebLLM | Especializado. Requiere WebGPU y descarga; revisar lo extraído. No usarlo como extracción factual verificada. |
| Recipe | `python/taf_browser.py:run_recipe_*` | Parámetros explícitos → cadenas de fórmulas | Especializado. X-21 retirada; X-22/X-23 exploratorias. Precios/MFU son supuestos, no cotizaciones. |
| Diagnose CLI | `main.js:buildDiagnoseCommand`, `cli/diagnose_model.py` | Protocolo/modelo → comando para medir | Especializado. La medición ocurre al ejecutar Python con pesos, no al generar el comando. |
| Prediction vs Reality | `prediction_reality.js` | JSON medido → gamma, referencia RoPE, diferencias/protocolo | **Directo**. Rechaza gamma no numérica; no compara con contexto contradictorio/variable. Tolerancia descriptiva. |
| Phase Diagram | `phase_diagram.js:initPhaseDiagram` | Atlas incluido → gráfico con superposición Padé | Especializado. No ejecuta un mini-forward; no mide un modelo subido. |
| Depth map | `depth.js:runDepth`, `gammaGeom`, `lcritFrac` | Geometría/atlas → referencias de profundidad y delta | Especializado. No mide transporte residual/J-lens ni valida un corte óptimo. Correspondencia del atlas por nombre requiere cautela. |
| SWA Unmasker | `swa_unmasker.js:unmaskConfig` | Ventana declarada → advertencia de contexto | Especializado. `2 × window` es heurística; comprobar si la ventana se usa realmente. |
| Memory Reality | `memory_reality.js:classifyMemory` | Configuración → atención/estado/memoria, híbridos y límites | **Directo** junto a `inspectModel`. Clasificar no certifica soporte del motor ni recuperación. |
| Adapter Reality | `adapter_reality.js:parseAdapterConfig`, `compatChecks` | adapter_config.json/base → base, objetivos, escala | **Directo**. Coincidencia de familia no es base exacta; la evidencia bibliográfica de olvido no mide este adaptador. |
| Chat-template Sniffer | `chat_template_sniffer.js:sniffChatTemplate` | Archivos de plantilla → presencia y marcadores | **Directo** con normalización de formatos. No ejecuta Jinja ni verifica aplicación real; ausencia en archivos consultados no prueba ausencia total. |
| Arena Elo | `arena_ci.js:computeArenaCI` | Votos por parejas → Bradley–Terry y bootstrap | Especializado. Revisar independencia, grafo conectado y CSV. Solapamiento de intervalos no demuestra igualdad. |
| Contamination | `contamination_prior.js:computeContaminationPrior` | Fechas/procedencia → factores de riesgo | Especializado. No inspecciona corpus de entrenamiento; puntuación no calibrada como probabilidad. |
| Quant | `quant_regime.js:predictQuantShift` | Configuración/esquema → gamma y ΔPPL heurísticas | Especializado. No diagnosticar pérdida real de calidad con estas cifras; validar kernels y tareas. |
| Drift | `cross_drift.js:computeDriftBound` | Dos puntuaciones comparables, motor, precisión, lote, plantilla | **Directo**. Bandas prefijadas, no intervalos estadísticos. Traduce códigos heredados `bug*` como solicitud de revisión, no causa demostrada. |
| NIAH→Reason | `niah_reasoning.js:predictNIAHReasoning`, `calibrateNIAH` | Longitud/configuración → curvas heurísticas y referencias RULER | Especializado. El máximo configurado no verifica longitud entrenada; las divisiones por tarea derivadas no son nuevas mediciones. |
| Saturation | `saturation_detector.js:classifyBenchmark` | Instantáneas incluidas/en vivo → indicadores de techo/concentración | Especializado. Umbrales heurísticos; distinguir fecha/fuente y no declarar inútil todo benchmark. |
| JSON CoT | `json_cot_linter.js:lintJsonCot`, `reorderJsonText` | Esquema/objeto → orden por nombres reconocidos | **Directo**. Reordenación opcional preserva propiedades y obligatoriedad. No valida todo JSON Schema ni garantiza razonamiento. |
| PEFT linter | `peft_anti_pattern.js:lintPeftCode` | Código → carga, orden QLoRA, objetivos y alpha/r | **Directo**. Regex, no AST ni ejecución; alias/control de flujo pueden escapar. alpha/r es informativo. |
| Prompt Cache | `prompt_cache_diff.js:longestCommonPrefix` | Dos textos → prefijo exacto en unidades UTF-16 | **Directo**, sin precios. La tabla del modo especializado está fechada; caché real depende de tokens y proveedor. |
| Spec Decode | `spec_decode_compat.js:checkCompatibility`, `compareVocabs` | Dos tokenizadores/configs → compatibilidad convencional por IDs | Especializado. No cubre todos los métodos asistidos ni predice aceleración; revisar procedencia/mirrors y correspondencia exacta. |
| Token Tax | `tokenizer_tax.js:tokenizeWithModel` | Texto/tokenizador → recuento real | Especializado. Descarga tokenizador; no demuestra calidad por idioma ni facturación efectiva. |
| LongScore | `longscore.js:lookup` | Identidad del modelo → instantáneas RULER/HELMET | Especializado. Verificar identidad exacta y protocolo; no hay predicción para un modelo ausente ni benchmark en vivo. |
| Solutions Hub | `solutions_hub.js:searchEntries` | Necesidad → recursos curados | Especializado. Navegación; no vigilancia ni respuesta a discusiones. |
| Research | `research_studies.js:filterResearchStudies` | Tema/estado → estudios y laboratorios ilustrativos | Especializado. Una publicación no valida automáticamente TAF; demos no reproducen entrenamientos. |
| YaRN | `yarn_planner.js:planExtension` | RoPE/longitud objetivo → configuración candidata | Especializado. No entrena ni valida calidad en contexto largo. |
| GGUF | `gguf_bridge.js:fetchGgufMetadata`, `analyzeGguf` | Cabecera por rangos HTTP → metadatos/geometría/cuantización | Especializado. Puede faltar información; no ejecuta pesos ni certifica calidad. |
| Launch | `launch_flags.js:planLaunch`, `launchCommands` | Geometría/VRAM/motor → presupuesto y comando | Especializado. No ejecuta comandos ni verifica cada versión de motor; no mide latencia. |
| Fit Check | `fit_check.js:checkFit` | Pesos/VRAM/tokens → pesos + KV + sobrecarga | **Directo** con importación estricta. Una GPU, una secuencia; no mide picos, fragmentación, entrenamiento o reparto. |

## Hallazgos que afectan a las respuestas

1. **Medir y estimar son operaciones diferentes.** Phase Diagram usa el atlas;
   Diagnose genera un comando; PVR analiza un informe ya medido. No deben prometer
   un mini-forward desde cualquier formulario del navegador.
2. **No convertir heurísticas en veredictos causales.** La entropía no determina
   la pendiente por distancia. No se introduce una corrección gamma/nu inventada.
   Drift no prueba un bug; Contamination no prueba filtración; Quant no mide ΔPPL.
3. **Conservar la procedencia.** Una coincidencia aproximada del nombre en atlas,
   LongScore o familias de adaptadores necesita confirmación. Un snapshot no es
   una medición actual del modelo y hardware del usuario.
4. **Preguntar por la etapa y modalidad.** Entrenamiento, inferencia, multi-GPU,
   texto y multimodal tienen presupuestos distintos. La ruta de memoria detiene
   geometrías no soportadas en vez de completar parámetros por intuición.
5. **Exportar solo lo necesario.** Los seis casos locales excluyen código, prompts,
   informes/configuraciones originales y propuestas de sus descargas. Las
   preguntas no salen a un LLM ni a discusiones. No se configura telemetría.

## Correcciones verificadas en las funciones reutilizadas

- JSON: la reordenación ya no pierde claves `required` que no estén en la lista
  sugerida; preserva una propiedad propia llamada `__proto__`.
- Drift: consulta ambas orientaciones de las parejas de motores. Las claves de
  la tabla no estaban ordenadas de forma uniforme y algunas usaban el valor por
  defecto en vez de su contribución declarada.
- PEFT: se verificó con pruebas la detección de alpha/r; su campo original
  `lora_alpha` era correcto y se conserva. No se modifica su fórmula.

## Lo que sigue fuera del alcance

El resolutor no inicia entrenamientos, cambia instalaciones, accede a permisos de
cuenta, certifica kernels, corrige datasets ni responde automáticamente en foros.
Los demás módulos quedan accesibles con su alcance documentado; esta entrega no
reescribe todas sus heurísticas heredadas. Antes de automatizar otras decisiones,
priorizar procedencia exacta de modelos, validación de protocolos, distinción de
ventanas habilitadas y revisión explícita de tablas de precios/umbrales.

Pruebas: `npm test` y `npm run test:resolver`; validación de seis adaptadores,
ramas de síntomas, nueve ejemplos, 31 enlaces de módulos/demos/guía, cuatro
idiomas, privacidad de informes, esquema JSON, entradas inválidas y móvil.
