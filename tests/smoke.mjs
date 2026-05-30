// Runtime smoke test for the TAF Agent logic modules.
// Exercises the public functions with representative + edge-case inputs so that
// a future change which breaks a return shape or throws at runtime is caught
// immediately (syntax checks alone do not catch these). Pure-logic modules only
// — no DOM, no network. Run:  node tests/smoke.mjs
import assert from "node:assert";
import { gammaCheckAll, classifyRegime } from "../js/gamma_check.js";
import { predictNIAHReasoning, sweepContextLengths } from "../js/niah_reasoning.js";
import { computeArenaCI, parseVotesCSV, SAMPLE_VOTES_CSV } from "../js/arena_ci.js";
import { computeContaminationPrior } from "../js/contamination_prior.js";
import { predictQuantShift } from "../js/quant_regime.js";
import { computeDriftBound } from "../js/cross_drift.js";
import { planExtension } from "../js/yarn_planner.js";
import { planLaunch } from "../js/launch_flags.js";
import { analyzeGguf } from "../js/gguf_bridge.js";
import { unmaskConfig } from "../js/swa_unmasker.js";

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log("  PASS", name); pass++; }
  catch (e) { console.log("  FAIL", name, "—", e.message); fail++; }
}

console.log("\n[gamma_check] regime classification");
check("γ=1.02 → phase_b (not fraud)", () => assert.equal(gammaCheckAll({ theta: 10000, T: 2048, gObs: 1.02, isRandom: false }).regime, "phase_b"));
check("γ=1.0 → phase_b", () => assert.equal(classifyRegime(NaN, 1.0, false), "phase_b"));
check("γ=0.75 → not fraud", () => assert.notEqual(gammaCheckAll({ theta: 10000, T: 2048, gObs: 0.75 }).regime, "fraud"));
check("γ>1 random → swa", () => assert.equal(classifyRegime(NaN, 1.1, true), "swa"));
check("NaN γ → unknown", () => assert.equal(classifyRegime(1, NaN, false), "unknown"));

console.log("\n[niah_reasoning] extrapolation axis (no d_horizon tautology)");
check("no d_horizon, has extrapolation_ratio, niah∈[0,1]", () => {
  const r = predictNIAHReasoning({ rope_theta: 10000, max_position_embeddings: 8192, num_attention_heads: 32, hidden_size: 4096, num_key_value_heads: 8 }, 32768);
  assert.ok(!("d_horizon" in r), "d_horizon should be gone");
  assert.ok("extrapolation_ratio" in r);
  assert.ok(Number.isFinite(r.niah_rate) && r.niah_rate >= 0 && r.niah_rate <= 1);
  assert.ok(Number.isFinite(r.reasoning_rate));
});
check("config WITHOUT rope_scaling does not throw", () => {
  const r = predictNIAHReasoning({ rope_theta: 10000, max_position_embeddings: 8192 }, 4096);
  assert.ok(Number.isFinite(r.niah_rate));
});
check("within context → high niah", () => assert.ok(predictNIAHReasoning({ rope_theta: 10000, max_position_embeddings: 32768 }, 4096).niah_rate > 0.8));
check("YaRN boosts θ (40000)", () => assert.equal(predictNIAHReasoning({ rope_theta: 10000, max_position_embeddings: 8192, rope_scaling: { rope_type: "yarn", factor: 4 } }, 32768).theta, 40000));
check("linear extends T_train, keeps θ", () => {
  const r = predictNIAHReasoning({ rope_theta: 10000, max_position_embeddings: 8192, rope_scaling: { rope_type: "linear", factor: 4 } }, 32768);
  assert.equal(r.theta, 10000); assert.equal(r.T_train, 32768);
});
check("sweep returns rows", () => assert.ok(sweepContextLengths({ rope_theta: 10000, max_position_embeddings: 8192 }).length > 0));

console.log("\n[arena_ci] bradley-terry + two-sided ties");
check("sample CSV → ratings + ties arrays", () => {
  const r = computeArenaCI(parseVotesCSV(SAMPLE_VOTES_CSV));
  assert.ok(Array.isArray(r.ratings) && Array.isArray(r.ties));
  for (const t of r.ties) assert.ok(t.model_a && t.model_b);
});
check("empty votes → safe empty", () => assert.equal(computeArenaCI([]).ratings.length, 0));

console.log("\n[contamination_prior] uncalibrated risk score honesty");
check("calibrated:false + clamped boolean + risk≤0.97", () => {
  const r = computeContaminationPrior("2024-12", "mmlu");
  assert.equal(r.calibrated, false);
  assert.equal(typeof r.clamped, "boolean");
  assert.ok(r.prior <= 0.97);
});
check("high case clamps at 0.97", () => {
  const r = computeContaminationPrior("2024-12", "squad");
  assert.equal(r.clamped, true); assert.equal(r.prior, 0.97);
});
check("released after cutoff → low", () => assert.ok(computeContaminationPrior("2020-01", "aime24").prior < 0.3));

