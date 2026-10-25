# TAF Agent — Limitations & evidence

## Reported memory peaks

TAF does not measure GPU memory. The resolver can accept a user-reported scalar
peak with metric and unit. Compatible, phase-isolated tensor peaks may be compared
with resident weights (loading) or the steady estimate (prefill/decode). This is
not a peak prediction or causal diagnosis. Reserved memory, device usage, unknown
phases, mismatched workloads and unsupported geometry block the numerical
difference. A failed allocation is absent from successful allocation peaks;
being below budget cannot rule out OOM. See [the full boundaries](resolver.md#memory-estimates-and-reported-phase-peaks).


Implementation review: **25 October 2026**. This document describes what the
current tools establish. It is not a new experimental validation of the papers.
See the [31-mode audit](resolver-module-audit.md) for individual computations.

## Estimates, inspections and measurements

| Output | Evidence available | What it does not establish |
|---|---|---|
| Configuration-derived γ | A formula evaluated from supplied architecture/context parameters | The distance profile of learned attention or task quality |
| Phase Diagram | Included atlas measurements and formula overlays | A new forward pass on a user-selected model |
| Diagnose CLI | Measurements when the user actually runs Python with model weights | That generating the command in the browser executed it |
| Prediction vs Reality | Statistics and protocol imported from a JSON report | Independent reproduction or verification of that report |
| Fit Check | Estimated weights, KV and overhead under declared assumptions | Observed peak memory, successful loading or production capacity |
| Resolver review | Provenance, limits, existing notices and a next check | A probability of failure, a new model run or an independently verified fix |

Saved and synthetic demos illustrate the controls. They are not measurements of
the user's model. A matching family or model name is not proof that revisions,
weights, tokenizer, backend and measurement protocols match.

## 1. Closed-form γ and attention entropy

The browser's Padé reference is
`γ = (2 − z)/(2 + z)`, with `z = T√2/θ`. This expression contains no learned
query/key weights or dataset. It cannot establish a universal empirical decay
exponent for every softmax transformer. Equal allowed logits, for example, produce
uniform attention within each row regardless of RoPE base. Causal masks and
distance aggregation must be accounted for when defining the measured profile.

Different training objectives, weights, masks and data can change attention.
Neither a discrepancy nor a regime label identifies which of those caused it.
Do not infer fraud, post-training damage or usable context from such a label.
Adding a “standard training” condition also does not, by itself, prove the formula
within that domain: assumptions and empirical tests still need specification.

The historical Validity Gate compares derived quantities using heuristic
thresholds. Passing it is not a validation certificate; failing it is a reason
to inspect the measurement and assumptions, not a causal diagnosis.

### Implemented entropy measurement

`cli/diagnose_model.py --measure-entropy` adds a separately documented entropy
probe; `--entropy-only` runs that probe without the distance sweep. The browser's
standalone `js/entropy_scanner.js` analyzes already measured attention rows and is
not imported as an automatic model-loading feature. See
[the measurement instructions](entropy-correction.md).

Entropy alone cannot identify distance decay: permuting a row's probabilities
preserves entropy while moving mass to different distances. TAF therefore does
not implement an entropy-to-γ correction or an entropy threshold that certifies
Padé. There is no validated `H_RoPE = 0.5 log₂(L)` baseline or mixing coefficient
λ in this feature. Undefined or incompatible measurements must not become zero.

## 2. The inverse Padé horizon is not independent evidence

For `d = θ√2(1 − γ)/(1 + γ)`, substituting the same Padé reference gives:

```text
(1 − γ_Padé)/(1 + γ_Padé) = T√2/(2θ)
d(θ, γ_Padé(θ,T)) = T
```

This is an algebraic identity, not a prediction of usable context. Corrections
to γ can break the equality without independently validating a horizon. Using
measured γ makes a deviation index descriptive of that measurement; it still
does not establish retrieval or reasoning performance. Validate those tasks
directly at the required lengths. A configured context limit is not necessarily
a verified training length or demonstrated quality limit.

## 3. The proposed ν constant and correlation corrections

The discussion of `ν = −1/(2π)` must remain a hypothesis with an explicit
definition, derivation, assumptions and measurement protocol. This implementation
does not establish universal convergence, nor does it establish convergence merely
by imposing an i.i.d. assumption.

Earlier review proposals introduced `δ(β)` and a weighting function `φ(m)` without
deriving or validating them. Those proposals and their illustrative numbers are
not experimental results. This documentation withdraws the previous unsupported
default β range, claimed shift and claim that a discrepancy necessarily falsifies
only the i.i.d. assumption. A disagreement requires checking both the theory and
the experiment; it cannot automatically be assigned to the data.

TAF does not provide a validated correlation-to-ν correction or an automatic
detector of that shift. Numeric token IDs are arbitrary labels, so their numeric
autocorrelation is not an encoding-independent measure of linguistic dependence.
A future diagnostic needs a defined representation, estimator and validation;
it must not present an invented correction as a measured value.

## 4. Resolver review and reproducibility

**Review this result** is an optional panel in all nine direct resolver routes.
It distinguishes configuration estimates, static inspections, heuristic score
comparisons and imported attention measurements. It reuses current inputs/results,
retains protocol notices and missing-field counts, and links to the next check
and a relevant guide chapter. No additional inference is run.
The attention checklist marks 19 known conditions as documented or missing and
compares their declared values with an optional reference. It does not validate
types, scientific appropriateness or truth merely because a field is populated.
Custom fields affect missing/difference counts without exposing their names or
values. The next step follows context issues and protocol differences before
asking for repetition; no missing settings are invented.
The eight non-attention routes prioritize current findings and
provide three verification steps. Their `executed: false` status remains explicit.
Estimated fit, a present template or matching adapter metadata do not establish
successful execution. The illustrative scenario controls replace demo inputs;
they do not convert a user's weights or modify a runtime.
Cache relation categories describe pasted UTF-16 strings, not token boundaries
or actual reuse. Drift priorities use declared settings and two aggregate scores;
matching template-application flags do not prove identical rendered inputs.
The band supplies no statistical uncertainty, and the comparability checkbox
does not verify the task, split, sample set or metric.
Architecture scope is a boundary of TAF's reviewed input schema, not a verdict on
engine support. Synthetic architecture scenarios clear model provenance. JSON
plans concern top-level field-name heuristics, not full schema validity or reasoning
faithfulness; an explanation field is not required by the checker. PEFT plans
cannot follow execution paths or certify loaded weights, gradients or optimizers.
Fixing a lint notice does not establish a measured fix.
Optional step tracking records user declarations, or simulated marks on a demo.
It cannot verify that a check was performed. All-reviewed status does not certify
a repair, and neither tracking nor feedback changes the underlying evidence.
Marks are scoped to the current result and cleared on input changes/recalculation.
They live only in tab memory, without persistence, report import or transmission
through guide links. Retain the original tab to keep the full case.

The local case report uses schema version 3; its `review` object uses version 1.
`independently_verified: false` is explicit, including after a user reports that
a suggestion worked. Pasted questions, prompts, code, measurement/config files
and proposed JSON are excluded as described in [resolver documentation](resolver.md).
The report is not a signed ledger or a reproducibility certificate. It does not
claim bitwise reproducibility across environments. No community monitoring,
posting or telemetry is enabled.

The four interface languages are EN/ES/FR/ZH; the guide is ES/EN, with an explicit
English fallback for FR/ZH. Manual, feature overview and the narrated resolver
demo explain the same boundaries.

## 5. Remaining work

Future extensions should validate estimates against controlled measurements,
record exact revisions and protocols, and distinguish replicated results from
imported reports. Data-correlation estimators, calibrated corrections, a signed
ledger and automatic community replies are not delivered by this update.

The earlier external AI review helped identify questions worth investigating;
its proposed equations and virtual examples are not treated as evidence.

## Save and reopen a private case

All nine direct routes offer **Save private case** after a successful check.
It downloads a version-1 `taf-resolver-private-case` JSON file containing the
initial/current inputs, inspected metadata, declared progress, up to 12
observations and feedback. Pasted code, prompts, reports and adapter metadata
are included when needed to resume. The disclosure explains that this file is
unencrypted and should be kept private. There is no automatic browser storage
or upload. The existing reduced schema-3 report remains separate and continues
to omit pasted local inputs; it cannot reconstruct those omitted inputs.

**Open saved case** accepts up to 4 MiB, validates and previews the route and
save date, then requires **Open and replace current case**. Cancel or invalid
files leave the current case untouched. An import performs local recalculation
from both input sets; it never trusts saved results, fetches repository data,
executes pasted code/Jinja, downloads weights or verifies a repair. Current UI
language is retained. Imported metadata is visibly unverified; the review and
reduced report mark `restored_from_file`. Saved demos remain illustrative.
Running the HF check again refreshes metadata rather than silently reusing the
imported snapshot. Changed check plans discard incompatible follow-up and
feedback; ordinary input edits still reset stale findings as before.

The file parser checks route/version, input bounds, metadata shape, progress and
observation enums, nesting/size and HTTPS Hugging Face source URLs. Unknown
versions and old reduced reports show specific guidance. Restoring uses a
preview/apply step and handles competing asynchronous file reads. The file is
portable between the GitHub and Hugging Face hosts; it does not restore a
language, arbitrary navigation URL or free-form error description, and never
reads or uses account credentials.
It can still contain secrets that a user pasted into their own input: the UI
does not promise automatic redaction. Treat private case files accordingly.

Validation: `npm run test:resolver-session` covers nine-route round trips,
initial/current differences, memory peaks, declared follow-up, malformed data,
provenance, changed plans, reduced-report privacy and four-language browser
reopening after reload, cancellation, keyboard and mobile use.
