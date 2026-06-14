# TAF Agent v0.10 — announcement draft

Paste in the Space **Community** tab (pin it) and/or HF Forum **Show and Tell**
(`discuss.huggingface.co`). Reddit / X / LinkedIn variants below.

**Live Space**: https://huggingface.co/spaces/karlexmarin/taf-agent
**GitHub**: https://github.com/karlesmarin/tafagent

---

## 🔬 TAF Agent v0.10 — "what does your model's context length *actually* mean?" (free, browser-only)

The web is full of new long-context models — Mamba, RWKV, DeltaNet, Jamba, Zamba, Nemotron-H — all advertising big context numbers. But a "1M context" means something very different for a state-space model than for full attention. v0.10 adds three tools to cut through that, all running 100% in your browser (no inference, no signup):

- **🧠 Memory Reality Check** — paste a model id → it detects the architecture (full-attention / sliding-window / SSM-Mamba / RWKV / linear / test-time-training / hybrid) straight from `config.json` and tells you what its "context length" really means and how it fails. e.g. *state-space models read the whole stream but compress it into a fixed-size state — so exact needle-recall of an old token fails.* Detection validated against 13 live HF configs.
- **📊 Prediction vs Reality** — don't take the numbers on faith. Compare the tool's closed-form predictions against MEASURED values (the shipped dataset, or the JSON from the Diagnose CLI on your own weights), with a confidence score. And **contribute your measurement back** to the public dataset via a one-click PR — server-less, so it benefits everyone.
- **✅ Confidence score** on every verdict — a 0–100% rating with a ✓/⚠ evidence checklist (γ measured vs closed-form, validated regime, benchmark available). Predictions are never presented as absolute truth.

Also in v0.10: HF model-id autocomplete on every input, a manual reorganised into scannable cards, and an honest fix to the long-context verdict (we found and disclosed a tautology in our own closed-form horizon — `d_horizon ≡ T_eval` — see docs/LIMITATIONS.md).

27 modes total, 4 languages (EN/ES/FR/ZH), 37 Lean+Mathlib-verified identities, 0 telemetry.

**Try it**: https://huggingface.co/spaces/karlexmarin/taf-agent
Feedback welcome — especially if a prediction disagrees with your real measurement (that's exactly what Prediction-vs-Reality is for). Paper: https://zenodo.org/records/20314038

---

## Reddit (r/LocalLLaMA) variant

**Title (strongest first):**
1. *Your model says "1M context" — but if it's Mamba/RWKV/hybrid, what does that actually mean? Free browser tool that tells you (and why exact recall fails).*
2. *TAF Agent v0.10 — paste a model id, see what its context length really means: full-attention vs SSM vs RWKV vs hybrid. No GPU, no signup.*

**Body (TL;DR):**
> Free, browser-only, no signup. Paste an HF model id → it detects the architecture from config.json and tells you what its "context length" actually buys you and how it fails (e.g. why Mamba/RWKV miss an exact needle), plus a confidence score and a predicted-vs-measured check you can contribute back to a public dataset.
> Try: https://karlexmarin-taf-agent.static.hf.space/  ·  Source: https://github.com/karlesmarin/tafagent
> Issues / PRs / refutations welcome.

(Lead with the architecture hook; attach a screenshot of Memory Reality on `state-spaces/mamba-2.8b-hf`. Don't crosspost to r/MachineLearning the same day.)

## X / LinkedIn (1–2 lines)

> "1M context" means something very different for Mamba/RWKV than for full attention. TAF Agent v0.10 (free, browser-only) detects the architecture and tells you what your model's context length *actually* means + how it fails. https://huggingface.co/spaces/karlexmarin/taf-agent

---

## Posting checklist

- [ ] Space → Community tab → New discussion (pin it)
- [ ] discuss.huggingface.co → Show and Tell
- [ ] r/LocalLLaMA (use the variant above; screenshot of Memory Reality on a Mamba model)
- [ ] X / LinkedIn (1–2 lines + Space link + screenshot)
- [ ] Architecture-specific communities where it's genuinely useful: flash-linear-attention,
      Mamba / RWKV / state-space discussions — link Memory Reality specifically, never spam
- [ ] Cross-link from the Zenodo papers (TAF I/II) to the Space

## Tips

- Lead with the hook ("what does context length actually mean"), not the math.
- Memory Reality on a Mamba/RWKV model is the most shareable screenshot — it reads instantly.
- HF Trending favours Gradio/Streamlit; static Spaces rely on tags + forum presence, so the
  forum/Community post matters more than for a typical Space.
- Match the honest tone: free, no signup, no server, and it tells you when it's *not* sure.
