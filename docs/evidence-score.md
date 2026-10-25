# Evidence checklist score

X-2 and Memory Reality use a **heuristic checklist score**, displayed as points
out of 100. It is not a probability of a correct prediction, an accuracy result,
a confidence interval or a task-quality benchmark. This explanation is visible
beside the score in EN/ES/FR/ZH; the calculation is available in a keyboard-accessible
expanded method. Language changes update an already displayed checklist.

For the listed factors, supported = 1, partial = 0.5 and missing/outside the
stated regime = 0. The score is the rounded weighted average multiplied by 100.
Weights default to 1; non-default weights are shown. Bands are high at 80 or more,
medium at 55 or more and low otherwise. These are design choices, not thresholds
calibrated against held-out accuracy. An empty checklist has no assessment.

The score only describes that checklist. Different modes use different factors,
so their scores are not comparable model-quality rankings. A supplied gamma may
support a factor without validating the whole prediction. The legacy benchmark
factor describes a reference gamma, not an independent task-quality benchmark;
the correction factor checks disabled/exploratory flags, not score calibration.
No data is uploaded or model run by this widget.

## Compatibility

Existing functions `computeConfidence` and `_confidence`, the X-2 `confidence`
object, and `pct` and `band` fields remain available. Existing numeric calculations
are unchanged. Consumers should use the new explicit metadata:

```json
{"score": 75, "max_score": 100, "kind": "evidence_checklist",
 "calibrated": false, "scope": "listed_factors_only",
 "pct": 75, "band": "medium"}
```

The `factors` array accompanies the object. `pct` is a legacy numeric alias, not
a probability. Old objects without the new fields still render as an evidence
checklist. Python uses equal weights; JavaScript also accepts explicit weights.

Prediction vs Reality no longer displays this checklist score. It inspects
measurements, protocol conditions and applicable comparisons. R² is goodness of
fit and is not converted to a probability of correct predictions. Arena bootstrap
confidence intervals and other statistical uses of confidence are separate and
retain their terminology.
