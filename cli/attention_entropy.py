"""Attention entropy in bits; a measured diagnostic, not a gamma correction."""
import math
import numpy as np


def attention_row_entropy(probabilities, allowed_keys=None, sum_tolerance=1e-5):
    p = np.asarray(probabilities, dtype=float)
    if p.ndim != 1 or not p.size or not np.isfinite(p).all() or (p < 0).any():
        raise ValueError("Attention must be a vector of finite nonnegative probabilities")
    if not math.isfinite(sum_tolerance) or not 0 <= sum_tolerance <= 0.01:
        raise ValueError("Invalid sum tolerance")
    mask = np.ones(p.size, dtype=bool) if allowed_keys is None else np.asarray(allowed_keys)
    if mask.shape != p.shape or mask.dtype != bool or not mask.any():
        raise ValueError("allowed_keys must be a boolean mask with nonempty support")
    if np.any(p[~mask] != 0):
        raise ValueError("Attention on masked keys is not zero")
    mass = float(p.sum())
    if mass <= 0 or abs(mass - 1) > sum_tolerance:
        raise ValueError("Attention row must sum to one")
    q = p[p > 0] / mass
    entropy = float(-np.sum(q * np.log2(q)))
    support = int(mask.sum())
    maximum = math.log2(support)
    return {
        "entropy_bits": 0.0 if entropy == 0 else entropy,
        "uniform_entropy_bits": maximum,
        "normalized_entropy": min(1.0, entropy/maximum) if maximum > 0 else None,
        "kl_to_uniform_bits": max(0.0, maximum-entropy),
        "allowed_keys": support, "original_row_sum": mass,
    }


def summarize_attention_entropy(rows, allowed_keys_by_row=None, sum_tolerance=1e-5, protocol=None):
    if len(rows) == 0:
        raise ValueError("At least one measured attention row is required")
    if allowed_keys_by_row is not None and len(allowed_keys_by_row) != len(rows):
        raise ValueError("One allowed-key mask is required per row")
    measurements = [attention_row_entropy(row, None if allowed_keys_by_row is None else allowed_keys_by_row[i], sum_tolerance)
                    for i, row in enumerate(rows)]
    normalized = [r["normalized_entropy"] for r in measurements if r["normalized_entropy"] is not None]
    return {
        "schema_version": 1, "status": "measured", "unit": "bits", "rows": measurements,
        "mean_entropy_bits": float(np.mean([r["entropy_bits"] for r in measurements])),
        "mean_uniform_entropy_bits": float(np.mean([r["uniform_entropy_bits"] for r in measurements])),
        "mean_normalized_entropy": float(np.mean(normalized)) if normalized else None,
        "mean_kl_to_uniform_bits": float(np.mean([r["kl_to_uniform_bits"] for r in measurements])),
        "gamma_correction": {"applied": False, "reason": "entropy_does_not_identify_distance_decay"},
        "protocol": {**(protocol or {}), "statistic": "mean_of_row_entropies", "logarithm": "base_2",
                     "row_count": len(rows), "sum_tolerance": sum_tolerance,
                     "rounding": "rescale_validated_rows_only"},
    }


def measure_model_entropy(model, *, length=128, samples=4, layer=0, head=0, seed=42):
    """Real fixed-length CPU/GPU forwards; random token IDs, one layer/head, final query.

    No padding, no cache and no row exclusions. The uniform reference covers all
    input keys; local-attention models can therefore have a structural entropy gap.
    Unsupported attention outputs raise, rather than returning fictitious zeros.
    """
    import torch
    if not all(isinstance(v, int) and not isinstance(v, bool) for v in (length, samples, layer, head, seed)):
        raise ValueError("Probe parameters must be integers")
    if length < 2 or samples < 1 or layer < 0 or head < 0:
        raise ValueError("Invalid probe length, sample count, layer or head")
    vocab_size = model.get_input_embeddings().num_embeddings
    device = model.get_input_embeddings().weight.device
    rng = np.random.default_rng(seed)
    rows = []
    was_training = model.training
    model.eval()
    try:
        with torch.inference_mode():
            for _ in range(samples):
                tokens = rng.integers(0, vocab_size, size=(1, length))
                output = model(input_ids=torch.tensor(tokens, dtype=torch.long, device=device),
                               output_attentions=True, use_cache=False, return_dict=True)
                attentions = getattr(output, "attentions", None)
                if not attentions or layer >= len(attentions) or attentions[layer] is None:
                    raise ValueError("Requested attention layer unavailable; use a model supporting eager attention")
                attention = attentions[layer]
                if attention.ndim != 4 or attention.shape[0] != 1 or head >= attention.shape[1] or tuple(attention.shape[2:]) != (length, length):
                    raise ValueError("Unsupported attention shape or unavailable head")
                rows.append(attention[0, head, -1, :].float().cpu().numpy().copy())
    finally:
        model.train(was_training)
    return summarize_attention_entropy(rows, sum_tolerance=0.005, protocol={
        "id": "taf-entropy-final-query-v1", "length": length, "samples": samples,
        "layer": layer, "head": head, "queries": [length-1], "seed": seed,
        "corpus": "uniform_random_token_ids", "vocab_range_inclusive": [0, vocab_size-1],
        "reference_support": "all_input_keys_including_self", "sink_tokens": 0,
        "backend": getattr(model.config, "_attn_implementation", None), "dtype": str(model.dtype),
        "device": str(device), "model_type": getattr(model.config, "model_type", None),
        "sliding_window": getattr(model.config, "sliding_window", None),
        "torch_version": torch.__version__, "numpy_version": np.__version__,
        "evaluation": "eval_mode_no_cache_no_padding", "training_performed": False,
    })
