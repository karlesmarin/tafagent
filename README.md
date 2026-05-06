---
title: TAF Agent
emoji: 🔬
colorFrom: blue
colorTo: green
sdk: static
pinned: true
license: apache-2.0
short_description: 14 anti-bullshit LLM diagnostics in browser. 4 langs.
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
  - viability
  - thermodynamics
  - free
  - browser
  - webgpu
language:
  - en
  - es
  - fr
  - zh
---

# 🔬 TAF Agent

> **Diagnose any transformer LLM in 30 seconds. Free. No GPU. No signup.**
> 14 browser-only modes · 4 languages · 37 Lean+Mathlib-verified theorems · 0 telemetry.

**🌐 Live**: https://karlesmarin.github.io/tafagent  ·  HF Space: https://huggingface.co/spaces/karlexmarin/taf-agent
**📦 Source**: https://github.com/karlesmarin/tafagent  ·  Lean repo: https://github.com/karlesmarin/lean-taf
**📄 Paper**: [Predicting How Transformers Attend — Marin 2026](https://zenodo.org/records/19826343)
**🗂️ Dataset**: [taf-attention-decay (58 measurements, 32 models)](https://huggingface.co/datasets/karlexmarin/taf-attention-decay)

---

## 🆕 v0.7 — Anti-bullshit pack (7 new modes)

Each mode solves a documented HuggingFace community pain. All run in your browser with zero inference — pure metadata + math. **3 of these have no comparable tool publicly available** (validated against existing literature):

| Mode | What it answers | Pain it kills |
|------|-----------------|---------------|
| 🪟 **Unmask** | "Is `max_position_embeddings` honest?" | Mistral-7B-v0.1 says 32k, attends ~8k via SWA |
| 📜 **Chat-template** | "Which CLI flag for lm-eval / vLLM / transformers?" | lm-eval-harness #1841 silently halves multi-turn accuracy |
| 🎯 **Arena CI** | "Is GPT-4 actually better than Claude — or tied?" | Chatbot Arena strips CIs from public leaderboard |
| 🧪 **Contamination** | "Should I trust this MMLU score?" | Open LLM Leaderboard v1 killed by MMLU/HellaSwag contamination |
| ⚖️ **Quant** | "Will NF4 break my model? AWQ better?" | Generic "AWQ ~95%" claims hide model-specific cliffs |
| 🔀 **Drift** | "lm-eval gives 67.2, vLLM gives 65.1. Bug or noise?" | arxiv 2506.09501 — eval irreproducibility |
| 🔍 **NIAH→Reason** | "Does my 128k-context model actually reason there?" | RULER paper finding — needle pass ≠ multi-hop reasoning |

Plus a search-as-you-type HF Hub autocomplete on every model-id input (5 minute cache, privacy-noted, gated-license link).

[**▶ Try it now**](https://huggingface.co/spaces/karlexmarin/taf-agent) · [v0.7 release notes](https://github.com/karlesmarin/tafagent/blob/main/README.md#whats-new-in-v07)

---

## A note before you read on

This tool was built by **one independent researcher**, with no funding,
no team, no GPUs beyond a single consumer card, and the full collaborative
help of large language models as research instruments. It exists because the
paper it complements (*Predicting How Transformers Attend* — Marin 2026) needed a
way for any reader to **check the framework's predictions on their own
model in seconds**, without installing anything, without paying anyone, and
without trusting a server they don't control.

If it is useful to you — even once — that is enough. If it is wrong about
your model, please tell us so we can fix the framework. The point is the
common ground, not the artefact.

---

## What it does

Drop in a model id (or paste any HuggingFace public model), get a
falsifiable answer to "**will this work?**" — backed by the
Thermodynamic Attention Framework (TAF) formulas:

**Decision recipes**
- *Will Llama-3-8B serve 32K context with NIAH retrieval?* → **X-2**
- *Should I train a custom 7B model or pay for API access?* → **X-1**
- *I have $5,000 — what model can I afford to train?* → **X-3**
- *Cheapest GPU to serve Llama-70B at 100M tokens/day?* → **X-5**
- *Soft KV decay or hard cutoff for compression?* → **X-19**

**Diagnostic recipes** (NEW v0.4 — sesión 29 findings 2026-04-28)
- *How much positional bias did training imprint on this model?* → **X-21**
- *Does this model fit the empirical compute-context invariant band?* → **X-22**
- *Is this checkpoint pre- or post-induction-head?* → **X-23**

Each as a chain of TAF formulas (paper §17, §19, §20, §24, §26, §28-§30)
rendered with full audit trail. Every number is deterministic Python;
nothing is hallucinated.

## Four ways to use it

- **📇 Profile a model** — paste id, get all 5 recipes scored as a unified
  TAF Card (best starting point)
- **🆚 Compare models** — 2-3 candidates side-by-side on the same recipe
- **💬 Ask plain English** — free-form question, in-browser LLM picks
  the right recipe
- **📋 Pick recipe** — manual selection with full form control

## How it stays free + unlimited

- Static HTML/JS hosted on **GitHub Pages** (truly unlimited bandwidth)
- Python TAF computation runs in your browser via **Pyodide**
  (no server-side compute)
- Plain-English synthesis runs **Qwen2.5-0.5B-Instruct** in your browser
  via **WebLLM** (your GPU/CPU, your electricity, ~350MB cached after
  first load)
- Model `config.json` files fetched directly from **HuggingFace Hub**
  (free, public, no auth for non-gated models)
- **Your data never leaves your browser**

If 1 user or 1 million users hit it, our cost stays the same: $0.

## Why static HTML+JS+Pyodide instead of Gradio/Streamlit?

A reasonable question. Three TAF Agent USPs are **only possible** with browser-only architecture:

1. **Your inputs never leave the tab.** No server = no privacy compromise. The "anti-bullshit" framing depends on this.
2. **$0 forever, even at infinite scale.** Static Spaces have unlimited HF bandwidth; there is no cold-start, no queue, no rate limit. Going viral can't bankrupt the project.
3. **Lean+Mathlib formal verification** ships as a static manifest. The 37 theorem badges link to source lines that anyone can `lake build` themselves — no hidden server logic.

Bonus: in-browser LLM (WebLLM running Qwen2.5-0.5B in your GPU/CPU) for the 💬 Ask mode is only viable in static. Pyodide running deterministic Python in your browser means you can audit every number — no opaque server.

The cost: HuggingFace's "Trending Spaces" algorithm favours Gradio/Streamlit Spaces. We compensate with detailed tags + forum presence + this README. If you'd prefer a Python-API client, that's a planned `gradio_client` companion (v0.9).

---

## Architecture coverage

Supports any model whose `config.json` is parseable:

| Family | Examples | Status |
|--------|----------|--------|
| RoPE-MHA | pythia, gpt-j, original LLaMA | ✓ supported |
| RoPE-GQA | Llama-3, Mistral, Qwen2.5, gemma-2 | ✓ supported |
| ALiBi | BLOOM, Falcon | ✓ supported |
| AbsPE | gpt2 family | ✓ supported |
| SWA (sliding window) | Mistral, gemma-2, phi-3 | ✓ supported |
| SSM | Mamba, Mamba-2 | ✓ partial (γ doesn't apply, KV does) |
| Any HF Hub public model | (any) | ✓ via 📥 Fetch button |

## Languages

Interface available in:
- 🇬🇧 English
- 🇪🇸 Español
- 🇫🇷 Français
- 🇨🇳 中文

Click flags top-right to switch.

## Local development

### Browser application

```bash
git clone https://github.com/karlesmarin/tafagent
cd tafagent
python -m http.server 8000
# open http://localhost:8000
```

### CLI diagnostic (for the paper)

The directory `cli/diagnose_model.py` is the command-line companion
described in the paper *Predicting How Transformers Attend* (Marin 2026).
It characterises any causal language model from HuggingFace in
minutes on CPU and produces the raw `gamma_obs`, `R²`, and
thermodynamic profile used in the manuscript.

```bash
pip install torch transformers numpy
python cli/diagnose_model.py --model EleutherAI/pythia-2.8b --fast --cpu
```

### Reproducibility data

The directory `data/` ships every measurement referenced in the
paper (343 JSON files, ~5.5 MB). See `data/README.md` for the layout.

## Browser requirements

- **Chrome / Edge / Firefox 113+** for WebGPU acceleration (recommended)
- Older browsers fall back to CPU inference (slower but works)
- ~2 GB free RAM for the synthesis LLM
- ~350 MB disk for model cache (one-time)

## What's new in v0.4 (2026-04-28)

Three new diagnostic recipes derived from cross-model panel analysis (n=22 LLMs):

### X-21 — Imprint Purity Diagnostic
Predicts γ on RANDOM-token input via the **learned-imprint formula**:

```
γ_random = γ_pade(θ, T) + ν · log_10(P / 14M)
   ν = −1/(2π) ≈ −0.1592   (DERIVED from RoPE rotation period)
```

Even on random tokens, weights apply a learned positional bias proportional
to log(N_params). The slope ν is **fixed** (not fitted) — derivable from
RoPE's 2π rotation period. Empirical validation: n=22 LLMs, p=0.022, |err|=0.3%.

**Use case**: detect anomalous training, format conversion (e.g. OLMo native
vs HF Δγ=0.30), or fine-tuning drift by comparing predicted vs measured
γ_random.

### X-22 — Compute-Context Invariant
Computes the empirical Chinchilla×attention invariant:

```
K = γ × log(N² · D)   where D = 20·N (Chinchilla compute-optimal)
Empirical band: K ∈ [34, 68]   (51.2 ± 16.8, CV=0.329, n=22)
```

K-outliers indicate scaling/training anomalies. Llama-3-8B with γ=1.045
gives K=74.6 (z=1.39, high-K OUTLIER) — flags supra-Padé attention.

### X-23 — IH-Phase Detector
Uses the Δγ probe (cheaper than ICL benchmark):

```
sign(γ_text − γ_random) > 0   ⟺   post-induction-head formation
```

Pre-IH (P<400M, n=7): ⟨Δγ⟩=−0.19±0.26
Post-IH (P≥400M, n=15): ⟨Δγ⟩=+0.03±0.26

**Use case**: monitor training trajectories without running ICL benchmarks;
detect anomalous checkpoints.

### Other v0.4 additions

- `gamma_decompose_v2(...)` — 6-axis decomposition with the new imprint axis
- `famous_constant_proximity(...)` — detects γ-cluster on famous constants
  (e.g. CodeLlama-13b γ=0.382 ≈ 1−1/φ golden conjugate)

---

## What's new in v0.5.3 (2026-05-02) — 🔧 Audit-driven bug fixes

The TAF Agent was **applied to its own author's paper** (recursive Sócrates audit)
and to the agent's own formula implementations. Several real bugs were detected
and corrected. **All v0.5.0–v0.5.2 users running diagnostics on Phase B models
(γ > 1: LLaMA-2/3, Mistral, Gemma, Qwen2.5-7B near-Hagedorn) received
incorrect KV-compression recommendations.** This release fixes all known issues.

### Critical fixes

- **`D_f_closed` (KV compression window)**: replaced asymptotic / Hagedorn-buffer
  branches with **discrete cumulative sum**. Old code clamped Phase B (γ>1) to
  N when truth was ~3 % of N (LLaMA-3-8B at γ=1.046 with N=2000 should compress
  to ~750 tokens; old code returned 2000). Boundary γ ∈ [0.99, 1.01] was off
  by factor ~2×. Now exact for any γ.

- **`partition_Z(γ=1, N)`**: was `log(N + 0.5)`, missing Euler-Mascheroni
  constant γ_E ≈ 0.577 (~7 % underestimate of H_N). Now `log(N) + γ_E`.

- **`free_energy_F`**: returned `−log(Z)` (β·F convention). Now `−log(Z)/γ`,
  consistent with the Helmholtz definition F = −T·log(Z) and the
  thermodynamic identity S = γ·(U − F).

- **`γ_pred`**: replaced obsolete `C/lnθ` heuristic with `γ_Padé(θ, T_eval)`
  (paper §3.3).

### Calibration audit (cross-panel re-check, n=22)

Re-running the empirical δ corrections of `gamma_decompose` against the
panel revealed:

| Constant | Hardcoded | Panel re-audit | Verdict |
|---|---|---|---|
| δ_GQA | +0.11 | +0.115 | ✓ replicates |
| δ_SWA | −0.21 | originally fit on **n=1 model** | ✗ disabled (insufficient data) |
| δ_post_IH | −0.15 | group-mean ≈ 0 (n=16 yes / 6 no) | ⚠ flagged exploratory |
| δ_instruct (v2) | −0.10 | n=3, p=0.06 (already noted) | ⚠ flagged exploratory |

`gamma_decompose` and `gamma_decompose_v2` now return per-axis status fields
(`delta_SWA_status`, `delta_post_IH_status`, etc.) and a top-level
`calibration_warning` so consumers can detect which corrections are reliable.

The TAF Card UI now displays a collapsible **"v0.5.3 — Calibration audit"
banner** in all four supported languages (EN/ES/FR/ZH) explaining this.

### Paper §5.2 erratum

The framework's **own self-audit** found that paper §5.2 Theorem 5.2 claims
`C_V(γ=1, N) = (log N)²/4`. Sócrates triangulation (numerical Python +
Sage exact rational + SymPy symbolic integral) confirms the correct
asymptotic is `(log N)²/12` — a factor-3 error in the paper's truncated
Z-expansion proof. The agent's `heat_capacity_Cv` already computes the
correct value via numerical derivative of U; **only the paper's analytic
formula is wrong, not the tool**. A formal erratum will be published as a
separate document.

### Tests

22/22 unit tests pass (`tests/test_taf_formulas.py`), including regression
tests for D_f Phase B, partition_Z γ_E, free_energy_F convention, and
δ_SWA disabled.

### Why this happened

These bugs survived prior reviews because the affected code paths were
exercised mainly on Phase A models (γ < 0.95) where the asymptotic
approximation is close enough. Phase B (γ > 1) and the boundary near
Hagedorn (|γ−1| < 0.05) were under-tested. The agent now uses direct
discrete computation, so accuracy is uniform across all γ.

---

## What's new in v0.5 (2026-05-01) — 🔬 Machine-verified consistency

**First transformer-attention framework with formal machine-proof backing.**

Sage Groebner basis (algebraic decision procedure) + Lean Mathlib4 (dependent
type theory) **dual-tool verification** of 15 algebraic identities of TAF
critical exponents.

### `verify_algebraic_consistency(γ)` — new function

Given measured γ ∈ Phase A (0,1), checks 12 D-SAGE identities derived from
TAF exponents (β=γ−1, ν=1/(1−γ), η=γ−1, etc.):

- **D-SAGE-1 (★★ core)**: `2η² + η·γ_χ + 1 = 0` (quadratic identity)
- **D-SAGE-2**: `β·χ = −1` (Phase A)
- **D-SAGE-4**: `α + χ = 2`
- **D-SAGE-5**: `α + γ_χ = 2(2 − γ)`
- **D-SAGE-6**: `β·γ_χ = −2γ² + 4γ − 3` (factored)
- **Rushbrooke + Josephson** tautologies (d=1)
- **Fisher residual** = `γ(2γ−3)/(1−γ)` (NOT zero generally; corrects "triple closure")
- **η=2γ refutation** (Phase A residual > 0; paper 1's claim was wrong)
- **D-SAGE-7**: `c · |ν_imprint| · 2π = 3` (dimensional closure)

Pass = framework intact. Fail = bf16 outlier, quantization artifact, or
γ measurement noise.

### Paper 1 erratum

Paper 1 originally claimed `η = 2γ`. Sage Groebner + Lean Mathlib4 detected
this is **algebraically wrong** (residual `(−4γ³+5γ+1)/(1−γ) > 0 ∀γ ∈ Phase A`).
Correct value: `η = γ − 1`, satisfying D-SAGE-1.

### Reproducibility

```bash
# Sage verification
docker run --rm -v "$(pwd)/analysis:/work" sagemath/sagemath:latest \
    sage /work/sage_recursive_sweep_2026-04-30.sage

# Lean verification
docker run --rm -v "$(pwd)/lean_taf:/work" \
    leanprovercommunity/lean:latest \
    -c "cd /work/taf && lake build"
```

Build success: 1973/1973 jobs (Mathlib4 + 15 TAF theorems), `DONE_EXIT=0`.

Lean code: `lean_taf/taf/Taf/Identities.lean`
Sage script: `analysis/sage_recursive_sweep_2026-04-30.sage`

---

## How you can help

This tool is at v0.5. There's a long way to go.

- **🐛 Report bugs**: https://github.com/karlesmarin/tafagent/issues
- **🌐 Translate**: add a language to `js/i18n.js`, send a PR
- **🧪 Falsify a prediction**: run the tool on a model where you have
  ground-truth measurements; if our verdict disagrees with reality,
  open an issue. We take refutations as seriously as confirmations.
- **➕ New recipe**: implement an X-N recipe in `python/taf_browser.py`
  following the pattern of X-1...X-19
- **➕ New preset**: add a popular model to the `PRESETS` dict
- **📝 Improve docs / examples**: anything that helps the next person

## Citation

If this tool helps you — paper or code:

```bibtex
@article{marin2026Predicting How Transformers Atten,
  author  = {Marin, Carles},
  title   = {Predicting How Transformers Attend
Analytic Power-Law Theory, Phase Transitions, and Practical Compression
Tools},
  year    = {2026},
  url     = {https://zenodo.org/records/19826343},
}

@misc{marin2026tafagent,
  author = {Marin, Carles},
  title  = {{TAF Agent}: Browser-Based Transformer Diagnostic Tool},
  year   = {2026},
  url    = {https://karlesmarin.github.io/tafagent},
}
```

## License

Apache-2.0 (this code).

Synthesis model: [Qwen2.5-0.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct)
distributed under [Apache-2.0](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/blob/main/LICENSE).

---

## Acknowledgements

This tool would not exist without:

- **The model commons**: EleutherAI, Meta AI, Alibaba Qwen team, Mistral AI,
  Google DeepMind, Microsoft Research, AI2, BigScience, TII, DeepSeek-AI,
  HuggingFace SmolLM team, the Mamba authors, the RWKV community, and OpenAI
  for releasing weights and configs publicly.
- **The infrastructure commons**: Pyodide, WebLLM, HuggingFace Hub, GitHub
  Pages, jsdelivr CDN.
- **The maintainers** of `transformers`, `numpy`, `scipy`, `sympy`, `tokenizers`,
  `accelerate`, and the dozens of small libraries that make modern ML possible.
- **The wider ML community** — bloggers, reproducibility checkers, Discord
  moderators, Stack Overflow answerers, blog post writers
  (Lilian Weng, Andrej Karpathy, Sebastian Raschka, Jay Alammar, Sasha Rush,
  Phil Wang, the EleutherAI team, and many more) whose explanations carried
  the author through every concept this tool uses.
- **Large language models as research instruments** — Claude (Anthropic),
  GPT (OpenAI), Gemini (Google DeepMind), Mistral, Llama, DeepSeek, Grok,
  Qwen-Chat, and Microsoft phi — for the symbolic derivations, sage
  cross-checks, prose revision, audit work, and long-form co-writing that
  underlie both this tool and the underlying paper.

The author was the hand that typed; the work itself belongs to the commons
that made it possible.
