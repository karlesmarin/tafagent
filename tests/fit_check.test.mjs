// Unit tests for js/fit_check.js — run: node tests/fit_check.test.mjs
import { checkFit, maxContextThatFits, kvPerTokenBytes, FIT_PRECISIONS } from "../js/fit_check.js";

let pass = 0, failCount = 0;
const ok = (cond, msg) => {
  if (cond) { console.log("  PASS", msg); pass++; }
  else { console.log("  FAIL", msg); failCount++; }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// Llama-3.1-8B geometry (the canonical forum case: discuss.huggingface.co/t/140711)
const LLAMA31_8B = {
  nParams: 8.03e9, nLayers: 32, nKvHeads: 8, headDim: 128, hidden: 4096,
  vocab: 128256, intermediate: 14336, ropeTheta: 500000, ctxTrain: 131072,
};

console.log("[1] KV per token (Llama-3.1-8B, fp16 cache)");
const kvTok = kvPerTokenBytes(LLAMA31_8B, 2);
// 2 * 32 * 8 * 128 * 2 = 131072 B/token = 128 KiB/token
ok(kvTok === 131072, `kv/token = ${kvTok} B (expected 131072)`);

console.log("[2] The forum surprise: fp16 weights fit-ish, KV at 128K does not");
const r128k = checkFit(LLAMA31_8B, { precision: "FP16", vramGB: 24, targetCtx: 131072 });
ok(r128k.ok, "returns ok");
ok(near(r128k.weightsGB, 15.0, 1.5), `weights ≈ 15 GB (got ${r128k.weightsGB.toFixed(1)})`);
ok(near(r128k.kvGB, 16.0, 0.5), `KV @128K ≈ 16 GB (got ${r128k.kvGB.toFixed(1)})`);
ok(!r128k.fits, "does NOT fit in 24 GB");
ok(r128k.verdictCode === "kv_bound", `verdict kv_bound (got ${r128k.verdictCode})`);
ok(r128k.kvShare > 0.4, `KV is the dominant share (${(r128k.kvShare * 100).toFixed(0)}%)`);
ok(r128k.suggestions.some(s => s.code === "reduce_ctx"), "suggests reduce_ctx");
ok(r128k.suggestions.some(s => s.code === "quant_cache"), "suggests quant_cache");
const redCtx = r128k.suggestions.find(s => s.code === "reduce_ctx");
ok(redCtx.params.maxCtx > 30000 && redCtx.params.maxCtx < 80000,
   `maxCtx sane (got ${redCtx.params.maxCtx})`);

console.log("[3] Same model, short context: fits comfortably");
const r4k = checkFit(LLAMA31_8B, { precision: "FP16", vramGB: 24, targetCtx: 4096 });
ok(r4k.fits, "fits in 24 GB at 4K");
ok(r4k.verdictCode === "fits_comfortably", `verdict (got ${r4k.verdictCode})`);
ok(near(r4k.kvGB, 0.5, 0.1), `KV @4K ≈ 0.5 GB (got ${r4k.kvGB.toFixed(2)})`);

console.log("[4] Weights-bound: fp32 70B on 24 GB");
const B70 = { nParams: 70e9, nLayers: 80, nKvHeads: 8, headDim: 128, hidden: 8192, ctxTrain: 8192 };
const r70 = checkFit(B70, { precision: "FP32", vramGB: 24, targetCtx: 4096 });
ok(!r70.fits && r70.verdictCode === "weights_bound", `verdict weights_bound (got ${r70.verdictCode})`);
ok(near(r70.weightsGB, 260.8, 3), `fp32 weights ≈ 261 GB (got ${r70.weightsGB.toFixed(0)})`);

console.log("[5] Rescue precision ladder");
const r8q = checkFit(LLAMA31_8B, { precision: "FP16", vramGB: 12, targetCtx: 8192 });
const lower = r8q.suggestions.find(s => s.code === "lower_precision");
ok(!r8q.fits, "fp16 8B + 8K does not fit in 12 GB");
ok(lower && FIT_PRECISIONS[lower.params.precision].bpw < 16,
   `suggests a lower precision (got ${lower ? lower.params.precision : "none"})`);

console.log("[6] maxContextThatFits inverts the budget");
const mx = maxContextThatFits(LLAMA31_8B, { bpw: 16, vramGB: 24, cacheBytes: 2, flashAttn: true });
const atMax = checkFit(LLAMA31_8B, { precision: "FP16", vramGB: 24, targetCtx: mx });
const overMax = checkFit(LLAMA31_8B, { precision: "FP16", vramGB: 24, targetCtx: Math.ceil(mx * 1.1) });
ok(atMax.fits, `fits exactly at maxCtx=${mx}`);
ok(!overMax.fits, "does not fit 10% past maxCtx");

console.log("[7] TAF warning passthrough: KV wasted past trained context");
const rW = checkFit({ ...LLAMA31_8B, ctxTrain: 8192 }, { precision: "Q4_K_M", vramGB: 80, targetCtx: 65536 });
ok(rW.warnings.some(w => w.code === "kv_wasted"), "kv_wasted warning surfaces");

console.log("[8] Edge cases: no geometry / no GPU");
ok(checkFit({}, { vramGB: 24, targetCtx: 4096 }).ok === false, "no geometry → ok:false");
ok(checkFit(LLAMA31_8B, { vramGB: 0, targetCtx: 4096 }).ok === false, "no GPU → ok:false");

console.log(`\n==== fit_check: ${pass} passed, ${failCount} failed ====`);
process.exit(failCount ? 1 : 0);
