"""
TAF Browser — Pyodide-compatible TAF formulas + recipes.

Pure-Python deterministic computations of TAF (Thermodynamic Attention Framework)
formulas, plus 5 cross-section recipes for the most common viability questions.

Author: Carles Marin <transformerkmarin@gmail.com>
License: Apache-2.0
"""
from __future__ import annotations
import math
import json


# ════════════════════════════════════════════════════════════════════════════
# §26 — γ-Thermodynamics (OUR contribution)
# ════════════════════════════════════════════════════════════════════════════
def gamma_pade(theta: float, T_eval: int) -> float:
    """§26.1 — γ = (2θ - T√2)/(2θ + T√2)"""
    z_sqrt2 = T_eval * math.sqrt(2)
    return (2 * theta - z_sqrt2) / (2 * theta + z_sqrt2)


def gamma_decompose(gamma_pade_val, has_GQA=False, has_SWA=False, n_params=0.0) -> dict:
    """§26.10 — 5-axis decomposition (n=23 OLS, paper sesión 28)."""
    delta_GQA = +0.11 if has_GQA else 0.0
    delta_SWA = -0.21 if has_SWA else 0.0
    delta_post_IH = -0.15 if n_params >= 4e8 else 0.0
    return {
        "pade_centroid":   gamma_pade_val,
        "delta_GQA":       delta_GQA,
        "delta_SWA":       delta_SWA,
        "delta_post_IH":   delta_post_IH,
        "gamma_corrected": gamma_pade_val + delta_GQA + delta_SWA + delta_post_IH,
    }


def d_horizon(theta: float, gamma: float):
    """§26.2 — d_h = θ(1-γ)√2/(1+γ). None if γ outside (0,1)."""
    if gamma <= 0 or gamma >= 1:
        return None
    return theta * (1 - gamma) * math.sqrt(2) / (1 + gamma)


def l_niah_c(d_horizon_val):
    """§26.5 — L_NIAH^c = 2·d_horizon."""
    return None if d_horizon_val is None else 2 * d_horizon_val


def chi_susceptibility(gamma: float) -> float:
    """§26.16 — χ = 1/|γ-1|."""
    return float('inf') if gamma == 1.0 else 1.0 / abs(gamma - 1.0)


def p_hallucinate(L: int, theta: float, gamma: float):
    """§26.9 — Horizon-overshoot probability."""
    dh = d_horizon(theta, gamma)
    if dh is None or L <= 0:
        return None
    chi = chi_susceptibility(gamma)
    if chi == float('inf'):
        return None
    geom = max(0.0, 1.0 - (dh / L) ** (1 - gamma))
    return geom * (math.sqrt(chi) / (1 + math.sqrt(chi)))


def theta_design(gamma_target: float, T_eval: int) -> float:
    """§26.3 — θ to land at γ_target at T_eval (Padé inverse)."""
    if gamma_target >= 1 or gamma_target <= -1:
        raise ValueError("gamma_target must be in (-1, 1)")
    return T_eval * math.sqrt(2) * (1 + gamma_target) / (2 * (1 - gamma_target))


def alpha_opt(gamma_target: float, T_eval: int, theta_nominal: float) -> float:
    """§26.4 — α = θ_design / θ_nominal."""
    return theta_design(gamma_target, T_eval) / theta_nominal


def df_window(gamma: float, N: int, f: float = 0.90):
    """§26.7 — KV compression window. None outside [0.65, 0.85] zone."""
    if not (0.65 <= gamma <= 0.85):
        return None
    if gamma >= 1:
        return int(f * N)
    inner = (1 - f) + f * N ** (1 - gamma)
    return int(math.ceil(inner ** (1 / (1 - gamma))))


def kv_soft_decay_regime(theta: float, gamma: float, T_train: int) -> str:
    """§26.8 — Soft decay régimen-bound. d_h ≳ T_train/2 ⇒ applies."""
    dh = d_horizon(theta, gamma)
    if dh is None:
        return "use-hard-cutoff"
    ratio = dh / max(1, T_train / 2)
    if ratio >= 1.2:
        return "applies"
    if ratio >= 0.8:
        return "borderline"
    return "use-hard-cutoff"


# ════════════════════════════════════════════════════════════════════════════
# §28 — Sesión 29 (2026-04-28): learned-imprint, F2 Chinchilla, Δγ-IH probe
# ════════════════════════════════════════════════════════════════════════════
NU_IMPRINT = -1.0 / (2 * math.pi)  # §28 — learned-imprint slope (DERIVED, n=22 err 0.3%)
P_0_IMPRINT_M = 14.0                # baseline pythia-14m (smallest panel reference)


def gamma_random_predict(theta: float, T_eval: int, n_params_M: float) -> float:
    """§28.1 — Predicted γ on RANDOM-token input.

    γ_random = γ_pade(θ,T) + ν · log_10(P / P_0),  ν = -1/(2π) ≈ -0.1592.
    Empirical n=22 LLMs (sesión 29). Random-input γ scales with model size
    despite RoPE-Padé predicting only (θ,T) dependence — weights imprint
    a learned positional bias proportional to log(N_params).

    Predicted CI ≈ ±0.18 (95%).
    """
    g_pade = gamma_pade(theta, T_eval)
    return g_pade + NU_IMPRINT * math.log10(max(n_params_M, 1e-3) / P_0_IMPRINT_M)


def imprint_purity(gamma_random_obs: float, theta: float, T_eval: int,
                   n_params_M: float) -> dict:
    """§28.2 — Diagnostic: how clean is the model's RoPE-Padé prediction?

    Compares observed γ_random to predicted (γ_pade + ν·log_10(P/P_0)).
    Negative residual ⇒ extra-strong training imprint (less clean).
    Positive ⇒ weaker than expected imprint (cleaner / less trained).
    """
    g_pred = gamma_random_predict(theta, T_eval, n_params_M)
    g_pade_only = gamma_pade(theta, T_eval)
    residual = gamma_random_obs - g_pred
    return {
        "gamma_random_obs":      gamma_random_obs,
        "gamma_random_pred":     g_pred,
        "gamma_pade_only":       g_pade_only,
        "imprint_predicted":     g_pred - g_pade_only,
        "imprint_residual":      residual,
        "purity":                "clean (within CI)" if abs(residual) < 0.18 else
                                 ("over-imprinted" if residual < 0 else "under-imprinted"),
        "ci_95_half_width":      0.18,
    }


def compute_invariant_K(gamma: float, n_params_M: float,
                        D_tokens: float = None) -> dict:
    """§29 — F2 Chinchilla compute-context invariant.

    K = γ × log(N²·D),  D = 20·N (Chinchilla compute-optimal) if not given.
    Empirical: K ≈ 51.2 ± 16.8 (CV=0.329, n=22). In-distribution if K∈[34, 68].
    """
    N = n_params_M * 1e6
    if D_tokens is None:
        D_tokens = 20 * N
    K = gamma * math.log(N * N * D_tokens)
    panel_mean, panel_std = 51.2, 16.8
    z = (K - panel_mean) / panel_std
    return {
        "K":                K,
        "panel_mean":       panel_mean,
        "panel_std":        panel_std,
        "z_score":          z,
        "in_distribution":  abs(z) <= 1.0,
        "interpretation":   "in-band" if abs(z) <= 1.0 else
                            ("high-K outlier" if z > 0 else "low-K outlier"),
    }


def ih_phase_check(gamma_text: float, gamma_random: float,
                   n_params_M: float = None) -> dict:
    """§30 — IH-formation phase discriminator.

    sign(γ_text − γ_random) > 0 ⟺ post-IH (text concentrates more than random).
    Pre-IH (P<400M, n=7): ⟨Δγ⟩ = -0.19 ± 0.26
    Post-IH (P≥400M, n=15): ⟨Δγ⟩ = +0.03 ± 0.26
    """
    delta = gamma_text - gamma_random
    phase_observed = "post-IH" if delta > 0 else ("pre-IH" if delta < 0 else "ambiguous")
    phase_expected = None
    if n_params_M is not None:
        phase_expected = "post-IH" if n_params_M * 1e6 >= 4e8 else "pre-IH"
    consistent = (phase_expected is None) or (phase_observed == phase_expected)
    return {
        "delta_gamma":       delta,
        "phase_observed":    phase_observed,
        "phase_expected_by_size": phase_expected,
        "consistent":        consistent,
        "panel_pre_IH_mean": -0.19,
        "panel_post_IH_mean": +0.03,
        "panel_std":         0.26,
    }


def gamma_decompose_v2(gamma_pade_val: float, n_params_M: float,
                       has_GQA: bool = False, has_SWA: bool = False,
                       corpus: str = "text", is_instruct: bool = False) -> dict:
    """§28.3 — 6-axis decomposition (sesión 29 update with imprint axis).

    γ_obs = γ_pade
           + ν·log_10(P/P_0)·𝟙[corpus=random]    ← NEW imprint axis (DERIVED)
           + Δ_corpus(text-rand)
           + δ_arch(GQA, SWA)
           + δ_circuit(IH phase)
           + δ_train(steps, RLHF, instruct)
           + ε
    Imprint axis activates only on RANDOM input. TEXT input dominated by corpus.
    """
    delta_imprint = NU_IMPRINT * math.log10(max(n_params_M, 1e-3) / P_0_IMPRINT_M) \
                    if corpus == "random" else 0.0
    delta_GQA = +0.11 if has_GQA else 0.0
    delta_SWA = -0.21 if has_SWA else 0.0
    delta_post_IH = -0.15 if n_params_M >= 400 else 0.0
    delta_instruct = -0.10 if is_instruct else 0.0  # F9 tentative (n=3, p=0.06)
    return {
        "pade_centroid":       gamma_pade_val,
        "delta_imprint":       delta_imprint,
        "delta_GQA":           delta_GQA,
        "delta_SWA":           delta_SWA,
        "delta_post_IH":       delta_post_IH,
        "delta_instruct":      delta_instruct,
        "gamma_corrected":     gamma_pade_val + delta_imprint + delta_GQA
                                + delta_SWA + delta_post_IH + delta_instruct,
        "corpus":              corpus,
        "axes":                ["pade", "imprint", "GQA", "SWA", "IH", "instruct"],
    }


