// γ predicted-vs-observed diagnostic — Padé closed-form + regime classifier.
// Pure functions ported from tools/taf/diagnose/gamma_check.py.
// All math is browser-only (no backend, no Python).

const SQRT2 = Math.SQRT2;

export function gammaPade(theta, T) {
  if (!Number.isFinite(theta) || theta <= 0 || !Number.isFinite(T) || T < 0) return NaN;
  const z = (T * SQRT2) / theta;
  return (2 - z) / (2 + z);
}

export function thetaEffPade(theta, T) {
  if (!Number.isFinite(theta) || !Number.isFinite(T)) return NaN;
  return theta + T / SQRT2;
}

export function thetaEffObserved(gObs, T) {
  if (!Number.isFinite(gObs) || !Number.isFinite(T) || T < 0) return NaN;
  if (Math.abs(1 - gObs) < 1e-12) return Infinity;
  return (T * SQRT2) / (1 - gObs);
}

export function efficiency(thEffObs, thEffPade) {
  if (!Number.isFinite(thEffObs) || !Number.isFinite(thEffPade) || thEffPade === 0) return NaN;
  return thEffObs / thEffPade;
}

export function deltaHCardy(thEffObs, thetaNominal) {
  if (!Number.isFinite(thEffObs) || thEffObs <= 0) return NaN;
  if (!Number.isFinite(thetaNominal) || thetaNominal <= 0) return NaN;
  return Math.log(thEffObs / thetaNominal);
}

export function classifyRegime(eff, gObs, isRandom) {
  if (!Number.isFinite(gObs)) return "unknown";
  // Phase B (γ ≥ 1): recency-locked / local attention — a legitimate regime.
  // The efficiency diagnostic below assumes Phase A: thetaEffObserved =
  // T√2/(1−γ) goes NEGATIVE for γ > 1, which must NOT be misread as "fraud"
  // (efficiency < 0.01). A random/SWA-corpus signature lands here too.
  if (gObs >= 1) return isRandom ? "swa" : "phase_b";
  if (!Number.isFinite(eff)) return "unknown";
  if (eff < 0.01) return "fraud";
  if (eff < 0.50) return "compressed";
  if (eff > 1.50) return "overpade";
  if (eff >= 0.85 && eff <= 1.15) return "normal";
  return "unknown";
}

export function gammaCheckAll({ theta, T, gObs, isRandom }) {
  const gPade = gammaPade(theta, T);
  const thEffPade = thetaEffPade(theta, T);
  const thEffObs = thetaEffObserved(gObs, T);
  const eff = efficiency(thEffObs, thEffPade);
  const dH = deltaHCardy(thEffObs, theta);
  const regime = classifyRegime(eff, gObs, !!isRandom);
  return {
    gammaPade: gPade,
    thetaEffPade: thEffPade,
    thetaEffObs: thEffObs,
    efficiency: eff,
    deltaHCardy: dH,
    regime,
  };
}

// --- Bose-Einstein condensate of attention mass (Part III §2) ---
// Softmax mass conservation under RoPE forces excess attention to condense
// into the sink / ground state once γ > 1. Closed-form indicator (NOT a
// measurement): condensate = 1 − (1/ζ(γ)) · ∫₁ᴸ d^(−γ) dd.

// Riemann ζ(s) for s > 1 via direct sum + Euler-Maclaurin tail. Diverges
// for s ≤ 1 (returns Infinity), which is correct: Phase A has no condensate.
export function riemannZeta(s) {
  if (!Number.isFinite(s) || s <= 1) return Infinity;
  const N = 20;
  let sum = 0;
  for (let k = 1; k < N; k++) sum += Math.pow(k, -s);
  // Euler-Maclaurin correction from k = N onward.
  sum += Math.pow(N, 1 - s) / (s - 1);
  sum += 0.5 * Math.pow(N, -s);
  sum += (s / 12) * Math.pow(N, -s - 1);
  sum += -(s * (s + 1) * (s + 2) / 720) * Math.pow(N, -s - 3);
  return sum;
}

// Returns { status, fraction }:
//   "na"        — γ or L invalid (fraction null)
//   "dispersed" — γ < 1 (Phase A): tail integral diverges with L, no BEC
//   "condensed" — γ ≥ 1 (Phase B): fraction ∈ [0,1] of mass in the sink
export function condensateFraction(gamma, L) {
  if (!Number.isFinite(gamma) || gamma <= 0 || !Number.isFinite(L) || L <= 1) {
    return { status: "na", fraction: null };
  }
  if (gamma < 1) return { status: "dispersed", fraction: null };
  // Regularize the boundary: ζ(1) diverges, so clamp s just above 1.
  const s = gamma > 1.0000001 ? gamma : 1.0000001;
  const zeta = riemannZeta(s);
  const tail = Math.abs(gamma - 1) < 1e-9
    ? Math.log(L)
    : (Math.pow(L, 1 - gamma) - 1) / (1 - gamma);
  let frac = 1 - tail / zeta;
  if (!Number.isFinite(frac)) return { status: "na", fraction: null };
  frac = Math.min(1, Math.max(0, frac));
  return { status: "condensed", fraction: frac };
}

export const REGIME_META = {
  normal:     { emoji: "✅", cls: "v-yes" },
  fraud:      { emoji: "🚨", cls: "v-no"  },
  compressed: { emoji: "📉", cls: "v-deg" },
  overpade:   { emoji: "📈", cls: "v-deg" },
  phase_b:    { emoji: "🔒", cls: "v-deg" },
  swa:        { emoji: "🪟", cls: "v-deg" },
  unknown:    { emoji: "❓", cls: "v-deg" },
};
