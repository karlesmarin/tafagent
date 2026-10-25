# TAF ↔ guía: acompañar la interpretación

## Before/After memory — 25 October

R5 ES/EN adds `#sec-resolver-memory-comparison`, linked from the comparison panel.
In-app manual/help use `resolver.comparison_help_summary` in EN/ES/FR/ZH; FR/ZH
link to the English guide. Existing videos do not demonstrate paired reports. The [dated demo audit](demo-validation-2026-10-25.md)
checks existing flows; it does not claim the videos cover the new import/pair UI.

## Memory-file bridge — 25 October

R5 ES/EN includes `#sec-resolver-memory-import` with the import flow, collector usage and limits. The memory result links directly there; in-app manual and feature help use `resolver.measurement_help_summary` in EN/ES/FR/ZH. FR/ZH use the English guide. Earlier videos do not demonstrate file imports.


## Picos por fase

R5, `sec-resolver-memory-peaks`, documenta carga, prefill y decodificación,
unidades, métricas, medición y límites de la comparación. Las fases prefill/decode
y los resultados con pico declarado enlazan a esa sección ES/EN; FR/ZH conservan
la indicación de guía inglesa. Manual y ayuda de TAF están en los cuatro idiomas.


La integración conecta las preguntas del usuario, los resultados y su explicación. No
es un chatbot ni necesita un servicio adicional. Conserva Quarto como generador del
libro y JavaScript como soporte de la interactividad, con enlaces estáticos de respaldo.

## Recorrido del usuario

1. En cualquiera de los 31 modos de TAF, abrir **Entender este resultado** y elegir
   el concepto que interesa. Aparecen una explicación breve, lecturas y un siguiente paso.
2. En **Profile**, los botones 📖 de las seis métricas principales seleccionan la
   explicación correspondiente. En **Prediction vs Reality**, la γ importada se ofrece
   después de cargar el resultado. Si difieren los protocolos, la explicación lo señala.
3. El enlace abre la guía en otra pestaña y conserva la pestaña del diagnóstico.
   La guía recibe una instantánea de la métrica, muestra su procedencia y ofrece
   **Volver a TAF** o **Elegir otra ruta**. Volver prepara el formulario; no restaura una
   sesión completa ni vuelve a ejecutar el análisis.
4. Desde orientación, evaluación y glosario se llega al selector de R5. Los capítulos
   también ofrecen un siguiente paso. El selector permite elegir tarea y modelo.
5. La demo `?mode=profile&demo=guide` enseña las rutas sin esperar a Pyodide ni ejecutar
   un modelo. La demo del selector prepara una sonda CLI con Pythia-70m sin ejecutarla.

## Límites científicos y privacidad

### Resolutor y revisión de evidencia (25 de octubre de 2026)

**Resolver mi problema** empieza por siete familias de síntomas y veinte
situaciones. Ofrece nueve comprobaciones directas y un selector de los 31 modos,
con requisitos, límites, demos y lecturas. No hace falta conocer el nombre del
módulo para empezar; los casos no cubiertos explican su límite.

Cada resultado directo incluye un resumen y **Revisar este resultado**, un panel
opcional con procedencia, fundamento, lo pendiente de verificar y siguiente
comprobación. El enlace contextual utiliza la misma selección de capítulo que
el resumen; conserva el idioma ES/EN y el aviso de lectura inglesa para FR/ZH.
El panel se recalcula al cambiar el resultado y desaparece al modificar entradas.
No transmite a la guía el informe, los prompts ni el código pegado.
El contexto añade una ruta `resolve` de la lista admitida, coherente con el modo,
y `app=hf` cuando corresponde. **Volver al formulario de este problema** conserva
la ruta, idioma de TAF y alojamiento original. No ejecuta una comprobación ni
restaura datos pegados; la pestaña original conserva el resultado completo.
Las rutas desconocidas o incompatibles con el modo se ignoran. Los ejemplos y
las rutas locales no transportan un ID de modelo ajeno al caso.

En la ruta de atención, **Ver detalles del protocolo** enumera condiciones
ausentes o diferentes sin transmitir sus valores a la guía. El siguiente paso
se prioriza según contexto, referencia y documentación. R4 explica cómo recuperar
las condiciones de la ejecución real y R5 cómo abrir el panel y su demo. Los
enlaces conservan el regreso al mismo formulario, sin restaurar datos pegados.

Ocho rutas (memoria, plantillas, arquitectura, JSON, código PEFT, adaptadores,
caché y diferencias de evaluación) añaden tres pasos según los hallazgos: 41
prioridades y 33 escenarios. Atención conserva su lista de protocolo. Los capítulos
10, 20, 28, 30, 36, 40 y el manual de TAF (R5) explican este seguimiento.
Arquitectura, JSON y PEFT enlazan a `sec-resolver-architecture`, `sec-resolver-json`
y `sec-resolver-peft`; el retorno conserva ruta, idioma y alojamiento.
El panel opcional **Seguir mis comprobaciones** registra declaraciones por paso
y prioriza discrepancias, bloqueos y pendientes sin modificar la evidencia.
R5 (`sec-resolver-progress`) explica su demo y sus límites: las marcas permanecen
en la pestaña original, no viajan con los enlaces ni se restauran desde el informe.
Recalcular cambia el plan, pero no implica ejecutar las comprobaciones en el
entorno del usuario. Los enlaces de ida y vuelta conservan su comportamiento.

