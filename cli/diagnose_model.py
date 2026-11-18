"""
diagnose_model.py — "Predicting How Transformers Attend" Diagnostic Tool
=========================================================================
Single-command characterization of any causal LM via power-law attention decay.

Measures:
  γ (gamma)     — attention decay exponent  A(d) ∝ d^{-γ}
  T_attn = 1/γ  — attention temperature
  Phase         — A (deconfined / RoPE), B (confined / AbsPE), C (ALiBi), Hagedorn
  Z, U, S, F    — thermodynamic potentials (partition function, energy, entropy, free energy)
  C_V, χ        — heat capacity, susceptibility
  D_90          — context depth capturing 90% of Z (KV compression estimate)
  ΔH_90         — holographic quality loss at D_90
  KL_grammar    — attention grammar anomaly (deviation from power-law prior)
  θ_eff         — effective RoPE base (Padé diagnostic)
  γ_pred        — omitted: this probe varies sequence length with distance

Usage:
  python diagnose_model.py --model EleutherAI/pythia-70m
  python diagnose_model.py --model meta-llama/Meta-Llama-3-8B --local /path/to/weights --load_in_4bit
  python diagnose_model.py --model Qwen/Qwen2.5-7B --theta 1000000 --N 1000
  python diagnose_model.py --model EleutherAI/pythia-70m --fast   # quick mode, 4 distances
  python diagnose_model.py --model EleutherAI/pythia-70m --cpu --entropy-only
  python diagnose_model.py --model EleutherAI/pythia-70m --cpu --fast --measure-entropy

Output:
  Prints diagnostic table to stdout.
  Saves JSON to ./diagnose_results/{model_short}.json
  --entropy-only saves {model_short}.entropy.json; entropy does not correct gamma.
"""

import sys
sys.stdout.reconfigure(encoding='utf-8')
import argparse
import json
import math
import random
import time
from pathlib import Path

import numpy as np
from attention_entropy import measure_model_entropy

# ── Constants ──────────────────────────────────────────────────────────────────
C_THEORY     = math.log(10000)       # 9.2103 — γ × ln(θ) = C for standard RoPE
DISTANCES_FULL = [10, 20, 30, 50, 100, 200, 500, 1000, 2000]
DISTANCES_FAST = [10, 50, 200, 1000]
N_PROMPTS    = 30                    # per distance (fast mode default)
N_PROMPTS_FULL = 80
SEEDS        = [42, 123, 7]

THETA_KNOWN = {
    "EleutherAI/pythia-14m":                    10_000,
    "EleutherAI/pythia-31m":                    10_000,
    "EleutherAI/pythia-70m":                    10_000,
    "EleutherAI/pythia-160m":                   10_000,
    "EleutherAI/pythia-410m":                   10_000,
    "EleutherAI/pythia-1b":                     10_000,
    "EleutherAI/pythia-1.4b":                   10_000,
    "EleutherAI/pythia-2.8b":                   10_000,
    "mistralai/Mistral-7B-v0.1":                10_000,
    "tiiuae/falcon-7b":                         10_000,
    "microsoft/phi-2":                          10_000,
    "meta-llama/Llama-2-7b-hf":                 10_000,
    "google/gemma-2-9b-it":                     10_000,
    "EleutherAI/gpt-j-6B":                      10_000,
    "meta-llama/Meta-Llama-3-8B":              500_000,
    "Qwen/Qwen2.5-7B":                        1_000_000,
    "mistralai/Mistral-Nemo-Instruct-2407":   1_000_000,
    "codellama/CodeLlama-13b-Instruct-hf":    1_000_000,
}

OUTPUT_DIR = Path("./diagnose_results")

# ── Thermodynamic functions ────────────────────────────────────────────────────

# Euler-Mascheroni constant — needed for accurate H_N approximation at γ=1.
EULER_GAMMA = 0.5772156649015329


