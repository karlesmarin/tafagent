# Open attention report files in a resolver case

The attention / Prediction vs Reality route can open one local JSON file for the
primary report and another for the optional reference. This connects existing
Diagnose CLI or compatible attention records to the resolver without copy/paste.
It reuses the current analysis and protocol checks; no model is run by import.

## Workflow

1. Open **Solve my problem → attention measurements**.
2. Under the desired field, choose **Open primary report file** or **Open reference
   report file**, then select a JSON file.
3. Review the reported gamma, declared model/revision/source, context classification
   and number of undocumented protocol fields. Long identity labels are shortened
   only in the preview; this does not alter the stored text.
4. Choose **Use this report** to replace only that field, or **Discard preview**.
   Applying clears the previous result, progress, observations and feedback.
5. Run the check explicitly. It analyzes both current fields using the same
   context/protocol rules as pasted reports. Import does not pre-confirm conditions.
6. Use **Save private case** to retain both report texts and resume later.

Selecting, previewing, cancelling, or choosing an invalid/oversized file does not
alter the case inputs or existing result. An edit, route switch, rerun or a newer
file selection invalidates stale previews; late file reads cannot replace newer
inputs. Language changes retain applied texts and discard pending previews.
No filename is added to the case. The input file itself is never modified.

## Accepted content and limits

- A single JSON object with finite numeric `gamma` or `gamma_obs`; zero is valid.
  String, null or missing exponents are not treated as measurements.
- Up to **50 kB = 50,000 UTF-8 bytes** per file, including any byte-order mark.
  A leading UTF-8 BOM is removed for parsing. The textarea normalizes CRLF/CR
  line endings to LF; the JSON content and unknown fields are not projected away.
  This fits the existing 50,000-character textarea limit without raising it.
- At most 20 nested levels and 25,000 visited values, with no nonfinite numbers.
  Collections, compressed files and larger reports are unsupported by this importer.
- Diagnose CLI reports with a numeric exponent are accepted even when context or
  protocol is incomplete. This permits the resolver to explain missing information;
  it does not silently treat incomplete conditions as comparable.
- Entropy-only reports, memory reports and reduced resolver reports do not replace
  the required attention exponent. No entropy-to-gamma conversion is performed.

[Diagnose CLI](../cli/diagnose_model.py) writes JSON when the user actually runs
it with model weights. Some outputs, especially with extra diagnostics, exceed
this importer's size limit. They remain unsupported here; do not remove protocol
conditions merely to make a file fit. The included
[uniform control](../data/measurement_examples/uniform_attention.json) can exercise
file selection, but is synthetic and is not a new measurement of a trained model.

The current CLI can report `length_policy: distance_plus_50` and no single
`T_eval`. The resolver retains the **variable measurement lengths** classification;
it does not replace that with `N` or the configured context limit. Conflicting
`T_eval` and protocol length remain conflicts. A legacy `N` alone does not establish
measured length. Existing missing-field and reference-protocol checks still apply.

## Privacy and provenance

Contents and source labels are unverified, including a label saying `diagnose-cli`.
An imported file may contain illustrative data. No upload, HF lookup, Python,
Jinja, model execution or other code execution is triggered by preview/apply.

The full text, including unknown fields, curves, notes and any private details
already present, survives in the selected textarea and an explicitly downloaded
**unencrypted private case**. This is preservation, not automatic redaction.
The reduced report omits both raw texts and custom protocol names, retaining the
existing numerical findings and categorical protocol review. A private attention
case still uses format version **1**: its two existing text inputs are unchanged.
Memory cases retain their separately documented v2/v3 rules.

`attention_report_file.js` validates files and builds a preview.
`resolver_ui.js` owns selection/apply/cancellation; `resolver_local.js` and
`resolver_protocol.js` continue to perform the analysis. No new report schema or
private-file version is introduced. Original paste workflows remain available.

## Validation

`npm run test:attention-import` checks the included control, CLI-style variable
context, missing/zero/string gamma, byte limits and Unicode/BOM, nested inputs,
context conflicts, preservation and private-case round trips. Browser checks cover
both fields, all four languages, cancellation, invalid files leaving a result
intact, explicit analysis, stale reads, privacy, keyboard and mobile layout.
`npm test` includes the pure tests; CI includes the browser flow. Test fixtures
are not new GPU measurements. The dated 35-demo review covers the previous demo
flows; it does not claim that narrated demos show these new file controls.

[Guía ES](https://karlesmarin.github.io/transformers-guide/es/chapters/R5-tafagent.html#sec-resolver-attention-import) ·
[English guide](https://karlesmarin.github.io/transformers-guide/en/chapters/R5-tafagent.html#sec-resolver-attention-import).