La demo `?demo=resolver&lang=es` abre la revisión en su quinto paso, antes del
seguimiento. R5 explica este recorrido en ambos idiomas. El informe descargado
incluye la revisión (esquema 3); no es una medición nueva ni una certificación.
Implementación: `js/resolver_summary.js`, `js/resolver_review.js` y
`js/resolver_ui.js`. Pruebas: `npm run test:resolver`.

### Alcance de las explicaciones

- γ_Padé y γ_decomposed siguen siendo estimaciones. γ_obs es un valor importado:
  la guía no verifica cómo se obtuvo. Los controles sintéticos tampoco se convierten
  en evidencia de modelos entrenados.
- El horizonte derivado no certifica contexto útil; entropía no identifica γ; una
  ruta de lectura no valida una predicción. Los priors de contaminación no prueban
  contaminación, y Depth map no mide activaciones.
- Se transmite por URL únicamente el modo, idioma, concepto, métrica y valor
  seleccionados y, cuando corresponde, un ID de modelo. Estos datos quedan en el
  enlace y pueden aparecer en el historial o en registros normales del alojamiento.
  No se transmiten prompts, corpus, pesos, matrices ni el informe completo.
- Un perfil calculado con parámetros manuales no hereda el ID escrito en otro campo.
  El prellenado por URL no activa autocompletado, descarga de config ni inferencia.
- Solo se admiten destinos de retorno conocidos (GitHub Pages y el Space estático).
  No se aceptan URL arbitrarias, rutas locales ni nombres de modo desconocidos.

## Idiomas y mantenimiento

TAF mantiene EN/ES/FR/ZH. La guía mantiene ES/EN. Los enlaces FR/ZH indican que la
lectura está en inglés. La procedencia científica se fija por métrica, no por un
parámetro de URL que pudiera presentarla como una medición.

El campo opcional de modelo de R5 comparte `hf_autocomplete.js` con TAF. Al enfocarlo
muestra modelos populares; al escribir consulta HF, ordenando por descargas. La
caché dura cinco minutos y distingue consulta, filtro y límite. No consulta al cargar
la página ni descarga configuración o pesos al seleccionar. Mantiene entrada manual
si falla la red y prepara el enlace a TAF. La guía explica el envío de la consulta a
HF, el criterio de ordenación y que la lista no certifica compatibilidad.
El desplegable admite teclado, se adapta al móvil y descarta respuestas antiguas.
`guide_hf.css` conserva el estilo claro de la guía. Ambos archivos se sincronizan
con los módulos compartidos. Prueba: `node tests/guide_models_browser.mjs` (acepta
`GUIDE_URL` para comprobar las páginas reales ES/EN).

`js/guide_bridge.js` es el catálogo y comportamiento compartido; `js/guide_panel.js`
integra los resultados de TAF. `js/guide_chapters.js` contiene los títulos reales de
los capítulos de Quarto para evitar referencias por números aproximados.
Las copias de los dos módulos compartidos en `es/assets/` y `en/assets/` de la guía
deben coincidir byte a byte con TAF. El cargador del libro se añade al include
existente y usa `quarto:offset` para resolver los recursos locales.
Se comprueba con `python scripts/sync_guide_bridge.py RUTA_AL_MANUAL` y se actualiza
con el mismo comando más `--write`, antes de compilar y revisar ambos idiomas.
El sincronizador también incluye los tres módulos `research_lab*` y su CSS;
las demos y sus límites se describen en [la actualización de estudios](research-update-2026-10.md).

Pruebas: `node tests/guide_bridge.test.mjs`,
`node tests/guide_bridge_browser.mjs` y `node tests/guide_profile_browser.mjs`.
Las pruebas de navegador aceptan `TAF_URL`; la primera también acepta `GUIDE_URL`
para recorrer ambas aplicaciones. La prueba Profile usa Pyodide real.

Referencias de diseño consultadas: [Transformer Explainer](https://poloclub.github.io/transformer-explainer/)
combina controles y explicación de las operaciones; [BertViz](https://github.com/jessevig/bertviz)
ofrece distintas vistas de la atención. La integración de TAF conserva sus propias
métricas, evidencias y componentes; no incorpora código de esos proyectos.

## Resolver case continuity — 25 October 2026

R5 ES/EN now includes `#sec-resolver-saved-cases`: save a private case, preview
and reopen it on either app host, and distinguish it from the reduced report.
The in-app Manual and feature overview use `resolver.case_help` in EN/ES/FR/ZH.
FR/ZH guide links continue to use English. Guide return links still prepare a
fresh form; they carry neither case files nor pasted inputs. To preserve work
across reloads, explicitly save a private case before leaving.
Source QMD, rendered R5 pages and their search entries are synchronized. See
[resolver documentation](resolver.md#save-and-reopen-a-private-case) for format,
privacy, validation and tests. The earlier recorded video does not demonstrate
this new optional file workflow.
