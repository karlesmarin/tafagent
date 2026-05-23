// Launch-Flag Generator (v0.9.4 anti-bullshit pack)
//
// Input a model + GPU + target context → the exact llama.cpp / Ollama launch
// flags (-ngl layers to offload, -c context, --no-mmap, cache-type), with a
// VRAM breakdown AND the TAF angle the pure VRAM calculators miss: "you CAN
// allocate KV for 128K, but this model's attention horizon is ~32K — context
// past that is wasted memory." Solves the recurring r/LocalLLaMA pain of
// guessing -ngl / hitting Blackwell OOM. All browser-only.

import { gammaPade } from "./gamma_check.js";
import { dHorizon } from "./yarn_planner.js";

// Curated GPU VRAM presets (GB). Unified-memory Macs included (shared pool).
export const GPU_PRESETS = [
  { id: "rtx3060",  label: "RTX 3060 12GB",     vram: 12 },
  { id: "rtx4060ti",label: "RTX 4060 Ti 16GB",  vram: 16 },
  { id: "rtx4070",  label: "RTX 4070 12GB",     vram: 12 },
  { id: "rtx4080",  label: "RTX 4080 16GB",     vram: 16 },
  { id: "rtx3090",  label: "RTX 3090 24GB",     vram: 24 },
  { id: "rtx4090",  label: "RTX 4090 24GB",     vram: 24 },
  { id: "rtx5090",  label: "RTX 5090 32GB",     vram: 32 },
  { id: "a100_40",  label: "A100 40GB",         vram: 40 },
  { id: "a100_80",  label: "A100 80GB",         vram: 80 },
  { id: "h100",     label: "H100 80GB",         vram: 80 },
  { id: "h200",     label: "H200 141GB",        vram: 141 },
  { id: "mac32",    label: "Mac 32GB (unified)",vram: 24 },   // ~75% usable for GPU
  { id: "mac64",    label: "Mac 64GB (unified)",vram: 48 },
  { id: "mac128",   label: "Mac 128GB (unified)",vram: 96 },
];

// Effective bits-per-weight per GGUF quant (includes K-quant block overhead).
export const QUANT_BPW = {
  F16:    16.0,
  Q8_0:    8.5,
  Q6_K:    6.56,
  Q5_K_M:  5.67,
  Q4_K_M:  4.83,
  Q4_0:    4.55,
  Q3_K_M:  3.91,
  Q2_K:    2.63,
};

// KV-cache element bytes per cache dtype.
const CACHE_BYTES = { fp16: 2, q8_0: 1, q4_0: 0.5 };

const GB = 1024 ** 3;

// Estimate parameter count from geometry when the model card doesn't state it.
// Uses the exact decoder layout (attention with GQA + SwiGLU MLP + embeddings)
// when intermediate_size is known — the 12·h² shortcut undercounts modern
// large-FFN models (Qwen2.5-7B is really 7.6B, not the ~5.4B the shortcut gives).
export function estimateNParams({ nParams, hidden, nLayers, vocab, intermediate, nKvHeads, headDim, tieEmbeddings }) {
  if (Number.isFinite(nParams) && nParams > 0) return nParams;
  if (!hidden || !nLayers) return null;
  let perLayer;
  if (intermediate) {
    const kvDim = (nKvHeads && headDim) ? nKvHeads * headDim : hidden; // GQA shrinks K,V
    const attn = 2 * hidden * hidden + 2 * hidden * kvDim;             // q,o + k,v
    const mlp = 3 * hidden * intermediate;                            // gate,up,down (SwiGLU)
    perLayer = attn + mlp;
  } else {
    perLayer = 12 * hidden * hidden; // fallback heuristic
  }
  const embed = vocab ? (tieEmbeddings ? 1 : 2) * vocab * hidden : 0;
  return perLayer * nLayers + embed;
}

// KV cache bytes for the whole model at context L.
function kvCacheBytes(nLayers, nKvHeads, headDim, L, cacheType) {
  const elem = CACHE_BYTES[cacheType] ?? 2;
  return 2 /* K+V */ * nLayers * nKvHeads * headDim * L * elem;
}

