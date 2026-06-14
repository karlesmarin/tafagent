// Validates the Memory Reality Check detector against real HF configs.
// Run: node tests/memory_reality.test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { classifyMemory } from "../js/memory_reality.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(__dirname, "fixtures", "memory_reality_configs.json"), "utf8"));

let pass = 0, fail = 0;
const find = (sub) => fx.cases.find((c) => c.model.includes(sub)).cfg;

console.log("[1] Class detection (13 live HF configs)");
for (const c of fx.cases) {
  const r = classifyMemory(c.cfg);
  if (r.cls === c.expect) { pass++; console.log(`  ✓ ${c.model.padEnd(34)} → ${r.cls}`); }
  else { fail++; console.log(`  ✗ ${c.model.padEnd(34)} → got ${r.cls}, want ${c.expect} | ${r.markers}`); }
}

console.log("\n[2] Structured extras (the features the UI consumes)");
const checks = [
  ["Jamba recallLayers = 4 (32/8)", () => classifyMemory(find("Jamba")).recallLayers === 4],
  ["Qwen3-30B MoE badge 128/8", () => { const m = classifyMemory(find("30B")).moe; return m && m.experts === 128 && m.active === 8; }],
  ["Qwen2.5-7B ghost sliding-window", () => classifyMemory(fx.cases.find((c) => c.model === "Qwen/Qwen2.5-7B").cfg).ghostWindow === true],
  ["Qwen2.5-1M flagged extended", () => classifyMemory(find("1M")).extended === true],
  ["Mamba stateSize = 16", () => classifyMemory(find("mamba-2.8b")).stateSize === 16],
  ["RWKV not mis-tagged FULL despite heads", () => classifyMemory(find("Finch")).cls === "RWKV"],
  ["Mistral real SWA (4096<32768)", () => { const r = classifyMemory(find("Mistral")); return r.cls === "SWA" && r.window === 4096; }],
  ["traffic light present for every class", () => fx.cases.every((c) => !!classifyMemory(c.cfg).light)],
];
for (const [name, fn] of checks) {
  let ok = false; try { ok = fn(); } catch (e) { ok = false; }
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}`); }
}

console.log(`\n==== memory_reality: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
