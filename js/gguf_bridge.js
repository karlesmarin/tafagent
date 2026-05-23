// GGUF Validity Bridge (v0.9.1 anti-bullshit pack)
//
// The dozen GGUF/VRAM calculators on HF answer "does this quant fit in my GPU?".
// None answer "does it fit AND still work?". This reads a .gguf file's metadata
// header directly in the browser (HTTP Range — no full multi-GB download), pulls
// rope_theta + context_length + quant scheme + head geometry, then runs TAF's
// γ_Padé / d_horizon + the quant-regime γ-shift to emit a quality verdict:
// "fits in VRAM but attention collapses past d_horizon, and Q4 worsens γ by …".
//
// Parser logic is pure; the network fetch is unavoidable I/O. main.js renders.

import { gammaPade } from "./gamma_check.js";
import { dHorizon } from "./yarn_planner.js";
import { predictQuantShift } from "./quant_regime.js";

// ── GGUF metadata value types (spec v2/v3) ──
const GT = { U8:0, I8:1, U16:2, I16:3, U32:4, I32:5, F32:6, BOOL:7, STR:8, ARR:9, U64:10, I64:11, F64:12 };
const FIXED_SIZE = { 0:1, 1:1, 2:2, 3:2, 4:4, 5:4, 6:4, 7:1, 10:8, 11:8, 12:8 };

// general.file_type enum (llama_ftype) → human label + the quant_regime scheme id
// we feed to predictQuantShift. Only the common ones; filename parsing backstops.
const FTYPE = {
  0:  ["F32",     null],
  1:  ["F16",     null],
  2:  ["Q4_0",    "gguf_q4_km"],
  3:  ["Q4_1",    "gguf_q4_km"],
  7:  ["Q8_0",    "gguf_q8_0"],
  8:  ["Q5_0",    "gguf_q5_km"],
  9:  ["Q5_1",    "gguf_q5_km"],
  10: ["Q2_K",    "gguf_q2_k"],
  11: ["Q3_K_S",  "gguf_q3_km"],
  12: ["Q3_K_M",  "gguf_q3_km"],
  13: ["Q3_K_L",  "gguf_q3_km"],
  14: ["Q4_K_S",  "gguf_q4_km"],
  15: ["Q4_K_M",  "gguf_q4_km"],
  16: ["Q5_K_S",  "gguf_q5_km"],
  17: ["Q5_K_M",  "gguf_q5_km"],
  18: ["Q6_K",    "gguf_q8_0"],
};

// Filename → (label, scheme) backstop when general.file_type is absent/ambiguous.
export function quantFromFilename(name) {
  const n = (name || "").toUpperCase();
  const pairs = [
    ["Q2_K", "gguf_q2_k"], ["Q3_K", "gguf_q3_km"], ["Q4_K", "gguf_q4_km"],
    ["Q5_K", "gguf_q5_km"], ["Q6_K", "gguf_q8_0"], ["Q8_0", "gguf_q8_0"],
    ["Q4_0", "gguf_q4_km"], ["Q4_1", "gguf_q4_km"], ["Q5_0", "gguf_q5_km"],
    ["Q5_1", "gguf_q5_km"], ["F16", null], ["BF16", null], ["F32", null],
  ];
  for (const [tag, scheme] of pairs) {
    if (n.includes(tag)) return { label: tag.replace(/_$/, ""), scheme };
  }
  return { label: "?", scheme: null };
}

// List the .gguf files in a HF repo (so the user can pick a quant).
export async function listGgufFiles(repo) {
  const resp = await fetch(`https://huggingface.co/api/models/${encodeURIComponent(repo).replace(/%2F/g, "/")}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} — repo not found or private`);
  const data = await resp.json();
  const sib = Array.isArray(data.siblings) ? data.siblings : [];
  return sib.map(s => s.rfilename).filter(f => /\.gguf$/i.test(f)).sort();
}

