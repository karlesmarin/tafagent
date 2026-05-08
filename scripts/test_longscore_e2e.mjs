// E2E lookup smoke for the 3 example buttons (Jamba/Llama/dbrx) + a HELMET-only model.
import { readFileSync } from "fs";
globalThis.fetch = async (url) => {
  const path = url.startsWith("data/") ? `./${url}` : url;
  return { ok: true, json: async () => JSON.parse(readFileSync(path, "utf-8")) };
};

const { lookup } = await import("../js/longscore.js");

const cases = [
  { input: "Jamba-1.5-Large", expect: { code: "ruler_hit", verdict: "no_degradation" } },
  { input: "Llama-3.1-70B-Instruct", expect: { code: "ruler_hit", verdict: "moderate" } },
  { input: "dbrx", expect: { code: "ruler_hit", verdict: "extreme" } },
  { input: "GPT-4", expect: { code: "helmet_only" } },  // HELMET-only
  { input: "totally-fake-model-xyz", expect: { code: "miss" } },
];

let pass = 0, fail = 0;
for (const c of cases) {
  const r = await lookup(c.input);
  const ok = r.code === c.expect.code &&
    (!c.expect.verdict || r.verdict === c.expect.verdict);
  if (ok) {
    pass++;
    const score = r.ruler_long_score ? `LongScore=${(r.ruler_long_score.avg_lc*100).toFixed(1)}%` :
                  r.helmet ? `HELMET overall=${r.helmet.overall}` : "";
    console.log(`  ✓ ${c.input.padEnd(30)} → ${r.code.padEnd(12)} ${r.verdict || "n/a".padEnd(15)} ${score}`);
  } else {
    fail++;
    console.log(`  ✗ ${c.input.padEnd(30)} → got code=${r.code} verdict=${r.verdict}, expected=${JSON.stringify(c.expect)}`);
  }
}
console.log(`\n${pass}/${pass+fail} cases pass`);
process.exit(fail > 0 ? 1 : 0);
