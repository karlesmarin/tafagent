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
  γ_pred        — theoretical prediction C/ln(θ) where C=ln(10000)=9.2103

Usage:
  python diagnose_model.py --model EleutherAI/pythia-70m
  python diagnose_model.py --model meta-llama/Meta-Llama-3-8B --local /path/to/weights --load_in_4bit
  python diagnose_model.py --model Qwen/Qwen2.5-7B --theta 1000000 --N 1000
  python diagnose_model.py --model EleutherAI/pythia-70m --fast   # quick mode, 3 distances

Output:
  Prints diagnostic table to stdout.
  Saves JSON to ./diagnose_results/{model_short}.json
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


def partition_Z(gamma: float, N: int) -> float:
    """Z(γ, N) = sum_{d=1}^N d^{-γ}.

    γ=1: H_N ~ log N + γ_E + 1/(2N) − ...   [Euler-Mascheroni asymptotic]
    γ≠1: integral approximation + d=1 boundary.
    """
    if abs(gamma - 1.0) < 1e-5:
        return math.log(N) + EULER_GAMMA  # was math.log(N+0.5), missing γ_E
    return (N ** (1 - gamma) - 1) / (1 - gamma) + 1


def mean_log_d(gamma: float, N: int) -> float:
    Z = partition_Z(gamma, N)
    if Z <= 0:
        return 0.0
    if abs(gamma - 1.0) < 1e-5:
        integral = math.log(N) ** 2 / 2
    else:
        g1 = 1.0 - gamma
        integral = N ** g1 * (math.log(N) / g1 - 1 / g1 ** 2) + 1 / g1 ** 2
    return integral / Z


def entropy_S(gamma: float, N: int) -> float:
    return math.log(partition_Z(gamma, N)) + gamma * mean_log_d(gamma, N)


def free_energy_F(gamma: float, N: int) -> float:
    """Helmholtz free energy: F = -T·log(Z) = -log(Z)/γ  (T_attn = 1/γ).

    Was: -log(Z)  [β·F = log-partition convention; ambiguous when reported as F].
    Now: -log(Z)/γ  [physical F, consistent with U = -∂(log Z)/∂γ and S = (U − F)/T].
    """
    Z = max(partition_Z(gamma, N), 1e-30)
    return -math.log(Z) / max(gamma, 1e-9)


def heat_capacity_Cv(gamma: float, N: int, delta: float = 1e-4) -> float:
    if gamma <= delta or gamma >= 20:
        return float("nan")
    dU = (mean_log_d(gamma + delta, N) - mean_log_d(gamma - delta, N)) / (2 * delta)
    return -gamma ** 2 * dU


