# TAF Agent — Limitations & Regime of Validity

This document records the assumptions behind the closed-form predictions used in TAF Agent and the conditions under which they may fail. It complements the in-tool **Validity Gate** banner (γ Predicted vs Observed panel) and the empirical Phase Diagram.

## TL;DR

| Closed-form | Assumption | When it breaks | Detection in TAF Agent |
|-------------|------------|----------------|------------------------|
| **γ_Padé(θ, T) = (2−z)/(2+z), z = T√2/θ** | Natural training; attention follows the architectural RoPE-induced shape; no explicit attention regularization | Heavy regularization, RLHF/instruction-tuning collapse, sliding-window architectures, undertrained checkpoints | η = θ_eff_obs / θ_eff_Padé outside [0.85, 1.15] → Validity Gate banner |
| **ν = −1/(2π) (universal footprint)** | Token sequence is i.i.d. when computing the gradient fixed point of the RoPE base | Real text has long-range correlations (1/f, Zipf-like). Synthetic data can shift the fixed point further | Not yet detected automatically — see Future Work |
| **d_horizon = θ(1−γ)√2/(1+γ)** | Treated as an independent predicted horizon | **Always**, in the no-inference path: with γ = γ_Padé(θ, T_eval) it is the algebraic identity d_horizon ≡ T_eval (D-NEW-1) — tautological | X-2 now flags it ("Honesty notes") and routes to measured γ_obs → PDI |

## 1. Closed-form γ — regime of validity

The Padé form `γ = (2−z)/(2+z)` is derived from the architecture alone (θ, head dimension, evaluation length T). It does **not** know what the trained weights do. Two failure modes:

1. **Forced near-uniform attention.** If training pushes attention towards uniform distribution (e.g. via entropy regularization, or as a side effect of certain RLHF losses), the empirical γ collapses regardless of θ. The closed-form will then over-predict γ.
2. **Collapsed / compressed attention.** Instruction tuning and RLHF often flatten attention to short range. Empirical γ is then much lower than `γ_Padé`. This is the "compressed" regime in TAF (η ∈ [0.01, 0.5)) and the "fraud" regime (η < 0.01) when paired with marketing inflation of θ.
3. **Sliding-window attention.** Mistral and Gemma families use a windowed mask. The closed-form assumes full attention by construction; SWA produces γ_obs > 1 on random corpora, which TAF labels as a known signature, not as "normal".
4. **Undertrained / Lerch-corrected regimes.** Early checkpoints and models with non-standard training can attend farther than Padé predicts (η > 1.5).

### What TAF Agent does about it

- **Validity Gate banner** (added v0.8.9, all 4 UI languages): when η falls outside `[0.85, 1.15]` or the regime classifier returns anything other than `normal`, the γ panel renders an explanatory warning above the regime tile, with a per-regime hint about the most likely cause.
- **Empirical fallback already exists**: the Phase Diagram (`js/phase_diagram.js`) shows γ_observed for 23 panel models; the Diagnose CLI (`cli/diagnose_model.py`) measures γ via real forward pass. When the Validity Gate fires, users are directed to those channels.

### What TAF Agent does **not** do (and why)

We considered, and explicitly rejected, the "γ_eff = γ_RoPE + λ · Δ_attn" patch suggested in external review. Reasons:

- The mixing coefficient `λ` would be set ad hoc (e.g. `λ = −γ_RoPE / Δ_attn_uniform`) to satisfy the uniform-attention edge case, with no derivation justifying linearity in the entropy gap.
- The result would replace a clean closed-form with a fitted formula whose interpretability is lower than just measuring γ directly — which the Phase Diagram and Diagnose CLI already do.
- If the closed-form is unreliable in a regime, the honest answer is "use the empirical measurement", not "trust this patched formula".

We therefore treat the closed-form as a **regime-bounded prediction** with an automatic gate, rather than a universal law.

## 1b. The closed-form horizon `d_horizon` is tautological (D-NEW-1)

The recipe **X-2 (Long Context Viability)** reports a `d_horizon = θ(1−γ)√2/(1+γ)` and compares the requested length `T_eval` against it. In the no-inference browser path the γ fed to this formula is `γ_Padé(θ, T_eval)`. Substituting:

```
d_horizon(θ, γ_Padé(θ, T_eval)) = θ·√2·(1−γ)/(1+γ)  with  (1−γ)/(1+γ) = T_eval·√2/(2θ)
                                = θ·√2·T_eval·√2/(2θ) = T_eval   (identically)
```

So **the closed-form horizon equals `T_eval` by construction** — it is the identity behind the Padé Deviation Index (`PDI = d_horizon_obs / T_eval = 1 ⟺ γ_obs = γ_Padé`, §33.2). Consequences:

