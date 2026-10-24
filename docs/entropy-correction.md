# Entropía de atención: medición experimental y límites

Esta implementación mide entropía real. **No implementa una corrección de γ por
entropía**, ni un test automático de validez de Padé. El módulo
`js/entropy_scanner.js` no se importa desde la aplicación: recibe filas de atención
ya medidas y no carga modelos, ejecuta inferencia ni accede a la red.

La ayuda y las demos de TAF explican esta distinción en EN/ES/FR/ZH. El proyecto
utiliza `js/i18n.js`, no `locales/*.json`; los textos de esta actualización están en
`js/entropy_i18n.js`. Catalán no forma parte de los cuatro idiomas actuales.

Todos los modos ofrecen una demo opcional. Las nuevas demos de estudios, entropía
y protocolos muestran controles reales de la interfaz. La demo de protocolos compara
el control numérico uniforme guardado (128 tokens) con otro control uniforme calculado
analíticamente (64 tokens). Ambos son sintéticos: no se presenta un entrenamiento ni
una nueva inferencia como ejecutados. La demo de entropía genera el comando local.

## Ejecutar una medición real

Si importas un diagnóstico con γ en **Resolver mi problema → Atención**, el
panel **Revisar este resultado** conserva los avisos de protocolo y explica qué
falta verificar. No vuelve a ejecutar el modelo ni convierte la entropía en una
γ corregida. Un informe `--entropy-only` no contiene γ y no es una entrada válida
para esa ruta. Véanse los [límites actuales](LIMITATIONS.md) y el
[alcance del resolutor](resolver.md).

Instala las dependencias en tu entorno Python y ejecuta desde la raíz del repositorio:

```bash
pip install torch transformers numpy
python cli/diagnose_model.py --model EleutherAI/pythia-70m --cpu --entropy-only
```

El comando carga pesos y ejecuta **cuatro forwards de 128 tokens**. El resultado queda
en `diagnose_results/EleutherAI--pythia-70m.entropy.json`. La carga del modelo sigue
requiriendo memoria y tiempo; un sondeo corto no garantiza que cualquier modelo quepa
en CPU. No se realiza entrenamiento. Una medición ausente o incompatible produce
un error, nunca una entropía ficticia de cero.

Para añadir el sondeo al diagnóstico por distancias existente:

```bash
python cli/diagnose_model.py --model EleutherAI/pythia-70m --cpu --fast --measure-entropy
```

El JSON completo incluye `attention_entropy` con un **protocolo separado**. Las
longitudes variables del barrido de γ no se confunden con la longitud fija del sondeo.
`--entropy-only` omite ese barrido y no devuelve γ. Se puede configurar el sondeo con
`--entropy-tokens`, `--entropy-samples`, `--entropy-layer` y `--entropy-head`.

El generador **Diagnose CLI → Avanzado** solo construye estos comandos. Sus opciones
están desmarcadas por defecto. No carga un segundo backend en el navegador. El JSON
de solo entropía es un diagnóstico independiente, no una medición de γ importable en
Predicción vs Realidad. El JSON completo sí conserva la entropía al importarse/exportarse.

## Qué se calcula

Para cada fila post-softmax, con probabilidades (p_k\), calculamos:

\[
H_2(p)=-\sum_{k:p_k>0}p_k\log_2 p_k,
\qquad D_{KL,2}(p\|U_K)=\log_2 K-H_2(p).
\]

La referencia (U_K\) es una **distribución uniforme explícita**, no una predicción de
RoPE. `mean_normalized_entropy` es la media de los cocientes (H_2/\log_2K\);
cuando (K=1\), el cociente se devuelve como `null` y se excluye de esa media.
La entropía de cada fila se calcula **antes** de promediar: no es la entropía de la fila media.

El sondeo actual utiliza tokens aleatorios uniformes sobre el vocabulario de embeddings,
una capa, una cabeza y la última consulta de secuencias sin padding. La referencia
comprende todas las claves de entrada, incluida la propia consulta. Una ventana local
puede producir por sí misma un déficit respecto a esa referencia; no se interpreta como
fallo del modelo. La API de matrices acepta máscaras booleanas explícitas para otros protocolos.

