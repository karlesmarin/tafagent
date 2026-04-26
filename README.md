# 🔬 TAF Agent

> **Transformer LLM diagnostic in your browser.** Free. Unlimited. Auditable.

Drop in a model config (or paste any HuggingFace model id), get a falsifiable answer to *"will it work?"* — backed by the Thermodynamic Attention Framework (TAF) formulas.

**🌐 Live demo**: https://transformerkmarin.github.io/tafagent  *(once GitHub Pages is enabled)*

---

## What it does

Answers practical viability questions for transformer LLMs, with **zero servers**:

- *Will Llama-3-8B serve 32K context with NIAH retrieval?*  →  **X-2**
- *Should I train a custom 7B model or use GPT-4 API?*  →  **X-1**
- *I have $5K — what model can I afford to train?*  →  **X-3**
- *Cheapest GPU to serve Llama-70B at 100M tokens/day?*  →  **X-5**
- *Should I use soft KV decay or hard cutoff for compression?*  →  **X-19**

…each as a chain of TAF formulas (paper §17, §19, §20, §24, §26) rendered with full audit trail.

## Two modes

- **💬 Ask in plain English**  →  in-browser LLM picks the right recipe and runs it
- **📋 Recipe + form**  →  manual selection, full control over every parameter

## How it's free + unlimited

- Static HTML/JS hosted on **GitHub Pages** (truly unlimited bandwidth)
- Python TAF computation runs in your browser via **Pyodide** (no server)
- Plain-English synthesis runs **Llama-3.2-1B-Instruct** in your browser via **WebLLM** (your GPU)
- Model weights cached in IndexedDB after first load (~700MB, one-time)
- **Your data never leaves your browser**

## Architecture

```
GitHub Pages (HTML/JS)
      ↓ (one-time download)
Your browser:
  ├─ Pyodide  → Python TAF formulas (CPU, instant)
  └─ WebLLM   → Llama-3.2-1B (GPU/CPU, deterministic-ish)
```

## How to add new models

1. **Preset list** — 11 popular models curated, instant autofill
2. **HF Hub fetch** — paste any model id (`Qwen/Qwen2.5-32B`, `meta-llama/Llama-3.3-70B-Instruct`, ...) → browser fetches `config.json` → autofill form
3. **Manual** — fill the form fields directly

Works for any public RoPE / GQA / MHA / SWA / ALiBi / AbsPE model. Gated models (Llama family) require accepting the licence on HF first.

## Status

- ✅ **Phase 1**: Pyodide + TAF formulas
- ✅ **Phase 2**: WebLLM synthesis (plain-English answer)
- ✅ **Phase 3**: Free-form question router (NLU → recipe selection)
- ✅ **5 recipes**: X-1, X-2, X-3, X-5, X-19
- 🚧 Phase 4: 15 more recipes (X-4, X-6...X-20) + advanced UI

## Local development

```bash
git clone https://github.com/karlesmarin/tafagent
cd tafagent
python -m http.server 8000
# open http://localhost:8000
```

## Browser requirements

- Chrome / Edge / Firefox 113+ for WebGPU acceleration (recommended)
- Older browsers fall back to CPU inference (slower but works)
- ~2 GB free RAM for Llama-3.2-1B
- ~700 MB disk for model cache (one-time)

## Citation

If you use this tool, please cite the underlying paper:

```bibtex
@article{marin2026transformer_thermodynamics,
  author  = {Marin, Carles},
  title   = {Transformer Thermodynamics: A Closed-Form Theory of Attention Decay,
             Phase Transitions, and Context-Length Limits in RoPE Language Models},
  year    = {2026},
}
```

## License

Apache-2.0 (this code). Llama-3.2-1B distributed under the [Meta Llama 3.2 license](https://www.llama.com/llama3_2/license/).

---

**Acknowledgements**: this tool would not exist without the open-weights commons
(Meta, Mistral, Qwen, EleutherAI, AI2 and many more), the Pyodide + WebLLM
projects, GitHub Pages free hosting, and the wider ML community keeping all
the tooling honest and accessible. Full list in the
[paper Acknowledgements](https://github.com/karlesmarin/NeurIPS).
