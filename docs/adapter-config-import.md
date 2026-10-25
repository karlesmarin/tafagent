# Open an adapter configuration in Solve my problem

Updated 25 October 2026. UI and help: EN/ES/FR/ZH; companion guide: ES/EN.

The adapter route already checks pasted metadata. Its optional file input reads
`adapter_config.json` locally, previews declared PEFT type, base, revision, task,
rank and alpha when present, and applies the JSON only after confirmation.
Labels over 160 characters are shortened in the preview only.

1. Open **Solve my problem → Adapters** and enter the base model you intend to use.
2. Expand **Open adapter configuration file** and select the JSON.
3. Review the declared metadata. **Use this configuration** replaces only the JSON
   input. The base-model field stays unchanged, including when it is empty.
4. Run the check explicitly. Import does not run an analysis or fill in the base
   from the file: doing so could conceal a mismatch.

Applying clears the previous result, progress and follow-up. Previewing, cancelling
or rejecting a file preserves the existing inputs and result. Editing inputs,
switching routes, rerunning checks or choosing a newer file invalidates old previews
and late reads. A language change retains applied input, and discards its preview.

## File contract and scope

- One JSON object, at most **50 kB = 50,000 UTF-8 bytes**, with a nonempty string
  `peft_type`. This is a file-input contract, not complete PEFT schema validation.
- Reuses the resolver's checks: optional `r` must be a positive integer and
  `lora_alpha` a finite nonnegative number; zero alpha remains zero.
- Optional non-null base, revision and task must be strings; `use_rslora` and
  `use_dora` booleans; `target_modules` a string or string array; `modules_to_save`
  a string array. Target expressions are retained as text, never executed.
- Optional non-null `rank_pattern`/`alpha_pattern` are objects with positive integer
  ranks / finite nonnegative alphas. Unknown fields are retained. Null optional
  metadata remains missing; it is not replaced by guessed values.
- Unknown nonempty PEFT types are not rejected just for being unknown. Acceptance
  does not certify method support. Soft-prompt methods keep their existing check
  behavior and do not acquire the LoRA missing-target warning.
- Structure is limited to 20 nested levels and 25,000 visited values. Nonfinite
  numbers anywhere, arrays at the root, malformed JSON, weights, archives and
  files over the limit are rejected. Do not remove relevant metadata just to fit.

Existing checks still distinguish missing, declared, matching, family-only and
mismatching base IDs. Family similarity does not establish exact base identity.
Revision is shown as declared metadata; this change does not compare revisions,
inspect weights, load models, run training, or measure quality/forgetting. A
filename or `peft_type` does not authenticate provenance. No upload or HF request
is made by this file flow. Pasting text retains its existing validation rules.

## Privacy and continuity

The original file is untouched. Its name is not saved. A leading UTF-8 BOM is
removed; the textarea normalizes CRLF/CR to LF. The full JSON text, including
unknown fields and private paths or notes, remains in the input and **Save private
case**. This still uses private-case **v1** because the existing `text` and `base`
fields are retained. Private files are unencrypted and not automatically redacted.

The reduced report omits the raw configuration and base-model text, retaining
computed categories/numeric facts as before. Reopening a private case recalculates
from its inputs; it does not accept a stored verdict as verified evidence.

## Validation

`npm run test:adapter-import` covers boundaries, typed metadata, unknown fields,
zero alpha, soft prompts, family-only and mismatching bases, private v1 roundtrip
and reduced-report privacy. Browser coverage checks all four languages, preview,
explicit apply/check, invalid/cancel preservation, unchanged base, stale reads,
keyboard/mobile, contextual guide links and no HF requests.

`npm test` includes the unit checks; CI also runs the browser check. Existing
attention-file and private-case browser suites cover the adjacent flows. These
tests use synthetic metadata; they do not train or execute an adapter. Previous
recorded demos do not show this new file selector.

See [resolver workflow](resolver.md), [module audit](resolver-module-audit.md),
[limitations](LIMITATIONS.md), [Spanish guide](https://karlesmarin.github.io/transformers-guide/es/chapters/R5-tafagent.html#sec-resolver-adapter-import)
and [English guide](https://karlesmarin.github.io/transformers-guide/en/chapters/R5-tafagent.html#sec-resolver-adapter-import).
