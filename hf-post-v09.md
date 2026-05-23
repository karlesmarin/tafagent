# TAF Agent v0.9 — announcement draft

Paste this in the Space **Community** tab and/or the HF Forum **Show and Tell**
category (`discuss.huggingface.co`). Also reusable for r/LocalLLaMA, X, LinkedIn.

**Live Space**: https://huggingface.co/spaces/karlexmarin/taf-agent

---

## 🔬 TAF Agent v0.9 — 3 new tools for the "fits ≠ works" problem (free, browser-only)

Every GGUF/VRAM calculator tells you if a model *fits in your GPU*. None tell you
if it *still works* at that context. I built 3 tools that do, using a closed-form
attention-decay model (γ_Padé / d_horizon), all running 100% in your browser — no
inference, no signup:

- **🧵 YaRN Planner** — paste a model + target context → the exact `rope_scaling`
  config.json block **and** a verdict on whether attention quality holds (γ collapse,
  d_horizon, fine-tune flag for aggressive factors).
- **🧊 GGUF Bridge** — paste a GGUF repo → reads the `.gguf` header via HTTP Range
  (no multi-GB download), compares every quant's γ-shift, tells you "fits 8GB but
  degrades past 30K" before you download anything.
- **🚀 Launch Flags** — model + GPU + context → the exact `llama.cpp`/Ollama command
  (`-ngl`, `-c`, `--no-mmap`, KV-cache type) + warns when your context is past the
  usable horizon (KV memory you'd waste).

25 modes total, 4 languages (EN/ES/FR/ZH). Try it:
https://huggingface.co/spaces/karlexmarin/taf-agent

Feedback welcome — especially if the γ predictions disagree with your real
measurements. Paper: https://zenodo.org/records/20314038

---

## Posting checklist

- [ ] Space → Community tab → New discussion (pin it)
- [ ] discuss.huggingface.co → Show and Tell
- [ ] r/LocalLLaMA (see REDDIT_LOCALLLAMA.md for the longer, rules-aware version)
- [ ] X / LinkedIn (1-2 line + Space link + a screenshot)
- [ ] Optional: relevant GGUF model discussions (Qwen/Llama) — only where genuinely
      useful, link the GGUF Bridge specifically, never spam

## Tips

- Lead with the one-line hook ("fits ≠ works"), not the math.
- Attach a screenshot of the GGUF Bridge compare-all table — it reads instantly.
- HF Trending favours Gradio/Streamlit; static Spaces rely on tags + forum presence,
  so the forum post matters more than for a typical Space.