- The θ → γ_Padé → d_horizon → verdict chain shown in the audit trail **collapses to an identity**. Any deviation of the displayed `d_horizon` from `T_eval` comes **only** from the empirical γ-corrections (`δ_GQA`, `δ_SWA`, `δ_post_IH`), several of which are disabled (`δ_SWA`, fit on n=1) or exploratory (`δ_post_IH`, group-mean ≈ 0 in re-audit). The verdict is therefore **δ-driven, not RoPE-geometry-driven**, despite how the trail reads.
- This is *not* a numerical bug — the numbers are internally consistent — but presenting a tautological horizon as a geometry-derived prediction would be exactly the kind of false confidence this tool exists to surface.

### What TAF Agent does about it (v0.9.x audit fix)

- **X-2 now emits "Honesty notes"** (all 4 UI languages) disclosing the tautology and that the no-inference verdict is δ-driven, with the disabled/exploratory δ-corrections flagged individually.
- The audit-trail `d_horizon` step now states the identity inline and also reports the **native horizon at `T_train`** (`d_horizon(θ, γ_Padé(θ, T_train)) ≡ T_train`) as the meaningful geometric reference ("are you asking beyond the training length?").
- **Non-tautological path:** passing a measured `gamma_obs` (from the Diagnose CLI) makes X-2 compute the real `PDI = d_horizon_obs / T_eval` and base the verdict on it. `PDI ≈ 1` matches Padé; `PDI > 1.5` sink-dominated; `PDI < 0.5` over-concentrated.

The honest rule is the same as for §1: when the closed-form is tautological in a regime, **use the empirical measurement** (γ_obs → PDI), not the identity dressed as a prediction.

## 2. Universal footprint ν = −1/(2π)

The ν derivation in the second paper assumes i.i.d. tokens when computing the gradient fixed point of the RoPE base. Real corpora do not satisfy this:

- Natural text exhibits long-range correlations of approximately `1/f^β` form, with β typically in the 0.5–0.8 range.
- Synthetic data (especially long-context benchmarks like RULER, NIAH, multi-document QA) can have correlations far outside that range by construction.
- The fixed point shifts as `ν_final = −1/(2π) + δ(β)`, where `δ(β)` depends on a weighting function we have not derived rigorously.

### Honest framing

The published constant should be read as the **asymptotic footprint under the i.i.d. assumption**. Empirically the deviations are small for natural text, but neither universal nor zero.

### What TAF Agent does about it

Not yet automated. The Validity Gate covers γ; an analogous "data correlation diagnostic" for ν is planned but **deliberately not implemented as a corrected formula**, for the same reason as above: without a derivation of `δ(β)` from first principles, any reported "ν_corrected" would be a fitted constant masquerading as theory.

If you measure ν directly on your model + data and it deviates from `−1/(2π)`, that is expected for non-i.i.d. data and does not falsify the framework — it falsifies the i.i.d. assumption used to derive the constant.

## 3. Future work

- **Attention Entropy Scanner (planned)**: extend `cli/diagnose_model.py` to emit per-layer per-head attention entropy `H(A)` alongside γ, and surface it in a JSON field `attention_entropy.regime_validity`. The browser side already supports the Validity Gate UI; this would let it fire on objective measurement (entropy near `log(L)` = uniform) instead of only on the η ratio.
- **Data correlation diagnostic**: estimate β from a user-supplied text sample and report it as a *diagnostic* (not a correction). Warn when β suggests strong long-range correlations that violate the i.i.d. assumption.
- **Formal ν derivation for non-i.i.d. data**: open problem. We invite contributions but will not ship a "corrected formula" that depends on undefined functions.

## 4. Reading guide for the papers

When citing the closed-form γ or the universal ν constant, please include the regime caveats:

> "The closed-form γ assumes natural training without explicit attention regularization. For models with near-uniform attention (e.g. after entropy regularization, certain post-training losses, or sliding-window architectures), measure γ directly. TAF Agent v0.8.9+ ships a Validity Gate that flags this regime automatically."

> "The universal footprint ν = −1/(2π) is the asymptotic value under the i.i.d. token assumption. For corpora with strong long-range correlations (β ≲ 1 in a 1/f^β autocorrelation), the fixed point shifts; the size of the shift depends on a weighting function whose closed form is open."

## 5. Acknowledgements

This Limitations document was prompted by an external review (DeepSeek, May 2026) of the TAF papers and the TAF Agent tool. The reviewer correctly identified the regime-of-validity issues for both γ and ν. We adopted the diagnostic / disclaimer approach (Validity Gate + this document) rather than the proposed `γ_eff` and `ν_corrected` patches, because the latter introduce undefined parameters (`λ`, `φ(m)`) that we cannot derive from first principles.
