# 🔧 TAF Agent v0.5.3 — Audit-driven bug fixes

**TL;DR** — If you ran the TAF Agent on a model with γ > 1 (LLaMA-2/3,
Mistral, Gemma, near-Hagedorn Qwen) before today, the KV-compression
recommendation (`D_f`) was probably wrong. The agent has been corrected
end-to-end. Re-run your diagnostics.

---

## What was wrong

The agent applies a self-audit to its own paper. Yesterday I turned the
audit on the agent itself. It found six issues. Three are critical
enough that I'm posting publicly.

### 1. `D_f_closed` Phase B (γ>1) — wrong by 30–95 %

For models with γ > 1 (Phase B, where attention is locally concentrated)
the old asymptotic formula clamped to the full context length N, when
the true compression target is ~3–10 % of N.

| Model | γ | Old `D_f` (N=2000, f=0.9) | Correct `D_f` |
|---|---|---|---|
| LLaMA-2-7B | 1.026 | 2000 (clamped) | ~830 |
| LLaMA-3-8B | 1.046 | 2000 (clamped) | ~750 |
| Gemma-2-9B random | 1.135 | 2000 (clamped) | ~610 |
| (γ = 1.5 stress test) | 1.500 | 2000 (clamped) | ~44 |

If you used the agent's compression suggestion for any of these, you
were leaving real memory savings on the table.

### 2. Hagedorn buffer (|γ − 1| < 0.01) — factor 2× off

Models living right at the phase boundary (Qwen2.5-7B at γ=0.997, etc.)
hit a hardcoded special case `N · f^(1/log N)` instead of the correct
`N^f`. Off by ~2×.

### 3. `δ_SWA = −0.21` calibration — fit on n = 1 model

The architectural decomposition `gamma_decompose` carried a SWA
correction of −0.21 derived from a single Sliding-Window-Attention
model in the panel. With n = 1 you cannot estimate a coefficient; the
constant was effectively arbitrary. **Now disabled** with explicit
status flag `delta_SWA_status: 'exploratory_n1_disabled'`.

`δ_post_IH = −0.15` and `δ_instruct = −0.10` did not replicate cleanly
on the panel re-audit either; both now carry `exploratory` flags.
Only `δ_GQA = +0.11` (panel-mean +0.115) replicates. **The most
reliable axes are now `δ_GQA` and the `ν_imprint` slope.**

---

## What was fixed

- `D_f_closed` rewritten to use **direct discrete cumulative sum** —
  exact for any γ, no asymptotics, no buffers. ~10 ms per call for
  N ≤ 10⁶.

- `partition_Z(γ=1, N)` now adds the Euler-Mascheroni constant
  (~7 % accuracy fix on H_N).

- `free_energy_F` switched to physics convention `F = −log(Z)/γ`,
  consistent with `S = γ·(U − F)`.

- `γ_pred` now uses `γ_Padé(θ, T_eval)` instead of the obsolete
  `C/lnθ` heuristic.

- `gamma_decompose` and `gamma_decompose_v2` return per-axis
  reliability flags + a top-level `calibration_warning`.

- TAF Card UI shows a **collapsible "v0.5.3 — Calibration audit"
  banner in all four supported languages** (EN / ES / FR / ZH).

- 22 unit tests added (`tests/test_taf_formulas.py`), all passing.

---

## What was *not* affected

These formulas were verified independently and remain correct:

- `gamma_pade`, `theta_design`, `alpha_opt`, `theta_eff_pade`
- `mean_log_d`, `entropy_S` (the new `F` convention adjusts but the
  identity `S = γ·(U − F)` is preserved)
- `heat_capacity_Cv` — numerical derivative of `mean_log_d`,
  computes the correct value automatically (the **paper §5.2 analytic
  formula `(log N)²/4` is wrong** but the agent never used it; agent
  computes via finite difference and gets the correct asymptotic
  `(log N)²/12`)
- `d_horizon`, `L_NIAH^c`, `χ`, `T_attn`
- `gamma_random_predict`, `compute_invariant_K`, `ih_phase_check`
- All the verified algebraic identities (D-SAGE-1 through 7)

---

## Paper §5.2 erratum (separate)

While auditing the agent, the framework also caught an algebraic error
in the companion paper. Paper §5.2 Theorem 5.2 claims:

```
C_V(γ = 1, N) = (log N)² / 4
```

Triple triangulation (Sócrates numerical + Sage exact rational + SymPy
symbolic integration) shows the correct asymptotic is:

```
C_V(γ = 1, N) → (log N)² / 12   (large N)
```

The proof in the paper truncated Z(γ, N) at first order in (1−γ),
missing a (1−γ)²·(log N)²/6 term. A formal erratum is in preparation
and will be published as a separate document.

This does not affect any of the agent's numerical outputs — the agent
computes `C_V` via numerical derivative, not the buggy analytic form.
It only affects the analytic claim in the paper.

---

## How to verify

```bash
git clone https://github.com/karlesmarin/tafagent
cd tafagent
pytest tests/test_taf_formulas.py    # 22/22 should pass
```

Or just open the live Space — the calibration banner will show up
immediately at the top of any TAF Card output.

---

## Why I'm telling you this

If you used a tool's recommendation to change a real production setup
(KV cache size, RoPE scaling, model selection) and the tool was wrong,
you deserve to know. That's the point of "auditable, deterministic,
in-browser" — not just that it's transparent in the abstract, but that
when a bug is found it gets reported. Today there's a bug to report.

The audit framework that found these is itself in early development
(Sócrates v0.1, internal use). The fact that it caught real issues in
its own author's published paper and shipped tool is, honestly, the
strongest validation it has so far.

If you spot anything else wrong — please open an issue.

— Carles Marín
*Independent researcher*
*2026-05-02*

---

**Links**:
- Live: https://huggingface.co/spaces/karlexmarin/taf-agent
- Source: https://github.com/karlesmarin/tafagent
- Paper: https://zenodo.org/records/19826343
- Dataset: https://huggingface.co/datasets/karlexmarin/taf-attention-decay