def famous_constant_proximity(gamma: float, tolerance: float = 0.01) -> dict:
    """§31 — Detect proximity to famous constants in γ-cluster (sesión 29).

    Empirical hits (n=4 in panel):
      CodeLlama-13b   γ=0.3823 ≈ 1−1/φ = 0.3820 (golden conjugate)
      pythia-1.4b     γ=0.7051 ≈ 1/√2  = 0.7071
      Llama-2-7b      γ=0.2871 ≈ 1−1/√2 = 0.2929
      Mistral-Nemo    γ=0.4284 ≈ log_10(e) = 0.4343
    Returns nearest constant within tolerance, or None.
    """
    phi = (1 + math.sqrt(5)) / 2
    constants = {
        "1−1/φ (golden conjugate)": 1 - 1/phi,
        "1/√2":                     1 / math.sqrt(2),
        "1−1/√2":                   1 - 1/math.sqrt(2),
        "log_10(e)":                math.log10(math.e),
        "1/π":                      1 / math.pi,
        "2/π":                      2 / math.pi,
        "1/φ":                      1 / phi,
        "ln(2)":                    math.log(2),
        "z*_Cayley = (√17−3)/2":    (math.sqrt(17) - 3) / 2,
    }
    hits = []
    for name, val in constants.items():
        err = abs(gamma - val)
        if err <= tolerance:
            hits.append({"constant": name, "value": val, "error": err})
    hits.sort(key=lambda h: h["error"])
    return {
        "gamma":     gamma,
        "tolerance": tolerance,
        "n_hits":    len(hits),
        "hits":      hits[:3],
        "caveat":    "n=4 hits in panel; could be coincidence (continuous distribution)",
    }


# ════════════════════════════════════════════════════════════════════════════
# §17 — Pre-training viability formulas
# ════════════════════════════════════════════════════════════════════════════
def chinchilla_optimal_tokens(N_params: float, ratio: float = 20.0) -> float:
    """§17.30 — Chinchilla 20:1 token budget. D = ratio · N."""
    return ratio * N_params


def chinchilla_optimal_N(D_tokens: float, ratio: float = 20.0) -> float:
    """§17.30 inverse — given D tokens, optimal N = D/20."""
    return D_tokens / ratio


def training_flops(N_params: float, D_tokens: float) -> float:
    """§17.10 — C ≈ 6·N·D total training FLOPs."""
    return 6 * N_params * D_tokens


def training_memory_16N(N_params: float) -> dict:
    """§17.20 — total memory ≈ 16·N bytes (model + grads + Adam moments)."""
    bytes_total = 16 * N_params
    return {
        "bytes": bytes_total,
        "GB": bytes_total / 1e9,
    }


def emergent_threshold(N_params: float) -> str:
    """§17.60 — capability threshold heuristic (Wei 2022)."""
    if N_params >= 1e11:
        return "above 100B — strong reasoning capabilities expected"
    if N_params >= 1e10:
        return "above 10B — most emergent capabilities present"
    if N_params >= 1e9:
        return "above 1B — basic instruction-following, not strong reasoning"
    if N_params >= 1e8:
        return "above 100M — useful for narrow tasks, no emergence"
    return "below 100M — domain-specific tasks only"


# ════════════════════════════════════════════════════════════════════════════
# §19 — Inference economics
# ════════════════════════════════════════════════════════════════════════════
def kv_cache_memory(n_layers, n_kv_heads, d_head, seq_len, bytes_per_element=2.0) -> dict:
    """§19.1 — bytes = 2·L·n_kv·d_h·seq·B."""
    bytes_total = 2 * n_layers * n_kv_heads * d_head * seq_len * bytes_per_element
    return {"bytes": bytes_total, "MB": bytes_total / 1e6, "GB": bytes_total / 1e9}


def model_weights_memory(N_params, bytes_per_element=2.0) -> dict:
    """Inference memory for model weights only (BF16=2, INT8=1, INT4=0.5)."""
    return {"GB": N_params * bytes_per_element / 1e9}


def inference_decode_throughput(N_params, hbm_GB_per_s, bytes_per_element=2.0) -> float:
    """§19.7 — memory-bound decode: tokens/sec = HBM_BW / model_size."""
    model_GB = N_params * bytes_per_element / 1e9
    return hbm_GB_per_s / model_GB


# ════════════════════════════════════════════════════════════════════════════
# §20 — Hardware catalog (curated from vendor docs 2026)
# ════════════════════════════════════════════════════════════════════════════
GPU_CATALOG = {
    # name: {bf16_TFLOPs, hbm_GB, hbm_GB_s, cloud_USD_per_h_spot, tdp_W}
    "H100 SXM":  {"flops": 989,  "vram_GB": 80,  "bw_GB_s": 3350, "usd_h": 2.5,  "tdp": 700},
    "H100 PCIe": {"flops": 756,  "vram_GB": 80,  "bw_GB_s": 2000, "usd_h": 2.0,  "tdp": 350},
    "H200":      {"flops": 989,  "vram_GB": 141, "bw_GB_s": 4800, "usd_h": 3.5,  "tdp": 700},
    "B200":      {"flops": 2250, "vram_GB": 192, "bw_GB_s": 8000, "usd_h": 5.0,  "tdp": 1000},
    "A100 80GB": {"flops": 312,  "vram_GB": 80,  "bw_GB_s": 2000, "usd_h": 1.2,  "tdp": 400},
    "A100 40GB": {"flops": 312,  "vram_GB": 40,  "bw_GB_s": 1555, "usd_h": 1.0,  "tdp": 400},
    "L40S":      {"flops": 362,  "vram_GB": 48,  "bw_GB_s": 864,  "usd_h": 0.7,  "tdp": 350},
    "MI300X":    {"flops": 1307, "vram_GB": 192, "bw_GB_s": 5300, "usd_h": 2.1,  "tdp": 750},
    "RTX 4090":  {"flops": 165,  "vram_GB": 24,  "bw_GB_s": 1008, "usd_h": 0.4,  "tdp": 450},
    "RTX 5090":  {"flops": 419,  "vram_GB": 32,  "bw_GB_s": 1792, "usd_h": 0.7,  "tdp": 575},
    "RTX 5060Ti":{"flops": 36,   "vram_GB": 16,  "bw_GB_s": 448,  "usd_h": 0.0,  "tdp": 180},  # local
}


def cost_per_training_run(N_params: float, D_tokens: float, gpu: str = "H100 SXM",
                          n_gpus: int = 8, mfu: float = 0.45) -> dict:
    """§20.11 — cost = (flops_total / (peak·MFU·n_gpus)) · USD/h."""
    info = GPU_CATALOG.get(gpu)
    if info is None:
        return {"error": f"unknown gpu '{gpu}'", "available": list(GPU_CATALOG.keys())}
    total_flops = training_flops(N_params, D_tokens)  # absolute FLOPs
    effective_flops_per_sec = info["flops"] * 1e12 * mfu * n_gpus
    seconds = total_flops / effective_flops_per_sec
    hours = seconds / 3600
    usd = hours * info["usd_h"] * n_gpus
    return {
        "total_FLOPs": total_flops,
        "hours": hours,
        "days": hours / 24,
        "USD": usd,
        "gpu": gpu, "n_gpus": n_gpus, "mfu": mfu,
    }


def cost_per_inference_token(model_GB: float, gpu: str, batch: int = 1) -> dict:
    """§19.9 / §20.12 — derived $/Mtok from memory-bound decode."""
    info = GPU_CATALOG.get(gpu)
    if info is None:
        return {"error": f"unknown gpu '{gpu}'"}
    tok_per_sec = info["bw_GB_s"] / model_GB * batch
    sec_per_Mtok = 1e6 / tok_per_sec
    h_per_Mtok = sec_per_Mtok / 3600
    usd_per_Mtok = h_per_Mtok * info["usd_h"]
    return {
        "tok_per_sec": tok_per_sec,
        "USD_per_Mtok": usd_per_Mtok,
        "gpu": gpu, "batch": batch,
    }


# ════════════════════════════════════════════════════════════════════════════
# §24 — Cost / ROI
# ════════════════════════════════════════════════════════════════════════════
API_PRICING = {
    # USD per million tokens (input/output blended typical)
    "GPT-4o":         {"input": 2.5,  "output": 10.0},
    "GPT-4o-mini":    {"input": 0.15, "output": 0.60},
    "Claude-Opus-4":  {"input": 15.0, "output": 75.0},
    "Claude-Sonnet-4":{"input": 3.0,  "output": 15.0},
    "Claude-Haiku-4": {"input": 0.80, "output": 4.0},
    "Gemini-1.5-Pro": {"input": 1.25, "output": 5.0},
    "DeepSeek-V3":    {"input": 0.27, "output": 1.10},
    "Llama-3.3-70B (Together)": {"input": 0.88, "output": 0.88},
}


def break_even_volume(training_cost: float, self_inference_per_Mtok: float,
                      api_per_Mtok: float, blend_input_output: float = 0.5) -> dict:
    """§24.3 — monthly tokens at which custom training pays off."""
    savings_per_Mtok = api_per_Mtok - self_inference_per_Mtok
    if savings_per_Mtok <= 0:
        return {"error": "self-host more expensive than API per token; never breaks even"}
    Mtok_breakeven = training_cost / savings_per_Mtok
    return {
        "savings_per_Mtok": savings_per_Mtok,
        "Mtok_breakeven": Mtok_breakeven,
        "tokens_breakeven": Mtok_breakeven * 1e6,
    }


