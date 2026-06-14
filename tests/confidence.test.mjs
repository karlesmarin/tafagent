// Unit test for the confidence engine (#5).
import { computeConfidence } from "../js/confidence.js";

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log("  ✓ " + name); } else { fail++; console.log("  ✗ " + name); } };

const allOk = computeConfidence([{ key: "a", status: "ok" }, { key: "b", status: "ok" }]);
check("all ok → 100% high", allOk.pct === 100 && allOk.band === "high");

const mixed = computeConfidence([
  { key: "a", status: "ok" }, { key: "b", status: "warn" },
  { key: "c", status: "miss" }, { key: "d", status: "ok" },
]); // 2.5 / 4 = 62.5% → 63 medium
check("ok+warn+miss+ok → 63% medium", mixed.pct === 63 && mixed.band === "medium");

const low = computeConfidence([{ key: "a", status: "miss" }, { key: "b", status: "warn" }]);
check("miss+warn → 25% low", low.pct === 25 && low.band === "low");

const weighted = computeConfidence([
  { key: "a", status: "ok", weight: 3 }, { key: "b", status: "miss", weight: 1 },
]); // 3 / 4 = 75% medium
check("weighted ok(3)+miss(1) → 75% medium", weighted.pct === 75 && weighted.band === "medium");

check("empty → 0%", computeConfidence([]).pct === 0);
check("null-safe", computeConfidence(null).pct === 0);

console.log(`\n==== confidence: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
