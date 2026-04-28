# 🔬 TAF Agent — predict transformer LLM viability before you spend GPU/$

Just shipped **TAF Agent**, a free browser-based diagnostic tool for transformer LLMs.
No server, no auth, no cost. Runs entirely in your browser.

🌐 **Try it**: https://huggingface.co/spaces/karlexmarin/taf-agent
📦 **Source**: https://github.com/karlesmarin/tafagent
📄 **Paper**: [Predicting How Transformers Attend](https://zenodo.org/records/19826343)

## What it answers

- *Will Llama-3-8B serve 32K context with NIAH retrieval?* ← **X-2 recipe**
- *Should I train custom or use GPT-4o for 50M tokens/month?* ← **X-1 recipe**
- *I have $5K — what model can I afford to train?* ← **X-3 recipe**
- *Cheapest GPU to serve Llama-70B at 100M tokens/day?* ← **X-5 recipe**
- *Soft KV decay or hard cutoff at 32K?* ← **X-19 recipe**

5 cross-section recipes, 5 UI modes, 4 languages (EN/ES/FR/ZH).

## Why it's different from "ask ChatGPT"

Every number is deterministic Python (the TAF formulas — closed-form, derivable
from RoPE aliasing geometry). No hallucination. The synthesis LLM only reads the
chain and writes plain English; it doesn't invent values.

The full computation chain is auditable per click — every step shows formula,
inputs, output, paper section reference.

## Architecture coverage

✓ RoPE-MHA · ✓ RoPE-GQA · ✓ ALiBi · ✓ AbsPE · ✓ SWA · ✓ SSM
✓ Any HuggingFace public model (paste model id, fetch config.json, profile)

## How it stays free + unlimited

- Static HTML/JS on GitHub Pages (unlimited bandwidth)
- Python computation in your browser via Pyodide
- Plain-English synthesis via WebLLM (Qwen2.5-0.5B local, your GPU)
- Configs fetched directly from HF Hub
- **Your data never leaves your browser**

If 1 user or 1M users hit it, our cost stays at **$0/month**.

## Built by an independent researcher

No funding, no team, no GPUs beyond a single consumer card. Built with the
help of large language models as research instruments. Open source. Apache-2.0.

The tool exists because the paper it complements needed a way for any reader
to *check the framework's predictions on their own model in seconds*.

## Looking for

- 🧪 **Falsifications**: run TAF Agent on a model where you have real
  measurements. If our verdict disagrees, please open a [refutation issue](https://github.com/karlesmarin/tafagent-registry/issues/new?template=refutation.md).
- 🌐 **Translations**: 4 languages so far. Add yours via PR (`js/i18n.js`).
- 💡 **New recipes**: we shipped 5 of 20 candidate recipes from the paper.
  Propose more in the [registry](https://github.com/karlesmarin/tafagent-registry).
- ➕ **Model presets**: 11 popular models curated. Add yours.

## What this is NOT

- Not a benchmark (we predict from config, don't measure)
- Not a leaderboard (no ranking, just per-model viability)
- Not a replacement for actual evaluation — *prediction* before *measurement*
- Not a vendor pitch — there's nothing to buy, ever

The point is to give the community a free, auditable, falsifiable lens for
evaluating transformer LLMs before spending compute on them.

If you find it useful even once, that's enough.

#transformer #llm #rope #diagnostic #free #opensource