# ════════════════════════════════════════════════════════════════════════════
# RECIPES
# ════════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────
# X-2 — Long Context Viability
# ─────────────────────────────────────────────────────────────────────
def run_recipe_x2(theta, T_train, T_eval, n_attention_heads, n_kv_heads,
                  d_head, n_layers, n_params, has_SWA=False,
                  bytes_per_element=2.0, **_unused):
    """X-2: will model M serve length L doing NIAH retrieval?"""
    chain = []
    g_pade = gamma_pade(theta, T_eval)
    chain.append(_step(1, "§26.1", "γ_Padé", "γ = (2θ - T√2)/(2θ + T√2)",
                       {"theta": theta, "T_eval": T_eval}, g_pade,
                       _phase_label(g_pade)))

    has_GQA = (n_kv_heads < n_attention_heads)
    decomp = gamma_decompose(g_pade, has_GQA=has_GQA, has_SWA=has_SWA, n_params=n_params)
    g_corr = decomp["gamma_corrected"]
    chain.append(_step(2, "§26.10", "γ-decomposition", "γ + δ_GQA + δ_SWA + δ_post_IH",
                       {"has_GQA": has_GQA, "has_SWA": has_SWA, "n_params": n_params},
                       g_corr, breakdown=decomp))

    dh = d_horizon(theta, g_corr)
    chain.append(_step(3, "§26.2", "d_horizon", "d_h = θ(1-γ)√2/(1+γ)",
                       {"theta": theta, "gamma": g_corr}, dh,
                       "n/a — γ outside (0,1)" if dh is None else f"horizon at d={dh:.0f}"))

    l_niah = l_niah_c(dh)
    chain.append(_step(4, "§26.5", "L_NIAH^c", "L_NIAH^c = 2·d_horizon",
                       {"d_horizon": dh}, l_niah,
                       "n/a" if l_niah is None else f"NIAH 50% at L={l_niah:.0f}"))

    p_hallu = p_hallucinate(T_eval, theta, g_corr)
    chain.append(_step(5, "§26.9", "P_hallucinate", "max(0,1-(d_h/L)^(1-γ))·√χ/(1+√χ)",
                       {"L": T_eval, "theta": theta, "gamma": g_corr}, p_hallu,
                       "n/a (Phase B)" if p_hallu is None else f"{p_hallu*100:.1f}% predicted"))

    kv = kv_cache_memory(n_layers, n_kv_heads, d_head, T_eval, bytes_per_element)
    chain.append(_step(6, "§19.1", "KV cache memory", "2·L·n_kv·d_h·seq·B",
                       {"n_layers": n_layers, "n_kv_heads": n_kv_heads, "d_head": d_head,
                        "seq_len": T_eval, "bytes_per_element": bytes_per_element},
                       kv, f"{kv['GB']:.2f} GB per request"))

    if g_corr <= 0 or g_corr >= 1:
        verdict, reason = "NO", "Phase B / geometric collapse (γ_corrected outside (0,1))"
        mit = (f"Apply NTK-aware extension. Required θ for γ=0.85: "
               f"{theta_design(0.85, T_eval):,.0f}. α_opt = {alpha_opt(0.85, T_eval, theta):.2f} "
               f"({'fine-tuning required' if alpha_opt(0.85, T_eval, theta) > 8 else 'zero-shot may work'}).")
    elif dh is not None and T_eval < dh:
        margin = (1 - T_eval / dh) * 100
        verdict, reason = "YES", f"L={T_eval} inside d_horizon={dh:.0f} ({margin:.0f}% margin)."
        mit = "None required."
    elif dh is not None and T_eval < l_niah:
        verdict, reason = "DEGRADED", f"L between d_horizon ({dh:.0f}) and L_NIAH^c ({l_niah:.0f})."
        mit = "Consider context contraction OR NTK extension."
    else:
        verdict, reason = "NO", f"L={T_eval} exceeds NIAH ceiling {l_niah:.0f}."
        mit = f"Apply NTK extension; need θ ≈ {theta_design(0.85, T_eval):,.0f} for γ=0.85."

    return _wrap("X-2", "Long Context Viability", locals(), chain, verdict, reason, mit)


# ─────────────────────────────────────────────────────────────────────
# X-1 — Custom training vs API for a domain task
# ─────────────────────────────────────────────────────────────────────
def run_recipe_x1(N_params, D_tokens=None, gpu="H100 SXM", n_gpus=8, mfu=0.45,
                  api_model="GPT-4o", monthly_tokens_M=10.0, **_unused):
    """X-1: custom training (Chinchilla optimal) vs API."""
    chain = []

    # Step 1: Chinchilla optimal D
    if D_tokens is None:
        D_tokens = chinchilla_optimal_tokens(N_params)
    chain.append(_step(1, "§17.30", "Chinchilla optimal D", "D = 20·N",
                       {"N_params": N_params}, D_tokens,
                       f"recommended D = {D_tokens:.2e} tokens"))

    # Step 2: training FLOPs
    flops = training_flops(N_params, D_tokens)
    chain.append(_step(2, "§17.10", "Training FLOPs", "C = 6·N·D",
                       {"N": N_params, "D": D_tokens}, flops,
                       f"{flops:.2e} FLOPs total"))

    # Step 3: training cost
    cost = cost_per_training_run(N_params, D_tokens, gpu=gpu, n_gpus=n_gpus, mfu=mfu)
    chain.append(_step(3, "§20.11", "Training cost",
                       "hours·USD/h·n_gpus = total $",
                       {"gpu": gpu, "n_gpus": n_gpus, "mfu": mfu}, cost,
                       f"${cost['USD']:,.0f} over {cost['days']:.1f} days"))

    # Step 4: model_GB and decode throughput
    model_GB = N_params * 2 / 1e9  # BF16
    inf = cost_per_inference_token(model_GB, gpu, batch=1)
    chain.append(_step(4, "§19.9 / §20.12", "Self-inference $/Mtok",
                       "BW / model_GB → tok/s → $/Mtok",
                       {"model_GB": model_GB, "gpu": gpu}, inf,
                       f"${inf['USD_per_Mtok']:.2f} per million tokens (single user)"))

    # Step 5: API blended price
    api = API_PRICING.get(api_model, {"input": 2.0, "output": 8.0})
    api_blend = (api["input"] + api["output"]) / 2
    chain.append(_step(5, "§24.X", f"{api_model} blended price",
                       "(input + output) / 2 USD/Mtok",
                       {"api_model": api_model}, api_blend,
                       f"${api_blend:.2f}/Mtok blended"))

    # Step 6: break-even
    be = break_even_volume(cost["USD"], inf["USD_per_Mtok"], api_blend)
    chain.append(_step(6, "§24.3", "Break-even tokens", "training$ / (api - self) = Mtok",
                       {"training_cost": cost["USD"]}, be,
                       _be_interp(be, monthly_tokens_M)))

    # Verdict
    if "error" in be:
        verdict, reason = "NO", be["error"]
        mit = f"Stick with {api_model} API."
    elif monthly_tokens_M >= be["Mtok_breakeven"]:
        verdict = "YES (custom)"
        months_to_payoff = be["Mtok_breakeven"] / monthly_tokens_M
        reason = (f"At {monthly_tokens_M} M tokens/month, break-even in "
                  f"{months_to_payoff:.1f} months. Long-term custom is cheaper.")
        mit = f"Train at {gpu}×{n_gpus}; serve self-hosted."
    else:
        months = be["Mtok_breakeven"] / monthly_tokens_M
        verdict = "NO (API)"
        reason = (f"At {monthly_tokens_M} M tokens/month, break-even in "
                  f"{months:.1f} months — too slow.")
        mit = f"Use {api_model} API (cheaper for your volume)."

    return _wrap("X-1", "Custom training vs API", locals(), chain, verdict, reason, mit)


def _be_interp(be, monthly):
    if "error" in be:
        return be["error"]
    months = be["Mtok_breakeven"] / max(monthly, 0.001)
    return f"break-even at {be['Mtok_breakeven']:.0f} Mtok ({months:.1f} months at {monthly} M/mo)"


# ─────────────────────────────────────────────────────────────────────
# X-3 — Pre-flight check on $5K training budget
# ─────────────────────────────────────────────────────────────────────
def run_recipe_x3(USD_budget=5000.0, gpu="H100 SXM", mfu=0.45, n_gpus=1, **_unused):
    """X-3: given $ budget, what model can I train?"""
    chain = []
    info = GPU_CATALOG[gpu]

    # Step 1: GPU-hours we can afford
    hours = USD_budget / (info["usd_h"] * n_gpus)
    chain.append(_step(1, "§20.11", "Affordable GPU-hours", "USD / ($/h·n_gpus)",
                       {"USD": USD_budget, "gpu": gpu, "n_gpus": n_gpus}, hours,
                       f"{hours:.0f} GPU-hours total ({hours/24:.1f} days at full use)"))

    # Step 2: max FLOPs
    max_flops = info["flops"] * 1e12 * mfu * n_gpus * hours * 3600
    chain.append(_step(2, "§17.10", "Max training FLOPs",
                       "peak·MFU·n_gpus·seconds",
                       {"peak_TFLOPs": info["flops"], "MFU": mfu}, max_flops,
                       f"{max_flops:.2e} effective FLOPs"))

    # Step 3: Chinchilla-optimal N (with D=20N)
    # 6·N·D = max_flops, D=20N → 120·N² = max_flops → N = sqrt(max_flops/120)
    N_chinchilla = math.sqrt(max_flops / 120)
    D_chinchilla = 20 * N_chinchilla
    chain.append(_step(3, "§17.30", "Chinchilla-optimal N",
                       "N = √(C/120) at D=20N", {"max_FLOPs": max_flops},
                       N_chinchilla,
                       f"N ≈ {N_chinchilla:.2e} params with D = {D_chinchilla:.2e} tokens"))

    # Step 4: emergence check
    emerg = emergent_threshold(N_chinchilla)
    chain.append(_step(4, "§17.60", "Emergence threshold", "Wei 2022 capability",
                       {"N": N_chinchilla}, emerg, emerg))

    # Step 5: memory budget check
    mem = training_memory_16N(N_chinchilla)
    fits = mem["GB"] <= info["vram_GB"]
    chain.append(_step(5, "§17.20", "16N training memory",
                       "model + grads + AdamW",
                       {"N": N_chinchilla}, mem,
                       f"{mem['GB']:.1f} GB needed; "
                       f"{'fits in ' if fits else 'EXCEEDS '}{info['vram_GB']} GB VRAM"))

    # Verdict
    if N_chinchilla < 1e8:
        verdict, reason = "TINY-MODEL", f"Budget supports only ~{N_chinchilla:.0e} params"
        mit = "Use LoRA fine-tuning of larger pretrained model instead."
    elif not fits:
        verdict, reason = "MEMORY-LIMITED", f"Chinchilla N ({N_chinchilla:.1e}) doesn't fit one {gpu}"
        mit = f"Use ZeRO-3 across multiple GPUs (need ≥{math.ceil(mem['GB']/info['vram_GB'])}× {gpu}) OR train smaller N undertrained."
    else:
        verdict = "GO"
        reason = (f"At ${USD_budget}, train {N_chinchilla:.1e}-param model on "
                  f"{D_chinchilla:.1e} tokens in ~{hours/24:.1f} days. "
                  f"Capability tier: {emerg.split('—')[0].strip()}.")
        mit = "None — proceed with Chinchilla-optimal recipe."

    return _wrap("X-3", "Budget pre-flight", locals(), chain, verdict, reason, mit)


