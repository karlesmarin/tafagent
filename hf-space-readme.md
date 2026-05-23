---
title: TAF Agent
emoji: 🔬
colorFrom: blue
colorTo: green
sdk: static
pinned: true
license: apache-2.0
short_description: Test ANY transformer LLM before you spend GPU/$. Free. Auditable.
tags:
  - transformer
  - llm
  - diagnostic
  - rope
  - kv-cache
  - long-context
  - gguf
  - llama-cpp
  - ollama
  - yarn
  - quantization
  - viability
  - thermodynamics
  - free
  - browser
  - webgpu
language:
  - en
  - es
  - fr
  - zh
---

# 🔬 TAF Agent

> **Test ANY transformer LLM before you spend GPU/$.**
> Free. Unlimited. Auditable. Runs entirely in your browser.

---

## What it does

Predicts practical viability of any transformer LLM from its config alone:

- Will Llama-3-8B serve 32K context with NIAH retrieval?
- Should I train a custom 7B model or use GPT-4o for 50M tokens/month?
- Cheapest GPU to serve Llama-70B at 100M tokens/day?
- Which KV compression strategy fits my model's γ profile?

25 modes, 4 languages (EN/ES/FR/ZH), 100% in-browser.

## Why it's different

- **Truly free**: no server, no auth, no rate limits. Compute runs in YOUR browser.
- **Auditable**: every number is deterministic Python (TAF formulas, see paper).
  No hallucination — the LLM only synthesises, doesn't invent values.
- **Falsifiable**: 23 paper predictions tracked publicly with verification status.
- **Community-first**: submit your analyses to a public registry; debate them.

## Architecture coverage

✓ RoPE-MHA · ✓ RoPE-GQA · ✓ ALiBi · ✓ AbsPE · ✓ SWA · ✓ SSM · ✓ Any HuggingFace public model

## Modes (25)

**Core**
- **📇 Profile**: paste model id → all 5 recipes scored at once = TAF Card
- **🆚 Compare**: 2-3 models side-by-side · **🔍 Inspector**: raw config.json · **💬 Ask**: free-form · **📋 Recipe**: manual

**🆕 v0.9 — "fits ≠ works" pack**
- **🧵 YaRN Planner**: target context → exact `rope_scaling` config + γ/d_horizon verdict on whether quality holds
- **🧊 GGUF Bridge**: paste a GGUF repo → reads the `.gguf` header (HTTP Range, no full download), compares every quant's γ-shift
- **🚀 Launch Flags**: model + GPU + context → exact `llama.cpp`/Ollama command (`-ngl`, `-c`, `--no-mmap`, KV-type) + wasted-context warning

**Anti-bullshit pack (v0.7–v0.8)**
- 🪟 Unmask · 📜 Chat-template · 🎯 Arena CI · 🧪 Contamination · ⚖️ Quant · 🔀 Drift · 🔍 NIAH→Reason
- 📈 Saturation · 📋 JSON CoT · 🔧 PEFT Lint · 🔁 Cache Diff · 🔬 Spec-Decode · 🌍 Token Tax · 🎯 LongScore · 🧭 Solutions · 🩺 Diagnose CLI · 📊 Phase diagram

## Underlying paper

[Marin 2026 — Predicting How Transformers Attend](https://zenodo.org/records/20314038)

## Source

[github.com/karlesmarin/tafagent](https://github.com/karlesmarin/tafagent)

## Public registry

[tafagent-registry](https://github.com/karlesmarin/tafagent-registry) — community-submitted analyses

## Citation

```bibtex
@misc{marin2026tafagent,
  author = {Marin, Carles},
  title  = {{TAF Agent}: Browser-Based Transformer Diagnostic Tool},
  year   = {2026},
  url    = {https://huggingface.co/spaces/karlexmarin/taf-agent},
}
```

## Acknowledgements

Built by an independent researcher with the help of LLMs as research instruments.
Not affiliated with any model vendor.

The tool would not exist without the open-weights commons (Meta, Mistral, Qwen,
EleutherAI, AI2, BigScience, TII, DeepSeek, Microsoft, Google DeepMind, Anthropic),
the Pyodide + WebLLM projects, and HuggingFace for hosting models, datasets,
and now this Space.
