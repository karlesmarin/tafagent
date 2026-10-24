# TAF ↔ guía: acompañar la interpretación

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

`js/guide_bridge.js` es el catálogo y comportamiento compartido; `js/guide_panel.js`
integra los resultados de TAF. `js/guide_chapters.js` contiene los títulos reales de
los capítulos de Quarto para evitar referencias por números aproximados.
Las copias de los dos módulos compartidos en `es/assets/` y `en/assets/` de la guía
deben coincidir byte a byte con TAF. El cargador del libro se añade al include
existente y usa `quarto:offset` para resolver los recursos locales.
Se comprueba con `python scripts/sync_guide_bridge.py RUTA_AL_MANUAL` y se actualiza
con el mismo comando más `--write`, antes de compilar y revisar ambos idiomas.

Pruebas: `node tests/guide_bridge.test.mjs`,
`node tests/guide_bridge_browser.mjs` y `node tests/guide_profile_browser.mjs`.
Las pruebas de navegador aceptan `TAF_URL`; la primera también acepta `GUIDE_URL`
para recorrer ambas aplicaciones. La prueba Profile usa Pyodide real.

Referencias de diseño consultadas: [Transformer Explainer](https://poloclub.github.io/transformer-explainer/)
combina controles y explicación de las operaciones; [BertViz](https://github.com/jessevig/bertviz)
ofrece distintas vistas de la atención. La integración de TAF conserva sus propias
métricas, evidencias y componentes; no incorpora código de esos proyectos.
