"""Numerical tests for TAF Agent formulas — paper §3.3, §5, §7.1.

Verifies the corrected implementations match:
  - exact theoretical paper formulas (γ_Padé, D_f closed)
  - numerical ground truth (partition_Z at γ=1, mean_log_d)
  - paper Table §7.1 compression examples
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "cli"))
sys.path.insert(0, str(ROOT / "python"))

from diagnose_model import (  # type: ignore
    D_f_closed, free_energy_F, partition_Z, mean_log_d,
    entropy_S, heat_capacity_Cv, theta_eff_pade, EULER_GAMMA,
)
from taf_browser import (  # type: ignore
    gamma_pade, d_horizon, theta_design, df_window,
    gamma_decompose, gamma_decompose_v2,
)


# ─────────────────────────────────────────────────────────────────────────
# γ_Padé (sanity)
# ─────────────────────────────────────────────────────────────────────────


def test_gamma_pade_T_zero_gives_one():
    assert abs(gamma_pade(10000, 0) - 1.0) < 1e-12


def test_gamma_pade_at_T_theta_sqrt2_gives_zero():
    """T = θ√2 ⇒ γ_Padé = 0 (paper saturation point)."""
    theta = 10000
    T = int(theta * math.sqrt(2))
    g = gamma_pade(theta, T)
    assert abs(g) < 1e-3, f"got {g}"


def test_gamma_pade_at_T_theta_over_sqrt2_NOT_zero():
    """T = θ/√2 (= d_alias) gives γ_Padé = 1/3, NOT 0
    (only γ_LINEAR saturates here)."""
    theta = 10000
    T = int(theta / math.sqrt(2))
    g = gamma_pade(theta, T)
    assert abs(g - 1.0/3.0) < 0.01, f"expected ~1/3, got {g}"


# ─────────────────────────────────────────────────────────────────────────
# partition_Z γ=1: H_N + Euler-Mascheroni
# ─────────────────────────────────────────────────────────────────────────


def test_partition_Z_at_gamma_1_matches_H_N():
    """partition_Z(1, N) should approximate H_N = ∑ 1/d to within 1%."""
    for N in (100, 1000, 10000):
        H_N = sum(1.0 / d for d in range(1, N + 1))
        Z_pred = partition_Z(1.0, N)
        rel_err = abs(Z_pred - H_N) / H_N
        assert rel_err < 0.01, f"N={N}: H_N={H_N:.4f}, code={Z_pred:.4f}, err={rel_err:.4f}"


def test_partition_Z_at_gamma_neq_1_continuous():
    """Z is continuous across γ=1 boundary (limit-consistent)."""
    Z_below = partition_Z(0.99999, 10000)
    Z_above = partition_Z(1.00001, 10000)
    Z_at = partition_Z(1.0, 10000)
    assert abs(Z_below - Z_at) < 0.05 * Z_at
    assert abs(Z_above - Z_at) < 0.05 * Z_at


# ─────────────────────────────────────────────────────────────────────────
# D_f_closed: exact paper Theorem 7.1
# ─────────────────────────────────────────────────────────────────────────


def _df_numerical_truth(gamma: float, f: float, N: int) -> int:
    """Brute-force compute the smallest D such that ∑_{d=1}^D d^{-γ}/Z ≥ f."""
    weights = [d ** (-gamma) for d in range(1, N + 1)]
    total = sum(weights)
    cum = 0.0
    for d, w in enumerate(weights, start=1):
        cum += w
        if cum / total >= f:
            return d
    return N


def test_D_f_phase_A_pythia_70m():
    """Pythia-70m γ=0.748, paper Table §7.1: D_0.90 ≈ 1383."""
    truth = _df_numerical_truth(0.748, 0.90, 2000)
    code = D_f_closed(0.748, 0.90, 2000)
    assert abs(code - truth) <= max(15, 0.02 * truth), \
        f"phase A: code={code}, truth={truth}"


def test_D_f_phase_A_pythia_2_8b():
    """pythia-2.8b γ=0.674, paper: D_0.90 ≈ 1476."""
    truth = _df_numerical_truth(0.674, 0.90, 2000)
    code = D_f_closed(0.674, 0.90, 2000)
    assert abs(code - truth) <= max(15, 0.02 * truth)


def test_D_f_at_gamma_1_matches_discrete_truth():
    """At γ=1: discrete D_f from cumulative ∑ 1/d ≥ f·H_N.
    Continuum approximation N^f overestimates by ~6%.
    """
    truth = _df_numerical_truth(1.0, 0.9, 2000)
    code = D_f_closed(1.0, 0.9, 2000)
    assert code == truth, f"γ=1: code={code}, truth={truth}"
    # Document continuum-approx discrepancy:
    continuum = int(round(2000 ** 0.9))
    assert abs(continuum - truth) > 30, \
        "continuum N^f should differ from discrete truth at γ=1"


def test_D_f_phase_B_severe_compression():
    """γ=1.5: discrete-truth implementation → exact match."""
    truth = _df_numerical_truth(1.5, 0.90, 2000)
    code = D_f_closed(1.5, 0.90, 2000)
    assert code == truth, f"phase B: code={code}, truth={truth}"
    assert code < 200, f"phase B should be tiny, got {code}"


def test_D_f_llama_3_8b_phase_B():
    """LLaMA-3-8B γ=1.046 — discrete truth, exact."""
    truth = _df_numerical_truth(1.046, 0.90, 2000)
    code = D_f_closed(1.046, 0.90, 2000)
    assert code == truth


def test_D_f_at_boundary_0_99():
    truth = _df_numerical_truth(0.99, 0.90, 2000)
    code = D_f_closed(0.99, 0.90, 2000)
    assert code == truth


def test_D_f_at_boundary_1_01():
    truth = _df_numerical_truth(1.01, 0.90, 2000)
    code = D_f_closed(1.01, 0.90, 2000)
    assert code == truth


# ─────────────────────────────────────────────────────────────────────────
# free_energy_F: physics convention F = -log(Z)/γ
# ─────────────────────────────────────────────────────────────────────────


def test_free_energy_F_physics_convention():
    """F = -T·log(Z) = -log(Z)/γ."""
    for gamma in (0.5, 0.75, 1.0, 1.5):
        Z = partition_Z(gamma, 2000)
        expected = -math.log(Z) / gamma
        code = free_energy_F(gamma, 2000)
        assert abs(code - expected) < 1e-8, \
            f"γ={gamma}: code={code}, expected={expected}"


def test_thermodynamic_identity_S_equals_U_minus_F_over_T():
    """Sanity: S = (U − F)/T = γ·(U − F).
    Equivalently S = γU + log Z when F = -log Z/γ.
    """
    for gamma in (0.5, 0.75, 1.0, 1.5):
        Z = partition_Z(gamma, 2000)
        U = mean_log_d(gamma, 2000)
        F = free_energy_F(gamma, 2000)
        S_from_eq = gamma * (U - F)
        S_direct = entropy_S(gamma, 2000)
        # In our entropy_S = log Z + γU, and corrected F = -log Z/γ ⇒
        # γ(U − F) = γU + log Z = S. So they MUST match.
        assert abs(S_from_eq - S_direct) < 1e-8, \
            f"γ={gamma}: S_eq={S_from_eq}, S_direct={S_direct}"


# ─────────────────────────────────────────────────────────────────────────
# C_V at Hagedorn — paper §5.2 was wrong, agent's numerical-derivative is OK
# ─────────────────────────────────────────────────────────────────────────


def test_cv_at_hagedorn_matches_corrected_asymptotic():
    """C_V(γ=1, N) ~ (log N)²/12 + sub-leading corrections.
    Agent's numerical derivative gives the exact discrete value; ratio to
    the leading asymptotic /12 converges slowly (1/log N rate).
    Paper §5.2 said /4 — wrong by factor 3.
    """
    # Verify agent does NOT match /4 (paper's claim)
    cv_10000 = heat_capacity_Cv(1.0, 10000)
    pred_paper_wrong = math.log(10000) ** 2 / 4.0
    assert cv_10000 / pred_paper_wrong < 0.5, "C_V should NOT match paper's /4"

    # Verify it DOES converge to /12 from above
    ratios = []
    for N in (1000, 10000, 100000):
        cv = heat_capacity_Cv(1.0, N)
        pred_corrected = math.log(N) ** 2 / 12.0
        ratios.append(cv / pred_corrected)
    # Monotone decreasing toward 1 from above
    assert ratios[0] > ratios[1] > ratios[2] > 1.0
    assert ratios[-1] < 1.20, f"N=10⁵ ratio should approach 1, got {ratios[-1]:.4f}"


# ─────────────────────────────────────────────────────────────────────────
# Browser df_window — exact in calibrated zone, None outside
# ─────────────────────────────────────────────────────────────────────────


def test_df_window_in_zone():
    """γ=0.748 ∈ [0.65, 0.85]: should match exact paper formula."""
    truth = _df_numerical_truth(0.748, 0.90, 2000)
    code = df_window(0.748, 2000, 0.90)
    assert code is not None
    assert abs(code - truth) <= max(15, 0.02 * truth)


def test_df_window_out_of_zone_returns_None():
    assert df_window(0.5, 2000) is None     # too low
    assert df_window(0.95, 2000) is None    # too high
    assert df_window(1.5, 2000) is None     # phase B


# ─────────────────────────────────────────────────────────────────────────
# Sanity: theta_design + gamma_pade are inverses
# ─────────────────────────────────────────────────────────────────────────


def test_theta_design_inverts_gamma_pade():
    """θ_design(γ, T) should yield θ such that γ_Padé(θ, T) = γ exactly."""
    for gamma_target in (0.3, 0.5, 0.7, 0.85):
        for T in (1000, 2000, 8000):
            theta = theta_design(gamma_target, T)
            recovered = gamma_pade(theta, T)
            assert abs(recovered - gamma_target) < 1e-9


def test_theta_eff_pade_definition():
    """θ_eff_Padé = θ + T/√2 (paper definition)."""
    for theta in (10000, 500000, 1_000_000):
        for T in (1000, 2000):
            assert abs(theta_eff_pade(theta, T) - (theta + T / math.sqrt(2))) < 1e-9


# ─────────────────────────────────────────────────────────────────────────
# gamma_decompose: audit-driven calibration changes
# ─────────────────────────────────────────────────────────────────────────


def test_decompose_SWA_disabled():
    """δ_SWA was originally fit on n=1 — must NOT apply correction; status flagged."""
    result = gamma_decompose(0.75, has_SWA=True)
    assert result["delta_SWA"] == 0.0
    assert "n1_disabled" in result["delta_SWA_status"]


def test_decompose_GQA_still_active():
    """δ_GQA replicates in panel re-audit (+0.115 vs +0.11 hardcoded)."""
    on = gamma_decompose(0.75, has_GQA=True)
    off = gamma_decompose(0.75, has_GQA=False)
    assert abs(on["delta_GQA"] - 0.11) < 1e-9
    assert off["delta_GQA"] == 0.0


def test_decompose_v2_warnings_present():
    """v2 must emit calibration_warning."""
    r = gamma_decompose_v2(0.75, n_params_M=500, has_SWA=True, is_instruct=True)
    assert "calibration_warning" in r
    assert r["delta_SWA"] == 0.0  # disabled
    assert "exploratory" in r["delta_SWA_status"] or "n1" in r["delta_SWA_status"]