// Incremental Range-fetch reader. GGUF metadata sits at the file head; arch +
// rope fields precede the big tokenizer arrays, so a few MB always suffices.
class GgufReader {
  constructor(url) {
    this.url = url;
    this.buf = new Uint8Array(0);
    this.dv = new DataView(this.buf.buffer);
    this.off = 0;
    this.fetched = 0;
    this.CHUNK = 1 << 20;       // 1 MB per range
    this.MAX = 48 << 20;        // hard cap 48 MB
    this.eof = false;
  }
  async ensure(n) {
    while (this.off + n > this.buf.length && !this.eof && this.fetched < this.MAX) {
      const start = this.fetched;
      const end = Math.min(this.fetched + this.CHUNK, this.MAX) - 1;
      const resp = await fetch(this.url, { headers: { Range: `bytes=${start}-${end}` } });
      if (!resp.ok && resp.status !== 206 && resp.status !== 200) throw new Error(`HTTP ${resp.status}`);
      const part = new Uint8Array(await resp.arrayBuffer());
      if (part.length === 0) { this.eof = true; break; }
      const merged = new Uint8Array(this.buf.length + part.length);
      merged.set(this.buf); merged.set(part, this.buf.length);
      this.buf = merged;
      this.dv = new DataView(this.buf.buffer);
      this.fetched += part.length;
      if (part.length < this.CHUNK) this.eof = true; // server returned the tail
    }
    if (this.off + n > this.buf.length) throw new Error("gguf_metadata_too_large");
  }
  async u8()  { await this.ensure(1); return this.dv.getUint8(this.off++); }
  async u16() { await this.ensure(2); const v = this.dv.getUint16(this.off, true); this.off += 2; return v; }
  async i16() { await this.ensure(2); const v = this.dv.getInt16(this.off, true); this.off += 2; return v; }
  async u32() { await this.ensure(4); const v = this.dv.getUint32(this.off, true); this.off += 4; return v; }
  async i32() { await this.ensure(4); const v = this.dv.getInt32(this.off, true); this.off += 4; return v; }
  async f32() { await this.ensure(4); const v = this.dv.getFloat32(this.off, true); this.off += 4; return v; }
  async f64() { await this.ensure(8); const v = this.dv.getFloat64(this.off, true); this.off += 8; return v; }
  // u64/i64 as Number — safe for counts/dims well under 2^53.
  async u64() { await this.ensure(8); const lo = this.dv.getUint32(this.off, true); const hi = this.dv.getUint32(this.off + 4, true); this.off += 8; return hi * 4294967296 + lo; }
  async i64() { return this.u64(); }
  async skip(n) { await this.ensure(0); // ensure buffer exists
    // skip may exceed current buffer; pull enough then advance offset
    await this.ensure(Math.min(n, this.MAX)); this.off += n;
    if (this.off > this.buf.length) { this.off = this.buf.length; throw new Error("gguf_metadata_too_large"); }
  }
  async str() {
    const len = await this.u64();
    await this.ensure(len);
    const bytes = this.buf.subarray(this.off, this.off + len);
    this.off += len;
    return new TextDecoder("utf-8").decode(bytes);
  }
}

async function readValue(r, type) {
  switch (type) {
    case GT.U8: return r.u8();
    case GT.I8: { const v = await r.u8(); return v > 127 ? v - 256 : v; }
    case GT.U16: return r.u16();
    case GT.I16: return r.i16();
    case GT.U32: return r.u32();
    case GT.I32: return r.i32();
    case GT.F32: return r.f32();
    case GT.BOOL: return (await r.u8()) !== 0;
    case GT.STR: return r.str();
    case GT.U64: return r.u64();
    case GT.I64: return r.i64();
    case GT.F64: return r.f64();
    case GT.ARR: {
      const et = await r.u32();
      const len = await r.u64();
      if (FIXED_SIZE[et]) { await r.skip(len * FIXED_SIZE[et]); return { __array: len, elemType: et }; }
      if (et === GT.STR) { for (let i = 0; i < len; i++) { const sl = await r.u64(); await r.skip(sl); } return { __array: len, elemType: et }; }
      throw new Error("gguf_nested_array");
    }
    default: throw new Error(`gguf_unknown_type_${type}`);
  }
}

// Parse the metadata KV block. Returns a flat { key: value } map (arrays are
// returned as {__array,len} stubs — we never need their contents here).
export async function fetchGgufMetadata(url) {
  const r = new GgufReader(url);
  const magic = (await r.u8()) | ((await r.u8()) << 8) | ((await r.u8()) << 16) | ((await r.u8()) << 24);
  if (magic !== 0x46554747 /* 'GGUF' little-endian */) throw new Error("not_a_gguf_file");
  const version = await r.u32();
  const tensorCount = await r.u64();
  const kvCount = await r.u64();
  const kv = {};
  for (let i = 0; i < kvCount; i++) {
    const key = await r.str();
    const type = await r.u32();
    kv[key] = await readValue(r, type);
  }
  return { version, tensorCount, kvCount, kv, bytesRead: r.fetched };
}

