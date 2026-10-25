# Read llama.cpp memory logs

Updated 25 October 2026. UI/help EN/ES/FR/ZH; guide ES/EN. This extends the
existing memory route; the nine routes and 31 specialist modes are unchanged.

## Workflow

1. Open **Solve my problem → memory**, enter the model and planning conditions,
   and run the existing check. Even when the architecture is outside the estimate's
   scope, the completed case can accept a log.
2. Open **Read a llama.cpp memory log**. Select a local UTF-8 `.log`/`.txt` file,
   or paste text and choose **Preview log**. Maximum **256 KiB (262,144 bytes)**.
   Select one initialization excerpt, not a concatenation of runs.
3. Review recognized lines and metadata, then **Attach log to this case**.
   The case recalculates locally; the model, precision, context and manual peak
   stay unchanged. No upload, HF request, model execution or command execution.
4. Check model/revision, weight format, hardware and execution conditions yourself
   before selecting the confirmation. It starts unchecked for every attachment.
   It cannot override missing, different or ambiguous parsed conditions.
5. **Save private case** retains the entire normalized log. The reduced report
   keeps numerical declarations and checks, omitting the original text.

The built-in synthetic example is preview-only and has no attach action. It
illustrates a CPU/GPU split and recurrent state without claiming a measured run.
Real file provenance is not authenticated; fabricated logs cannot be detected
reliably. Changing the language retains attached data and discards the preview.
Changing model, GPU budget, context, precision or phase clears the attached log
and its confirmation. Removing it preserves other measurement inputs. Attaching,
removing or confirming resets progress, observations and feedback. The existing
before/after peak workflow remains separate. Invalid input preserves the case.
Late reads are ignored after edits, reruns, navigation or replacement of the panel.

## What the numbers mean

Recognized lines describe **buffer sizes declared by the runtime log**. They are
not PyTorch allocated-memory peaks, `nvidia-smi` device usage, total process usage,
or evidence of successful inference. No peak field is populated from a log.

Rows retain their source line number, component and recognized placement:

- Model weights; KV cache; recurrent state (`RS`); compute and output buffers.
- `CUDA0`…`CUDA999` are separate devices. `CPU`, `CPU_Mapped` and `CUDA_Host`
  remain host categories; pinned host storage is not GPU VRAM.
- Other backend names become **Other backend**. No discrete/host placement or
  capacity is inferred for Metal, Vulkan or unified-memory systems.

A per-location subtotal sums only recognized buffer rows. It excludes unlisted
allocations, driver/context overhead, desktop use, other processes and later
growth. It is never labelled total VRAM or subtracted from the GPU budget to
declare a fit. CPU mappings do not establish physical resident RAM. Printed
values are rounded and can include allocator padding.

Repeated component/location rows or repeated relevant metadata flag ambiguity:
they could represent reloads, shards or mixed runs. No subtotals or numerical
differences are returned in this situation. Unsupported buffer-size lines block
differences; other unrecognized lines are ignored. A partial log cannot establish
that absent buffers or overhead are zero. Even an accepted excerpt does not prove
completeness or exclude all mixed-run cases.

## Comparison boundaries

The component view shows the current planning estimate alongside a unique GPU
buffer declaration. `declared − estimated`, in GiB, is available only with:

- A supported configuration estimate; a real case, not the resolver demo.
- Explicit confirmation of the same artifact and run conditions.
- A recognized build identifier, one CUDA device and declared full layer offload.
- No ambiguity, unsupported buffer-size lines or unknown backends.
- One GPU row for the component and no positive host/other row for that component.

The weights estimate is approximate; it is not GGUF file size. An embedding
remaining in `CPU_Mapped` blocks the weight difference even if all transformer
layers were offloaded. Layer offload alone does not establish full weight residency.