def D_f_closed(gamma: float, f: float, N: int) -> int:
    """KV compression window — DISCRETE truth (exact for the sum).

    Smallest D such that ∑_{d=1}^D d^{-γ} / ∑_{d=1}^N d^{-γ}  ≥  f.

    The paper's "exact continuous formula"
    D_f = [(1−f) + f·N^(1−γ)]^{1/(1−γ)}   (and the γ=1 limit N^f)
    is a CONTINUUM INTEGRAL APPROXIMATION that diverges from the discrete
    sum by 5–50% in Phase B (γ>1), where the agent serves users.
    Since N is bounded by context window (≤ ~10⁶), direct summation is
    O(N) and fast (<10 ms). We use it for accuracy.
    """
    if N <= 0:
        return 1
    if not (0.0 < gamma):
        return N  # ill-defined; safe upper bound
    # Direct discrete cumulative
    weights = [d ** (-gamma) for d in range(1, N + 1)]
    total = sum(weights)
    if total <= 0 or not math.isfinite(total):
        # Fall back to continuum closed form (rare numerical edge case)
        return _D_f_closed_continuum(gamma, f, N)
    target = f * total
    cum = 0.0
    for d, w in enumerate(weights, start=1):
        cum += w
        if cum >= target:
            return d
    return N


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
    if gamma < 0.95:
        return "A — deconfined (RoPE/long)"
    if gamma > 1.05:
        return "B — confined (AbsPE/short)"
    return "Hagedorn (crossover γ≈1)"


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
                           seed: int, device: str, vocab_high: int) -> float:
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

    return float(np.mean(attn_values)) if attn_values else float("nan")


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
    model.eval()
    print(f"  Loaded in {time.time()-t0:.1f}s  device={device}")

    vocab_high = min(tokenizer.vocab_size - 1, 49_000)
    distances = DISTANCES_FAST if args.fast else DISTANCES_FULL
    n_prompts = N_PROMPTS if args.fast else N_PROMPTS_FULL
    N = args.N

    # ── Measure attention by distance ────────────────────────────────────
    print(f"\nMeasuring attention decay at {len(distances)} distances × {n_prompts} prompts ...")
    attn_by_d = {}
    for dist in distances:
        if dist > N:
            continue
        t1 = time.time()
        mean_val = measure_attn_distance(
            model, tokenizer, dist, n_prompts, SEEDS[0], device, vocab_high
        )
        attn_by_d[dist] = mean_val
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
    chi = 1.0 / abs(gamma - 1.0) if abs(gamma - 1.0) > 1e-4 else 1e6
    xi = 1.0 / abs(math.log(gamma)) if abs(math.log(gamma)) > 1e-10 else 1e6
    T_attn = 1.0 / gamma

    D90 = D_f_closed(gamma, 0.90, N)
    dH90 = delta_H(theta_nom, D90, N)
    theta_eff = theta_eff_pade(theta_nom, float(N))

    # Theoretical γ prediction — γ_Padé(θ, T_eval) (paper §3.3, supersedes
    # the earlier shorthand γ ≈ C/lnθ which assumed T = 10000).
    if theta_nom > 0:
        T_for_pred = max(distances) if distances else N  # use largest measured T
        z_sqrt2 = T_for_pred * math.sqrt(2)
        gamma_pred = (2 * theta_nom - z_sqrt2) / (2 * theta_nom + z_sqrt2)
    else:
        gamma_pred = None

    # Attention grammar KL
    kl_ag = grammar_kl(attn_by_d, gamma, log_A)

    # Phase
    phase = phase_label(gamma)

    # ── Report ───────────────────────────────────────────────────────────
    print(f"\n{'='*65}")
    print(f"RESULTS")
    print(f"{'='*65}")
    print(f"  γ (gamma)      = {gamma:.4f}   [R²={R2:.4f}]")
    if gamma_pred is not None:
        delta_g = gamma - gamma_pred
        print(f"  γ_Padé(θ,T)    = {gamma_pred:.4f}   Δγ = {delta_g:+.4f}")
    print(f"  Phase          : {phase}")
    print(f"  T_attn = 1/γ   = {T_attn:.4f}")
    print()
    print(f"  Thermodynamics (N={N}):")
    print(f"    Z (partition) = {Z:.4f}")
    print(f"    U = E[log d]  = {U:.4f}")
    print(f"    S (entropy)   = {S:.4f}")
    print(f"    F (free ener) = {F:.4f}")
    cv_str = f"{Cv:.4f}" if math.isfinite(Cv) else "N/A"
    print(f"    C_V (heat cap)= {cv_str}")
    chi_str = f"{chi:.2f}" if chi < 1e5 else "∞ (near Hagedorn)"
    print(f"    χ (suscept.)  = {chi_str}")
    xi_str = f"{xi:.2f}" if xi < 1e5 else "∞"
    print(f"    ξ (corr. len) = {xi_str}")
    print()
    print(f"  KV Compression (f=0.90):")
    print(f"    D_90           = {D90} tokens ({D90/N*100:.1f}% of N={N})")
    print(f"    dH_90          = {dH90:.4f} nats")
    print()
    print(f"  RoPE Diagnostic:")
    print(f"    theta_nom      = {theta_nom:,}")
    print(f"    theta_eff_Pade = {theta_eff:.1f}")
    print()
    print(f"  Attention Grammar:")
    print(f"    KL(obs||prior) = {kl_ag:.4f}  ", end="")
    if kl_ag > 0.05:
        print("[HIGH — non-power-law circuits present]")
    elif kl_ag > 0.01:
        print("[MODERATE — some circuit deviation]")
    else:
        print("[LOW — pure positional attention]")

    print(f"\n  γ interpretation:")
    if gamma < 0.7:
        print(f"    Very long-range attention (large θ, LLaMA-3/Qwen2.5 class)")
    elif gamma < 0.95:
        print(f"    Long-range attention (standard RoPE, Phase A)")
    elif gamma < 1.05:
        print(f"    Hagedorn crossover — attention at phase boundary")
    elif gamma < 1.3:
        print(f"    Short-range attention (AbsPE or short context training)")
    else:
        print(f"    Highly local attention (possible SWA or very short context)")

    # ── Save ─────────────────────────────────────────────────────────────
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    short = model_name.replace("/", "--")
    result = {
        "model": model_name,
        "theta_nom": theta_nom,
        "N": N,
        "fast_mode": args.fast,
        "fit_power_law": fit,
        "gamma": gamma,
        "gamma_pred": gamma_pred,
        "delta_gamma": (gamma - gamma_pred) if gamma_pred else None,
        "phase": phase,
        "T_attn": T_attn,
        "Z": Z, "U": U, "S": S, "F": F, "Cv": Cv,
        "chi": chi, "xi": xi,
        "D90": D90,
        "D90_frac": D90 / N,
        "delta_H_90": dH90,
        "theta_eff_pade": theta_eff,
        "kl_grammar": kl_ag,
        "attn_by_distance": {str(d): v for d, v in attn_by_d.items()},
    }

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
    args = parser.parse_args()

    try:
        run_diagnostic(args)
    except KeyboardInterrupt:
        print("\n[interrupted]")
    except Exception as e:
        print(f"\n[ERROR] {e}")
        raise


if __name__ == "__main__":
    main()
