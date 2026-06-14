# TAF Agent v0.10 — Architecture-aware + Reality-check

> Release date: 2026-06-14. Browser-only, no inference, $0, EN/ES/FR/ZH.
> Live: https://karlesmarin.github.io/tafagent · HF Space: https://huggingface.co/spaces/karlexmarin/taf-agent

This release adds three diagnostics, an honesty fix to the long-context verdict, and a set of UX fixes — all still running entirely in your browser from `config.json` + math, with no server and no inference.

## 🧠 Memory Reality Check (new mode)

Tells you what a model's **"context length" actually means** and how it fails — by classifying its architecture straight from `config.json`:

| Class | What "context" means | Failure mode |
|-------|----------------------|--------------|
| Full attention | random access, decays with distance | effective < advertised |
| Sliding-window | hard window | nothing past the window |
| State-space (Mamba) / RWKV / Linear | fixed-size lossy state | exact recall of an old token (needle) fails |
| Test-time-training / delta-rule | updated lossy state | surprising / unique tokens overwritten |
| Hybrid (Jamba, Zamba, Nemotron-H) | a few attention layers do the recall | recall ≈ those layers |

Detection rules were **validated against 13 live HF configs** (incl. the gotchas: `sliding_window` set-but-disabled, RWKV declaring `num_attention_heads`, per-family hybrid layer maps). Side-flags surface MoE total-vs-active, extended-context (RoPE scaling), and "tokens ≠ words". Bottom line it teaches: *advertised context = how much it READS; effective recall = how much it can FIND AGAIN.*

## 📊 Prediction vs Reality + Bring-Your-Own-Data (new mode)

Stop taking the numbers on faith — **check them against measured reality**:

- Paste a **Diagnose-CLI JSON** (or a measured record) → a table of **TAF prediction vs measured** (γ, KV) with Δ and a within-tolerance flag.
- Pulls measured values from the shipped dataset, your CLI run, or harvested published benchmarks.
- **Contribute back, server-less:** generates a dataset-schema record + a one-click link to open an HF dataset discussion/PR. Your data stays in your browser until you submit; the maintainer reviews and merges → everyone benefits on the next dataset version.

## ✅ Confidence score

Every X-2 viability verdict, Memory Reality result, and Prediction-vs-Reality comparison now carries a **0–100% confidence** with a ✓/⚠ checklist of evidence (γ measured vs closed-form, validated regime, benchmark available, calibration reliable vs exploratory). Predictions are never shown as absolute truth. A measured γ visibly raises confidence.

## 🔍 Honesty fix — the d_horizon tautology (X-2)

The closed-form horizon `d_horizon(γ_Padé(θ, T_eval))` is **identically equal to `T_eval`** (identity D-NEW-1). So the no-inference long-context verdict was driven by the empirical γ-corrections (some disabled/exploratory), **not** by RoPE geometry as the audit trail implied. X-2 now discloses this in "Honesty notes", reports the native horizon at `T_train`, and — when you supply a measured `γ_obs` — uses the non-tautological PDI instead. Documented in [`docs/LIMITATIONS.md`](LIMITATIONS.md).

## ✨ UX & quality fixes

- **HF autocomplete on every model-id field** (Profile, Memory Reality, Prediction-vs-Reality, Compare ×3, Diagnose, Unmask, Quant, NIAH, Spec, YaRN, Launch, gguf).
- **Fixed "dropdown only opens once"**: the dropdown now (re)opens on every focus **and** click, the dedup that blocked re-opening is reset, and a pending blur-close is cancelled on re-focus.
- **Manual ("📘 User Manual") reorganised** into the same collapsible cards as "🧰 What it gives you", one per topic, each with its own icon — easy to scan.
- **`serve.py`** added: a no-cache local dev server (`python serve.py`) so edits show up on reload without fighting the browser cache.

## ✓ Quality

- Tests: Node (`memory_reality` 21, `confidence` 6, `prediction_reality` 11) + pytest (confidence engine, X-2 tautology/caveats). i18n **parity 1289 keys × 4 languages**.
- Verified across all 27 modes + modals with zero console errors.
