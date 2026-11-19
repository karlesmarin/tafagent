---
title: TAF Agent
emoji: 🔬
colorFrom: blue
colorTo: green
sdk: static
pinned: true
license: apache-2.0
short_description: 31 diagnostic modes + linked field guide. EN/ES/FR/ZH.
tags:
  - transformer
  - llm
  - evaluation
  - diagnostic
  - anti-bullshit
  - long-context
  - sliding-window
  - yarn
  - chat-template
  - arena-elo
  - contamination
  - quantization
  - drift
  - ruler
  - niah
  - lean-mathlib
  - formal-verification
  - rope
  - kv-cache
  - gguf
  - llama-cpp
  - ollama
  - viability
  - thermodynamics
  - free
  - browser
  - webgpu
  - mamba
  - ssm
  - rwkv
  - linear-attention
  - memory
language:
  - en
  - es
  - fr
  - zh
---

# 🔬 TAF Agent

> Inspect model configuration, estimate resources and compare declared evidence.
> Explore the calculations in your browser, with their assumptions visible.

🌐 [GitHub Pages](https://karlesmarin.github.io/tafagent/) · 🤗 [Hugging Face](https://huggingface.co/spaces/karlexmarin/taf-agent)
· 📖 [Guía ES](https://karlesmarin.github.io/transformers-guide/es/)
· 📖 [English guide](https://karlesmarin.github.io/transformers-guide/en/)

## 🔗 19 November 2026 · Paper I / guía / guide

📄 [Revised Paper I EN (129 pp)](https://github.com/karlesmarin/predicting-how-transformers-attend/blob/session-2026-05-27-gamma-emergence/output/pdf/part1_formal_20261119/How_Transformers_Attend_Part_I_formal_EN.pdf) · [ES (140 pp)](https://github.com/karlesmarin/predicting-how-transformers-attend/blob/session-2026-05-27-gamma-emergence/output/pdf/part1_formal_20261119/How_Transformers_Attend_Part_I_formal_ES.pdf) · [Guide EN](https://karlesmarin.github.io/transformers-guide/en/chapters/R5-tafagent.html) · [Guía ES](https://karlesmarin.github.io/transformers-guide/es/chapters/R5-tafagent.html).
🗺️ [Blueprint público de esta edición](https://karlesmarin.github.io/blueprints/transformers-attend-I-full/) — mapa, pruebas, figuras, laboratorios y PDF EN/ES.
📦 [DOI de esta edición](https://doi.org/10.5281/zenodo.24379538); the older Zenodo record names the historical edition. The paper defines the quantities and proof scope, the guide explains protocols, and TAF calculates or imports values with provenance. A calculated value is not an independent trained-model measurement.

## 🆕 18 November 2026 · Fórmulas y evidencia / Formulas and evidence

**ES:** Publicadas las correcciones conjuntas de Parte I, tafagent y la guía.
El motor y la CLI usan la misma familia discreta; se distinguen candidato,
medición y cálculo de familia. γ observado queda vacío cuando falta la medición.
X-2, el deslizador y NIAH requieren evaluación de tarea; X-19 calcula un cuantil
de masa. GQA +0.11 queda desactivado por defecto. YaRN requiere su agenda real de
frecuencias. La guía ES/EN y las explicaciones relevantes EN/ES/FR/ZH concuerdan.

**EN:** Published the joint Part I, tafagent and guide corrections. Engine and CLI
share the discrete family; candidates, measurements and family calculations keep
distinct meanings. Missing observed gamma stays empty. X-2, the slider and NIAH
require task evaluation; X-19 computes a mass quantile. GQA +0.11 is disabled by
default. YaRN requires the actual frequency schedule. The ES/EN guide and relevant
EN/ES/FR/ZH explanations agree.

📚 [Release notes](docs/RELEASE_NOTES_2026-11.md) · 🧮 [Formula contract](docs/finite-family-contract.md)

## 🧭 What you can do

| Task | Tool / interpretation |
|---|---|
| Estimate weights, KV storage and overhead | **Fit Check / Memory Reality** under declared geometry and runtime assumptions |
| Investigate loading, prefill or decode memory | **Solve my problem → Memory**, with compatible reported peaks, local JSON or llama.cpp buffer logs |
| Explore an attention exponent | **Profile** computes a configuration candidate; **Diagnose CLI** measures attention when run with weights |
| Compare attention reports | **Prediction vs Reality / Attention resolver** retain context, support, aggregation and provenance checks |
| Plan a context-scaling configuration | **YaRN Planner** drafts settings; evaluate retrieval and reasoning at the intended lengths |
| Inspect prompts, JSON and adapters | Guided static checks, explicit file preview and apply, with known limits |
| Learn what a number means | 📖 Metric explanations link to the matching ES/EN guide chapter |

🌍 Interface and relevant help: **EN / ES / FR / ZH**. FR/ZH reading links use
the English guide. Optional demos exercise controls or use declared examples;
they do not establish new measurements of your model.

## 🧮 Calculations you can reproduce

On the declared finite support `d = 1..N`:

```text
pγ(d) = d^(−γ) / Z_N        Z_N = Σ d^(−γ)
U = E[log d]                S = log Z_N + γU
I = Var(log d)              C_V = γ² I
D_f = min D such that Σ(d≤D) pγ(d) ≥ f
```

Use integer `N≥1`, finite real gamma and `0<f<1`. These expressions remain
defined at gamma zero and one. Formal temperature `1/γ` and free energy
`−log(Z_N)/γ` are unavailable at zero. The continuous distribution uses a
different measure and can have different moments and quantiles.

The configuration candidate and its inverse are:

```text
γ_P(θ,T) = (2θ − T√2) / (2θ + T√2)
θ_inv(g,T) = T√2(1+g) / [2(1−g)]     for T>0 and −1<g<1
d_inv(θ,g) = θ√2(1−g) / (1+g)        for θ>0 and −1<g<1
```

`d_inv(θ,γ_P(θ,T)) = T` is an identity. It supplies no independent retrieval
ceiling. `θ + T/√2` is a separate shifted coordinate. An imported gamma of zero
is valid; an absent gamma is not replaced by the candidate.

📐 [Domains, examples and meanings](docs/finite-family-contract.md) ·
⚖️ [Limitations and evidence](docs/LIMITATIONS.md).

## 🔎 Measure attention in your own environment

The browser can generate commands. To run the measurement yourself:

```bash
pip install torch transformers numpy
python cli/diagnose_model.py --model EleutherAI/pythia-70m --cpu --fast --measure-entropy
```

This loads weights and requires sufficient memory. The distance sweep and entropy
probe retain separate protocols. `--entropy-only` produces no gamma. Variable
sequence lengths and changing query populations can induce a distance slope even
under uniform attention; read the protocol before comparing exponents.

🔬 [Entropy measurement](docs/entropy-correction.md) ·
📂 [Import attention reports](docs/attention-report-import.md) ·
🧭 [Model examples and coverage](docs/model-review.md).

## 💾 Work with a private case

**Solve my problem** supports previewing local inputs, running a check, attaching
declared follow-up, and explicitly saving/reopening a private case. Private files
may contain your full inputs and are unencrypted. Reduced reports omit those raw
inputs and cannot reconstruct the original case.

- 🧩 [Resolver workflow](docs/resolver.md)
- 🧠 [Memory measurements and Before/After comparisons](docs/memory-measurement.md)
- 🖥️ [NVIDIA device memory collector](docs/device-memory-probe.md)
- 🦙 [llama.cpp buffer logs](docs/llama-memory-log.md)
- 📝 [JSON, code and prompt files](docs/resolver-text-import.md)
- 🔧 [Adapter configuration files](docs/adapter-config-import.md)
- ⚖️ [Heuristic evidence scores](docs/evidence-score.md)

## 📚 Documentation and updates

- 🆕 [November 2026 corrections](docs/RELEASE_NOTES_2026-11.md)
- 🗓️ [October 2026 update history](docs/RELEASE_NOTES_2026-10.md)
- 🎬 [Historical v0.11 demo release](docs/RELEASE_NOTES_v0.11.md)
- 🔗 [Guide integration](docs/guide-integration.md)
- 🧪 [Dated demo validation](docs/demo-validation-2026-10-25.md)
- 🛠️ [Contributing](CONTRIBUTING.md)

Historical release notes describe their dated versions. The November corrections
and current formula contract take precedence for the reviewed calculations.
Formal identities, family calculations, imported observations and task benchmarks
provide different kinds of evidence. New QL measurements, causal training tests
and in-context KV quality evaluations remain research work.

## ✅ Checks

```bash
npm test
python -m pytest tests/test_taf_formulas.py tests/test_measurement_protocol.py tests/test_attention_entropy.py -q
```

The correction was checked against independent high-precision vectors, the real
guide widget, both guide builds and browser flows. The expanded Python group has
95 passing tests; real Pyodide profile and model-review flows were checked locally.
GitHub Actions records the complete remote suite for each commit.
