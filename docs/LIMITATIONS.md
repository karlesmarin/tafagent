# TAF Agent — Limitations & Regime of Validity

This document records the assumptions behind the closed-form predictions used in TAF Agent and the conditions under which they may fail. It complements the in-tool **Validity Gate** banner (γ Predicted vs Observed panel) and the empirical Phase Diagram.

## TL;DR

| Closed-form | Assumption | When it breaks | Detection in TAF Agent |
|-------------|------------|----------------|------------------------|
| **γ_Padé(θ, T) = (2−z)/(2+z), z = T√2/θ** | Natural training; attention follows the architectural RoPE-induced shape; no explicit attention regularization | Heavy regularization, RLHF/instruction-tuning collapse, sliding-window architectures, undertrained checkpoints | η = θ_eff_obs / θ_eff_Padé outside [0.85, 1.15] → Validity Gate banner |
| **ν = −1/(2π) (universal footprint)** | Token sequence is i.i.d. when computing the gradient fixed point of the RoPE base | Real text has long-range correlations (1/f, Zipf-like). Synthetic data can shift the fixed point further | Not yet detected automatically — see Future Work |

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