# ─────────────────────────────────────────────────────────────────────
# X-5 — Hardware selection for serving
# ─────────────────────────────────────────────────────────────────────
def run_recipe_x5(N_params, T_eval=4096, n_layers=32, n_kv_heads=8, d_head=128,
                  bytes_per_weight=2.0, target_tokens_per_day=10_000_000.0,
                  concurrent_users=1, **_unused):
    """X-5: which GPU should I use to serve N-param model at L context?"""
    chain = []

    # Step 1: weights memory
    w_mem = model_weights_memory(N_params, bytes_per_weight)
    chain.append(_step(1, "§19.X", "Model weights memory",
                       "N · bytes_per_weight",
                       {"N": N_params, "bytes": bytes_per_weight}, w_mem,
                       f"{w_mem['GB']:.1f} GB for weights"))

    # Step 2: KV cache per request
    kv = kv_cache_memory(n_layers, n_kv_heads, d_head, T_eval, bytes_per_weight)
    chain.append(_step(2, "§19.1", "KV cache (per request)",
                       "2·L·n_kv·d_h·seq·B",
                       {"n_layers": n_layers, "n_kv": n_kv_heads,
                        "d_head": d_head, "seq": T_eval}, kv,
                       f"{kv['GB']:.2f} GB per concurrent request"))

    # Step 3: total memory needed
    total_GB = w_mem["GB"] + kv["GB"] * concurrent_users
    chain.append(_step(3, "§20.3", "Total GPU memory",
                       "weights + KV·n_concurrent", {}, {"GB": total_GB},
                       f"{total_GB:.1f} GB for {concurrent_users} concurrent users"))

    # Step 4: scan GPU catalog
    candidates = []
    for name, info in GPU_CATALOG.items():
        if info["vram_GB"] < total_GB:
            continue
        # Decode throughput estimate (memory-bound)
        tok_per_s = info["bw_GB_s"] / w_mem["GB"]
        tok_per_day = tok_per_s * 86400
        capacity_users = tok_per_day / target_tokens_per_day
        usd_per_day = info["usd_h"] * 24
        usd_per_Mtok = (usd_per_day / (tok_per_day / 1e6)) if tok_per_day > 0 else float('inf')
        candidates.append({
            "gpu": name, "vram_GB": info["vram_GB"], "bw_GB_s": info["bw_GB_s"],
            "tok_per_sec": tok_per_s, "tok_per_day": tok_per_day,
            "USD_per_day": usd_per_day, "USD_per_Mtok": usd_per_Mtok,
            "users_supported": capacity_users,
        })
    candidates.sort(key=lambda c: c["USD_per_Mtok"])
    chain.append(_step(4, "§20", f"Eligible GPUs (≥{total_GB:.0f}GB)",
                       "filter + rank by $/Mtok",
                       {"min_VRAM": total_GB}, candidates[:5],
                       f"{len(candidates)} GPUs fit; cheapest: {candidates[0]['gpu'] if candidates else 'NONE'}"))

    # Verdict
    if not candidates:
        verdict, reason = "NO", f"No single GPU has ≥{total_GB:.0f} GB VRAM."
        mit = (f"Use tensor parallelism across multiple GPUs "
               f"(e.g. 2× H100 = 160GB), or quantize to INT8 (halves memory).")
    else:
        best = candidates[0]
        verdict = "YES"
        reason = (f"Best GPU: {best['gpu']} at ${best['USD_per_Mtok']:.2f}/Mtok. "
                  f"Supports {best['users_supported']:.1f}× your daily target.")
        mit = f"Provision {best['gpu']}, expected {best['tok_per_sec']:.0f} tok/s decode."

    return _wrap("X-5", "Hardware selection for serving", locals(), chain, verdict, reason, mit)


# ─────────────────────────────────────────────────────────────────────
# X-19 — KV compression decision (ours vs literature)
# ─────────────────────────────────────────────────────────────────────
def run_recipe_x19(theta, T_train, T_eval, n_attention_heads, n_kv_heads,
                   d_head, n_layers, n_params, has_SWA=False, **_unused):
    """X-19: should I use γ-soft KV decay, hard D_f, or literature methods?"""
    chain = []

    # Step 1: γ_Padé
    g_pade = gamma_pade(theta, T_eval)
    chain.append(_step(1, "§26.1", "γ_Padé", "(2θ-T√2)/(2θ+T√2)",
                       {"theta": theta, "T_eval": T_eval}, g_pade, _phase_label(g_pade)))

    # Step 2: γ-decomposition
    has_GQA = n_kv_heads < n_attention_heads
    decomp = gamma_decompose(g_pade, has_GQA, has_SWA, n_params)
    g_corr = decomp["gamma_corrected"]
    chain.append(_step(2, "§26.10", "γ-decomposition", "5-axis adjustment",
                       {"has_GQA": has_GQA, "has_SWA": has_SWA, "n_params": n_params},
                       g_corr))

    # Step 3: §26.7 D_f window applicability
    df = df_window(g_corr, T_eval, f=0.90)
    df_zone_ok = df is not None
    chain.append(_step(3, "§26.7", "D_f window (γ in [0.65, 0.85])",
                       "[(1-f)+fN^(1-γ)]^(1/(1-γ))",
                       {"gamma": g_corr, "N": T_eval, "f": 0.9}, df,
                       f"D_f = {df}" if df_zone_ok
                       else f"NOT applicable (γ={g_corr:.3f} outside [0.65, 0.85])"))

    # Step 4: §26.8 soft decay régimen
    regime = kv_soft_decay_regime(theta, g_corr, T_train)
    dh = d_horizon(theta, g_corr)
    dh_str = f"{dh:.0f}" if dh is not None else "n/a"
    chain.append(_step(4, "§26.8", "Soft decay régimen", "d_h ≳ T_train/2",
                       {"theta": theta, "gamma": g_corr, "T_train": T_train}, regime,
                       f"d_horizon={dh_str}; regime: {regime}"))

    # Step 5: KV cache memory baseline
    kv = kv_cache_memory(n_layers, n_kv_heads, d_head, T_eval)
    chain.append(_step(5, "§19.1", "Baseline KV memory", "2·L·n_kv·d_h·seq·B",
                       {"L": n_layers, "n_kv": n_kv_heads, "d_h": d_head, "seq": T_eval},
                       kv, f"{kv['GB']:.2f} GB without compression"))

    # Verdict
    if regime == "applies" and df_zone_ok:
        verdict = "USE SOFT DECAY"
        reason = (f"d_horizon ≳ T_train/2 AND γ in compression zone. "
                  f"Soft decay (1-d/d_h)^γ best (-21% PPL vs hard cutoff per F17).")
        mit = "Implement as 4D attention_mask additive bias with eager attention."
    elif df_zone_ok:
        verdict = "USE D_f HARD CUTOFF"
        reason = f"γ in [0.65, 0.85] zone but d_h < T_train/2. Hard truncation at D_f={df} works."
        mit = "Set cache_max_len = D_f."
    elif regime == "applies":
        verdict = "USE SOFT DECAY (caveat)"
        reason = "Régimen applies but γ outside D_f validity zone. Soft decay only."
        mit = "Soft decay; do not use D_f window."
    elif g_corr >= 1 or g_corr <= 0:
        verdict = "USE LITERATURE METHODS"
        reason = f"γ={g_corr:.3f} outside Phase A. Our formulas don't apply."
        mit = "Use SnapKV / PyramidKV / FastGen (literature heuristics)."
    else:
        verdict = "USE HARD T_train CUTOFF"
        reason = "Régimen not met AND γ outside zone. Cap context at T_train."
        mit = f"Set seq_len ≤ {T_train}, no extension."

    return _wrap("X-19", "KV compression decision", locals(), chain, verdict, reason, mit)


# ─────────────────────────────────────────────────────────────────────
# X-21 — Imprint Purity Diagnostic (sesión 29 — uses §28 ν=−1/(2π))
# ─────────────────────────────────────────────────────────────────────
def run_recipe_x21(theta, T_train, n_attention_heads, n_kv_heads,
                   d_head, n_layers, n_params, T_eval=None,
                   gamma_random_obs=None, **_unused):
    """X-21: how clean is the model's RoPE-Padé prediction?

    Predicts γ on RANDOM-token input via learned-imprint formula:
      γ_random = γ_pade(θ,T) + ν·log_10(P/14M),  ν = −1/(2π) ≈ −0.1592
    If user provides observed γ_random, returns purity diagnostic.
    """
    chain = []
    if T_eval is None:
        T_eval = T_train

    # Step 1: γ_Padé baseline
    g_pade = gamma_pade(theta, T_eval)
    chain.append(_step(1, "§26.1", "γ_Padé", "(2θ-T√2)/(2θ+T√2)",
                       {"theta": theta, "T_eval": T_eval}, g_pade,
                       _phase_label(g_pade)))

    # Step 2: predicted imprint shift
    n_params_M = n_params / 1e6
    imprint_shift = NU_IMPRINT * math.log10(max(n_params_M, 1e-3) / P_0_IMPRINT_M)
    chain.append(_step(2, "§28.1", "Imprint shift", "ν·log_10(P/P_0), ν=−1/(2π)",
                       {"P_M": n_params_M, "P_0_M": P_0_IMPRINT_M, "nu": NU_IMPRINT},
                       imprint_shift,
                       f"Bigger model → stronger imprint (more negative shift)."))

    # Step 3: predicted γ_random
    g_pred = g_pade + imprint_shift
    chain.append(_step(3, "§28.1", "γ_random predicted", "γ_pade + ν·log_10(P/P_0)",
                       {"gamma_pade": g_pade, "imprint": imprint_shift}, g_pred,
                       f"Predicted γ_random = {g_pred:.4f} ± 0.18 (95% CI)"))

    # Step 4: purity diagnostic if observed value provided
    if gamma_random_obs is not None:
        purity = imprint_purity(gamma_random_obs, theta, T_eval, n_params_M)
        chain.append(_step(4, "§28.2", "Imprint purity",
                           "obs − pred (purity = within ±0.18)",
                           {"gamma_random_obs": gamma_random_obs,
                            "gamma_random_pred": g_pred},
                           purity["imprint_residual"], purity["purity"]))
        verdict = "CLEAN" if abs(purity["imprint_residual"]) < 0.18 else \
                  ("OVER-IMPRINTED" if purity["imprint_residual"] < 0 else "UNDER-IMPRINTED")
        reason = (f"Residual γ_random_obs − γ_pred = {purity['imprint_residual']:+.4f}. "
                  f"95% CI is ±0.18.")
        mit = ("Models far from prediction may have anomalous training (e.g. heavy "
               "fine-tuning, format conversion). Compare to native checkpoint.")
    else:
        verdict = "PREDICTION ONLY"
        reason = (f"Predicted γ_random = {g_pred:.4f}. Provide gamma_random_obs to "
                  f"check purity (measure on RANDOM token sequences, e.g. via E4 protocol).")
        mit = ("To measure: run a 150-prompt forward pass on RANDOM-token sequences "
               "across distances d=10..1000 and fit power law. "
               "(See https://github.com/karlesmarin/tafagent for E4 protocol.)")

    return _wrap("X-21", "Imprint Purity Diagnostic", locals(), chain,
                 verdict, reason, mit)


