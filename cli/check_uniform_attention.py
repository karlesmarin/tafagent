"""Exact counterexample to an unrestricted architecture-only decay claim.

No training or pretrained model: one causal softmax head, d=128, W_Q=0.
Runs RoPE, then fits distances WITHIN the final row at fixed context length.
This does not test the empirical accuracy of Padé on any pretrained panel.
Usage: python cli/check_uniform_attention.py > uniform_attention.json
"""
import json
import numpy as np


def uniform_control(theta=10000.0, length=128, d_head=128):
    rng = np.random.default_rng(42)
    q = np.zeros((length, d_head))
    k = rng.normal(size=(length, d_head))
    angles = np.arange(length)[:, None] * theta ** (-np.arange(0, d_head, 2) / d_head)

    def rope(x):
        c, s = np.cos(angles), np.sin(angles)
        y = np.empty_like(x)
        y[:, 0::2] = x[:, 0::2] * c - x[:, 1::2] * s
        y[:, 1::2] = x[:, 0::2] * s + x[:, 1::2] * c
        return y

    scores = rope(q) @ rope(k).T / np.sqrt(d_head)
    scores[np.triu_indices(length, 1)] = -np.inf
    weights = np.exp(scores - np.max(scores, axis=1, keepdims=True))
    weights /= weights.sum(axis=1, keepdims=True)
    distances = np.arange(1, length)
    means = weights[-1, length - 1 - distances]
    X = np.column_stack([np.ones(len(distances)), -np.log(distances)])
    coeffs, *_ = np.linalg.lstsq(X, np.log(means), rcond=None)
    gamma = float(coeffs[1])
    residual = np.log(means) - X @ coeffs
    return {
        "model": "synthetic/causal-softmax-zero-query",
        "revision": "uniform-control-v1",
        "source": "synthetic_control_not_pretrained_model",
        "corpus": "seeded_normal_keys_zero_queries",
        "theta_nom": theta, "T_eval": length, "gamma": gamma, "r2_log": None,
        "distance": distances.tolist(), "mean_attention": means.tolist(),
        "residual_log": residual.tolist(),
        "protocol": {
            "id": "uniform-control-v1", "length": length, "queries": [length-1],
            "sink_tokens": 0, "samples": 1, "layer": 0, "head": 0, "d_head": d_head,
            "pooling": "arithmetic_mean_per_distance",
            "fit": "unweighted_OLS_log_mean_vs_log_distance",
            "backend": "numpy", "dtype": "float64", "quantization": "none",
            "seed": 42, "tokenizer_revision": "not_used",
            "mask": "causal_including_self", "query_weights": "zero",
        },
    }, weights


if __name__ == "__main__":
    record, _ = uniform_control()
    print(json.dumps(record, indent=2, allow_nan=False))
