# Sample NVIDIA device memory

`cli/device_memory_probe.py` collects **device-wide sampled usage**, including
other processes and the initial reading. It does not load/stop models, reset CUDA
counters or synchronize a workload. Short peaks between samples can be missed.
The report contains requested interval, actual maximum gap, duration, sample count,
initial usage and capacity. It is never a tensor-allocation peak or a measurement
attributable to llama.cpp alone. No baseline subtraction is interpreted as model use.

Observe a window without disturbing the running GPU workload:

```sh
python cli/device_memory_probe.py --output device-window.json --device 0 --seconds 5
```

Import the resulting `taf-memory-measurement` v1 JSON through **Import memory
measurement** in the resolver. The new sampling fields survive private downloads;
the UI explains sampling in EN/ES/FR/ZH. The `device` metric blocks numerical
estimate and before/after deltas. Refresh older apps, which discard sampling details.

For an existing Python llama.cpp integration, instrument a boundary you control:

```python
from cli.device_memory_probe import device_memory_probe
with device_memory_probe('decode.json', device='0', phase='decode',
                         engine='llama.cpp', engine_version=YOUR_BUILD):
    run_your_decode_and_wait_for_completion()
```

The uppercase name and function are placeholders, not an executable benchmark.
The caller must await completion and expose/isolate actual load, prefill or decode
boundaries. The CLI records an undivided `generate` window with unknown model,
engine and phase isolation; it never infers a subphase or workload identity.
Model, revision, tokens and precision can be declared through context-manager
arguments. Device UUID is read from NVIDIA; other metadata is caller-declared.
GPU count, batch, residency and KV format stay unknown unless the caller supplies
them in the yielded record. No unknown is replaced by zero.

Requires Python and working `nvidia-smi`. One device per report. WDDM/driver
limitations and other workloads affect readings. Samples use separate read-only
queries; actual gaps include query overhead. The interval is 100–60,000 ms.
Exceptions, timeouts, device changes or invalid samples produce no new report.
Existing output is never overwritten. Output parent must exist. Failed/OOM runs
are not labelled successful measurements. The final sample is taken after the
caller block finishes. The initial reading is included in the sampled maximum.

Reports may reveal device identifiers, which remain in private files; reduced
reports omit runtime identifiers. Sampling counts/times/capacity remain numerical
context. Private case versions remain v2/v3, or v4 when also containing a log.
Unknown extra sampling fields are discarded. Tests use fake counters plus a
read-only device observation; no llama.cpp benchmark is claimed by those tests.

Reference: [NVIDIA System Management Interface](https://docs.nvidia.com/deploy/nvidia-smi/).
See [memory imports](memory-measurement.md) and [buffer logs](llama-memory-log.md).
