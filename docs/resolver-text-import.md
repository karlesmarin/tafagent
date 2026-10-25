# Open JSON, PEFT code and prompt files

Updated 25 October 2026. UI/help EN/ES/FR/ZH; companion guide ES/EN.

The JSON (`cot`), PEFT code (`peft`) and prompt-prefix (`cache`) routes in
**Solve my problem** accept local files as an alternative to pasting. The earlier
and new prompt each have their own selector. Imports use existing checks and do
not add model execution, a Python parser, full JSON Schema validation or a cache
measurement.

## Workflow

1. Select the route and expand its file selector below the relevant text field.
2. Choose a UTF-8 file, at most **50 kB = 50,000 bytes**: `.json` for JSON,
   `.py`/`.txt` for code, `.txt` for a prompt. Extensions are picker hints, not
   proof of content or origin. No notebook extraction, archive or PDF conversion.
3. Review the size, line count and literal text preview. It shows at most 12 lines
   and 1,200 Unicode code points, with a partial-preview label when shortened.
   The count includes a final empty line after a trailing newline.
4. **Use this text** replaces only the selected field. In the prompt route the
   other field is retained. Applying preserves the complete accepted text, not
   merely the preview, and clears previous results and follow-up.
5. Run the check explicitly once the inputs are ready. Reading and applying a
   file do not run a check. Cancelling, invalid or oversized files preserve inputs
   and results. Selecting a new file clears older previews.

Edits, route changes and rerunning checks invalidate pending reads. Switching
language keeps applied text and discards previews. Text is displayed literally;
HTML or script-like text is not inserted as markup. Files are not uploaded, code
is not executed, and prompts are not sent to a model. The import performs no HF
lookup and does not authenticate authorship or provenance.

## Input contract

UTF-8 is decoded strictly. Invalid sequences, empty/whitespace-only text, NUL
characters and oversized files are rejected. Convert UTF-16/other encodings to
UTF-8 explicitly. A leading UTF-8 BOM is removed and CRLF/CR line endings are
normalized to LF. The byte limit includes the original BOM and line endings.
Other accepted text, including trailing spaces and private data, is retained.

JSON must be one object. Basic `properties`/`required` types follow the existing
route: non-null `properties` is an object, and non-null `required` a string array.
Unknown fields are preserved. Nonfinite numbers are rejected; the object is
bounded to 20 nested levels and 25,000 visited values. This does not resolve refs,
validate all schema keywords, prove a generated response conforms to a schema,
or guarantee reasoning quality. Reordering remains an explicit existing option.

PEFT code remains text inspected by the existing regex checks when you run them.
Accepting a file does not establish Python syntax, imports, control flow or runtime
behavior. Text with no recognized PEFT call retains the existing no-call result.

Prompt comparison remains a longest common prefix in JavaScript UTF-16 units,
not tokenizer tokens, provider cache hits, pricing or byte-for-byte identity of
the original files. For example `A\r\nB` and `A\nB` both become `A\nB` in the input.
Neither case nor spaces are otherwise normalized. An identical normalized text
does not establish that any provider reused a cache.

## Privacy, cases and tests

The full normalized text is kept in the inputs and **Save private case**, still
format **v1** for these routes. Private files can contain prompts, code, secrets
and unknown JSON fields; they are unencrypted and not automatically redacted.
The original file is unchanged and its filename is not stored. Reopening a case
recalculates locally rather than trusting a saved verdict.

The reduced report omits original code/prompts/JSON and the JSON reorder proposal.
This flow does not put file contents into shared or guide URLs. Guide links carry
route, language and return host only, with the relevant guide topic.

`npm run test:text-import` covers all three routes and four input positions across
four languages, strict decoding, limits, BOM/LF, shortened previews, literal HTML,
explicit checks, field preservation, privacy, v1 roundtrip, stale reads, keyboard,
mobile and guide links. `npm test` includes the unit checks; CI includes browser
coverage. Existing attention, adapter and saved-case browser suites protect
adjacent flows. Fixtures are synthetic; no models, training or cache benchmarks
are run. Earlier recorded demos do not show the new selectors.

See [resolver](resolver.md), [module audit](resolver-module-audit.md),
[limits](LIMITATIONS.md), [Spanish guide](https://karlesmarin.github.io/transformers-guide/es/chapters/R5-tafagent.html#sec-resolver-text-import)
and [English guide](https://karlesmarin.github.io/transformers-guide/en/chapters/R5-tafagent.html#sec-resolver-text-import).
