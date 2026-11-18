# 🆕 November 2026 — Joint formula and evidence corrections

📅 Published 18 November 2026 · 🌍 App EN/ES/FR/ZH · 📖 Guide ES/EN

## 🧮 Mathematics and implementation

- Engine and CLI consistently use discrete sums for Z, U, entropy, Fisher, C_V
  and mass quantiles. `C_V=γ² Var(log d)`; the guide animation uses the same identity.
- Finite real gamma includes zero, negative values and one. Undefined formal
  temperature/free energy at zero stay unavailable.
- The Padé inverse is separated from the shifted coordinate and linear inverse.
  The inverse domain is `−1<g<1` with positive context/base inputs.
- BF16 dense KV storage includes both K/V and two bytes per element.

## 🔎 Evidence and user-facing results

- Missing observed gamma stays empty. Zero remains a valid observation.
- X-2 and the what-if slider no longer derive a retrieval ceiling or a capacity
  verdict from the identity `d_inv(γ_P)=T`.
- X-19 reports a family mass quantile, requiring policy/task evaluation for KV quality.
- GQA +0.11 is disabled by default; explicit exploratory opt-in retains historical
  hypotheses without making them calibrated predictions.
- Residuals and random/text contrasts are descriptive. They do not identify fraud,
  SWA, GQA or induction heads. Canonical contrast is `gamma_random−gamma_text`;
  imported legacy conventions retain their labels.
- NIAH/reasoning rates remain unestimated from configuration. The RULER lookup
  returns a published aggregate only at the exact catalogued model/context.
- YaRN uses a frequency schedule; post-scaling quality requires evaluation.
  The static NTK helper uses the actual rotary dimension.

## 📖 Paper and bilingual guide

Part I's corrected English draft has 120 pages. It identifies the Pythia 4096/2048
extrapolation confound, range-specific E4 nulls for NR-5, the limited comparison
with constant predictors, and the distinct score ansatz and rational candidate.
The cosine-integral alternative states its assumptions and approximation limits.
The revised draft has not been deposited as a new Zenodo version in this update.

The guide corrects rotary counts, finite/continuous families, inverses, fixed-query
estimation, recipes, glossary, solutions and interactive widgets. Model configuration
is not a measurement of trained attention or task performance.

## ✅ Verification and publication

Independent high-precision vectors check motor/CLI results. The expanded Python
group passes 95 tests; the estimator passes eight and the actual widget agrees on
eleven vectors. Both guide builds and reviewed browser routes pass. Profile and
model-review tests explicitly open the diagnostics section before using its controls.
See GitHub Actions for the complete remote suite, including CPU attention models.

Published to [GitHub Pages](https://karlesmarin.github.io/tafagent/),
[Hugging Face](https://huggingface.co/spaces/karlexmarin/taf-agent) and the
[ES/EN guide](https://karlesmarin.github.io/transformers-guide/).
Public-file comparisons confirm the reviewed calculation modules and guide pages.

## 🧭 Remaining research

New fixed-query measurements with immutable revisions, out-of-sample family
comparisons, causal training interventions and in-context KV quality/memory tests
remain proposed work. This correction does not claim those experiments were run.

📐 [Formula contract](finite-family-contract.md) · ⚖️ [Limits](LIMITATIONS.md)
