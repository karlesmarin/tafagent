# `data/` — Reproducibility artefacts for the TAF paper

This directory ships the raw experimental outputs referenced in
*Predicting How Transformers Attend: Analytic Power-Law Theory, Phase
Transitions, and Practical Compression Tools* (Marin 2026).

Every claim in the paper that depends on a measurement is backed by
a JSON file under one of the subdirectories below. File contents are
deliberately verbose so a reader can verify a number without re-running
the experiment.

## Layout

| Subdirectory | Contents |
|---|---|
| `e4_gamma/` | $\gamma_\mathrm{obs}$ measurements per model (text + random corpus). 23 model entries. |
| `e1_h3/` | H3 residual transplant recoveries (paper §sec:structure). |
| `exp_b1/` | NIAH zero-shot context extension (paper §sec:ntk_scaling). |
| `exp_b2/` | KV-cache compression sweeps for `D_f` validity (paper §sec:kvcache). |
| `exp_b3/` | Dead-band vs alive-band ablation (paper §sec:gamma_dial). |
| `exp_kv_decay/` | Soft-decay vs hard-truncation regime panel (paper §sec:kv_horizon_decay). |
| `exp_wqk_spectral/` | DFT spectral analysis of $W_Q, W_K$ rows. |
| `exp_gamma_field/` | Per-layer per-head $\gamma$-field measurements. |
| `e7_e9_hagedorn/` | Phase-A/B Hagedorn boundary cross-models. |
| `e7_passkey/` | Passkey retrieval at variable distance. |
| `dict1_primitives/` | Primitive subspace clustering. |
| `dft_weights/` | Weight-space DFT signatures. |
| `attention_grammar/` | Attention grammar / KL-anomaly classifier. |
| `cloud/` | Long-running runs from cloud GPUs. |
| `master_gamma_results.json` | Curated 23-model summary (top-level). |
| `*.png` | Figures used in the paper. |

## File format

Each measurement file is a JSON object with at minimum:

```json
{
  "model":      "<HuggingFace identifier>",
  "corpus":     "mongo" | "random",
  "theta":      <RoPE base>,
  "gamma_obs":  <fitted exponent>,
  "R2":         <fit quality>,
  "T_attn":     <evaluation length>
}
```

Additional fields (heat-capacity $C_V$, free energy $F$, decay
spectra, etc.) are present in experiment-specific files.

## How to use this data

To verify the Padé prediction on a single model, point `cli/diagnose_model.py` at the same model identifier and compare its `gamma_obs` against the value here. To re-run an experiment from scratch, the originating Python scripts live in the parent paper repository (referenced from the manuscript appendices).

## Excluded files

For repository hygiene, this directory ships only `*.json`, `*.csv`,
and `*.png`. Run logs (`*.log`, `*.txt`) and intermediate artefacts
(`*.bak`, `*.stale`) are not committed; they live in the originating
experiment directory and are reproducible from the scripts.
