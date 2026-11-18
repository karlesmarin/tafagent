// Context-scaling configuration draft. Quality requires task evaluation.
import { gammaPade } from "./gamma_check.js";

const SQRT2 = Math.SQRT2;

// §26.2 — d_horizon = θ(1-γ)√2/(1+γ). null if γ outside (-1,1).
export function dHorizon(theta, gamma) {
  if (!Number.isFinite(theta) || theta <= 0) return null;
  if (!Number.isFinite(gamma) || gamma <= -1 || gamma >= 1) return null;
  return theta * (1 - gamma) * SQRT2 / (1 + gamma);
}

// §26.3 — θ needed to land at γ_target at context T (Padé inverse).
export function thetaDesign(gammaTarget, T) {
  if (!(gammaTarget > -1 && gammaTarget < 1)) return null;
  if (!Number.isFinite(T) || T <= 0) return null;
  return T * SQRT2 * (1 + gammaTarget) / (2 * (1 - gammaTarget));
}

// Static NTK base formula using actual rotary dimension; not a YaRN schedule.
export function thetaEffNTK(theta, factor, rotaryDim) {
  if (!Number.isFinite(theta)||theta<=0||!Number.isFinite(factor)||factor<=0||
      !Number.isInteger(rotaryDim)||rotaryDim<=2||rotaryDim%2!==0) return NaN;
  return theta*Math.pow(factor,rotaryDim/(rotaryDim-2));
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
    thetaNeeded: null,  // algebraic base for candidate gamma 0.5 at L — reference target
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
  // Algebraic base for candidate gamma 0.5 at L — a reference design target.
  out.thetaNeeded = thetaDesign(0.5, targetCtx);

  if (targetCtx <= originalCtx) {
    out.verdict = "no_extension_needed";
    out.factor = Math.round(factor * 1000) / 1000;
    out.ropeType = "none";
    out.gammaEff = out.gammaNaive;
    return out;
  }

  const type = ropeType || suggestRopeType(factor);
  out.ropeType = type;
  out.config = buildRopeScaling(type, factor, originalCtx);

  // YaRN and dynamic NTK are frequency schedules, not a single theta*factor.
  // No post-intervention exponent or quality is identified from configuration.
  out.thetaEff = null;
  out.gammaEff = null;
  out.thetaNeeded = null;
  out.verdict = "needs_evaluation";
  out.warnings.push({code:"evaluation_required",params:{}});
  out.ok = true;
  return out;
}