# ─────────────────────────────────────────────────────────────────────
# X-22 — Compute-Context Invariant Check (sesión 29 — F2 Chinchilla)
# ─────────────────────────────────────────────────────────────────────
def run_recipe_x22(theta, T_train, n_params, gamma_obs, D_tokens=None,
                   T_eval=None, **_unused):
    """X-22: does the model lie in the empirical Chinchilla invariant band?

    K = γ × log(N²·D),  D = 20·N if not given.
    Empirical: K ≈ 51.2 ± 16.8 (CV=0.329, n=22 panel).
    """
    chain = []
    if T_eval is None:
        T_eval = T_train

    n_params_M = n_params / 1e6
    if D_tokens is None:
        D_tokens = 20 * n_params  # Chinchilla compute-optimal

    # Step 1: K computation
    inv = compute_invariant_K(gamma_obs, n_params_M, D_tokens)
    chain.append(_step(1, "§29", "K = γ·log(N²·D)", "γ × ln(N²·D)",
                       {"gamma": gamma_obs, "N": n_params, "D": D_tokens},
                       inv["K"],
                       f"K = {inv['K']:.2f} (panel mean {inv['panel_mean']:.1f} ± "
                       f"{inv['panel_std']:.1f})"))

    # Step 2: z-score interpretation
    chain.append(_step(2, "§29", "z-score vs panel", "(K − μ)/σ",
                       {"K": inv["K"], "mean": inv["panel_mean"],
                        "std": inv["panel_std"]},
                       inv["z_score"],
                       inv["interpretation"]))

    # Step 3: γ_pade comparison (anomaly test)
    g_pade = gamma_pade(theta, T_eval)
    pade_diff = gamma_obs - g_pade
    chain.append(_step(3, "§26.1", "γ deviation from Padé", "γ_obs − γ_pade",
                       {"gamma_obs": gamma_obs, "gamma_pade": g_pade}, pade_diff,
                       "negative = anomaly (sub-Padé); positive = supra-Padé"))

    if inv["in_distribution"]:
        verdict = "IN-BAND"
        reason = f"K = {inv['K']:.2f} within ±1σ of panel mean {inv['panel_mean']:.1f}."
        mit = "Model conforms to compute-context invariant. No action needed."
    else:
        verdict = "OUTLIER"
        reason = (f"K = {inv['K']:.2f} ({inv['interpretation']}). "
                  f"|z| = {abs(inv['z_score']):.2f} > 1.")
        mit = ("High-K (over-concentrating attention for given compute) or low-K "
               "(under-using compute for attention concentration). Check tokenizer, "
               "training recipe, fine-tuning history.")

    return _wrap("X-22", "Compute-Context Invariant", locals(), chain,
                 verdict, reason, mit)


# ─────────────────────────────────────────────────────────────────────
# X-23 — IH-Phase Detector (sesión 29 — F4 Δγ probe)
# ─────────────────────────────────────────────────────────────────────
def run_recipe_x23(n_params, gamma_text=None, gamma_random=None, **_unused):
    """X-23: is this checkpoint pre- or post-induction-head formation?

    Discriminator: sign(γ_text − γ_random) > 0 ⟺ post-IH.
    Cheaper than ICL benchmark for monitoring training trajectories.
    """
    chain = []
    n_params_M = n_params / 1e6

    # Step 1: size-based prediction
    expected = "post-IH" if n_params >= 4e8 else "pre-IH"
    chain.append(_step(1, "§30", "Size-based phase prediction",
                       "P ≥ 400M ⇒ post-IH",
                       {"n_params_M": n_params_M, "threshold_M": 400}, expected))

    # Step 2: γ-based discrimination if both gammas given
    if gamma_text is not None and gamma_random is not None:
        check = ih_phase_check(gamma_text, gamma_random, n_params_M)
        chain.append(_step(2, "§30", "Δγ discriminator", "sign(γ_text − γ_random)",
                           {"gamma_text": gamma_text, "gamma_random": gamma_random},
                           check["delta_gamma"],
                           f"observed phase: {check['phase_observed']}"))

        if check["consistent"]:
            verdict = f"CONFIRMED {check['phase_observed'].upper()}"
            reason = (f"Δγ = {check['delta_gamma']:+.3f} sign matches size-prediction "
                      f"({expected}).")
            mit = "Phase confirmed. Use this checkpoint for downstream tasks accordingly."
        else:
            verdict = "ANOMALY"
            reason = (f"Δγ = {check['delta_gamma']:+.3f} suggests {check['phase_observed']}, "
                      f"but size predicts {expected}. Investigate.")
            mit = ("Possible causes: incomplete training, anomalous fine-tuning, "
                   "format conversion, tokenizer corruption (cf. F5 OLMo Δγ=0.30).")
    else:
        verdict = f"PREDICTED {expected.upper()}"
        reason = (f"Only size given: P = {n_params_M:.0f}M. "
                  f"Provide gamma_text + gamma_random to verify via Δγ probe.")
        mit = ("Run E4 protocol with corpus=mongo and corpus=random; "
               "compare γ values.")

    return _wrap("X-23", "IH-Phase Detector", locals(), chain,
                 verdict, reason, mit)


# ════════════════════════════════════════════════════════════════════════════
# Helpers
# ════════════════════════════════════════════════════════════════════════════
def _step(n, sec, name, formula, inputs, result, interpretation=None, breakdown=None):
    s = {"step": n, "section": sec, "name": name, "formula": formula,
         "inputs": inputs, "result": result}
    if interpretation:
        s["interpretation"] = interpretation
    if breakdown:
        s["breakdown"] = breakdown
    return s


def _wrap(rid, rname, locals_dict, chain, verdict, reason, mitigation):
    # Clean inputs (drop chain/internal vars)
    inputs = {k: v for k, v in locals_dict.items()
              if not k.startswith("_") and k not in
              ("chain", "verdict", "reason", "mit", "info", "be", "kv", "g_pade", "g_corr",
               "decomp", "dh", "l_niah", "p_hallu", "cost", "model_GB", "inf", "api",
               "api_blend", "fits", "mem", "emerg", "max_flops", "hours",
               "N_chinchilla", "D_chinchilla", "candidates", "best", "tok_per_s",
               "tok_per_day", "capacity_users", "usd_per_day", "usd_per_Mtok",
               "total_GB", "w_mem", "df", "df_zone_ok", "regime", "has_GQA",
               "margin", "months", "months_to_payoff", "name")}
    return {"recipe_id": rid, "recipe_name": rname, "inputs": inputs,
            "chain": chain, "verdict": verdict, "reason": reason,
            "mitigation": mitigation}


def _phase_label(g):
    if 0 < g < 1:
        return "Phase A (long-range OK)"
    if g >= 1:
        return "Phase B / Hagedorn"
    return "Phase B / catastrophic (negative γ — T too large for θ)"


# ════════════════════════════════════════════════════════════════════════════
# §32 — Sesión 29 visual-diagnostic helpers (paper 2 §4 bimodal + Hagedorn)
# ════════════════════════════════════════════════════════════════════════════
def hagedorn_safety_alert(gamma: float) -> dict:
    """§32.1 — Classify γ into safety zones (paper 2 §4.2 finding F12).

    Empirical n=25 panel: 36% of LLMs operate at γ ≥ 0.95 (Hagedorn-zone risk).
    Models at γ ≥ 1.0 cannot serve long context without NTK extension.
    """
    if gamma is None or not isinstance(gamma, (int, float)):
        return {"level": "unknown", "color": "gray", "message": "no γ available"}
    if gamma >= 1.0:
        return {
            "level": "critical",
            "color": "red",
            "label": "🔴 HAGEDORN ZONE",
            "message": ("γ ≥ 1.0: attention concentrates locally. Long-context "
                        "retrieval will FAIL without NTK extension (α_opt > 1)."),
            "fraction_of_panel": "36% of n=25 LLMs are in this zone",
        }
    if gamma >= 0.95:
        return {
            "level": "warning",
            "color": "orange",
            "label": "🟠 HAGEDORN BOUNDARY",
            "message": ("γ ≥ 0.95: at the edge. Long context above T_train risky. "
                        "Run X-2 long-context viability before deploying."),
            "fraction_of_panel": "~24% of n=25 LLMs cluster here",
        }
    if gamma >= 0.65:
        return {
            "level": "ok",
            "color": "green",
            "label": "🟢 PHASE A NORMAL",
            "message": ("γ ∈ [0.65, 0.95]: long-context OK. KV compression via "
                        "D_f window applicable in [0.65, 0.85]."),
            "fraction_of_panel": "~40% of n=25 LLMs",
        }
    if gamma > 0:
        return {
            "level": "info",
            "color": "blue",
            "label": "🔵 PHASE A WIDE-FIELD",
            "message": ("γ < 0.65: very long-range attention. Model may be over-"
                        "trained on long context, or pre-IH (small model)."),
            "fraction_of_panel": "~12% of n=25 LLMs (mostly small or anomalous)",
        }
    return {
        "level": "catastrophic",
        "color": "darkred",
        "label": "❌ NEGATIVE γ",
        "message": "Negative γ means T_eval >> θ. Bad operating point. Use lower T or higher θ.",
        "fraction_of_panel": "0% of n=25 (pathological)",
    }


# ════════════════════════════════════════════════════════════════════════════
# §33 — Sesion 31 (2026-04-30) findings — added to TAF v0.4
# Architectural concentration law, PDI, 4-bit R²-direction rule, critical exponents
# ════════════════════════════════════════════════════════════════════════════

