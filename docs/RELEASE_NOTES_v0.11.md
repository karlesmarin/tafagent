# TAF Agent v0.11 — Guided demos for every mode

> Release date: 2026-06-29. Browser-only, no inference, $0, EN/ES/FR/ZH.
> Live: https://karlesmarin.github.io/tafagent · HF Space: https://huggingface.co/spaces/karlexmarin/taf-agent

This release makes TAF Agent **self-teaching**: every one of the 28 modes now has a **🎬 Demo** button that runs a short, guided walkthrough — so a newcomer can watch the tool work, understand the result, and then repeat it with their own data. Fully localized in the four UI languages.

## 🎬 Guided in-app demos (all 28 modes)

A **🎬 Demo** button is injected into the header of every mode. Clicking it (or opening the app with `?demo=<mode>`) plays a guided simulation:

1. **Step banners** ("Step 1/N · …") narrate each action.
2. The relevant inputs are **filled and highlighted**, and the real buttons are clicked — using **open models** (Qwen / Phi) so there's no gated-model wall, or the mode's own example/sample buttons.
3. The mode produces its **real result** (nothing is faked — the same computation a user would get).
4. A persistent **"📊 What this tells you"** panel is appended next to the result, breaking it down **section by section in plain language** — including an honesty caveat (⚠) where the method has limits.

For multi-section results (e.g. the Profile TAF Card) the demo also **opens and tours each expandable section** (Recipes → Diagnostics → Verification → Provenance) so nothing stays hidden.

### Deep-links
Each demo is addressable: `https://karlesmarin.github.io/tafagent/?demo=<mode>` (e.g. `?demo=profile`, `?demo=quant`, `?demo=contam`). `?demo=1` is an alias for `profile`. The companion **field guide** ("Cómo Atienden los Transformers") deep-links its 🧪 *Try it* boxes straight into the matching demo.

## 🌍 Fully localized (EN / ES / FR / ZH)

All demo text (step banners + explanation panels) lives in a new `js/demo_i18n.js` (`DEMO_STRINGS` + `dt()`), separate from the core i18n table. **230 keys × 4 languages, 0 missing.** Translations were reviewed for idiom and consistency (no calques; e.g. ES "problemas" not "dolores", FR vouvoiement throughout, ZH "容差带" not "带宽" for *band*); standard technical terms (KV-cache, dtype, RoPE, θ, γ, chat-template, hit-ratio) are kept in English.

## ♿ Accessible & robust by design

- **Scroll-triggered, progressive enhancement:** if JavaScript or a network fetch is unavailable, the app still works normally — the demo is additive.
- **No new dependencies, no telemetry, browser-only** — same as the rest of TAF Agent.
- The heavier modes degrade gracefully: `ask` shows a *soft* demo (it does **not** download the 350 MB in-browser LLM), and the network/`gguf` demos use generous timeouts.

## 🔧 Under the hood

- Engine in `js/main.js`: a `DEMOS` registry (one entry per mode), `runDemoFor(mode)`, and `injectDemoButtons()` (buttons are injected by JS — `index.html` is untouched). Helper API for demo scripts: `mode / banner / hl / type / paste / closeAuto / select / reveal / click / expand / scrollText / hlText / waitText / sleep`, plus an optional `explainIn` for modes whose result renders in a separate section.
- Files changed: `js/main.js` (engine + 28 demo scripts) and the new `js/demo_i18n.js`.

## Honesty

The demos reproduce exactly what a user would get — they never fabricate numbers — and each explanation panel surfaces the same caveats as the underlying mode (γ_Padé is regime-bounded, `d_horizon` tautology in the no-inference path, forgetting bands are cited literature, contamination is an uncalibrated risk ranking, etc.). See [`docs/LIMITATIONS.md`](LIMITATIONS.md).