// Map raw GGUF metadata → HF-style config (so quant_regime + TAF math can reuse it).
export function ggufToConfig(meta) {
  const kv = meta.kv || {};
  const arch = kv["general.architecture"];
  const g = (suffix, fallback = null) => (arch && kv[`${arch}.${suffix}`] !== undefined ? kv[`${arch}.${suffix}`] : fallback);

  const n_attn = g("attention.head_count");
  const n_kv = g("attention.head_count_kv", n_attn);
  const hidden = g("embedding_length");
  const keyLen = g("attention.key_length");
  const headDim = (typeof keyLen === "number") ? keyLen
                : (n_attn && hidden ? hidden / n_attn : null);
  const ftypeEnum = kv["general.file_type"];
  const ftype = (typeof ftypeEnum === "number" && FTYPE[ftypeEnum]) ? FTYPE[ftypeEnum] : null;

  return {
    architecture: arch || "?",
    quant_label: ftype ? ftype[0] : null,
    quant_scheme: ftype ? ftype[1] : null,
    rope_theta: g("rope.freq_base", null),
    context_length: g("context_length", null),
    rope_scaling_type: g("rope.scaling.type", null),
    rope_scaling_factor: g("rope.scaling.factor", null),
    rope_orig_ctx: g("rope.scaling.original_context_length", null),
    // HF-config aliases for predictQuantShift / inferNParams:
    num_attention_heads: n_attn ?? null,
    num_key_value_heads: n_kv ?? null,
    hidden_size: hidden ?? null,
    head_dim: headDim,
    num_hidden_layers: g("block_count", null),
    sliding_window: g("attention.sliding_window", null),
    vocab_size: g("vocab_size", null),
  };
}

// Bridge verdict: combine GGUF geometry + TAF horizon + quant γ-shift.
//   cfg       : ggufToConfig output (may be edited by user / filename backstop)
//   targetCtx : optional desired context L to check (else uses context_length)
export function analyzeGguf(cfg, targetCtx) {
  const theta = Number(cfg.rope_theta) || 10000;
  const nCtx = Number(cfg.context_length) || null;
  const L = Number(targetCtx) || nCtx;

  // fp16 attention horizon — architectural, set by θ. SAME across every quant
  // of the model (quantisation adds noise, it does not change θ). d_horizon is
  // a function of the *natural* Padé γ, so it must be computed from the fp16 γ —
  // never from a quant-shifted γ (that inverts the formula and is meaningless).
  const gammaTrain = nCtx ? gammaPade(theta, nCtx) : null;
  const dHoriz = gammaTrain != null ? dHorizon(theta, gammaTrain) : null;

  // Quant γ-shift via the existing quant-regime model (architecture-aware).
  const quant = cfg.quant_scheme ? predictQuantShift(cfg, cfg.quant_scheme) : null;

  // γ at the target L: fp16, then after the quant shift. This is the quantity
  // that degrades monotonically with worse quant — the correct comparison axis.
  const gammaAtL = (theta && L) ? gammaPade(theta, L) : null;
  const shift = quant ? quant.gamma_shift : 0;
  const gammaQuant = (gammaAtL != null) ? gammaAtL - shift : null;

  // Verdict is driven by γ@L after quant (the direct attention-quality signal
  // at the target length) plus the quant-regime band. We deliberately do NOT
  // gate on L ≤ d_horizon: the closed-form d_horizon understates the true reach
  // for high-θ models (e.g. Qwen θ=1e6 keeps γ healthy far past its d_horizon),
  // so γ@L is the honest measure. `reaches` is reported for context only.
  const reaches = dHoriz != null && L != null && L <= dHoriz;
  const collapsed = !Number.isFinite(gammaQuant) || gammaQuant <= 0.2;
  const quantCliff = quant && quant.regime === "cliff";
  let verdict;
  if (nCtx == null || theta == null) verdict = "incomplete";
  else if (collapsed || quantCliff) verdict = "degrades";
  else if (gammaQuant >= 0.6 && (!quant || quant.regime === "safe" || quant.regime === "mild")) verdict = "healthy";
  else verdict = "usable_with_care";

  return {
    theta, nCtx, L,
    gammaTrain, dHoriz,          // fp16 architectural horizon (shared across quants)
    gammaAtL, gammaQuant,        // attention at L: fp16 vs after-quant
    reaches,                     // is L within the fp16 horizon?
    quant,                       // {gamma_shift, regime, delta_ppl, ...} or null
    quantLabel: cfg.quant_label,
    arch: cfg.architecture,
    verdict,
  };
}
