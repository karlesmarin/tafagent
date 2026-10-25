# Memory measurement files

The memory route can attach a local **taf-memory-measurement v1** JSON record
(maximum **64 KiB**). This is the first measurement-file bridge into saved cases;
it does not connect all 31 tools, measure GPUs in the browser or validate quality.
The existing attention-report route still accepts Diagnose CLI reports separately.

## User workflow

1. Calculate your own memory case with the exact model, tokens, format and phase.
2. Open **Import memory measurement**, select the JSON and review the declared
   conditions. No upload, model lookup or execution is triggered by import.
3. Choose **Attach peak to this case**. Only the peak value/unit/metric are filled;
   the model, revision, precision, context and selected phase are not overwritten.
   Existing follow-up is cleared because the evidence changed.
4. Review the same-workload and phase-isolation checkboxes yourself, then run the
   check again. Both start unchecked. Checking them cannot override missing or
   different conditions in the imported record.
5. Save a **private case** to retain the normalized record and its runtime details.
   Reduced reports omit the raw record, retaining peak values and comparison
   categories. Unknown fields in a measurement file are discarded, not retained.

Files that declare a different model/revision/phase/precision/token count,
multiple GPUs/sequences, nonresident weights, different KV dtype or unknown
isolation block numerical baseline comparison. Missing identity stays missing.
Loading ignores token count and KV dtype because its baseline is resident weights.
Other existing guards remain: allocated-tensor metric, known phase, supported
geometry and explicit confirmations. A whole generate() peak stays phase-unknown.
Example files never enable a numerical comparison. Even a complete match remains
an unverified declaration and does not establish successful isolation or a repair.

Changing model, budget, context, precision or phase clears the imported peak and
record. Editing the peak value/unit/metric detaches the record and turns it into
manual input. Confirmations retain the record. Language changes retain applied
data; a pending preview can be selected again. Invalid files leave the case intact.

## Compare Before and After

After attaching and confirming the first measurement, open **Compare before and
after**. The current attached record is **Before**; choose a second local JSON as
**After** (same format and 64 KiB limit). Preview its conditions and runtime/date
checks, then choose **Attach as After**. The first record and case settings stay
intact. The new pair confirmation starts unchecked on every attachment.

Check both runs yourself: same input/workload, physical hardware and protocol,
with isolated phases. A device label such as `0` does not identify a physical GPU
or machine. The original peak's workload/isolation confirmations are also required.
Attaching or confirming recalculates locally, with no HF request, and resets
progress, observations and feedback because the evidence changed.

Both files must match the current case under the existing memory guards. Engine,
version and device label must be present and exactly equal; both timestamps must
be documented, with After strictly later. File labels/dates remain unauthenticated.
Each peak must be allocated tensor memory, from a known phase in the supported
single-GPU/single-sequence scope. Missing or different metadata, examples, reserved
or device peaks, whole-generate peaks and unconfirmed pairs block the delta.
The confirmation cannot override a mismatch. This first pair comparison does not
compare changed model, precision, context, runtime version or hardware; those
changes require a separate controlled protocol.

The panel shows both peaks converted to GiB. When comparable, it reports
`after − before` and `100 × (after − before) / before`. A negative difference
means only a lower declared peak. When Before is zero, the absolute difference
is available and the percentage is undefined. Nonfinite percentage results are
also omitted with a numeric-range explanation. A blocked pair keeps both peaks
visible but exports null deltas. Two records provide no uncertainty estimate,
causal attribution, output-quality check or proof that OOM is resolved. Repeat
controlled runs before drawing a conclusion.

**Remove After measurement** retains Before. Replacing Before clears After and
the pair confirmation. Changes to identity/budget/context/format/phase clear both;
manually editing the first peak detaches both records. Language changes retain
applied data; pending previews can be selected again. Invalid/oversized files leave
an existing pair unchanged. A private download retains both normalized records;
the reduced report retains only peaks, deltas, checks and declaration flags.

## Collect a peak in your own runtime

Use [cli/memory_probe.py](../cli/memory_probe.py) from a TAF checkout as an imported
context manager around your existing PyTorch/CUDA code. It does not install
packages, download/load models, choose a device for your tensors or run a task.
PyTorch with CUDA must already be available. The output directory must exist.

```python
from cli.memory_probe import memory_probe

# Run this inside your existing program. Fill real metadata; keep unknowns None.
with memory_probe(
    "prefill-memory.json", model=MODEL_ID, revision=MODEL_COMMIT,
    phase="prefill", tokens=ACTUAL_PROMPT_TOKENS, precision=WEIGHT_FORMAT,
    device=CUDA_DEVICE, phase_isolated=PHASE_WAS_ISOLATED,
    gpu_count=GPU_COUNT, batch_size=SEQUENCE_COUNT,
    resident_weights=WEIGHTS_RESIDENT, kv_dtype=ACTUAL_KV_DTYPE,
) as record:
    outputs = run_your_prefill()
```

