# 🧮 Finite-family contract — 18 November 2026

**Contract:** `finite-family-v2-20261118` · counting measure on integer distances
`1..N`, integer `N≥1`, finite real gamma.

| Quantity | Expression | Meaning |
|---|---|---|
| Normalizer | `Z_N=Σ d^(−γ)` | Finite-family normalizer |
| Mean energy | `U=Σ pγ(d) log d` | Energy is log distance |
| Entropy | `S=log Z_N+γU` | Shannon entropy of this family |
| Fisher | `I=Var(log d)` | Curvature on this fixed support |
| Heat capacity | `C_V=γ²I` | `I=C_V/γ²` requires gamma nonzero |
| Quantile | smallest D with `Σ(d≤D)pγ(d)≥f` | `0<f<1`; mass budget, quality requires tests |
| Formal temperature | `1/γ` | Unavailable at zero; distinct from sampling temperature |
| Free energy | `−log Z_N/γ` | Unavailable at zero |
| Dense KV bytes | `2bLH_KV d_head T` | One request; b bytes/element, before runtime overhead |

At `N=2000,γ=1`, `C_V=5.484118` for the discrete family. The continuous
variance `(log N)²/12=4.814477` belongs to a different distribution. All finite
sums remain regular at gamma one. At zero the family is uniform and `C_V=0`.

## 📐 Candidate coordinates

`γ_P=(2θ−T√2)/(2θ+T√2)` is a chosen configuration function.
Its inverse base is `T√2(1+g)/(2(1−g))`; its inverse context is
`θ√2(1−g)/(1+g)`. Require `−1<g<1`, with positive T or theta respectively.
The shifted base `θ+T/√2` is a different coordinate. Composing the context
inverse with the candidate returns T by construction.

## 🔬 Measurement boundaries

A fitted slope requires its checkpoint, context, distance support, queries,
mask, aggregation and fit protocol. A variable-length E4 slope is not the same
observable as a fixed-query slope. Moments inferred by inserting that slope into
a stipulated family are not measured attention-row moments.

Missing gamma is `null`/empty, never the candidate or zero. Zero is valid.
Canonical corpus contrast is `gamma_random−gamma_text`; retain labels for legacy
`text−random` data. A contrast alone does not identify a circuit.

## 🔗 Implementations and checks

`python/taf_browser.py` and `cli/diagnose_model.py` expose the same family
calculations. `js/gamma_check.js` implements candidate coordinates. The guide
documents the same domains and widget identity. Independent reference vectors
are in `tests/finite_family_vectors.json`; regressions are in
`tests/test_taf_formulas.py` and `tests/alignment.test.mjs`.

⚖️ [Limits](LIMITATIONS.md) · 🆕 [Release notes](RELEASE_NOTES_2026-11.md)
