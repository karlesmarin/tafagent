# Solve my problem

This is an automatic guided front door to existing TAF tools. It runs locally in
the browser, without Pyodide, WebLLM, model weights or a support operator. A user
chooses a route, supplies the necessary inputs, receives bounded checks and can
continue with another check, a detailed tool or a guide explanation.

## Initial routes

| Route | Reused computation | What it establishes |
|---|---|---|
| Memory | `checkFit`, guarded by `inspectModel` | An estimated single-GPU, single-sequence budget; distinguishes loading failures from generation budgets |
| Chat template | `sniffChatTemplate` plus template-shape normalization | Presence and marker family in inspected files; not execution or validation of the template |
| Compatibility | `inspectModel`, `classifyMemory` | Architecture, input completeness and limits of the dense schema; not runtime support or model quality |

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

- Header and Ask mode expose **Solve my problem**.
- **🎬 Demo**, beside the resolver heading and in the Manual/feature overview,
  uses the shared `DEMOS` player, like the other TAF tools. It types a sample
  problem, chooses a route, loads a saved example, reduces context and shows
  follow-up, with six step banners, highlighted controls and a final explanation.
  Closing the dialog or taking control with the mouse/keyboard interrupts playback.
  **Start my own case** clears the example inputs.
- `?demo=resolver&lang=es` (also the older `?resolve=demo&lang=es`) starts playback
  without waiting for Pyodide. It fetches
  only the site's saved catalog, never HF metadata or model weights. This demo
  link is the explicit exception to ordinary route links that do not run a check.
- `?resolve=memory&model=Qwen%2FQwen3-8B&lang=es` opens the relevant form without
  fetching metadata or running analysis. Routes are `memory`, `template`,
  `compatibility`, or `choose` for the selection screen.
- Every route has an offline example. Memory uses a saved Qwen3-8B configuration;
  compatibility uses Qwen3.8's hybrid; template inspection uses synthetic ChatML.
- Changing inputs cancels in-flight requests and invalidates the displayed result.
- **It still fails** offers additional checks and lets the user bring an error
  back to the local route selector. It does not claim to have diagnosed the GPU.
- **It worked** is labelled user feedback, not an independently verified fix.
- Reports include displayed inputs/results, revision, inspected sources and user
  feedback, excluding pasted questions/errors. Reports are downloaded locally.
- Shareable links contain only route, model ID and language. They carry no result,
  hardware details, pasted error or question. Users choose where to post them.

No discussion monitoring, webhook service, bot account, automatic replies or
periodic task is enabled by this feature. This first release provides the resolver
and the links through which a future authorized integration can introduce users.

## Adding a route

Add an explicit entry to `CASES` in `js/resolver.js`, required-input validation,
a pure computation that calls the appropriate TAF module, and a dedicated branch
in `solveCase`. Add UI questions, result/action translations in EN/ES/FR/ZH, an
honestly labelled offline example and source/evidence limits. Extend the unit and
browser checks and update the Manual, feature overview, README and guide R5.
Do not derive missing architecture facts from a free-form question.

Validation: `npm run test:resolver` covers numerical boundaries, template shapes,
revision provenance, private-data-free links, three demos in four languages,
follow-up, recalculation, export, mobile layout and operation without Pyodide.