The uppercase names and `run_your_prefill` are placeholders for values and code
in your program, not a runnable benchmark. Use `phase="generate"` around a whole
`generate()` call unless you genuinely expose separate phase boundaries. For
loading, `tokens=None` and `kv_dtype=None` are allowed. For decode, record the
actual cached length at the comparison point (not the configured maximum);
`record["tokens"]` can be updated inside the block. Do not assume that a requested
number of generated tokens equals the runtime's actual cache length.

The helper synchronizes the selected CUDA device, resets peak statistics, yields
to your code, synchronizes again, and reads max allocated memory. It writes MiB
and the PyTorch version/device identifier, with UTC time. `metric="reserved"`
collects the reserved-memory peak instead; this remains context, not a numerical
baseline comparison. Resetting peak statistics does not empty the allocator.
Use one probe at a time per device and isolate other activity yourself; counters
are process/device scoped. The device argument measures counters on that device,
not all GPUs. Declare the actual workload GPU count; it is not inferred.

An exception (including OOM or synchronization failure) propagates and no new
report is written. Existing files are never overwritten. The failed allocation
requested by an OOM is not measured by a successful-allocation counter. This
helper deliberately does not produce a misleading successful report on failure.

Sources: [PyTorch memory management](https://docs.pytorch.org/docs/stable/notes/cuda.html#cuda-memory-management),
[max allocated memory](https://docs.pytorch.org/docs/stable/generated/torch.cuda.memory.max_memory_allocated.html),
[reset peak counters](https://docs.pytorch.org/docs/stable/generated/torch.cuda.memory.reset_peak_memory_stats.html),
[max reserved memory](https://docs.pytorch.org/docs/stable/generated/torch.cuda.memory.max_memory_reserved.html).

## File contract and privacy

[Illustrative example](../data/memory_measurement_example.json) uses a synthetic
22 GiB peak and `kind: "example"`. It is not a measurement. For actual reports,
`kind` is `measurement`; this label is not authenticated by the browser.

| Fields | Contract |
|---|---|
| `format`, `version`, `kind` | `taf-memory-measurement`, `1`, `measurement` or `example` |
| `model`, `revision` | Exact Hub ID / 40-character commit hash, or `null` |
| `phase`, `tokens`, `precision` | load/prefill/decode/generate; actual token count or null; exact weight-format label or null |
| `measured_at`, `phase_isolated` | ISO timestamp or null; true/false/null declaration |
| `peak` | Finite nonnegative value, GiB/GB/MiB unit, allocated/reserved/device/unknown metric |
| `workload` | gpu_count, batch_size, resident_weights, kv_dtype; unknowns are null |
| `runtime` | engine, version, device; bounded strings or null |

Zero is a real peak value, not a placeholder for unknown data. Missing peak values
are rejected. Identity and workload labels are compared exactly; no family or
precision conversion is inferred. The peak importer does not interpret logs, error messages or scripts as peaks.
A separate [llama.cpp log panel](llama-memory-log.md) reads buffer declarations. Runtime strings can contain private details:
they survive only in the explicitly saved private case, not the reduced report.

Private case files use **version 3** when either the current or initial inputs
contain a pair, **version 2** for one measurement, and **version 1** without
measurements. Cases with llama.cpp log inputs use version 4. The current reader accepts all
four versions and recalculates from inputs.
Older app versions reject unsupported versions; reload the app before reopening.
The measurement JSON format itself remains version 1. A pair adds
`inputs.measurementAfter` and Boolean `inputs.comparisonSame`; its first record
remains `inputs.measurement`. The comparison is exported under
`result.memoryPeak.comparison`, with categorical checks and null deltas if blocked.
Neither raw measurement record is included in the reduced report.

Exported result/review `memoryPeak.measurement`
contains comparison categories and `independently_verified: false`, not raw
runtime identifiers or claims that TAF executed the measurement.

## Validation and maintenance

`npm run test:memory-import` checks pure validation/comparison, the Python
collector with fake CUDA counters, and browser import/reopen in EN/ES/FR/ZH.
`npm test` includes the pure tests; CI includes the collector and browser tests.
The tests do not establish actual GPU memory usage or model quality. Existing
memory and private-case suites cover compatibility with manually entered peaks
and files without measurements. Keep schema, producer, privacy projection,
translations, documentation and saved-case reader synchronized when extending.

`npm run test:memory-pair` covers units, differences, missing metadata, runtime
and timestamp checks, confirmations, zero baselines, privacy and private v3
round trips, plus browser flows in all four languages. CI runs both pair and
original import tests. Browser measurements are fixtures, not real GPU runs.

See [llama.cpp log evidence](llama-memory-log.md) for buffer declarations that
must not be converted to allocated-memory peak records.

## Device memory sampling — 25 October 2026

The optional NVIDIA sampler records device-wide observations, not isolated model
peaks. Sampling metadata is preserved and explained in EN/ES/FR/ZH; device metrics
remain excluded from numerical estimate/pair deltas. [Workflow and limits](device-memory-probe.md).
