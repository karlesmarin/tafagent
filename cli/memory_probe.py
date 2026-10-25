"""Collect one CUDA phase peak in an existing process; never load a model.

Use ``with memory_probe(path, ...) as record:`` around your own operation.
Metadata is caller-declared. Unknowns stay None; the browser checks scope.
A whole generate() call must use phase='generate' (unknown subphase).
The helper synchronizes and resets counters on one explicit device. It does
not clear the allocator, infer success, suppress errors or overwrite reports.
"""
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
import json
import math
import re


def _validate(record):
    if record['phase'] not in ('load', 'prefill', 'decode', 'generate'):
        raise ValueError('Unknown phase')
    model = record['model']
    if model is not None and (not isinstance(model, str) or len(model)>200 or '..' in model or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._-]*', model)):
        raise ValueError('Use a Hub model ID or None, not a local path')
    revision = record['revision']
    if revision is not None and (not isinstance(revision,str) or not re.fullmatch(r'[a-f0-9]{40}',revision)):
        raise ValueError('Revision must be a full commit hash or None')
    for value, limit in [(record['tokens'],10000000),(record['workload']['gpu_count'],100000),(record['workload']['batch_size'],100000)]:
        if value is not None and (type(value) is not int or not 1<=value<=limit):
            raise ValueError('Counts must be positive integers or None')
    for value in [record['phase_isolated'],record['workload']['resident_weights']]:
        if value is not None and type(value) is not bool:
            raise ValueError('Use True, False or None for declarations')
    for value, limit in [(record['precision'],64),(record['workload']['kv_dtype'],64),*[(record['runtime'][key],120) for key in ('engine','version','device')]]:
        if value is not None and (not isinstance(value,str) or not value.strip() or len(value)>limit):
            raise ValueError('Invalid runtime or precision metadata')


@contextmanager
def memory_probe(path, *, model=None, revision=None, phase='generate', tokens=None,
                 precision=None, device=None, phase_isolated=None, gpu_count=None,
                 batch_size=None, resident_weights=None, kv_dtype=None,
                 metric='allocated', _torch=None):
    """Write a new taf-memory-measurement v1 file after a successful block.

    Set record['tokens'] inside the block if the actual cached length is only
    known afterwards. All metadata describes the measured workload, not a
    guarantee of compatibility. Requires PyTorch with an available CUDA device.
    The output parent directory must exist. Use one probe at a time per device;
    resets are process/device scoped, so overlapping probes invalidate peaks.
    """
    target=Path(path)
    if target.exists():
        raise FileExistsError(target)
    if not target.parent.is_dir():
        raise FileNotFoundError(target.parent)
    if metric not in ('allocated','reserved'):
        raise ValueError('metric must be allocated or reserved')
    record={'format':'taf-memory-measurement','version':1,'kind':'measurement',
            'model':model,'revision':revision,'phase':phase,'tokens':tokens,
            'precision':precision,'phase_isolated':phase_isolated,'measured_at':None,
            'workload':{'gpu_count':gpu_count,'batch_size':batch_size,
                        'resident_weights':resident_weights,'kv_dtype':kv_dtype},
            'runtime':{'engine':'pytorch','version':None,'device':None}}
    _validate(record)
    if _torch is None:
        import torch as _torch
    if not _torch.cuda.is_available():
        raise RuntimeError('CUDA is not available; no measurement was made')
    selected=_torch.cuda.current_device() if device is None else device
    record['runtime'].update(version=str(_torch.__version__),device=str(selected))
    _torch.cuda.synchronize(selected)
    _torch.cuda.reset_peak_memory_stats(selected)
    yield record  # Exceptions propagate; no output file is written on failure.
    _torch.cuda.synchronize(selected)
    counter=_torch.cuda.max_memory_allocated if metric=='allocated' else _torch.cuda.max_memory_reserved
    value=counter(selected)/(1024**2)
    if not math.isfinite(value) or not 0<=value<=1e9:
        raise ValueError('Invalid peak counter')
    record['peak']={'value':value,'unit':'MiB','metric':metric}
    record['measured_at']=datetime.now(timezone.utc).isoformat()
    _validate(record)
    body=json.dumps(record,indent=2,allow_nan=False)
    if len(body.encode('utf-8'))>65536:
        raise ValueError('Report is too large')
    with target.open('x',encoding='utf-8') as handle:
        handle.write(body+'\n')
