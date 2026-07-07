# 💾 Show & Tell: TAF Agent v0.12 — "will it fit?" answered before you download, and the whole tool now speaks your language 🌍

> **⚡ TL;DR** — Free, no-signup, browser-only LLM diagnostics.
>
> 🆕 **💾 Fit Check** answers the most-asked question on this forum — *"will this model fit on my GPU at my context length?"* — including the part every VRAM calculator forgets (**the KV cache**), before you download a single byte.
> 🆕 **🌍 Four languages end-to-end** (EN/ES/FR/ZH): not just menus — guided demos, recipe verdicts and explanations follow your browser language.
>
> 🎬 **Try it in 10 seconds** (the demo runs itself): https://karlesmarin.github.io/tafagent/?demo=fitcheck
> 🚀 **Live**: https://huggingface.co/spaces/karlexmarin/taf-agent · 📦 **Source**: https://github.com/karlesmarin/tafagent

---

## 🧨 The problem Fit Check solves

The recurring surprise, straight from this forum: *"Llama-3.1-8B is ~16 GB in fp16 — why is my 24 GB GPU full?"* Because **weights are only half the story**. The KV cache grows linearly with context, and at 128K it can weigh as much as the model:

```
Llama-3.1-8B · fp16 · RTX 4090 (24 GB) · context 131072
  ⚖️  weights   15.0 GB
  🧊  KV cache  16.0 GB   ← 128 KB per token, 50% of the total!
  🔧  scratch    0.9 GB
  ─────────────────────
  📦  total     31.9 GB   → 🚨 DOES NOT FIT — and it's the KV cache, not the model
  ✂️  max context that DOES fit: ~66,000 tokens
  💡  cheapest rescues, in order: q8_0 KV cache → Q6_K weights → partial offload
```

That's the whole mode: model id (geometry fetched from `config.json`) + precision (fp16/bf16/int8/nf4 or any GGUF quant) + GPU + target context → full budget, a verdict that names **which side is the problem** (⚖️ weights-bound vs 🧊 KV-bound), the **max context that fits**, and the cheapest fix. Same budget math as the Launch-Flag Generator, so the two modes can never disagree.

## 🌍 Your language, end to end

Until v0.11 the menus were translated but demos and recipe results came out in English. v0.12 fixes it at the root: the Python recipe engine emits message codes that the UI localizes (EN/ES/FR/ZH, English always kept as fallback), and the guided demos follow your browser language automatically. Guarded by a real-browser regression test (Spanish locale, clean storage, full demo + full Profile, zero English residue) that now runs in CI on every push, along with a sweep of every mode in every language.

## 🧰 What else is in the box (29 modes, all browser-only)

📇 Profile (5-recipe TAF Card from a model id) · 🪟 Context Unmasker (is `max_position_embeddings` honest?) · 📜 Chat-template Sniffer (the lm-eval #1841 silent-halving fix) · ⚖️ Quant-regime · 🔍 NIAH→Reason · 🎯 LongScore (RULER+HELMET) · 🎯 Arena-Elo CI reconstructor · 🧪 Contamination prior · 🧵 YaRN planner · 🧊 GGUF Bridge (reads headers via HTTP Range — no download) · 🚀 Launch Flags · 🔁 Cache Diff · 🔬 Spec-Decode compatibility · 🌍 Token Tax · and more.

Every mode has a **🎬 Demo** button that walks you through it, step by step, in your language.

## ⚖️ Honesty section (as always)

- 📐 Everything from `config.json` is a **prediction**, not a measurement. When it matters, measure: the Diagnose CLI generates the command, and Prediction-vs-Reality compares.
- ⚠️ The quant γ-shift constants are hand-set, mostly uncalibrated (flagged in-tool).
- 🚧 Verdict pill labels ("GO", "MEMORY-LIMITED"…) are still English-only; next batch.
- 🔒 Nothing you type leaves your browser. No server, no telemetry, no signup.