KV additionally requires configured context and cache-cell count to equal the
case's context, maximum sequence count of one, K/V formats both `f16`, and no
recurrent-state buffers. The loading phase has no KV comparison. Configured cache
capacity is not the number of prompt tokens or tokens actually decoded. Quantized
KV, padded/different capacities, CPU KV, multiple sequences/devices, hybrids,
unsupported geometries and missing metadata keep their declarations visible but
do not receive a comparable KV delta. No overall memory delta or causal diagnosis
is computed. A discrepancy is not proof of an error or an OOM fix.

## Parser contract and provenance

The parser accepts plain llama.cpp initialization lines with exact recognized
function/category patterns and nonnegative decimal **MiB** values. ANSI color
escapes are removed for matching. Arbitrary timestamp/server prefixes, alternative
units, new naming conventions and other engine logs are not guessed. The UI
explains unsupported excerpts rather than interpreting arbitrary numbers.

Fields inspected: build number plus commit, `n_ctx`, `n_seq_max`, offloaded/total
layers, KV cell count and K/V formats. These are declarations, not authenticated
software identity. Arbitrary source paths, product names and free-form identifiers
are not copied into derived output. Known dtype labels are allowlisted.

The grammar was checked against upstream source at commit
`6050b467c07a95c7b87debd4ddac2f8ba8d9b807` on 25 October 2026:
[model buffers](https://github.com/ggml-org/llama.cpp/blob/6050b467c07a95c7b87debd4ddac2f8ba8d9b807/src/llama-model.cpp),
[context/compute buffers](https://github.com/ggml-org/llama.cpp/blob/6050b467c07a95c7b87debd4ddac2f8ba8d9b807/src/llama-context.cpp),
[KV buffers](https://github.com/ggml-org/llama.cpp/blob/6050b467c07a95c7b87debd4ddac2f8ba8d9b807/src/llama-kv-cache.cpp),
[recurrent buffers](https://github.com/ggml-org/llama.cpp/blob/6050b467c07a95c7b87debd4ddac2f8ba8d9b807/src/llama-memory-recurrent.cpp).
Legacy `llama_model_load_tensors`, `llama_new_context_with_model` and
`llama_kv_cache_init` prefixes are also recognized for the corresponding rows.
This is not a guarantee of compatibility with every build or logging option.

## Privacy, saved cases and verification

UTF-8 decoding is strict; empty text, NUL, invalid encoding and excessive size
are rejected. A leading BOM is removed and CRLF/CR normalized to LF. Other source
text is retained, including possible private paths or secrets. The original
file is unchanged and its filename is not saved. At most 128 recognized rows.

Private case **version 4** is used when current or initial inputs contain
`llamaLog` and Boolean `llamaSame`. The reader accepts v1–v4, validates inputs
and recalculates results locally. Private downloads are unencrypted and not
redacted. Existing v1/v2/v3 exports retain their versions when no log is present.
Old readers reject v4; refresh the app before reopening.

Reduced inputs omit both log fields. Derived `result.llamaLog` and review
`llama_log` retain only rows, bounded categorical metadata, subtotals, checks and
nullable differences, with `independently_verified: false` and
`executed_by_taf: false`. Shared/guide URLs contain no log text. No statement of
successful GPU execution is inferred from an attachment or confirmation.

`npm run test:llama-log` tests parser and comparison boundaries, private v4 and
reduced privacy, plus file/paste/preview/apply, synthetic example, stale reads,
language switching, keyboard and mobile in all four languages. `npm test` includes
the pure tests; CI runs the browser suite. Fixtures are synthetic, not GPU runs.
Original memory import, before/after, saved-case and resolver suites cover regressions.

See [memory peaks](memory-measurement.md), [resolver](resolver.md) and
[limits](LIMITATIONS.md). Earlier recorded videos do not show this new panel.

## Device memory sampling — 25 October 2026

The optional NVIDIA sampler records device-wide observations, not isolated model
peaks. Sampling metadata is preserved and explained in EN/ES/FR/ZH; device metrics
remain excluded from numerical estimate/pair deltas. [Workflow and limits](device-memory-probe.md).