export function planLaunch(opts) {
  const {
    nParams, nLayers, nKvHeads, headDim, hidden, ropeTheta, ctxTrain,
    quant = "Q4_K_M", vramGB, targetCtx, cacheType = "fp16", flashAttn = true,
  } = opts;

  const out = { ok: false, warnings: [] };
  if (!nLayers || !nKvHeads || !headDim) { out.verdict = "no_geometry"; return out; }
  if (!Number.isFinite(vramGB) || vramGB <= 0) { out.verdict = "no_gpu"; return out; }
  if (!Number.isFinite(targetCtx) || targetCtx <= 0) { out.verdict = "no_ctx"; return out; }

  const bpw = QUANT_BPW[quant] ?? 4.83;
  const N = estimateNParams({
    nParams, hidden, nLayers, vocab: opts.vocab,
    intermediate: opts.intermediate, nKvHeads, headDim, tieEmbeddings: opts.tieEmbeddings,
  });

  const weightsB = N ? (N * bpw / 8) : null;
  const kvB = kvCacheBytes(nLayers, nKvHeads, headDim, targetCtx, cacheType);
  // Compute/scratch buffer: roughly scales with context × hidden. Flash-attention
  // shrinks the attention scratch substantially. Coarse estimate, flagged as such.
  const scratchB = (flashAttn ? 0.25 : 0.6) * GB + (hidden ? 0.5 * hidden * targetCtx * 2 : 0);
  const overheadB = 0.4 * GB + scratchB;

  const weightsGB = weightsB != null ? weightsB / GB : null;
  const kvGB = kvB / GB;
  const overheadGB = overheadB / GB;
  const totalGB = (weightsGB ?? 0) + kvGB + overheadGB;

  // Layer-offload (-ngl). ~88% of weights live in transformer layers; the rest
  // (embeddings/output) load with any GPU offload.
  const layerFrac = 0.88;
  const layerWeightsGB = weightsGB != null ? weightsGB * layerFrac : null;
  const nonLayerGB = weightsGB != null ? weightsGB * (1 - layerFrac) : 0;
  const kvPerLayerGB = kvGB / nLayers;
  const perLayerGB = (layerWeightsGB != null ? layerWeightsGB / nLayers : 0) + kvPerLayerGB;

  let ngl, allOnGpu, fits;
  if (weightsGB == null) {
    ngl = null; allOnGpu = false; fits = false;
    out.warnings.push({ code: "no_params" });
  } else if (totalGB <= vramGB) {
    ngl = nLayers; allOnGpu = true; fits = true;
  } else {
    const avail = vramGB - overheadGB - nonLayerGB;
    ngl = perLayerGB > 0 ? Math.max(0, Math.floor(avail / perLayerGB)) : 0;
    ngl = Math.min(ngl, nLayers);
    allOnGpu = false; fits = false;
  }

  // TAF horizon: does the model's attention actually reach the context you're
  // paying KV memory for? This is the differentiator vs pure VRAM calculators.
  const theta = Number(ropeTheta) || 10000;
  const gammaTrain = ctxTrain ? gammaPade(theta, ctxTrain) : null;
  const dHoriz = gammaTrain != null ? dHorizon(theta, gammaTrain) : null;
  const horizonWasted = dHoriz != null && targetCtx > dHoriz * 1.25;
  if (horizonWasted) out.warnings.push({ code: "horizon_wasted", params: { dHoriz, target: targetCtx } });
  if (ctxTrain && targetCtx > ctxTrain) out.warnings.push({ code: "beyond_trained", params: { ctxTrain, target: targetCtx } });
  if (allOnGpu) out.warnings.push({ code: "no_mmap_blackwell" });
  if (!fits && ngl > 0) out.warnings.push({ code: "partial_offload", params: { ngl, nLayers } });
  if (!fits && ngl === 0) out.warnings.push({ code: "cpu_only", params: {} });

  out.ok = true;
  Object.assign(out, {
    verdict: fits ? "fits" : (ngl > 0 ? "partial" : "too_big"),
    nParams: N, bpw, quant, cacheType, flashAttn,
    weightsGB, kvGB, overheadGB, totalGB, vramGB,
    ngl, allOnGpu, nLayers,
    theta, dHoriz, gammaTrain, ctxTrain, targetCtx,
  });
  return out;
}

// Build the copy-paste commands for both engines.
export function launchCommands(plan, modelRef = "<model.gguf>") {
  const nglStr = plan.allOnGpu ? "99" : String(plan.ngl);
  const cache = plan.cacheType !== "fp16" ? ` -ctk ${plan.cacheType} -ctv ${plan.cacheType}` : "";
  const fa = plan.flashAttn ? " -fa" : "";
  const mmap = plan.allOnGpu ? " --no-mmap" : "";
  const llamacpp =
    `llama-server -m ${modelRef} \\\n` +
    `  -ngl ${nglStr} -c ${plan.targetCtx}${fa}${cache}${mmap}`;

  // Ollama: Modelfile params + env. num_gpu = layers on GPU.
  const olEnv = [
    plan.flashAttn ? "OLLAMA_FLASH_ATTENTION=1" : null,
    plan.cacheType !== "fp16" ? `OLLAMA_KV_CACHE_TYPE=${plan.cacheType}` : null,
  ].filter(Boolean).join(" ");
  const ollama =
    (olEnv ? olEnv + " \\\n" : "") +
    `ollama run <model>\n` +
    `# Modelfile / params:\n` +
    `PARAMETER num_ctx ${plan.targetCtx}\n` +
    `PARAMETER num_gpu ${nglStr === "99" ? plan.nLayers : nglStr}`;

  return { llamacpp, ollama };
}
