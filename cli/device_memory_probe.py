"""Sample device-wide NVIDIA memory around user code; never load or stop models.

Use device_memory_probe as a context manager in an existing llama.cpp workload,
or run this CLI to observe a time window. Samples are NOT allocator peak counters
and include other processes. Missing samples or failed user code produce no file.
"""
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
import argparse
import csv
import json
import math
import subprocess
import threading
import time
try:
    from .memory_probe import _validate
except ImportError:
    from memory_probe import _validate


def query_device(device):
    result = subprocess.run(['nvidia-smi', '-i', str(device),
        '--query-gpu=uuid,memory.used,memory.total', '--format=csv,noheader,nounits'],
        capture_output=True, text=True, check=True, timeout=5)
    rows = list(csv.reader(result.stdout.strip().splitlines()))
    if len(rows) != 1 or len(rows[0]) != 3:
        raise ValueError('Expected exactly one GPU')
    uuid, used, total = (x.strip() for x in rows[0])
    used, total = float(used), float(total)
    if not uuid.startswith('GPU-') or not all(math.isfinite(x) for x in (used, total)) or not 0 <= used <= total <= 1e9 or total == 0:
        raise ValueError('Invalid device memory reading')
    return uuid, used, total


@contextmanager
def device_memory_probe(path, *, device='0', interval_ms=250, phase='generate',
                        model=None, revision=None, tokens=None, precision=None,
                        engine=None, engine_version=None, phase_isolated=None,
                        _query=query_device):
    """Record max sampled device use after a successful block. Metadata is declared.

    This does not synchronize GPU work: the caller must wait for its workload.
    For load/prefill/decode, the caller must expose and isolate that boundary.
    generate means an undivided observation window, not an isolated subphase.
    Only this sampler thread is stopped; external GPU processes are untouched.
    """
    target = Path(path)
    if target.exists():
        raise FileExistsError(target)
    if not target.parent.is_dir():
        raise FileNotFoundError(target.parent)
    if type(interval_ms) not in (int, float) or not 100 <= interval_ms <= 60000:
        raise ValueError('interval_ms must be between 100 and 60000')
    record = {'format': 'taf-memory-measurement', 'version': 1, 'kind': 'measurement',
        'model': model, 'revision': revision, 'phase': phase, 'tokens': tokens,
        'precision': precision, 'phase_isolated': phase_isolated, 'measured_at': None,
        'workload': {'gpu_count': None, 'batch_size': None, 'resident_weights': None, 'kv_dtype': None},
        'runtime': {'engine': engine, 'version': engine_version, 'device': None}}
    _validate(record)
    uuid, baseline, total = _query(device)
    record['runtime']['device'] = uuid
    start = time.monotonic()
    stats = {'count': 1, 'maximum': baseline, 'last': start, 'max_gap': 0.0}
    stop = threading.Event()
    failures = []

    def sample():
        actual, used, capacity = _query(uuid)
        if actual != uuid or capacity != total or not math.isfinite(used) or not 0 <= used <= total:
            raise ValueError('Device changed or invalid sample')
        now = time.monotonic()
        stats['max_gap'] = max(stats['max_gap'], now - stats['last'])
        stats['last'] = now
        stats['maximum'] = max(stats['maximum'], used)
        stats['count'] += 1

    def poll():
        while not stop.wait(interval_ms / 1000):
            try:
                sample()
            except Exception as error:
                failures.append(error)
                return

    worker = threading.Thread(target=poll, daemon=True)
    worker.start()
    try:
        yield record
    finally:
        stop.set()
        worker.join()
    # If the body raised, control never reaches here: no misleading successful report.
    if failures:
        raise RuntimeError('Memory sampling failed; no report written') from failures[0]
    sample()
    record['peak'] = {'value': stats['maximum'], 'unit': 'MiB', 'metric': 'device'}
    record['sampling'] = {'method': 'nvidia-smi', 'count': stats['count'],
        'interval_ms': interval_ms, 'max_gap_ms': stats['max_gap'] * 1000,
        'duration_ms': (stats['last'] - start) * 1000, 'baseline_MiB': baseline,
        'total_MiB': total}
    record['measured_at'] = datetime.now(timezone.utc).isoformat()
    _validate(record)
    body = json.dumps(record, indent=2, allow_nan=False)
    if len(body.encode('utf-8')) > 65536:
        raise ValueError('Report exceeds 64 KiB')
    with target.open('x', encoding='utf-8') as handle:
        handle.write(body + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    parser.add_argument('--device', default='0')
    parser.add_argument('--seconds', type=float, default=5)
    parser.add_argument('--interval-ms', type=float, default=250)
    args = parser.parse_args()
    if not math.isfinite(args.seconds) or not 0 < args.seconds <= 3600:
        parser.error('--seconds must be positive and at most 3600')
    with device_memory_probe(args.output, device=args.device, interval_ms=args.interval_ms):
        time.sleep(args.seconds)
    print('Device observation saved. It includes all GPU processes and is not a llama.cpp benchmark.')


if __name__ == '__main__':
    main()