def finite_family(gamma, N):
    if isinstance(N, bool) or not isinstance(N, int) or N < 1:
        raise ValueError("N must be a positive integer")
    if isinstance(gamma, bool) or not isinstance(gamma, (int, float)) or not math.isfinite(gamma):
        raise ValueError("gamma must be a finite real number")
    logs = [math.log(d) for d in range(1, N + 1)]
    shift = -gamma * logs[-1] if gamma < 0 else 0.0
    if not math.isfinite(shift):
        raise ValueError("gamma*log(N) exceeds floating-point range")
    # Center before multiplication, avoiding overflow and cancellation for gamma<0.
    log_weights = [-gamma * (x - logs[-1] if gamma < 0 else x) for x in logs]
    weights = [math.exp(x) for x in log_weights]
    total = math.fsum(weights)
    p = [w / total for w in weights]
    logZ = shift + math.log(total)
    U = math.fsum(w * x for w, x in zip(p, logs))
    I = math.fsum(w * (x-U)**2 for w, x in zip(p, logs))
    S = -math.fsum(w * math.log(w) for w in p if w > 0)
    try:
        Z = math.exp(logZ)
    except OverflowError:
        Z = float('inf')
    return dict(Z=Z, logZ=logZ, U=U, I=I, Cv=(gamma*math.sqrt(I))**2,
                S=S, F=None if gamma == 0 else -logZ/gamma,
                probabilities=p, weights=weights, total=total)


def finite_quantile(gamma, N, f=0.90):
    if isinstance(f, bool) or not isinstance(f, (int, float)) or not math.isfinite(f) or not 0 < f < 1:
        raise ValueError("f must lie strictly between zero and one")
    family = finite_family(gamma, N)
    target = f * family['total']
    cumulative, correction = 0.0, 0.0
    for d, w in enumerate(family['weights'], 1):
        y = w-correction
        updated = cumulative+y
        correction = (updated-cumulative)-y
        cumulative = updated
        if cumulative >= target:
            return d
    return N

def partition_Z(gamma, N):
    return finite_family(gamma, N)["Z"]

def mean_log_d(gamma, N):
    return finite_family(gamma, N)["U"]

def entropy_S(gamma, N):
    return finite_family(gamma, N)["S"]

def free_energy_F(gamma, N):
    return finite_family(gamma, N)["F"]

def heat_capacity_Cv(gamma, N, delta=None):
    return finite_family(gamma, N)["Cv"]

def D_f_closed(gamma, f, N):
    return finite_quantile(gamma, N, f)


def _D_f_closed_continuum(gamma: float, f: float, N: int) -> int:
    """Continuum closed form (paper Theorem 7.1) — asymptotic, kept as fallback."""
    if abs(gamma - 1.0) < 1e-9:
        return max(1, min(N, int(round(N ** f))))
    one_minus_g = 1.0 - gamma
    base = (1 - f) + f * (N ** one_minus_g)
    if base <= 0:
        return 1
    try:
        d_f = base ** (1.0 / one_minus_g)
    except (OverflowError, ValueError):
        return N
    if not math.isfinite(d_f):
        return N
    return max(1, min(N, int(round(d_f))))


def delta_H(theta: float, Df: int, N: int) -> float:
    sqrt2 = math.sqrt(2)
    return math.log((theta + Df / sqrt2) / (theta + N / sqrt2))


def theta_eff_pade(theta: float, T: float) -> float:
    return theta + T / math.sqrt(2)


def phase_label(gamma: float) -> str:
    return "finite-family parameter; no architecture or task classification"


def kl_divergence(p: np.ndarray, q: np.ndarray) -> float:
    p = p / p.sum()
    q = q / q.sum()
    eps = 1e-12
    mask = p > eps
    return float(np.sum(p[mask] * np.log(p[mask] / (q[mask] + eps))))


# ── Attention measurement ──────────────────────────────────────────────────────

def set_seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    try:
        import torch
        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)
    except ImportError:
        pass


