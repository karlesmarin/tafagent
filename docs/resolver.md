# Solve my problem

## Import a local adapter configuration

Open `adapter_config.json` in the adapter route, review its declared metadata and
apply it explicitly. The base-model field remains unchanged; run the check to
compare it with the declared base. Invalid/cancelled files preserve the case.
Maximum 50 kB; full JSON remains in private v1 cases and is omitted from reduced
reports. No HF request or model execution. [Contract and tests](adapter-config-import.md).


## Open attention report files

The attention route can preview a local JSON as its primary report or reference
and explicitly replace only that text input. A subsequent Run performs the existing
context/protocol analysis. Limit: 50,000 bytes; one record with numeric gamma or
gamma_obs. Private cases retain full text using the existing v1 format; reduced
reports omit it. [Workflow, privacy and bounds](attention-report-import.md).

## Compare two memory measurements

Memory cases can retain Before and After records, require matching declared
conditions/runtime and later After timestamp, and show a descriptive GiB/percent
delta after explicit confirmation. No inference, upload or causal verdict.
See [workflow and privacy](memory-measurement.md#compare-before-and-after).

## Import a local memory measurement

The memory route accepts a previewed `taf-memory-measurement` v1 JSON (64 KiB). Model/revision/phase/precision/workload mismatches and missing data prevent numeric comparison. Applying only fills peak value/unit/metric and resets manual confirmations; it does not change the case identity. Private cases retain the record; reduced reports omit its raw metadata. See [complete workflow and collector](memory-measurement.md).


## Save and reopen a private case

All nine direct routes offer **Save private case** after a successful check.
It downloads a versioned `taf-resolver-private-case` JSON file containing the
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


### Private file format and maintenance

`resolver_session.js` owns `saveCase` / `readSavedCase`; `resolver_ui.js` owns
preview/apply and browser downloads. `resolver_session_i18n.js` supplies EN/ES/FR/ZH.
No backend or additional package is required.

| Field | Meaning |
|---|---|
| `format`, `version` | `taf-resolver-private-case`, versions `1` (none), `2` (one measurement), `3` (pair in current or initial inputs); unknown versions rejected |
| `saved_at`, `route` | Save date and one of the nine supported direct routes |
| `bundle` | Declared origin, model/revision/date, inspected metadata and source references |
| `inputs`, `initial_inputs` | Current and initial route inputs used for recalculation |
| `progress` | Plan key and three declared states, or `null` |
| `observations` | At most 12 route/plan/step/outcome entries |
| `feedback` | Empty, `worked` or `failed`; always a user declaration |

Computed results, rendered explanations and arbitrary navigation state are not
serialized. Imports derive results with `solveCase` from both input sets and
match follow-up to the current plan. Version 1 has no migration from the reduced
report format because those reports deliberately lack required private inputs.
Keep format validation, UI notices, all translations and browser tests aligned
when changing this contract. A file declaring HF origin is not authenticated by
that label: every reopened case has `restoredFromFile` in memory and the reduced
report/review expose `restored_from_file: true`.

## Memory estimates and reported phase peaks

The memory route distinguishes loading, prompt prefill, subsequent-token decode,
and an unknown post-loading phase (`generate`, retained for compatibility).
`generate()` can contain both prefill and decode. At comparison time, enter prompt
tokens for prefill and actual cached prompt-plus-generated tokens for decode.
The existing single-GPU/single-sequence/resident-weights/FP16-KV scope remains.

The optional peak form accepts a nonnegative value in GiB, decimal GB or MiB,
and distinguishes PyTorch allocated tensors, allocator reserved memory, sampled
device usage and an unknown metric. Missing values stay absent. The allocation
requested in an OOM error is not a peak. Only a tensor-allocation peak with a known
phase, matching workload and explicitly isolated measurement gets a numerical
baseline difference. Unsupported model geometry also blocks that comparison.
Loading uses resident weights as its baseline; prefill/decode use the existing
steady estimate. Neither baseline predicts a phase peak. Reserved/device values
remain context and are not subtracted from the estimate. No difference is
labelled fragmentation, a verified cause, a successful fix or a probability.

Changing model, available budget, tokens, precision or phase clears the peak and
its confirmations. Applying a lower-context/precision alternative also clears it.
Language changes retain the measurement. Reports retain initial inputs separately
from current inputs. Sharing a link never includes a peak or hardware inputs.
Schema-3 reports add `result.memoryPeak` / `review.memory_peak` version 1 with
`source: user_reported | illustrative`, `independently_verified: false` and
`executed_by_taf: false`. The difference is descriptive, even when all gates pass.

The fifth memory example uses saved Qwen3-8B geometry at BF16/4,096 prompt tokens
with a **synthetic** 22 GiB allocated prefill peak and a 24 GiB budget. It illustrates
a peak above the estimate, not a measured Qwen benchmark or proof of OOM. A peak
below the budget does not rule out OOM: failed allocations are not successful
allocations, and allocator/device/runtime limits differ.

For measurement, isolate the phase in your runtime, synchronize the selected
CUDA device, reset its peak statistics, execute that phase and synchronize again
before reading the counters. A whole `generate()` peak must remain phase-unknown
unless the runtime exposes separate prefill/decode boundaries. Record versions,
actual dtype/backend, device, tokens and relevant runtime options alongside the
measurement; TAF does not collect those logs or execute instrumentation.
[PyTorch memory management](https://docs.pytorch.org/docs/stable/notes/cuda.html#cuda-memory-management)
distinguishes tensor allocations from reserved memory;
[max_memory_allocated](https://docs.pytorch.org/docs/stable/generated/torch.cuda.memory.max_memory_allocated.html)
returns bytes for the selected device, and
[reset_peak_memory_stats](https://docs.pytorch.org/docs/stable/generated/torch.cuda.memory.reset_peak_memory_stats.html)
resets its peak counters, without freeing tensors.

Validation: `npm run test:resolver-memory`; standard `npm test` includes the pure
phase/comparison tests. Browser tests cover all four languages, units, gates,
provenance, exports, changed inputs, language changes, keyboard and mobile.

## Follow-up from reported observations

**What happened when you checked?** is available on all nine direct routes.
Select the attempted step and a concrete observation: 27 route-specific outcomes
plus unavailable evidence. For example, a short request working while a longer
one fails leads to a controlled length/peak-VRAM comparison; failure before
generation leads to loading peaks and actual weight-format checks.

**It still fails** opens this panel. After recording an observation, its next
instruction takes precedence in the follow-up, while the original findings and
declared progress remain unchanged. Suggested tools open the existing catalog
with their requirements and limits; no runtime check starts and tool results
are not imported automatically.

The last 12 observations are kept in order for the current result. New inputs,
recalculation, changing examples/routes and reload clear them. Closing/reopening
or changing language retains saved observations. Clear observations leaves the
analysis and progress marks intact. An unavailable-evidence response returns to
the selected step and does not invent a successful result.

Schema-3 case reports add `observations` version 1: allowed category and step
keys, localized labels/instructions, selected tool and ordered history, with
`source: illustrative | user_reported`, `independently_verified: false` and
`executed_by_taf: false`. They include no new free-text notes, credentials,
prompts or code. These are user reports, not imported runtime measurements or a
verified repair. Reports still cannot restore a session.

The interactive demo illustrates an observation in step five. The existing
recorded video documents the earlier progress-only flow; use the interactive
demo for observations. All controls, guidance and help support EN/ES/FR/ZH.
Guide R5 and the relevant ES/EN chapters explain the same workflow.

Fit Check's standalone demo now awaits the site's saved Qwen3-8B configuration,
sets a reproducible 24 GiB/BF16/FP16-KV scenario and requires a rendered budget
before showing completion. It does not fetch HF metadata or wait for Pyodide.
Unavailable example data stops the demo without a success explanation.



This is an automatic guided front door to existing TAF tools. It runs locally in
the browser, without Pyodide, WebLLM, model weights or a support operator. A user
chooses a route, supplies the necessary inputs, receives bounded checks and can
continue with another check, a detailed tool or a guide explanation.

All supported checks, explanations and follow-up suggestions are generated by
TAF. There is no human support inbox, operator handoff or expected owner reply.
Users supply inputs and choose whether to apply the suggestions in their own
runtime; TAF does not remotely change their model or execute repairs.

## Symptom-first entry and direct checks

The first selector asks what is going wrong, without requiring module names.
Seven families contain 20 specific situations. The follow-up distinguishes loading
from generation/training, template errors from prompt repetition, adapter loading
from apparently unchanged outputs, and access errors from architecture issues.
See [the discussion sample and question rationale](resolver-community.md).
Routing is deterministic and is not a causal diagnosis. Training/distributed
memory and account authorization receive an explicit boundary and useful reading,
not a fictitious successful check. Users can also open **I already know what to
check**, paste an optional error, or browse the 31-mode catalog.

| Route | Reused computation | What it establishes |
|---|---|---|
| Memory | `checkFit`, guarded by `inspectModel` | An estimated single-GPU, single-sequence budget; distinguishes loading failures from generation budgets |
| Chat template | `sniffChatTemplate` plus template-shape normalization | Presence and marker family in inspected files; not execution or validation of the template |
| Compatibility | `inspectModel`, `classifyMemory` | Architecture, input completeness and limits of the dense schema; not runtime support or model quality |
| JSON | `lintJsonCot`, `reorderJsonText` | Recognized top-level reasoning/answer order; optional local proposal, not full schema validation |
| PEFT code | `lintPeftCode` | Regex-based loading/order/target/scaling observations; no Python execution or control-flow analysis |
| Prompt prefix | `longestCommonPrefix` | Exact UTF-16 text prefix length; no token-cache hit or cost prediction |
| Evaluation drift | `computeDriftBound` | Comparable score gap and hand-set band; no proven bug or significance test |
| Attention report | `normalizeMeasured`, `predictionContext`, `compareProtocols` | Imported gamma, documented-context baseline and protocol gaps; no inference |
| Adapter metadata | `parseAdapterConfig`, `compatChecks` | Base, target and scaling observations; no successful loading or forgetting claim |

The six local checks require pasted data and do not fetch HF. Every direct route
has a saved/synthetic example. Pasted content is capped at 50,000 characters per
field. JSON proposals are only copied into this local form when the user chooses
to check them. Required fields and properties are preserved during reordering.

The catalog connects all 31 modes to their specialized forms and existing demos;
these may require Pyodide, network metadata/tokenizers, local Python or WebGPU.
Each entry states inputs, outputs and limitations in EN/ES/FR/ZH. This is navigation
coverage, not a claim that 31 computations run inside the resolver.
The [implementation audit](resolver-module-audit.md) records the distinctions.

The optional local text field suggests categories using multilingual keywords.
The user chooses the route. Text is not sent to an LLM or to HF. Model search
queries HF; checking a case retrieves the model metadata and revision-pinned
config or tokenizer/template files. No model code or Jinja is executed.

Template inspection checks `tokenizer_config.json` and `chat_template.jinja`.
HF supports additional template layouts and multimodal processor templates:
absence from these two files is explicitly not proof that a model has no template.
See [HF chat templates](https://huggingface.co/docs/transformers/chat_templating)
and [storage formats](https://huggingface.co/docs/transformers/chat_templating_writing).

Memory estimates reuse Fit Check's assumptions, including scratch allowances,
FP16 KV cache and approximate parameter counts. They do not measure GPU usage,
loading peaks, fragmentation, other processes, tensor parallelism or CPU offload.
Quantization suggestions stay within the chosen format family and require a
compatible checkpoint/runtime. A fitting estimate does not promise a successful
run or preserved quality. The reduced-context button only recalculates a scenario.
See [HF cache strategies](https://huggingface.co/docs/transformers/kv_cache).

## Navigation and user control

**Watch the video** offers an optional recorded walkthrough with English
narration and seven timed caption cues in EN/ES/FR/ZH. The interface language
selects the initial subtitle track; users can select another language or turn
subtitles off. The media element is created only when its disclosure is opened,
uses `preload="none"`, and never autoplays. Closing the disclosure or resolver
pauses playback. Starting the interactive demo collapses the video. The Manual
and feature overview describe this separate recorded option. It is a saved,
illustrative example, not model inference or a verified repair. See
[media provenance](../media/resolver/README.md).

**Track my checks** is an optional follow-up panel on all nine routes. Three steps
reuse the current ordered plan; attention reuses its protocol priority followed
by observation and interpretation instructions. Users can mark a step pending,
reviewed without a discrepancy, discrepant, or blocked. The next action follows
the first discrepancy, then first blockage, then first pending step. A focus button
opens the corresponding control. Marking everything reviewed does not certify a fix;
the panel asks for a check of the original task and preserves counterexamples.

Marks are declarations. They neither alter findings/protocol metadata nor mark a
repair verified. **It still fails** incorporates the declared next action alongside
the original evidence-based plan. The guide link remains tied to the case.
Without an explicit private case download, marks stay only in the current tab's memory: closing/reopening the resolver or
changing language preserves them. Input changes, reruns, adjusted estimates,
alternative examples and route changes clear them, even when priority is unchanged.
Reloading loses unsaved cases and marks. Use Save private case before leaving
and Open saved case to resume. Reduced reports cannot restore omitted inputs.
Guide return links open a fresh form; keep the original tab or save a private case.

Each saved example offers **Simulate a blocked check**: one reviewed step, one
blocked step and one pending step. This action exists only for illustrative cases.
The narrated resolver demo shows it in step five. Real inputs have no simulation
button. **Clear my marks** resets only the declarations, preserving the result.

Case report schema 3 adds `progress` version 1: fixed step keys, localized
instructions/status labels, counts and the selected next action, with
`source: illustrative | user_reported`, `independently_verified: false` and
`executed_by_taf: false`. No free-text notes, pasted inputs or runtime evidence
are copied into this object. A downloaded report is not a restorable session.

- Header and Ask mode expose **Solve my problem**.
- **🎬 Demo**, beside the resolver heading and in the Manual/feature overview,
  uses the shared `DEMOS` player, like the other TAF tools. It selects the memory
  symptom, answers that failure occurs while generating, then loads a saved
  example, reduces context, opens the evidence review and shows follow-up,
  with six step banners, highlighted controls and a final explanation.
  Closing the dialog or taking control with the mouse/keyboard interrupts playback.
  **Start my own case** clears the example inputs.
- `?demo=resolver&lang=es` (also the older `?resolve=demo&lang=es`) starts playback
  without waiting for Pyodide. It fetches
  only the site's saved catalog, never HF metadata or model weights. This demo
  link is the explicit exception to ordinary route links that do not run a check.
- `?resolve=memory&model=Qwen%2FQwen3-8B&lang=es` opens the relevant form without
  fetching metadata or running analysis. Routes are `memory`, `template`,
  `compatibility`, `cot`, `peft`, `cache`, `drift`, `pvr`, `adapter`, or `choose`
  for the symptom selection screen. Local routes do not include an unrelated model
  ID when sharing their navigation link.
- Every route has an offline example. Memory uses a saved Qwen3-8B configuration;
  compatibility uses Qwen3.8's hybrid; template inspection uses synthetic ChatML.
- Changing inputs cancels in-flight requests and invalidates the displayed result.
- Results and the animated demo end with a case summary: the original problem,
  the check, any before/after adjustment, and the remaining verification. The
  guide link points to a relevant section on KV growth, quantization, serving,
  evaluation controls or attention families, with a sentence explaining its use.
  ES opens the Spanish guide; EN/FR/ZH use English (explicitly noted for FR/ZH).
  Returning from that reading preserves the resolver route, TAF UI language and
  original GitHub/Hugging Face host. It prepares the form without running a check;
  the original tab retains the complete result. Local inputs are not transmitted
  or restored, and saved demos do not carry an asserted user-model ID.
  The summary is built from recorded inputs and estimates, never inferred from
  pasted error text. Starting another check clears the previous comparison.
- **It still fails** offers additional checks and lets the user bring an error
  back to the local route selector. It does not claim to have diagnosed the GPU.
- **It worked** is labelled user feedback, not an independently verified fix.
- Reports include displayed inputs/results, revision, inspected sources and user
  feedback, the original inputs and case summary with its guide link, excluding
  pasted questions/errors. For the six local checks, reports also omit pasted
  code/prompts/measurement/config files and proposed JSON, retaining derived facts
  and explanations only. Reports are downloaded locally (schema version 3).
- **Review this result** accompanies all nine direct checks with the evidence
  type, provenance, unverified assumptions, next check and contextual guide link.
  It distinguishes configuration estimates, static inspections, heuristic score
  comparisons and imported attention measurements. Saved/synthetic demos remain
  labelled examples. Missing protocol counts and existing protocol notices remain
  visible, even when a numerical comparison can be calculated. No confidence
  score, probability of failure or independent verification is invented.
  This optional panel uses the current result, performs no additional inference,
  and is included in the local report under `review` (version 1). The narrated
  demo opens it before showing follow-up checks. Recalculation and language
  changes rebuild it; changing inputs clears it with the previous result.
- In the attention route, **Show protocol details** opens the review directly.
  Nineteen fixed conditions are grouped by model/data, sampling, execution and
  aggregation/fit. Each shows whether A documents it and, when B is supplied,
  whether the declared values match, differ or lack documentation. This is not
  validation of those values. Additional custom fields are counted without
  exporting their names or values. The existing offline example demonstrates
  missing conditions; zero indices and seeds remain valid, as does explicit
  `none` for disabled quantization.
- **What to check first** prioritizes A's context issue, then B's context issue,
  then differing conditions, then incomplete documentation; otherwise it asks
  for curve/fit inspection and controlled repetition. It never fills unknown
  settings or turns a variable-length sweep into an invented fixed-length run.
  The summary, review and **It still fails** use the same priority. Schema 3
  reports add `result.protocolReview` and `review.protocol` (each version 1),
  containing field-status codes and counts only, not pasted protocol values.
- **Share tool and model (optional)** is a navigation link, not a support request.
  Shareable links contain only route, model ID and language. They carry no result,
  hardware details, pasted error or question. Users choose where to post them.

No discussion monitoring, webhook service, bot account, automatic replies or
periodic task is enabled by this feature. This feature provides the resolver
and the links through which a future authorized integration can introduce users.

## Ordered checks across the eight configuration and local-inspection routes

`resolver_checks.js` selects one of 41 priorities from the current result.
The ninth route, attention/PVR, retains its separate protocol checklist.

| Route | Priorities |
|---|---|
| Memory | Unsupported/missing geometry; weight budget exceeded; loading failure; KV budget exceeded; tight estimated margin; estimate fits; prefill; decode |
| Template | Missing from inspected files; multiple choices without an unambiguous default; present |
| Adapter | Base unidentified/not compared; base mismatch; family-only match; target modules; saved embeddings; per-module settings; unusual scaling; loading/activation |
| Prompt cache | Change after a shared prefix; identical text; appended text; shortened text; change from the start |
| Evaluation drift | Unknown template application; different application states; changed framework/precision/batch; matching supplied settings with gap above or within the descriptive band |
| Architecture | Outside the reviewed dense schema; incomplete/inconsistent metadata; accepted geometry with runtime verification still required |
| JSON | Answer-like field before explanation-like field; preferred order recognized; no applicable top-level field-name pattern |
| PEFT code | Creating versus loading; k-bit preparation order; target modules; scaling convention; no recognized calls; no configured findings |

**See the verification steps** opens three instructions: the priority check,
what to observe in the user's environment, and how to interpret or redirect an
unresolved case. The summary and **It still fails** share these instructions.
They are not executed by TAF. A recalculation rebuilds the plan; changing inputs
clears it. Existing notices remain visible when a higher-priority issue wins.
Conditional tool buttons open the existing catalog's input/limit explanation,
preserving the current result; they neither run a tool nor infer another cause.

After loading an example, **Explore another example** offers five memory cases,
three template cases, three adapter cases, five cache cases, five drift cases,
three architecture cases, three JSON cases and six PEFT-code cases. Choosing one resets that demo's
initial comparison, stays explicitly illustrative and performs no HF lookup or
model run. Ordinary user-input results do not show these replacement controls.
The animated memory demo highlights the ordered checks in step five.

The alternate architecture examples use synthetic configs and clear the previous
model ID, revision and sources. They cannot attribute synthetic geometry to the
model previously inspected. Architecture limitations take precedence over missing
dense dimensions: adding invented dense fields does not repair an unsupported
architecture. Accepted input geometry does not certify runtime support.

JSON guidance explicitly separates property-order experiments from JSON Schema
validation and reasoning quality. It does not require adding a reasoning field;
unclassified/nested names remain outside the heuristic. Trying the optional reorder
recalculates the steps, without running generation or certifying schema compliance.

PEFT guidance uses existing finding codes and line references, never pasted paths
or code in reports. Load intent takes precedence over call order, targets and
scaling; all findings remain visible. Regex matches may misread aliases, separate
functions, strings or custom modules. A clean snippet is not a verified setup,
and an alpha/r convention is not a correctness rule. The guide sections in chapters
10/28/30 are linked directly, including a return to the original TAF host.

These boundaries follow the [JSON Schema data model](https://json-schema.org/draft/2020-12/json-schema-core#section-4.2.1),
the [PEFT quantization workflow](https://huggingface.co/docs/peft/developer_guides/quantization)
and [PEFT troubleshooting](https://huggingface.co/docs/peft/developer_guides/troubleshooting),
reviewed on 25 October 2026. No Python, training or generation is executed by the checks.

Schema-3 reports add `summary.checks` and `review.checks` (version 1), containing
the priority, localized instructions and `executed: false`; `demo_scenario`
identifies a selected example. Adapter results retain only categorical base and
target evidence, not pasted configuration values or the intended private base ID.
Soft-prompt methods do not receive a LoRA-style missing-target warning. A missing
target list for a method that uses targets prompts inspection of actual defaults,
not an automatic conclusion that training failed.

Cache plans use only the relation between the two pasted strings. Prefix counts
are UTF-16 units, not tokens; tokenization at an appended or truncated boundary
can change. No cache counters, prices or speedups are inferred. Plans ask for
final rendered inputs and controlled cold/warm measurements in the user's runtime.
Token Tax is available for token counts, with an explicit limit: it cannot verify
cache reuse. Reports include the relation but omit both pasted prompts.

Drift plans prioritize missing template evidence, then a declared template mismatch,
then changed framework/precision/batch, even if scores agree. Matching application
states do not establish identical rendered templates. With matching supplied
settings, the existing descriptive band selects repeat/investigate or quantify
uncertainty; it is not a significance test. `driftEvidence` stores categorical
flags and changed-setting names. No cause, verified fix or experimental run is
inferred. The comparability checkbox remains a user declaration, not validation
of benchmark version, split, samples or metric.

Cache and drift guidance follows the official [vLLM prefix-cache design](https://docs.vllm.ai/en/latest/design/prefix_caching/)
and [lm-evaluation-harness interface](https://github.com/EleutherAI/lm-evaluation-harness/blob/main/docs/interface.md),
reviewed on 25 October 2026. The guide explains these cases in chapters 36 and 40;
the contextual return link reopens the same resolver and original host.

The guidance was checked against the official [chat-template documentation](https://huggingface.co/docs/transformers/chat_templating)
and [PEFT troubleshooting](https://huggingface.co/docs/peft/developer_guides/troubleshooting)
on 25 October 2026. Memory guidance follows the actual Fit Check assumptions;
runtime memory still requires measurement. No install, training, upload or public
reply is triggered by these steps.

## Extending a route

Add an explicit entry to `CASES` in `js/resolver.js`, required-input validation,
a pure computation that calls the appropriate TAF module, and a dedicated branch
in `solveCase`. Add UI questions, result/action translations in EN/ES/FR/ZH, an
honestly labelled offline example and source/evidence limits. Extend the unit and
browser checks and update the Manual, feature overview, README and guide R5.
Do not derive missing architecture facts from a free-form question.

Validation: `npm run test:resolver` covers numerical boundaries, template shapes,
revision provenance, private-data-free links, nine examples in four languages,
the 20 symptom choices, all 31 tool/demo/guide routes, follow-up, recalculation,
JSON proposal preservation, exports, mobile layout and operation without Pyodide.
