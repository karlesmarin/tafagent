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
  if (gObs > 1.05) return isRandom ? "swa" : "unknown";
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

export const REGIME_META = {
  normal:     { emoji: "✅", cls: "v-yes" },
  fraud:      { emoji: "🚨", cls: "v-no"  },
  compressed: { emoji: "📉", cls: "v-deg" },
  overpade:   { emoji: "📈", cls: "v-deg" },
  swa:        { emoji: "🪟", cls: "v-deg" },
  unknown:    { emoji: "❓", cls: "v-deg" },
};