def measure_attn_distance(model, tokenizer, distance: int, n_prompts: int,
                           seed: int, device: str, vocab_high: int,
                           return_count: bool = False):
    import torch
    set_seed(seed)
    rng = random.Random(seed)
    seq_len = distance + 50
    target_pos = seq_len - distance - 1
    last_pos = seq_len - 1
    vocab_low = 1000

    attn_values = []
    model.eval()
    with torch.no_grad():
        for _ in range(n_prompts):
            tokens = [rng.randint(vocab_low, vocab_high) for _ in range(seq_len)]
            input_ids = torch.tensor([tokens], dtype=torch.long).to(device)
            try:
                out = model(input_ids, output_attentions=True, return_dict=True)
            except Exception:
                continue
            if out.attentions is None:
                raise RuntimeError(
                    "output_attentions returned None. "
                    "Try loading with attn_implementation='eager'."
                )
            vals = []
            for layer_attn in out.attentions:
                w = layer_attn[0, :, last_pos, target_pos].float().cpu().numpy()
                finite = w[np.isfinite(w)]
                if len(finite):
                    vals.append(float(np.mean(finite)))
            if vals:
                attn_values.append(float(np.mean(vals)))

    mean = float(np.mean(attn_values)) if attn_values else float("nan")
    return (mean, len(attn_values)) if return_count else mean


def measurement_protocol(distances, fitted_distances, samples_by_distance,
                         n_prompts, vocab_high):
    """Describe the actual legacy probe; N is not its sequence length.

    Random tokens, last query, fixed key position 49, length d+50. This
    differs from the guide's fixed-length, single-layer/head estimator.
    """
    return {
        "id": "taf-cli-variable-length-v1",
        "length_policy": "distance_plus_50",
        "lengths": {str(d): d + 50 for d in distances},
        "queries": {str(d): [d + 49] for d in distances},
        "key_position": 49,
        "sink_tokens": 0,
        "distances": list(fitted_distances),
        "attempted_distances": list(distances),
        "samples_by_distance": samples_by_distance,
        "attempted_samples_per_distance": n_prompts,
        "seed": SEEDS[0],
        "seed_policy": "reset_same_seed_at_each_distance",
        "vocab_range_inclusive": [1000, vocab_high],
        "pooling": "mean_finite_heads_then_layers_then_successful_prompts",
        "fit": "unweighted_OLS_log_mean_vs_log_distance",
        "layer": "all_returned", "head": "all_returned",
        "attention": "post_softmax_eval_mode_no_renormalization",
    }


def fit_power_law(distances: list, means: list) -> dict:
    d = np.array(distances, dtype=float)
    m = np.array(means, dtype=float)
    mask = np.isfinite(m) & (m > 0)
    if mask.sum() < 2:
        return {"gamma": float("nan"), "log_A": 0.0, "R2": 0.0}
    log_d = np.log(d[mask])
    log_m = np.log(m[mask])
    X = np.stack([np.ones(mask.sum()), -log_d], axis=1)
    coeffs, *_ = np.linalg.lstsq(X, log_m, rcond=None)
    log_A, gamma = float(coeffs[0]), float(coeffs[1])
    pred = log_A - gamma * log_d
    ss_res = float(np.sum((log_m - pred) ** 2))
    ss_tot = float(np.sum((log_m - np.mean(log_m)) ** 2))
    R2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0
    return {"gamma": gamma, "log_A": log_A, "R2": round(R2, 6)}


# ── Attention Grammar anomaly ──────────────────────────────────────────────────

def grammar_kl(attn_by_d: dict, gamma: float, log_A: float) -> float:
    dists = sorted(attn_by_d.keys())
    p_obs = np.array([attn_by_d[d] for d in dists], dtype=float)
    p_obs = np.maximum(p_obs, 1e-30)
    p_obs /= p_obs.sum()
    A = math.exp(log_A)
    p_prior = np.array([A * d ** (-gamma) for d in dists], dtype=float)
    p_prior = np.maximum(p_prior, 1e-30)
    p_prior /= p_prior.sum()
    return kl_divergence(p_obs, p_prior)


