# Public discussion sample informing resolver questions

Reviewed 24 October 2026. This is a **qualitative, search-selected sample**, not
a representative census, frequency ranking or proof of the cause in any report.
Public posts are used to understand symptoms and missing information. Proposed
technical checks are bounded by TAF's implementation and official documentation;
forum replies are not treated as verified fixes. No private chat was accessed,
no author was contacted and no monitoring or bot replies were configured.

## Questions that follow from the reports

| Reported symptom | Question to ask before recommending a tool | Current automatic path |
|---|---|---|
| CUDA OOM | Loading, generating or training? One GPU or distributed? Text-only or multimodal? | Loading/generation → memory estimate with strict architecture checks. Training/distributed → explicit limitation and training guide. |
| Chat-template error or repeated prompt | Explicit template error, role/prompt repetition, or structured field order? | Template file inspection or JSON order check. Repetition is not diagnosed as a template fault from text alone. |
| Adapter cannot load / behaves like base | Loading mismatch, unchanged outputs, or preparation code? | Adapter metadata or PEFT code inspection; verify active adapter and controlled outputs in the real runtime. |
| 401/403 or missing config | Access restriction, unrecognized architecture, or GGUF metadata? | Official access steps without credentials; otherwise compatibility or GGUF specialist. |
| Long input fails | Memory exhaustion, missing distant information, or planned extension? | Memory, LongScore or YaRN; distinguish capacity, quality and unvalidated configuration. |
| Different scores | Are model, dataset, metric and scale actually comparable? | Drift requires confirmation, then asks runtime, precision, batch and template for each score. |
| Cost/speed surprises | Token count, edited prefix, or runtime setup? | Token Tax, exact text-prefix comparison, or Launch; no unmeasured latency/cache-hit promise. |

## Primary reports consulted

- [Qwen3-VL-2B, OOM discussion](https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct/discussions/8):
  memory symptoms in a multimodal model. This motivates checking modality and not
  silently treating every parameter count as a dense text-model budget.
- [Distributed GPT-OSS training OOM, February 2026](https://discuss.huggingface.co/t/gpt-oss-20b-torch-outofmemoryerror-cuda-out-of-memory/173047):
  author reports a loading failure in an eight-GPU training setup. Ask the stage
  and distribution mode before offering a single-GPU inference estimate.
- [Missing chat_template, August 2024](https://discuss.huggingface.co/t/chat-template-is-not-set-throwing-error/104095/1):
  explicit template error with library versions. Model ID and actual template
  metadata are more useful than guessing a universal conversation format.
- [Llama repeats its prompt, March 2024](https://discuss.huggingface.co/t/llama-2-repeats-its-prompt-as-output-without-answering-the-prompt/78230):
  ask whether the problem is formatting, returned input text or repeated generated
  tokens. The same visible symptom does not establish one cause.
- [Repetition across Llama models, March 2025](https://discuss.huggingface.co/t/repetition-issues-in-llama-models-3-8b-3-70b-3-1-3-2/144196):
  author reports repetition while extracting structured lists. Do not equate
  field-order linting with a general cure for repeated or incorrect responses.
- [LoRA deployment and saved files](https://discuss.huggingface.co/t/using-text-generation-inference-with-lora-adapter/73286):
  separate adapter artifacts, merged model and runtime loading are different
  situations; inspect base ID and adapter config before proposing changes.
- [Missing config.json after LoRA training](https://discuss.huggingface.co/t/config-json-is-not-saving-after-finetuning-llama-2/56871/6):
  the saved artifact can be an adapter rather than a full model. A missing model
  config does not by itself establish a broken checkpoint.
- [401 despite expected access, June 2024](https://discuss.huggingface.co/t/unable-to-access-model-error-401-gated-model-error-although-i-have-access/90042)
  and [401 report, February 2026](https://discuss.huggingface.co/t/error-401-unauthorized/173092):
  access errors need account/repository/environment checks, not gamma or memory
  formulas. TAF cannot confirm private permissions and must not request tokens.
- [Qwen3-VL batch versus individual outputs](https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct/discussions/9):
  ask about batching and preprocessing, not just temperature. Output differences
  are not automatically comparable benchmark score differences.
- [Qwen2.5-VL online demo versus local setup](https://huggingface.co/Qwen/Qwen2.5-VL-72B-Instruct/discussions/18):
  author supplies backend versions and asks for generation settings. Align exact
  artifacts and settings before interpreting differences as capability loss.

## Technical references checked separately

- [Transformers chat templates](https://huggingface.co/docs/transformers/chat_templating):
  model-specific conversation formatting and special-token/generation conventions.
- [PEFT troubleshooting](https://huggingface.co/docs/peft/developer_guides/troubleshooting):
  adapter/base/loading and training troubleshooting; static lint is only a partial check.
- [Hub gated models](https://huggingface.co/docs/hub/models-gated): account access and
  authentication are separate from public model configuration inspection.
- [lm-evaluation-harness](https://github.com/EleutherAI/lm-evaluation-harness):
  runtime comparisons require controlled evaluation; the project explicitly notes
  possible differences between HF and vLLM outputs.

The interface implements seven symptom families and twenty branches from these
distinctions. It does not display forum authors or reproduce their code. The
complete [module audit](resolver-module-audit.md) explains which TAF computations
can actually support a response and which remain exploratory.
