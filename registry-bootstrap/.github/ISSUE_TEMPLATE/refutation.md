---
name: ❌ Refute a prediction
about: TAF prediction contradicted by empirical measurement
title: '[Refute] '
labels: refuted
---

## Hash of analysis being refuted

`#__________`  ← paste the hash from the original issue's title

## Original issue

Link: #__

## TAF prediction

What did TAF say:
- Verdict: __
- Key number: __ (e.g. d_horizon = 47781)

## My empirical measurement

What actually happened:
- Verdict observed: __
- Key number measured: __ (e.g. NIAH collapse at L=12K, well before predicted ceiling)
- Magnitude of disagreement: __ (% or absolute)

## Setup

- Hardware: __
- Software: __ (versions matter!)
- Random seed(s) tried: __
- Number of trials: __

## Method

Detailed enough that a third party can reproduce:

```bash
# Step-by-step commands
```

```python
# Or full Python script
```

## Hypothesis on why TAF was wrong

- [ ] Out-of-regime (e.g. extrapolation beyond validity zone)
- [ ] Architecture-specific quirk not captured in formulas
- [ ] Model has unusual training data
- [ ] Bug in TAF formulas
- [ ] Other: __

Detailed thoughts:

## Suggested update to TAF

If applicable, what should the framework do differently?
- [ ] Update validity bounds for this recipe
- [ ] Add a caveat for this architecture family
- [ ] Withdraw the prediction (move to NR-X in paper appendix)
- [ ] No change needed (this is a known edge case)