# ── Main diagnostic ───────────────────────────────────────────────────────────

def run_diagnostic(args) -> dict:
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM

    model_name = args.model
    theta_nom = args.theta or THETA_KNOWN.get(model_name, 10_000)

    print(f"\n{'='*65}")
    print(f"TRANSFORMER THERMODYNAMICS DIAGNOSTIC")
    print(f"{'='*65}")
    print(f"  Model : {model_name}")
    print(f"  theta_nom : {theta_nom:,}")
    print(f"  N         : {args.N}")
    print(f"  Mode  : {'fast' if args.fast else 'full'}")
    print()

    # ── Load model ──────────────────────────────────────────────────────
    local_path = args.local or model_name
    print(f"Loading model from: {local_path} ...")
    t0 = time.time()

    load_kwargs = dict(
        trust_remote_code=True,
        attn_implementation="eager",
    )

    device = "cuda" if (not args.cpu and torch.cuda.is_available()) else "cpu"

    if args.load_in_4bit and device == "cuda":
        try:
            from transformers import BitsAndBytesConfig
            load_kwargs["quantization_config"] = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
            )
            load_kwargs["device_map"] = "auto"
        except ImportError:
            print("  [warn] bitsandbytes not available; loading in float32")
    elif device == "cpu":
        load_kwargs["dtype"] = torch.float32

    tokenizer = AutoTokenizer.from_pretrained(local_path, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(local_path, **load_kwargs)
    if device == "cpu":
        model = model.to("cpu")
    elif device == "cuda" and not args.load_in_4bit:
        # non-quantized cuda path: from_pretrained leaves the model on CPU,
        # so move it explicitly (else input(cuda)/model(cpu) device mismatch -> nan attn).
        model = model.to(torch.float16).to("cuda")
    model.eval()
    print(f"  Loaded in {time.time()-t0:.1f}s  device={device}")

    entropy = None
    if args.measure_entropy or args.entropy_only:
        print(f"Measuring attention entropy: {args.entropy_samples} forwards × {args.entropy_tokens} tokens ...")
        entropy = measure_model_entropy(model, length=args.entropy_tokens, samples=args.entropy_samples,
                                        layer=args.entropy_layer, head=args.entropy_head, seed=SEEDS[0])
        print(f"  H = {entropy['mean_entropy_bits']:.6f} bits; diagnostic only, no gamma correction")
        if args.entropy_only:
            record = {"model": model_name, "source": "diagnose-cli",
                      "revision": getattr(model.config, "_commit_hash", None),
                      "attention_entropy": entropy}
            OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
            path = OUTPUT_DIR / f"{model_name.replace('/', '--')}.entropy.json"
            path.write_text(json.dumps(record, indent=2, allow_nan=False), encoding="utf-8")
            print(f"  Saved: {path}")
            return record

    vocab_high = min(tokenizer.vocab_size - 1, 49_000)
    distances = DISTANCES_FAST if args.fast else DISTANCES_FULL
    n_prompts = N_PROMPTS if args.fast else N_PROMPTS_FULL
    N = args.N

    # ── Measure attention by distance ────────────────────────────────────
    print(f"\nMeasuring attention decay at {len(distances)} distances × {n_prompts} prompts ...")
    attn_by_d = {}
    samples_by_distance = {}
    for dist in distances:
        if dist > N:
            continue
        t1 = time.time()
        mean_val, successful = measure_attn_distance(
            model, tokenizer, dist, n_prompts, SEEDS[0], device, vocab_high,
            return_count=True,
        )
        attn_by_d[dist] = mean_val
        samples_by_distance[str(dist)] = successful
        print(f"  d={dist:5d}  attn={mean_val:.6f}  ({time.time()-t1:.1f}s)")

    # ── Fit power law ────────────────────────────────────────────────────
    valid_d = [d for d, v in attn_by_d.items() if math.isfinite(v) and v > 0]
    valid_v = [attn_by_d[d] for d in valid_d]
    fit = fit_power_law(valid_d, valid_v)
    gamma = fit["gamma"]
    log_A = fit["log_A"]
    R2 = fit["R2"]

    if not math.isfinite(gamma):
        print("\n[ERROR] Power-law fit failed. Too few valid distances.")
        return {}

    # ── Thermodynamics ───────────────────────────────────────────────────
    Z = partition_Z(gamma, N)
    U = mean_log_d(gamma, N)
    S = entropy_S(gamma, N)
    F = free_energy_F(gamma, N)
    Cv = heat_capacity_Cv(gamma, N)
    chi = xi = None  # Retired physical interpretations; keep legacy schema keys.
    T_attn = None if gamma == 0 else 1.0 / gamma

    D90 = D_f_closed(gamma, 0.90, N)
    dH90 = delta_H(theta_nom, D90, N)
    theta_eff = theta_eff_pade(theta_nom, float(N))

    # No unique T_eval: each distance is measured at a different length d+50.
    # Neither max(distance) nor integration horizon N supplies a fixed context.
    gamma_pred = None

    # Attention grammar KL
    kl_ag = grammar_kl({d: attn_by_d[d] for d in valid_d}, gamma, log_A)

    # Phase
    phase = phase_label(gamma)

    # ── Report ───────────────────────────────────────────────────────────
    print(f"\n{'='*65}")
    print(f"RESULTS")
    print(f"{'='*65}")
    print(f"  γ (gamma)      = {gamma:.4f}   [R²={R2:.4f}]")
    print("  Protocol       : random tokens; sequence length = distance + 50")
    print("  γ_Padé         : not compared (no single evaluation length)")
    print("  R² describes the log-fit; it is not a validation/confidence score.")
    print(f"  Phase          : {phase}")
    print(f"  T_attn = 1/γ   = {T_attn if T_attn is not None else 'undefined at gamma=0'}")
    print()
    print(f"  Derived finite-family coordinates (N={N}; not measured row moments):")
    print(f"    Z (partition) = {Z:.4f}")
    print(f"    U = E[log d]  = {U:.4f}")
    print(f"    S (entropy)   = {S:.4f}")
    print(f"    F (free ener) = {F if F is not None else 'undefined at gamma=0'}")
    cv_str = f"{Cv:.4f}" if math.isfinite(Cv) else "N/A"
    print(f"    C_V (heat cap)= {cv_str}")
    print()
    print(f"  Derived family mass quantile (f=0.90; not a cache recommendation):")
    print(f"    D_90           = {D90} tokens ({D90/N*100:.1f}% of N={N})")
    print(f"    dH_90          = {dH90:.4f} nats")
    print()
    print(f"  RoPE Diagnostic:")
    print(f"    theta_nom      = {theta_nom:,}")
    print(f"    theta_eff_Pade = {theta_eff:.1f}")
    print()
    print(f"  Attention Grammar:")
    print(f"    KL(obs||prior) = {kl_ag:.4f}  ", end="")
    print("[descriptive divergence on sampled support; no circuit diagnosis]")
    print("The variable-length fit is not a normalized attention row.")
    print("Task quality, actual cache eviction and latency require separate paired tests.")

    # ── Save ─────────────────────────────────────────────────────────────
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    short = model_name.replace("/", "--")
    protocol = measurement_protocol(list(attn_by_d), valid_d, samples_by_distance,
                                    n_prompts, vocab_high)
    protocol.update({
        "backend": getattr(model.config, "_attn_implementation", None),
        "dtype": str(model.dtype),
        "quantization": "bitsandbytes_4bit" if getattr(model, "is_loaded_in_4bit", False) else "none",
        "tokenizer_revision": getattr(tokenizer, "init_kwargs", {}).get("_commit_hash"),
        "device": device,
        "torch_version": torch.__version__,
    })
    result = {
        "model": model_name,
        "theta_nom": theta_nom,
        "N": N,
        "T_eval": None,
        "revision": getattr(model.config, "_commit_hash", None),
        "corpus": "uniform_random_token_ids",
        "source": "diagnose-cli",
        "protocol": protocol,
        "fast_mode": args.fast,
        "fit_power_law": fit,
        "gamma": gamma,
        "gamma_pred": gamma_pred,
        "delta_gamma": None,
        "phase": phase,
        "T_attn": T_attn,
        "Z": Z, "U": U, "S": S, "F": F, "Cv": Cv,
        "chi": chi, "xi": xi,
        "D90": D90,
        "D90_kind": "derived_power_law",
        "family_support": {"min": 1, "max": N, "measure": "counting"},
        "family_moments_kind": "derived_from_fit_not_measured_rows",
        "formula_contract": "finite-family-v2-20261118",
        "D90_frac": D90 / N,
        "delta_H_90": dH90,
        "theta_eff_pade": theta_eff,
        "kl_grammar": kl_ag,
        "attn_by_distance": {str(d): v if math.isfinite(v) else None for d, v in attn_by_d.items()},
    }
    if entropy is not None:
        result["attention_entropy"] = entropy

    out_path = OUTPUT_DIR / f"{short}.json"
    out_path.write_text(json.dumps(result, indent=2, default=float), encoding="utf-8")
    print(f"\n  Saved: {out_path}")
    print(f"{'='*65}\n")

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Predicting How Transformers Attend — diagnostic for any causal LM"
    )
    parser.add_argument("--model",  required=True,
                        help="HuggingFace model ID (e.g. EleutherAI/pythia-70m)")
    parser.add_argument("--local",  default=None,
                        help="Local path to model weights (if not downloading)")
    parser.add_argument("--theta",  type=int, default=None,
                        help="RoPE θ (auto-detected for known models)")
    parser.add_argument("--N",      type=int, default=2000,
                        help="Context length N for thermodynamic calculations (default 2000)")
    parser.add_argument("--fast",   action="store_true",
                        help="Fast mode: fewer distances and prompts (~5 min on CPU)")
    parser.add_argument("--load_in_4bit", action="store_true",
                        help="Load model in 4-bit quantization (requires bitsandbytes)")
    parser.add_argument("--cpu",    action="store_true",
                        help="Force CPU even if CUDA available")
    parser.add_argument("--measure-entropy", action="store_true",
                        help="Also measure actual attention entropy in a separate fixed-length probe; no gamma correction")
    parser.add_argument("--entropy-only", action="store_true",
                        help="Run only the short entropy probe, without the distance sweep")
    parser.add_argument("--entropy-tokens", type=int, default=128,
                        help="Fixed entropy-probe sequence length (default 128)")
    parser.add_argument("--entropy-samples", type=int, default=4,
                        help="Number of random-token forwards (default 4)")
    parser.add_argument("--entropy-layer", type=int, default=0, help="Zero-based layer index (default 0)")
    parser.add_argument("--entropy-head", type=int, default=0, help="Zero-based head index (default 0)")
    args = parser.parse_args()

    # Validate numeric inputs: N is used as a divisor (D90/N) and inside
    # log/partition terms, and theta must be positive for the Padé form.
    if args.N < 1:
        parser.error("--N must be >= 1 (it is used as a divisor and in log terms).")
    if args.theta is not None and args.theta <= 0:
        parser.error("--theta must be > 0.")
    if args.entropy_tokens < 2 or args.entropy_samples < 1 or args.entropy_layer < 0 or args.entropy_head < 0:
        parser.error("Entropy probe requires tokens >= 2, samples >= 1 and nonnegative layer/head indices.")

    try:
        run_diagnostic(args)
    except KeyboardInterrupt:
        print("\n[interrupted]")
    except Exception as e:
        print(f"\n[ERROR] {e}")
        raise


if __name__ == "__main__":
    main()