Se rechazan valores negativos, no finitos, soporte vacío, masa en posiciones enmascaradas
y filas cuya suma se aleja de uno. Solo se corrige el redondeo dentro de una tolerancia
documentada: `1e-5` en la API numérica; `0.005` en el sondeo para salidas de baja precisión.
Se guardan las sumas originales. El JSON conserva capa, cabeza, longitud, muestras,
semilla, backend, precisión, dispositivo y versiones de bibliotecas. Ninguno de estos
campos constituye un intervalo de confianza ni una certificación de fiabilidad.

## Por qué no se incluye la fórmula propuesta

`log2(contextLength) * 0.5` no es una entropía deducida de RoPE. Tampoco se ha validado
el factor `1 - 0.5 * delta`. Una distribución y su permutación sobre las distancias
pueden tener exactamente la misma entropía y pendientes de decaimiento opuestas.
Por eso `gamma_correction.applied` es siempre `false`: se informa del diagnóstico sin
crear un `gamma_corrected` a partir de él. No existe un umbral de entropía que certifique
el dominio de validez. Un entrenamiento o kernel de correlaciones aún no realizado
no se presenta como resultado experimental.

## Correcciones empíricas existentes

`gamma_decompose` y `gamma_decompose_v2` separan ahora `candidate`, `applied_value`,
`applied` y `status` dentro de `corrections`:

| Término | Comportamiento por defecto | Activación experimental |
|---|---|---|
| GQA | +0.11 si procede; ajuste empírico del panel | Sigue activo; no implica calibración universal |
| SWA | 0; candidato histórico −0.21, n=1 | Permanece desactivado |
| post-IH | 0; candidato −0.15 cuando el tamaño supera el umbral | `apply_exploratory=True`; el tamaño es solo un indicador aproximado |
| instruct, v2 | 0; candidato −0.10 | `apply_exploratory=True`; evidencia n=3 |
| imprint ν, v2 | 0; candidato no identificado | Permanece desactivado |

Ejemplo de API, para análisis explícitamente exploratorio:

```python
from python.taf_browser import gamma_decompose
baseline = gamma_decompose(0.8, n_params=1e9)
exploratory = gamma_decompose(0.8, n_params=1e9, apply_exploratory=True)
# baseline: 0.8; exploratory: 0.65. No medición de atención en esta operación.
```

No se añade un interruptor global para aplicar esas hipótesis en la web. Las recetas,
el perfil y el simulador «what-if» mantienen la política por defecto. Las identidades
matemáticas no se convierten en validación empírica al añadir o retirar un término.

## Pruebas y reproducción

```bash
node tests/entropy_scanner.test.mjs
python -m pytest tests/test_attention_entropy.py -q
python -m pytest tests/test_entropy_models.py -q
```

Las pruebas cubren atención uniforme, concentrada, máscaras causales, entrada inválida,
agregación por filas y condiciones de aplicación de δ. Los forwards de integración se
ejecutan sobre GPT-2 y Llama diminutos con **pesos aleatorios**, en CPU y sin descargar
modelos. Otra prueba guarda un modelo local y ejecuta el CLI completo. Estos controles
verifican la implementación; no validan una teoría sobre modelos preentrenados.

Fuentes: [salidas de atención en Transformers](https://huggingface.co/docs/transformers/v5.13.0/en/main_classes/output),
[protocolo de γ de la guía](https://karlesmarin.github.io/transformers-guide/es/chapters/R4-medir-gamma.html),
[auditoría de las afirmaciones](https://karlesmarin.github.io/transformers-guide/es/chapters/38-audit.html).

No hay telemetría ni recopilación automática de muestras. El descriptor
`recipes/attention_entropy_diagnostic.json` documenta el comando; no registra una receta
de corrección de γ ni activa inferencia en el navegador.