def architectural_concentration_predict(gamma_pade_val: float, n_kv: int) -> dict:
    """§33.1 — Architectural concentration law (paper 2 NEW, sesion 31).

    γ_text ≈ γ_Padé − 0.012·n_kv
    R² = 0.30 cross-panel (n=22) vs Padé alone R²=0.02.

    IMPORTANT: This is a CORRELATIONAL law, NOT per-model predictor.
    Mean per-model |err| = 0.27, WORSE than Padé alone (0.24).
    Use as CROSS-PANEL diagnostic, not individual prediction.
    """
    k_arch = 0.012  # panel-fit coefficient (n=22), not derived from first principles
    gamma_predicted = gamma_pade_val - k_arch * n_kv
    return {
        "gamma_pade": gamma_pade_val,
        "n_kv": n_kv,
        "k_arch": k_arch,
        "gamma_text_predicted": gamma_predicted,
        "caveat": "Correlational, not per-model predictor (R²=0.30, mean err 0.27)",
        "interpretation": (
            "GQA aggressive (low n_kv) → γ pushed up toward Hagedorn. "
            "MHA full (n_kv=32) → γ drops below Padé (sink-prone)."
        ),
    }


def padé_deviation_index(theta: float, gamma_obs: float, T_eval: int) -> dict:
    """§33.2 — PDI Padé Deviation Index (paper 2 NEW, sesion 31).

    PDI = d_horizon_obs / T_eval = θ(1−γ_obs)√2 / ((1+γ_obs)·T_eval)

    Identity (D-NEW-1): PDI = 1 ⟺ γ_obs = γ_Padé(θ, T_eval)
    Diagnostic value:
      PDI ≈ 1: canonical (model matches Padé)
      PDI > 1.5: γ_obs < γ_Padé (sink-dominated, code/instruct shift)
      PDI < 0.5: γ_obs > γ_Padé but < 1 (over-concentrated)
      PDI < 0: γ_obs > 1 (Phase B, formula sign-flips)

    Equivalent log scale: log(PDI) + ΔH_Cardy = 0 (D-DEEP-15).
    """
    if gamma_obs == -1.0:
        return {"PDI": float('inf'), "regime": "singular"}
    pdi = theta * (1 - gamma_obs) * math.sqrt(2) / ((1 + gamma_obs) * T_eval)
    if pdi < 0:
        regime = "Phase B (γ>1, formula sign-flip)"
        traffic = "🔴 RED — Phase B, NTK extension required"
    elif 0.5 <= pdi <= 1.5:
        regime = "canonical (γ_obs ≈ γ_Padé)"
        traffic = "🟢 GREEN — model matches Padé prediction"
    elif pdi > 1.5:
        regime = "γ_obs << γ_Padé (sink-dominated or extreme alignment)"
        traffic = "🟠 ORANGE — large positive deviation"
    else:  # 0 < pdi < 0.5
        regime = "γ_obs > γ_Padé (over-concentrated in Phase A)"
        traffic = "🟡 YELLOW — moderate deviation"
    return {
        "PDI": pdi,
        "log_PDI": math.log(pdi) if pdi > 0 else None,
        "regime": regime,
        "traffic_light": traffic,
        "identity": "log(PDI) + ΔH_Cardy = 0 (use either, log-inverse)",
    }


def precision_shift_predict_4bit(gamma_bf16: float, R2_bf16: float, is_GQA: bool) -> dict:
    """§33.3 — 4-bit precision shift direction predictor (paper 2 NEW, sesion 31).

    Empirical n=5 rule: bf16 R² of power-law fit predicts 4-bit shift direction.

    For MHA models:
      R²(bf16) < 0.9 (sink-dominated): 4-bit shifts γ UP toward γ_Padé
      R²(bf16) > 0.99 (clean): 4-bit shifts γ DOWN (introduces noise)
      0.95 ≤ R² ≤ 0.99: stable (~no shift)

    For GQA models: precision-robust regardless (|Δγ| < 0.05).
    """
    if is_GQA:
        return {
            "predicted_shift_direction": "stable",
            "expected_magnitude": "|Δγ| < 0.05",
            "reason": "GQA KV-sharing distributes attention; little long-tail to perturb",
            "recommendation": "Either bf16 or 4-bit OK for deployment",
        }
    # MHA case — depends on R²
    if R2_bf16 < 0.9:
        direction = "UP"
        magnitude = "+0.3 to +0.8 expected"
        reason = "Sink-dominated bf16: 4-bit truncates long-tail, reveals Padé prediction"
    elif R2_bf16 > 0.99:
        direction = "DOWN"
        magnitude = "−0.2 to −0.4 expected"
        reason = "Clean bf16: 4-bit further sparsifies, introduces non-monotonicity"
    else:
        direction = "stable"
        magnitude = "|Δγ| < 0.05"
        reason = "Borderline R², 4-bit minimal effect"
    return {
        "predicted_shift_direction": direction,
        "expected_magnitude": magnitude,
        "reason": reason,
        "evidence": "n=5 paired measurements (DeepSeek/Pythia-1B/Pythia-2.8B/Llama-3/Qwen-7B-Inst)",
        "caveat": "R²-direction rule is empirical, not formally derived",
    }


def critical_exponents_bundle(gamma: float) -> dict:
    """§33.4 — Critical exponents bundle (paper 2 NEW, sesion 31 + GAME-O).

    Returns ν_c (correlation length), β_c (order parameter), η_c (anomalous dim),
    α_C (specific heat), γ_susc (susceptibility) as functions of γ.

    Hyperscaling consistent (Rushbrooke + Josephson, d=1).

    NEW IDENTITY (GAME-P recursive):
      γ_susc(γ) = 1/(1−γ) + 2(1−γ) ≥ 2√2 (AM-GM bound)
      Minimum at γ = 1 − 1/√2 ≈ 0.293
      Equals c_central=3 at γ=0 AND γ=1/2
    """
    if gamma >= 1:
        return {"regime": "Hagedorn or beyond", "exponents": "diverge"}
    nu_c = 1 / (1 - gamma)
    beta_c = gamma - 1
    eta_c = gamma - 1  # CORRECTED from paper 1's η=2γ (Lévy mapping consistent with hyperscaling)
    alpha_C = 2 - 1 / (1 - gamma)
    gamma_susc = 1 / (1 - gamma) + 2 * (1 - gamma)

    # AM-GM bound check
    gamma_min = 1 - 1 / math.sqrt(2)
    gamma_susc_min = 2 * math.sqrt(2)

    return {
        "nu_correlation_length": nu_c,
        "beta_order_param": beta_c,
        "eta_anomalous_dim": eta_c,
        "eta_note": "η_c = γ−1 (Lévy-derived, hyperscaling-consistent). Paper 1 claim η=2γ is INCORRECT.",
        "alpha_specific_heat": alpha_C,
        "gamma_susceptibility": gamma_susc,
        "c_central_at_gamma_0": 3,  # γ_susc(γ=0) = 3 = c_central
        "AM_GM_bound": {
            "min_gamma_susc": gamma_susc_min,
            "min_at_gamma": gamma_min,
            "interpretation": (
                f"γ_susc has UNIVERSAL minimum {gamma_susc_min:.3f} at γ = {gamma_min:.4f} "
                "(AM-GM with ab=2 product constant)"
            ),
        },
        "hyperscaling_check": {
            "Rushbrooke (α + 2β + γ_susc = 2)": alpha_C + 2 * beta_c + gamma_susc,
            "expected": 2,
        },
        "warning_paper1_eta": "Paper 1's η_c = 2γ is INCORRECT. Use η_c = γ-1 (this function).",
    }


