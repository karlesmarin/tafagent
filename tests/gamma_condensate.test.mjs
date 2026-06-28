import { riemannZeta, condensateFraction } from "../js/gamma_check.js";
let p=0,f=0; const ck=(n,c)=>{if(c){p++;console.log("  ✓ "+n);}else{f++;console.log("  ✗ "+n);}};

// --- riemannZeta ---
ck("ζ(2) ≈ π²/6", Math.abs(riemannZeta(2) - Math.PI*Math.PI/6) < 1e-6);
ck("ζ(4) ≈ π⁴/90", Math.abs(riemannZeta(4) - Math.pow(Math.PI,4)/90) < 1e-6);
ck("ζ(s≤1) diverges → Infinity", riemannZeta(1) === Infinity && riemannZeta(0.5) === Infinity);

// --- condensateFraction: Phase B (γ ≥ 1) condenses ---
const c1 = condensateFraction(1.05, 2000);
ck("γ=1.05,L=2000 → condensed", c1.status === "condensed");
ck("γ=1.05,L=2000 → ~0.693 (matches closed-form)", Math.abs(c1.fraction - 0.693) < 5e-3);
ck("fraction always in [0,1]", [1.01,1.2,1.5,3].every(g => {
  const c = condensateFraction(g, 2000);
  return c.fraction >= 0 && c.fraction <= 1;
}));

// --- Phase A (γ < 1): tail diverges with L → no condensation ---
ck("γ=0.9 → dispersed (no fraction)", condensateFraction(0.9, 2000).status === "dispersed" && condensateFraction(0.9,2000).fraction === null);

// --- invalid inputs ---
ck("NaN γ → na", condensateFraction(NaN, 2000).status === "na");
ck("L≤1 → na", condensateFraction(1.1, 1).status === "na" && condensateFraction(1.1, 0).status === "na");
ck("γ≤0 → na", condensateFraction(0, 2000).status === "na" && condensateFraction(-1, 2000).status === "na");

// --- faithful to Part III §2: larger L dilutes the condensate fraction ---
// (more excited states d=1..L absorb mass → ground-state share shrinks)
const lo = condensateFraction(1.1, 1000).fraction, hi = condensateFraction(1.1, 100000).fraction;
ck("larger L → smaller fraction (paper-faithful)", hi < lo);

console.log(`\ngamma_condensate: ${p} passed, ${f} failed`);
if (f) process.exit(1);
