---
title: TAF Agent
emoji: 🔬
colorFrom: blue
colorTo: green
sdk: static
pinned: true
license: apache-2.0
short_description: Test any transformer LLM in browser before spending GPU/$.
tags:
  - transformer
  - llm
  - diagnostic
  - rope
  - kv-cache
  - long-context
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

**🌐 Live**: https://karlesmarin.github.io/tafagent
**📦 Source**: https://github.com/karlesmarin/tafagent
**📄 Paper**: [Transformer Thermodynamics — Marin 2026](https://github.com/karlesmarin/NeurIPS)

---

## A note before you read on

This tool was built by **one independent researcher**, with no funding,
no team, no GPUs beyond a single consumer card, and the full collaborative
help of large language models as research instruments. It exists because the
paper it complements (the *Transformer Thermodynamics* manuscript) needed a
way for any reader to **check the framework's predictions on their own
model in seconds**, without installing anything, without paying anyone, and
without trusting a server they don't control.

If it is useful to you — even once — that is enough. If it is wrong about
your model, please tell us so we can fix the framework. The point is the
common ground, not the artefact.

---

## What it does

Drop in a model id (or paste any HuggingFace public model), get a
falsifiable answer to "**will this work?**" — backed by the
Thermodynamic Attention Framework (TAF) formulas:

- *Will Llama-3-8B serve 32K context with NIAH retrieval?* → **X-2**
- *Should I train a custom 7B model or pay for API access?* → **X-1**
- *I have $5,000 — what model can I afford to train?* → **X-3**
- *Cheapest GPU to serve Llama-70B at 100M tokens/day?* → **X-5**
- *Soft KV decay or hard cutoff for compression?* → **X-19**

Each as a chain of TAF formulas (paper §17, §19, §20, §24, §26) rendered
with full audit trail. Every number is deterministic Python; nothing
is hallucinated.

## Four ways to use it

- **📇 Profile a model** — paste id, get all 5 recipes scored as a unified
  TAF Card (best starting point)
- **🆚 Compare models** — 2-3 candidates side-by-side on the same recipe
- **💬 Ask plain English** — free-form question, in-browser LLM picks
  the right recipe
- **📋 Pick recipe** — manual selection with full form control

## How it stays free + unlimited

- Static HTML/JS hosted on **GitHub Pages** (truly unlimited bandwidth)
- Python TAF computation runs in your browser via **Pyodide**
  (no server-side compute)
- Plain-English synthesis runs **Qwen2.5-0.5B-Instruct** in your browser
  via **WebLLM** (your GPU/CPU, your electricity, ~350MB cached after
  first load)
- Model `config.json` files fetched directly from **HuggingFace Hub**
  (free, public, no auth for non-gated models)
- **Your data never leaves your browser**

If 1 user or 1 million users hit it, our cost stays the same: $0.

## Architecture coverage

Supports any model whose `config.json` is parseable:

| Family | Examples | Status |
|--------|----------|--------|
| RoPE-MHA | pythia, gpt-j, original LLaMA | ✓ supported |
| RoPE-GQA | Llama-3, Mistral, Qwen2.5, gemma-2 | ✓ supported |
| ALiBi | BLOOM, Falcon | ✓ supported |
| AbsPE | gpt2 family | ✓ supported |
| SWA (sliding window) | Mistral, gemma-2, phi-3 | ✓ supported |
| SSM | Mamba, Mamba-2 | ✓ partial (γ doesn't apply, KV does) |
| Any HF Hub public model | (any) | ✓ via 📥 Fetch button |

## Languages

Interface available in:
- 🇬🇧 English
- 🇪🇸 Español
- 🇫🇷 Français
- 🇨🇳 中文

Click flags top-right to switch.

## Local development

### Browser application

```bash
git clone https://github.com/karlesmarin/tafagent
cd tafagent
python -m http.server 8000
# open http://localhost:8000
```

### CLI diagnostic (for the paper)

The directory `cli/diagnose_model.py` is the command-line companion
described in the paper *Transformer Thermodynamics* (Marin 2026).
It characterises any causal language model from HuggingFace in
minutes on CPU and produces the raw `gamma_obs`, `R²`, and
thermodynamic profile used in the manuscript.

```bash
pip install torch transformers numpy
python cli/diagnose_model.py --model EleutherAI/pythia-2.8b --fast --cpu
```

### Reproducibility data

The directory `data/` ships every measurement referenced in the
paper (343 JSON files, ~5.5 MB). See `data/README.md` for the layout.

## Browser requirements

- **Chrome / Edge / Firefox 113+** for WebGPU acceleration (recommended)
- Older browsers fall back to CPU inference (slower but works)
- ~2 GB free RAM for the synthesis LLM
- ~350 MB disk for model cache (one-time)

## How you can help

This tool is at v0.3. There's a long way to go.

- **🐛 Report bugs**: https://github.com/karlesmarin/tafagent/issues
- **🌐 Translate**: add a language to `js/i18n.js`, send a PR
- **🧪 Falsify a prediction**: run the tool on a model where you have
  ground-truth measurements; if our verdict disagrees with reality,
  open an issue. We take refutations as seriously as confirmations.
- **➕ New recipe**: implement an X-N recipe in `python/taf_browser.py`
  following the pattern of X-1...X-19
- **➕ New preset**: add a popular model to the `PRESETS` dict
- **📝 Improve docs / examples**: anything that helps the next person

## Citation

If this tool helps you — paper or code:

```bibtex
@article{marin2026transformer_thermodynamics,
  author  = {Marin, Carles},
  title   = {Transformer Thermodynamics: A Closed-Form Theory of Attention Decay,
             Phase Transitions, and Context-Length Limits in RoPE Language Models},
  year    = {2026},
  url     = {https://github.com/karlesmarin/NeurIPS},
}

@misc{marin2026tafagent,
  author = {Marin, Carles},
  title  = {{TAF Agent}: Browser-Based Transformer Diagnostic Tool},
  year   = {2026},
  url    = {https://karlesmarin.github.io/tafagent},
}
```

## License

Apache-2.0 (this code).

Synthesis model: [Qwen2.5-0.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct)
distributed under [Apache-2.0](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct/blob/main/LICENSE).

---

## Acknowledgements

This tool would not exist without:

- **The model commons**: EleutherAI, Meta AI, Alibaba Qwen team, Mistral AI,
  Google DeepMind, Microsoft Research, AI2, BigScience, TII, DeepSeek-AI,
  HuggingFace SmolLM team, the Mamba authors, the RWKV community, and OpenAI
  for releasing weights and configs publicly.
- **The infrastructure commons**: Pyodide, WebLLM, HuggingFace Hub, GitHub
  Pages, jsdelivr CDN.
- **The maintainers** of `transformers`, `numpy`, `scipy`, `sympy`, `tokenizers`,
  `accelerate`, and the dozens of small libraries that make modern ML possible.
- **The wider ML community** — bloggers, reproducibility checkers, Discord
  moderators, Stack Overflow answerers, blog post writers
  (Lilian Weng, Andrej Karpathy, Sebastian Raschka, Jay Alammar, Sasha Rush,
  Phil Wang, the EleutherAI team, and many more) whose explanations carried
  the author through every concept this tool uses.
- **Large language models as research instruments** — Claude (Anthropic),
  GPT (OpenAI), Gemini (Google DeepMind), Mistral, Llama, DeepSeek, Grok,
  Qwen-Chat, and Microsoft phi — for the symbolic derivations, sage
  cross-checks, prose revision, audit work, and long-form co-writing that
  underlie both this tool and the underlying paper.

The author was the hand that typed; the work itself belongs to the commons
that made it possible.