console.log("\n[quant_regime] ΔPPL never negative");
check("tiny model ΔPPL ≥ 0 (sizeBoost clamp)", () => {
  const r = predictQuantShift({ hidden_size: 128, num_hidden_layers: 2, vocab_size: 1000, num_attention_heads: 4 }, "gguf_q2_k");
  assert.ok(r.delta_ppl.mid >= 0 && r.delta_ppl.low >= 0 && r.delta_ppl.high >= 0);
});
check("normal model valid regime + ΔPPL≥0", () => {
  const r = predictQuantShift({ hidden_size: 4096, num_hidden_layers: 32, vocab_size: 128000, num_attention_heads: 32, num_key_value_heads: 8 }, "awq");
  assert.ok(["safe", "mild", "significant", "cliff"].includes(r.regime));
  assert.ok(r.delta_ppl.mid >= 0);
});

console.log("\n[cross_drift] template flag is boolean (regression guard)");
const drift = (a, b) => computeDriftBound({ score: a, dtype: "fp16", framework: "hf", batch: 1, chat_template: "llama3" }, { score: b, dtype: "fp16", framework: "hf", batch: 1, chat_template: "chatml" });
check("diff templates same score → noise + boolean true", () => {
  const r = drift(80, 80);
  assert.equal(typeof r.breakdown.template_mismatch, "boolean");
  assert.equal(r.breakdown.template_mismatch, true);
  assert.equal(r.verdict, "noise");
  assert.equal(r.dominant_cause, "template_differs_no_effect");
});
check("render expr (main.js) no throw on boolean", () => { const r = drift(80, 80); assert.equal(r.breakdown.template_mismatch ? "show" : "", "show"); });
check("big gap diff templates → bug_template", () => assert.equal(drift(80, 30).verdict, "bug_template"));
check("same config → noise + false", () => {
  const r = computeDriftBound({ score: 80, dtype: "fp16", framework: "hf", batch: 1, chat_template: "llama3" }, { score: 80, dtype: "fp16", framework: "hf", batch: 1, chat_template: "llama3" });
  assert.equal(r.verdict, "noise"); assert.equal(r.breakdown.template_mismatch, false);
});

console.log("\n[yarn_planner] d_horizon removed from verdict");
check("no dHorizon fields, gammaEff finite, valid verdict", () => {
  const r = planExtension({ originalCtx: 8192, theta: 10000, targetCtx: 32768, ropeType: "yarn" });
  assert.ok(!("dHorizonEff" in r) && !("dHorizonNaive" in r));
  assert.ok(Number.isFinite(r.gammaEff));
  assert.ok(["healthy", "usable_with_care", "needs_finetune", "degrades"].includes(r.verdict));
});
check("within context → no_extension_needed", () => assert.equal(planExtension({ originalCtx: 32768, theta: 10000, targetCtx: 8192 }).verdict, "no_extension_needed"));

console.log("\n[launch_flags] kv_wasted relabel");
check("target ≫ trained → kv_wasted (not horizon_wasted)", () => {
  const r = planLaunch({ nLayers: 32, nKvHeads: 8, headDim: 128, hidden: 4096, ropeTheta: 10000, ctxTrain: 8192, vramGB: 24, targetCtx: 32768, quant: "Q4_K_M" });
  assert.ok(r.warnings.some(w => w.code === "kv_wasted"));
  assert.ok(!r.warnings.some(w => w.code === "horizon_wasted"));
});
check("within trained → no kv_wasted", () => {
  const r = planLaunch({ nLayers: 32, nKvHeads: 8, headDim: 128, hidden: 4096, ropeTheta: 10000, ctxTrain: 8192, vramGB: 24, targetCtx: 8000, quant: "Q4_K_M" });
  assert.ok(!r.warnings.some(w => w.code === "kv_wasted"));
});

console.log("\n[gguf_bridge] θ nullable → incomplete");
check("normal → gammaTrain finite, no dHoriz/reaches", () => {
  const r = analyzeGguf({ rope_theta: 10000, context_length: 8192, architecture: "llama", num_attention_heads: 32, num_key_value_heads: 8 }, 8192);
  assert.ok(["healthy", "usable_with_care", "degrades"].includes(r.verdict));
  assert.ok(Number.isFinite(r.gammaTrain));
  assert.ok(!("dHoriz" in r) && !("reaches" in r));
});
check("missing rope_theta → incomplete + theta null", () => {
  const r = analyzeGguf({ context_length: 8192, architecture: "llama" }, 8192);
  assert.equal(r.verdict, "incomplete");
  assert.equal(r.theta, null);
});

console.log("\n[swa_unmasker] n_attn=0 guard");
check("n_attn=0 → no throw", () => assert.ok(unmaskConfig({ hidden_size: 4096, num_attention_heads: 0, num_hidden_layers: 32 })));
check("normal SWA config → no throw", () => assert.ok(unmaskConfig({ hidden_size: 4096, num_attention_heads: 32, num_key_value_heads: 8, num_hidden_layers: 32, sliding_window: 4096 })));

console.log(`\n==== smoke: ${pass} passed, ${fail} failed ====`);
process.exit(fail ? 1 : 0);