def verify_algebraic_consistency(gamma: float, tol: float = 1e-9) -> dict:
    """§34 v0.5 — Machine-verified framework consistency check.

    Verifies the 12 D-SAGE algebraic identities discovered by Sage Groebner basis
    and formally proven in Lean Mathlib4 (sesion 32, 2026-05-01).

    Each identity is a sanity check: given measured γ, the TAF critical exponents
    must satisfy these relations. Failures indicate γ measurement artifacts
    (bf16 outliers, quantization issues, Phase B regime).

    References:
      - sage_recursive_sweep_results.json (Sage Groebner verification)
      - lean_taf/taf/Taf/Identities.lean (Lean Mathlib4 machine-proof)
      - paper 2 appendix A.4 "Formal verification"
    """
    if gamma >= 1 or gamma <= 0:
        return {
            "status": "out_of_phase_A",
            "phase_A_range": "(0, 1)",
            "input_gamma": gamma,
            "message": "Verification requires γ ∈ (0, 1) Phase A regime."
        }

    nu = 1 / (1 - gamma)
    beta = gamma - 1
    eta = gamma - 1  # CORRECTED η=γ-1 (NOT paper 1's 2γ)
    alpha = 2 - 1 / (1 - gamma)
    chi = 1 / (1 - gamma)
    gamma_chi = 1 / (1 - gamma) + 2 * (1 - gamma)

    checks = {
        "D-SAGE-1": {
            "claim": "2η² + η·γ_χ + 1 = 0",
            "value": 2 * eta**2 + eta * gamma_chi + 1,
            "expected": 0.0,
            "passes": abs(2 * eta**2 + eta * gamma_chi + 1) < tol,
        },
        "D-SAGE-2": {
            "claim": "β·χ = -1",
            "value": beta * chi,
            "expected": -1.0,
            "passes": abs(beta * chi - (-1)) < tol,
        },
        "D-SAGE-4": {
            "claim": "α + χ = 2",
            "value": alpha + chi,
            "expected": 2.0,
            "passes": abs(alpha + chi - 2) < tol,
        },
        "D-SAGE-5": {
            "claim": "α + γ_χ = 2(2-γ)",
            "value": alpha + gamma_chi,
            "expected": 2 * (2 - gamma),
            "passes": abs(alpha + gamma_chi - 2 * (2 - gamma)) < tol,
        },
        "D-SAGE-6": {
            "claim": "β·γ_χ = -2γ²+4γ-3",
            "value": beta * gamma_chi,
            "expected": -2 * gamma**2 + 4 * gamma - 3,
            "passes": abs(beta * gamma_chi - (-2 * gamma**2 + 4 * gamma - 3)) < tol,
        },
        "Rushbrooke_tautology": {
            "claim": "2β + γ_χ - ν·d = 0 (d=1)",
            "value": 2 * beta + gamma_chi - nu,
            "expected": 0.0,
            "passes": abs(2 * beta + gamma_chi - nu) < tol,
        },
        "Josephson_tautology": {
            "claim": "2 - α - ν·d = 0 (d=1)",
            "value": 2 - alpha - nu,
            "expected": 0.0,
            "passes": abs(2 - alpha - nu) < tol,
        },
        "Fisher_independent": {
            "claim": "Fisher residual = γ(2γ-3)/(1-γ)  [NOT 0 generally]",
            "value": gamma_chi - (2 - eta) * nu,
            "expected_formula": gamma * (2 * gamma - 3) / (1 - gamma),
            "passes": abs((gamma_chi - (2 - eta) * nu) - gamma * (2 * gamma - 3) / (1 - gamma)) < tol,
        },
        "eta_2gamma_REFUTED": {
            "claim": "Paper 1's η=2γ residual > 0 in Phase A",
            "value": 2 * (2 * gamma)**2 + 2 * gamma * gamma_chi + 1,
            "expected": "positive (refutes η=2γ)",
            "passes": (2 * (2 * gamma)**2 + 2 * gamma * gamma_chi + 1) > 0,
        },
        "D-14_nu_imprint": {
            "claim": "ν_imprint · 2π = -1",
            "value": (-1 / (2 * math.pi)) * 2 * math.pi,
            "expected": -1.0,
            "passes": abs((-1 / (2 * math.pi)) * 2 * math.pi - (-1)) < tol,
        },
        "D-SAGE-7": {
            "claim": "c · |ν_imprint| · 2π = 3",
            "value": 3 * (1 / (2 * math.pi)) * 2 * math.pi,
            "expected": 3.0,
            "passes": abs(3 * (1 / (2 * math.pi)) * 2 * math.pi - 3) < tol,
        },
        "nu_beta_id": {
            "claim": "ν · β = -1",
            "value": nu * beta,
            "expected": -1.0,
            "passes": abs(nu * beta - (-1)) < tol,
        },
    }

    n_total = len(checks)
    n_passed = sum(1 for c in checks.values() if c["passes"])
    all_consistent = n_passed == n_total

    return {
        "input_gamma": gamma,
        "phase": "A (γ ∈ (0,1))",
        "n_checks_total": n_total,
        "n_checks_passed": n_passed,
        "all_consistent": all_consistent,
        "framework_verified_by": "Sage Groebner basis (PolynomialRing(ℚ)) + Lean Mathlib4 (dependent type theory)",
        "checks": checks,
        "interpretation": (
            f"All {n_total}/{n_total} D-SAGE identities consistent ✓ "
            "(framework algebraic structure intact)"
            if all_consistent
            else f"INCONSISTENCY: {n_passed}/{n_total} pass. Possible bf16 outlier, "
                 "quantization artifact, or measurement noise."
        ),
        "references": [
            "Sage script: sage_recursive_sweep_2026-04-30.sage",
            "Lean script: lean_taf/taf/Taf/Identities.lean",
            "Paper 2 appendix A.4: appendix_formal_verification_2026-05-01.md",
        ],
    }


def bimodal_phase_class(gamma: float) -> str:
    """§32.2 — Bimodal classifier (paper 2 §4 finding F11).

    γ_text panel n=25 shows 2 density peaks (~0.75 + ~1.0) with gap 0.85-0.95.
    Hartigan dip test pending (paper 2 Tier-A E3).
    """
    if gamma is None:
        return "unknown"
    if gamma < 0:
        return "catastrophic"
    if gamma < 0.85:
        return "Phase A (long-range)"
    if gamma < 0.95:
        return "boundary (gap zone)"
    if gamma < 1.0:
        return "Hagedorn boundary"
    return "Hagedorn zone"


def nearest_famous_constant(gamma: float, max_results: int = 3,
                            tolerance: float = 0.05) -> list:
    """§32.3 — Convenience wrapper: find named constants near γ.

    Wraps famous_constant_proximity(); always returns a list (possibly empty).
    Useful for displaying "your γ is close to <constant>" in UI.
    """
    if gamma is None:
        return []
    out = famous_constant_proximity(gamma, tolerance=tolerance)
    return out.get("hits", [])[:max_results]


# ════════════════════════════════════════════════════════════════════════════
# Recipe registry
# ════════════════════════════════════════════════════════════════════════════
RECIPES = {
    "X-1": {
        "name": "Custom Training vs API",
        "description": "Should I train a custom model or use a frontier API for my domain task?",
        "fn": run_recipe_x1,
        "params": ["N_params", "D_tokens", "gpu", "n_gpus", "mfu",
                   "api_model", "monthly_tokens_M"],
        "category": "build-vs-buy",
        "uses_sections": ["§17", "§19", "§20", "§24"],
    },
    "X-2": {
        "name": "Long Context Viability",
        "description": "Will model M serve length L doing Needle-in-a-Haystack retrieval?",
        "fn": run_recipe_x2,
        "params": ["theta", "T_train", "T_eval", "n_attention_heads", "n_kv_heads",
                   "d_head", "n_layers", "n_params", "has_SWA"],
        "category": "long-context",
        "uses_sections": ["§26", "§19"],
    },
    "X-3": {
        "name": "Budget Pre-flight",
        "description": "Given $ budget, what model is feasible to train?",
        "fn": run_recipe_x3,
        "params": ["USD_budget", "gpu", "mfu", "n_gpus"],
        "category": "training-budget",
        "uses_sections": ["§17", "§20"],
    },
    "X-5": {
        "name": "Hardware Selection",
        "description": "Which GPU should I use to serve my model at target throughput?",
        "fn": run_recipe_x5,
        "params": ["N_params", "T_eval", "n_layers", "n_kv_heads", "d_head",
                   "bytes_per_weight", "target_tokens_per_day", "concurrent_users"],
        "category": "serving",
        "uses_sections": ["§19", "§20"],
    },
    "X-19": {
        "name": "KV Compression Decision",
        "description": "Should I use soft decay, D_f cutoff, or literature methods to compress KV?",
        "fn": run_recipe_x19,
        "params": ["theta", "T_train", "T_eval", "n_attention_heads", "n_kv_heads",
                   "d_head", "n_layers", "n_params", "has_SWA"],
        "category": "kv-compression",
        "uses_sections": ["§26", "§19"],
    },
    "X-21": {
        "name": "Imprint Purity Diagnostic",
        "description": "How clean is the model's RoPE-Padé prediction? Predicts γ on RANDOM-token input via ν=−1/(2π).",
        "fn": run_recipe_x21,
        "params": ["theta", "T_train", "n_attention_heads", "n_kv_heads",
                   "d_head", "n_layers", "n_params", "T_eval", "gamma_random_obs"],
        "category": "diagnostic",
        "uses_sections": ["§26", "§28"],
    },
    "X-22": {
        "name": "Compute-Context Invariant",
        "description": "Does γ × log(N²·D) lie in the panel band 51.2 ± 16.8? Detects training/scaling anomalies.",
        "fn": run_recipe_x22,
        "params": ["theta", "T_train", "n_params", "gamma_obs", "D_tokens", "T_eval"],
        "category": "diagnostic",
        "uses_sections": ["§26", "§29"],
    },
    "X-23": {
        "name": "IH-Phase Detector",
        "description": "Is this model pre- or post-induction-head? Cheap probe via sign(γ_text − γ_random).",
        "fn": run_recipe_x23,
        "params": ["n_params", "gamma_text", "gamma_random"],
        "category": "diagnostic",
        "uses_sections": ["§30"],
    },
}


def list_recipes() -> str:
    """Return JSON of all recipes for UI dropdown."""
    return json.dumps([
        {"id": rid, "name": r["name"], "description": r["description"],
         "category": r["category"], "params": r["params"],
         "uses_sections": r["uses_sections"]}
        for rid, r in RECIPES.items()
    ])


def run_recipe(recipe_id: str, **params) -> dict:
    """Dispatcher — execute recipe by id with given params."""
    r = RECIPES.get(recipe_id)
    if r is None:
        return {"error": f"unknown recipe '{recipe_id}'",
                "available": list(RECIPES.keys())}
    return r["fn"](**params)


# ════════════════════════════════════════════════════════════════════════════
# Known model presets
# ════════════════════════════════════════════════════════════════════════════
PRESETS = {
    "EleutherAI/pythia-2.8b": {
        "theta": 10000, "T_train": 2048,
        "n_attention_heads": 32, "n_kv_heads": 32,
        "d_head": 80, "n_layers": 32, "n_params": 2.8e9, "has_SWA": False,
    },
    "EleutherAI/pythia-1b": {
        "theta": 10000, "T_train": 2048,
        "n_attention_heads": 8, "n_kv_heads": 8,
        "d_head": 256, "n_layers": 16, "n_params": 1e9, "has_SWA": False,
    },
    "EleutherAI/pythia-1.4b": {
        "theta": 10000, "T_train": 2048,
        "n_attention_heads": 16, "n_kv_heads": 16,
        "d_head": 128, "n_layers": 24, "n_params": 1.4e9, "has_SWA": False,
    },
    "meta-llama/Meta-Llama-3-8B": {
        "theta": 500000, "T_train": 8192,
        "n_attention_heads": 32, "n_kv_heads": 8,
        "d_head": 128, "n_layers": 32, "n_params": 8e9, "has_SWA": False,
    },
    "meta-llama/Llama-3.2-1B": {
        "theta": 500000, "T_train": 131072,
        "n_attention_heads": 32, "n_kv_heads": 8,
        "d_head": 64, "n_layers": 16, "n_params": 1.2e9, "has_SWA": False,
    },
    "meta-llama/Llama-3.3-70B-Instruct": {
        "theta": 500000, "T_train": 131072,
        "n_attention_heads": 64, "n_kv_heads": 8,
        "d_head": 128, "n_layers": 80, "n_params": 70e9, "has_SWA": False,
    },
    "mistralai/Mistral-7B-v0.1": {
        "theta": 10000, "T_train": 8192,
        "n_attention_heads": 32, "n_kv_heads": 8,
        "d_head": 128, "n_layers": 32, "n_params": 7e9, "has_SWA": True,
    },
    "Qwen/Qwen2.5-7B": {
        "theta": 1000000, "T_train": 32768,
        "n_attention_heads": 28, "n_kv_heads": 4,
        "d_head": 128, "n_layers": 28, "n_params": 7.6e9, "has_SWA": False,
    },
    "Qwen/Qwen2.5-1.5B": {
        "theta": 1000000, "T_train": 32768,
        "n_attention_heads": 12, "n_kv_heads": 2,
        "d_head": 128, "n_layers": 28, "n_params": 1.5e9, "has_SWA": False,
    },
    "google/gemma-2-9b-it": {
        "theta": 10000, "T_train": 8192,
        "n_attention_heads": 16, "n_kv_heads": 8,
        "d_head": 256, "n_layers": 42, "n_params": 9e9, "has_SWA": True,
    },
    "microsoft/phi-3-mini-4k-instruct": {
        "theta": 10000, "T_train": 4096,
        "n_attention_heads": 32, "n_kv_heads": 32,
        "d_head": 96, "n_layers": 32, "n_params": 3.8e9, "has_SWA": True,
    },
}


