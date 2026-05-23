// YaRN / RoPE Context-Extension Planner (v0.9.0 anti-bullshit pack)
//
// Answers the most-asked HF question: "how do I set rope_scaling to extend
// context to L, and will quality actually hold?" The VRAM calculators only
// say "fits in GPU"; this says "fits AND works (or not)" using TAF's γ_Padé /
// d_horizon machinery — all browser-only, no backend.
//
// Pure logic: returns structured codes + numbers. main.js does the i18n render.

import { gammaPade } from "./gamma_check.js";

const SQRT2 = Math.SQRT2;

// §26.2 — d_horizon = θ(1-γ)√2/(1+γ). null if γ outside (0,1).
export function dHorizon(theta, gamma) {
  if (!Number.isFinite(theta) || theta <= 0) return null;
  if (!Number.isFinite(gamma) || gamma <= 0 || gamma >= 1) return null;
  return theta * (1 - gamma) * SQRT2 / (1 + gamma);
}

// §26.3 — θ needed to land at γ_target at context T (Padé inverse).
export function thetaDesign(gammaTarget, T) {
  if (!(gammaTarget > -1 && gammaTarget < 1)) return null;
  if (!Number.isFinite(T) || T <= 0) return null;
  return T * SQRT2 * (1 + gammaTarget) / (2 * (1 - gammaTarget));
}

// Effective base after RoPE extension. NTK/YaRN raise the base frequency;
// the canonical NTK-aware bound is θ' = θ·f^(d/(d-2)) ≈ θ·f for typical head
// dims (d≈128 → exponent 1.016). We use the first-order θ·f and flag it as an
// estimate. Linear PI does NOT change the base — it compresses positions, so
// its effect is modelled on the context axis (T/f) instead (see planExtension).
export function thetaEffNTK(theta, factor) {
  if (!Number.isFinite(theta) || !Number.isFinite(factor) || factor <= 0) return NaN;
  return theta * factor;
}

// Default method pick: linear PI is fine for small stretches; YaRN is the
// community default for ≥2× and degrades far more gracefully past 4×.
export function suggestRopeType(factor) {
  if (factor <= 1) return "none";
  if (factor < 2) return "linear";
  return "yarn";
}

// Build the exact config.json rope_scaling block for transformers ≥4.43.
// `ropeType` ∈ {linear, dynamic, yarn, llama3}. original = trained context.
export function buildRopeScaling(ropeType, factor, originalCtx) {
  const block = {
    rope_type: ropeType,
    factor: Math.round(factor * 1000) / 1000,
    original_max_position_embeddings: originalCtx,
  };
  // YaRN exposes the interpolation ramp; ship the paper defaults so the snippet
  // is copy-paste runnable rather than a stub the user has to complete.
  if (ropeType === "yarn") {
    block.beta_fast = 32;
    block.beta_slow = 1;
  }
  return block;
}

// Core planner. All inputs numeric; returns numbers + warning/verdict codes.
//   originalCtx : model's trained context (max_position_embeddings pre-scaling)
//   theta       : rope_theta (base). Defaults handled by caller.
//   targetCtx   : desired context L
//   ropeType    : optional override; else suggested from factor
export function planExtension({ originalCtx, theta, targetCtx, ropeType }) {
  const out = {
    ok: false,
    originalCtx, theta, targetCtx,
    factor: null,
    ropeType: null,
    config: null,
    thetaEff: null,
    gammaNaive: null,   // γ_Padé(θ, L) — NO extension: shows the problem
    gammaEff: null,     // γ_Padé after the chosen extension method
    dHorizonNaive: null,
    dHorizonEff: null,
    thetaNeeded: null,  // θ to keep γ healthy (0.5) at L — reference target
    verdict: "unknown",
    warnings: [],
  };

  if (!Number.isFinite(originalCtx) || originalCtx <= 0) {
    out.verdict = "no_original_ctx";
    return out;
  }
  if (!Number.isFinite(theta) || theta <= 0) {
    out.verdict = "no_theta";
    return out;
  }
  if (!Number.isFinite(targetCtx) || targetCtx <= 0) {
    out.verdict = "no_target";
    return out;
  }

  const factor = targetCtx / originalCtx;
  out.factor = Math.round(factor * 1000) / 1000;

  // Baseline (no extension) — this is what naive use at L gives.
  out.gammaNaive = gammaPade(theta, targetCtx);
  out.dHorizonNaive = dHorizon(theta, out.gammaNaive);
  // θ that would keep γ at a healthy 0.5 at L — a reference design target.
  out.thetaNeeded = thetaDesign(0.5, targetCtx);

  if (targetCtx <= originalCtx) {
    out.verdict = "no_extension_needed";
    out.factor = Math.round(factor * 1000) / 1000;
    out.ropeType = "none";
    out.gammaEff = out.gammaNaive;
    out.dHorizonEff = out.dHorizonNaive;
    return out;
  }

  const type = ropeType || suggestRopeType(factor);
  out.ropeType = type;
  out.config = buildRopeScaling(type, factor, originalCtx);

  if (type === "linear" || type === "dynamic") {
    // Linear PI / dynamic-NTK compress positions by `factor`. Modelled on the
    // context axis: the attention pattern at L behaves like context L/factor.
    out.thetaEff = theta;
    out.gammaEff = gammaPade(theta, targetCtx / factor);
    out.dHorizonEff = dHorizon(theta, out.gammaEff);
    if (out.dHorizonEff != null) out.dHorizonEff *= factor; // back to real-position units
  } else {
    // YaRN / NTK / llama3: raise the effective base ≈ θ·factor.
    out.thetaEff = thetaEffNTK(theta, factor);
    out.gammaEff = gammaPade(out.thetaEff, targetCtx);
    out.dHorizonEff = dHorizon(out.thetaEff, out.gammaEff);
    out.warnings.push({ code: "theta_eff_estimate", params: { thetaEff: out.thetaEff, factor: out.factor } });
  }

  // Verdict from how much of the target the effective horizon actually covers.
  const horizonCover = (out.dHorizonEff != null && targetCtx > 0)
    ? out.dHorizonEff / targetCtx : null;

  if (factor > 4) {
    out.warnings.push({ code: "aggressive_factor", params: { factor: out.factor } });
  }
  // Verdict weighs BOTH reach (does d_horizon cover L?) and sharpness (is γ_eff
  // high enough that tokens within the horizon are actually attended?). A horizon
  // that just barely reaches L with γ≈0.2 still means heavy decay — not "healthy".
  const reaches = horizonCover != null && horizonCover >= 1.0;
  const collapsed = !Number.isFinite(out.gammaEff) || out.gammaEff <= 0.2;
  if (collapsed || (horizonCover != null && horizonCover < 0.5)) {
    out.verdict = "degrades";
    out.warnings.push({ code: "horizon_short", params: { dHorizon: out.dHorizonEff, target: targetCtx, cover: horizonCover, gammaEff: out.gammaEff } });
  } else if (factor > 4) {
    out.verdict = "needs_finetune";
  } else if (reaches && out.gammaEff >= 0.6) {
    out.verdict = "healthy";
  } else {
    out.verdict = "usable_with_care";
  }

  // Honesty caveat that always applies to closed-form extension planning.
  out.warnings.push({ code: "finetune_note", params: { factor: out.factor, aggressive: factor > 4 } });
  out.ok = true;
  return out;
}
