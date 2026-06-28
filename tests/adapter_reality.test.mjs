import { readFileSync } from "fs";
import { parseAdapterConfig, compatChecks, forgettingBand, rankBucket, familyFromModelId } from "../js/adapter_reality.js";

// Stub fetch so loadForgettingKB() reads the KB from disk (browser uses real fetch).
const KB = JSON.parse(readFileSync(new URL("../data/forgetting_kb.json", import.meta.url), "utf8"));
globalThis.fetch = async () => ({ ok: true, json: async () => KB });

let p = 0, f = 0; const ck = (n, c) => { if (c) { p++; console.log("  ✓ " + n); } else { f++; console.log("  ✗ " + n); } };

// --- rankBucket / familyFromModelId ---
ck("rankBucket low/med/high", rankBucket(8) === "low" && rankBucket(16) === "low" && rankBucket(64) === "med" && rankBucket(256) === "high");
ck("rankBucket null", rankBucket(null) === null);
ck("family from llama-3 / llama-2 / qwen2.5", familyFromModelId("meta-llama/Meta-Llama-3-8B") === "llama-3" && familyFromModelId("meta-llama/Llama-2-7b-hf") === "llama-2" && familyFromModelId("Qwen/Qwen2.5-7B") === "qwen-2.5");
ck("family unknown → null", familyFromModelId("mistralai/Mistral-7B-v0.1") === null);

// --- parseAdapterConfig ---
const lora = parseAdapterConfig({ peft_type: "LORA", r: 16, lora_alpha: 32, target_modules: ["q_proj", "v_proj"], base_model_name_or_path: "meta-llama/Meta-Llama-3-8B", task_type: "CAUSAL_LM" });
ck("parse LoRA: scaling α/r=2", lora.scaling === 2 && lora.r === 16 && lora.isRankBased);
const rs = parseAdapterConfig({ peft_type: "LORA", r: 64, lora_alpha: 16, use_rslora: true });
ck("parse rsLoRA: scaling α/√r", Math.abs(rs.scaling - 16 / Math.sqrt(64)) < 1e-9);
const prompt = parseAdapterConfig({ peft_type: "PROMPT_TUNING", num_virtual_tokens: 20 });
ck("parse prompt-tuning: not rank-based", prompt.isRankBased === false && prompt.r === null);
const dora = parseAdapterConfig({ peft_type: "LORA", r: 8, lora_alpha: 16, use_dora: true });
ck("parse DoRA flag", dora.useDora === true && dora.isRankBased);

// --- compatChecks ---
const codes = (cfg, base) => compatChecks(parseAdapterConfig(cfg), base).map((c) => c.code);
ck("base match exact", codes({ r: 8, lora_alpha: 16, base_model_name_or_path: "X/Y" }, "X/Y").includes("base_match_exact"));
ck("base match family", codes({ r: 8, lora_alpha: 16, base_model_name_or_path: "meta-llama/Meta-Llama-3-8B" }, "unsloth/llama-3-8b").includes("base_match_family"));
ck("base mismatch", codes({ r: 8, lora_alpha: 16, base_model_name_or_path: "meta-llama/Meta-Llama-3-8B" }, "mistralai/Mistral-7B-v0.1").includes("base_mismatch"));
ck("targets attn-only", codes({ r: 8, lora_alpha: 16, target_modules: ["q_proj", "v_proj"] }).includes("targets_attn_only"));
ck("targets full (attn+mlp)", codes({ r: 8, lora_alpha: 16, target_modules: ["q_proj", "gate_proj"] }).includes("targets_full"));
ck("scaling high flag", codes({ r: 8, lora_alpha: 128 }).includes("scaling_high"));
ck("modules_to_save embed", codes({ r: 8, lora_alpha: 16, modules_to_save: ["embed_tokens"] }).includes("modules_to_save_embed"));
ck("not_rank_based for prompt tuning", codes({ peft_type: "PROMPT_TUNING" }).includes("not_rank_based"));

// --- forgettingBand (uses stubbed KB) ---
const band = await forgettingBand(parseAdapterConfig({ peft_type: "LORA", r: 8, lora_alpha: 16, base_model_name_or_path: "meta-llama/Llama-2-7b-hf" }), "meta-llama/Llama-2-7b-hf");
ck("forgettingBand applicable for LoRA", band.applicable === true && band.bucket === "low");
ck("forgettingBand returns query+stats", band.query && typeof band.query.stats === "object");
const bandNA = await forgettingBand(parseAdapterConfig({ peft_type: "PROMPT_TUNING" }), "meta-llama/Llama-2-7b-hf");
ck("forgettingBand N/A for non-rank adapter", bandNA.applicable === false);

console.log(`\nadapter_reality: ${p} passed, ${f} failed`);
if (f) process.exit(1);
