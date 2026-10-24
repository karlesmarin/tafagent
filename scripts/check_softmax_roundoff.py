"""Optional CPU microcheck (requires PyTorch); not a replication of training experiments.

Run: python scripts/check_softmax_roundoff.py
Reports the actual backend/version, unlike the browser's elementary Float32 illustration.
"""
import json
import torch

result = {'kind': 'numerical_microcheck_not_training_replication', 'torch': torch.__version__, 'device': 'cpu', 'runs': []}
for dtype in (torch.float32, torch.float64):
    for form in ('standard_cross_entropy', 'stable_log1p'):
        logits = torch.tensor([9., -9., -9.], dtype=dtype, requires_grad=True)
        loss = (torch.nn.functional.cross_entropy(logits.unsqueeze(0), torch.tensor([0]))
                if form == 'standard_cross_entropy'
                else torch.log1p(torch.exp(torch.logsumexp(logits[1:] - logits[0], dim=0))))
        loss.backward()
        result['runs'].append({'dtype': str(dtype), 'form': form, 'logits': logits.detach().tolist(),
                               'loss': loss.item(), 'gradient': logits.grad.tolist(), 'sum': logits.grad.sum().item()})
print(json.dumps(result, indent=2))
