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
precision conversion is inferred. Import never interprets free-form logs, error
messages or scripts as measurements. Runtime strings can contain private details:
they survive only in the explicitly saved private case, not the reduced report.

Private case files containing a measurement use **version 2**; cases without one
still use version 1. The current reader accepts both. Older app versions do not
support version 2; reload the published app before reopening. The measurement
format itself remains version 1. Exported result/review `memoryPeak.measurement`
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