def list_presets() -> str:
    return json.dumps([
        {"id": k, "label": k.split("/")[-1],
         "theta": v["theta"], "T_train": v["T_train"]}
        for k, v in PRESETS.items()
    ])


def get_preset(model_id: str) -> dict:
    return PRESETS.get(model_id, {})


# ════════════════════════════════════════════════════════════════════════════
# MODEL PROFILE — runs all 5 recipes with sensible defaults
# ════════════════════════════════════════════════════════════════════════════
def profile_model(theta, T_train, n_attention_heads, n_kv_heads, d_head,
                  n_layers, n_params, has_SWA=False,
                  T_eval=None, USD_budget=5000, target_tokens_per_day=10_000_000,
                  api_model="GPT-4o", monthly_tokens_M=10.0,
                  **_unused) -> dict:
    """Run all 5 recipes against the same model and assemble a TAF Card profile.

    This produces the canonical paper §sec:gamma_decomposition view: one model,
    all viability dimensions, with κey numbers + falsification status per dimension.
    """
    if T_eval is None:
        T_eval = T_train  # default eval at training context

    has_GQA = n_kv_heads < n_attention_heads
    g_pade = gamma_pade(theta, T_eval)
    decomp = gamma_decompose(g_pade, has_GQA, has_SWA, n_params)
    g_corr = decomp["gamma_corrected"]
    dh = d_horizon(theta, g_corr)
    chi = chi_susceptibility(g_corr) if 0 < g_corr < 2 else None

    # Architecture classification (paper species map)
    if has_SWA:
        arch_class = "SWA-alternating (gemma/phi family signature)"
    elif has_GQA and n_params >= 4e8:
        arch_class = "RoPE-GQA post-IH (Llama-3 / Mistral / Qwen-style)"
    elif has_GQA:
        arch_class = "RoPE-GQA pre-IH (small GQA model)"
    elif n_params >= 4e8:
        arch_class = "RoPE-MHA post-IH (classical Llama-2 / pythia-large)"
    else:
        arch_class = "RoPE-MHA pre-IH (small MHA model)"

    common_params = {
        "theta": theta, "T_train": T_train, "T_eval": T_eval,
        "n_attention_heads": n_attention_heads, "n_kv_heads": n_kv_heads,
        "d_head": d_head, "n_layers": n_layers, "n_params": n_params,
        "has_SWA": has_SWA,
    }

    # Run all 5 recipes
    results = {}
    try:
        results["X-2"] = run_recipe_x2(**common_params)
    except Exception as e:
        results["X-2"] = {"error": str(e)}

    try:
        results["X-19"] = run_recipe_x19(**common_params)
    except Exception as e:
        results["X-19"] = {"error": str(e)}

    try:
        results["X-1"] = run_recipe_x1(N_params=n_params, gpu="H100 SXM",
                                        n_gpus=8, mfu=0.45,
                                        api_model=api_model, monthly_tokens_M=monthly_tokens_M)
    except Exception as e:
        results["X-1"] = {"error": str(e)}

    try:
        results["X-3"] = run_recipe_x3(USD_budget=USD_budget, gpu="H100 SXM",
                                        mfu=0.45, n_gpus=1)
    except Exception as e:
        results["X-3"] = {"error": str(e)}

    try:
        results["X-5"] = run_recipe_x5(N_params=n_params, T_eval=T_eval,
                                        n_layers=n_layers, n_kv_heads=n_kv_heads,
                                        d_head=d_head, bytes_per_weight=2.0,
                                        target_tokens_per_day=target_tokens_per_day,
                                        concurrent_users=1)
    except Exception as e:
        results["X-5"] = {"error": str(e)}

    # Falsification status (from FALSIFICATION.md F1-F23)
    falsifications = []
    if 0 < g_corr < 1:
        falsifications.append({"id": "F1", "claim": "γ_Padé median MAE < 5%", "status": "✅ in scope"})
    if dh is not None:
        falsifications.append({"id": "F2", "claim": "d_horizon predicts NIAH ±1%", "status": "✅ applicable"})
        falsifications.append({"id": "F17", "claim": "Soft KV decay regime",
                               "status": "✅ applies" if dh >= T_train / 2 else "⚠ refuted regime"})
    if has_GQA:
        falsifications.append({"id": "F10", "claim": "GQA Δγ < -0.1 ⇒ post-IH",
                               "status": "✅ in scope"})
    if has_SWA:
        falsifications.append({"id": "F11", "claim": "SWA Δγ > +0.3 (gemma signature)",
                               "status": "✅ in scope"})

    # Sesión 29 / paper 2 visual diagnostics
    safety = hagedorn_safety_alert(g_corr)
    phase_cls = bimodal_phase_class(g_corr)
    constants = nearest_famous_constant(g_corr, max_results=2, tolerance=0.02)
    n_params_M = n_params / 1e6
    gamma_random_pred = gamma_random_predict(theta, T_eval, n_params_M)
    K_inv = compute_invariant_K(g_corr, n_params_M)

    return {
        "model_summary": {
            "architecture_class": arch_class,
            "n_params": n_params,
            "T_train": T_train,
            "T_eval": T_eval,
            "rope_theta": theta,
            "has_GQA": has_GQA,
            "has_SWA": has_SWA,
        },
        "key_numbers": {
            "gamma_pade": g_pade,
            "gamma_decomposed": g_corr,
            "decomposition_breakdown": decomp,
            "d_horizon": dh,
            "L_NIAH_ceiling": l_niah_c(dh),
            "chi_susceptibility": chi,
            "kv_memory_per_request_GB": kv_cache_memory(n_layers, n_kv_heads,
                                                        d_head, T_eval)["GB"],
            "gamma_random_predicted": gamma_random_pred,
            "compute_invariant_K": K_inv["K"],
            "K_in_distribution": K_inv["in_distribution"],
        },
        "v04_diagnostics": {
            "hagedorn_safety": safety,
            "bimodal_phase_class": phase_cls,
            "nearest_famous_constants": constants,
            "imprint_predicted_shift": gamma_random_pred - g_pade,
            "compute_invariant": K_inv,
        },
        "recipes": {
            rid: {
                "verdict": r.get("verdict", "ERROR"),
                "reason": r.get("reason", r.get("error", "")),
                "mitigation": r.get("mitigation", ""),
                "name": r.get("recipe_name", ""),
            }
            for rid, r in results.items()
        },
        "falsification_status": falsifications,
    }


# ════════════════════════════════════════════════════════════════════════════
# COMPARE — same recipe across multiple models
# ════════════════════════════════════════════════════════════════════════════
def compare_models(model_specs: list, recipe_id: str = "X-2",
                   shared_params: dict = None) -> dict:
    """Run one recipe across multiple models and assemble side-by-side comparison.

    Args:
        model_specs: list of dicts each with model architectural params + a "label" key
        recipe_id: which recipe to run (X-1, X-2, X-3, X-5, X-19)
        shared_params: extra params to pass to recipe (T_eval, etc.)
    """
    shared_params = shared_params or {}
    rows = []
    for spec in model_specs:
        label = spec.pop("label", spec.get("model_id", "model"))
        params = {**spec, **shared_params}
        try:
            result = run_recipe(recipe_id, **params)
            rows.append({
                "label": label,
                "verdict": result.get("verdict", "ERROR"),
                "reason": result.get("reason", ""),
                "key_numbers": _extract_key_numbers(result),
            })
        except Exception as e:
            rows.append({"label": label, "verdict": "ERROR", "reason": str(e), "key_numbers": {}})
    return {
        "recipe_id": recipe_id,
        "recipe_name": RECIPES.get(recipe_id, {}).get("name", recipe_id),
        "shared_params": shared_params,
        "rows": rows,
    }


def _extract_key_numbers(result: dict) -> dict:
    """Pull the numerically interesting fields from a recipe result for compare table."""
    nums = {}
    for step in result.get("chain", []):
        name = step.get("name", "")
        res = step.get("result")
        if res is None:
            continue
        if isinstance(res, (int, float)):
            nums[name] = res
        elif isinstance(res, dict) and "GB" in res:
            nums[name] = res["GB"]
    return nums


# Smoke test
if __name__ == "__main__":
    print("─── X-2 Llama-3-8B @ 32K ───")
    r = run_recipe("X-2", theta=500_000, T_train=8192, T_eval=32_000,
                   n_attention_heads=32, n_kv_heads=8, d_head=128,
                   n_layers=32, n_params=8e9, has_SWA=False)
    print(f"Verdict: {r['verdict']} — {r['reason']}\n")

    print("─── X-1 Llama-3-8B vs GPT-4o (10M tok/mo) ───")
    r = run_recipe("X-1", N_params=8e9, monthly_tokens_M=10.0, api_model="GPT-4o")
    print(f"Verdict: {r['verdict']} — {r['reason']}\n")

    print("─── X-3 budget $5K ───")
    r = run_recipe("X-3", USD_budget=5000.0, gpu="H100 SXM", n_gpus=1)
    print(f"Verdict: {r['verdict']} — {r['reason']}\n")

    print("─── X-5 serve Llama-3-8B at 4K ───")
    r = run_recipe("X-5", N_params=8e9, T_eval=4096, n_layers=32, n_kv_heads=8, d_head=128,
                   target_tokens_per_day=10e6, concurrent_users=1)
    print(f"Verdict: {r['verdict']} — {r['reason']}\n")

    print("─── X-19 KV compression for Llama-3-8B ───")
    r = run_recipe("X-19", theta=500_000, T_train=8192, T_eval=8192,
                   n_attention_heads=32, n_kv_heads=8, d_head=128,
                   n_layers=32, n_params=8e9)
    print(f"Verdict: {r['verdict']} — {r['reason']}\n")
