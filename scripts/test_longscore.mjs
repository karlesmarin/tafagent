// Smoke test for js/longscore.js — verifies normalize, lookup, classify codes.
// Run: node scripts/test_longscore.mjs
import { readFileSync } from "fs";

// Mock fetch for Node ESM
globalThis.fetch = async (url) => {
  const path = url.startsWith("data/") ? `./${url}` : url;
  const txt = readFileSync(path, "utf-8");
  return {
    ok: true,
    json: async () => JSON.parse(txt),
  };
};

const { normalize, lookup, classify, rank } = await import("../js/longscore.js");

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ": " + detail : ""}`); }
}

console.log("--- normalize ---");
check("trims + lowercases", normalize("  Qwen2.5  ") === "qwen-2-5");
check("strips meta-llama/", normalize("meta-llama/Llama-3.1-70B-Instruct") === "llama-3-1-70-b-instruct");
check("strips 01-ai/", normalize("01-ai/Yi-34B-200K") === "yi-34-b-200-k");
check("inst → instruct", normalize("Mistral-7B-Inst-v0.2") === "mistral-7-b-instruct-v-0-2");
check("dot → dash", normalize("Phi-3.5-mini-instruct") === "phi-3-5-mini-instruct");
check("empty", normalize("") === "");

console.log("\n--- classify ---");
const t = { no_degradation: -0.02, mild: -0.10, moderate: -0.20, severe: -0.30 };
check("no_data", classify(null, t) === "no_data");
check("no_degradation", classify(0.0, t) === "no_degradation");
check("mild", classify(-0.05, t) === "mild");
check("moderate", classify(-0.15, t) === "moderate");
check("severe", classify(-0.25, t) === "severe");
check("extreme", classify(-0.50, t) === "extreme");

console.log("\n--- lookup (RULER hit) ---");
const r1 = await lookup("Llama-3.1-70B-Instruct");
check("ruler_hit code", r1.code === "ruler_hit");
check("longscore present", typeof r1.ruler_long_score?.avg_lc === "number");
check("verdict assigned", r1.verdict !== null);
check("base ~96", r1.ruler_long_score?.base > 95 && r1.ruler_long_score?.base < 97,
  `got base=${r1.ruler_long_score?.base}`);
check("Llama-3.1-70B avg_lc ~-0.10", Math.abs(r1.ruler_long_score?.avg_lc - (-0.1024)) < 0.001,
  `got ${r1.ruler_long_score?.avg_lc}`);

console.log("\n--- lookup (Jamba — best LongScore) ---");
const r2 = await lookup("Jamba-1.5-Large");
check("ruler_hit", r2.code === "ruler_hit");
check("Jamba near-zero degradation", r2.ruler_long_score?.avg_lc > -0.02);

console.log("\n--- lookup (dbrx — severe) ---");
const r3 = await lookup("dbrx");
check("ruler_hit", r3.code === "ruler_hit");
check("dbrx severe verdict", r3.verdict === "severe" || r3.verdict === "extreme",
  `got verdict=${r3.verdict} for avg_lc=${r3.ruler_long_score?.avg_lc}`);

console.log("\n--- lookup (miss) ---");
const r4 = await lookup("nonexistent-model-123");
check("miss code", r4.code === "miss");
check("normalized id present", r4.normalized_id === "nonexistent-model-123");

console.log("\n--- rank ---");
const ranking = await rank("worst");
check("ranking returned", Array.isArray(ranking) && ranking.length > 0);
check("worst is most negative", ranking[0].avg_lc < ranking[ranking.length - 1].avg_lc);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
