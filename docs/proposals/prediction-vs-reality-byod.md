# Proposal — 📊 Prediction vs Reality + Bring-Your-Own-Data (BYOD) + community

> Status: DESIGN. The honest, server-less version of the external-review "#1 auto-run benchmarks"
> (which is impossible browser-only) + Carles's community angle. Builds on Confidence (#5).

## The constraint that shapes everything

Browser-only, **no inference, no server, $0**. So the tool can NOT run RULER/NIAH itself.
What it CAN do: compare its closed-form predictions against **measurements the user already has**
(or that live in the shipped dataset), and let the user **contribute their measurement back** via a
PR to the public dataset — no backend needed.

## 1. Prediction vs Reality (per model)

A panel that, for a model, shows TAF's prediction next to a measured value when one is available:

| Metric | TAF prediction | Measured | Δ | Source |
|--------|----------------|----------|---|--------|
| γ | 0.91 | 0.94 | +0.03 | dataset / your CLI |
| Effective ctx | 64k | 58k | −6k | RULER (published) |
| KV @90% | 2.2× | 2.0× | −0.2× | your run |

Measured values come from three honest sources (in priority order):
1. **Shipped dataset** — `data/` already has measured γ_obs for 33 models (the paper's dataset).
2. **User-supplied** — the user pastes a Diagnose-CLI JSON, or types a measured γ_obs / RULER score.
3. **Harvested published benchmarks** — a small curated table (In-Place TTT, RULER paper, etc.), like
   the Stage-0 harvest, shipped as static JSON.

When a measurement exists, the **Confidence (#5) flips `benchmark_no → benchmark_yes`** automatically,
so reality-checking a prediction visibly raises its confidence. That closes the loop the review wanted.

## 2. Bring-Your-Own-Data (the input path)

A small form / drag-drop:
- Paste the JSON the **Diagnose CLI** emits (it already produces `gamma_obs`, `R²`, thermo profile).
- Or paste a config.json **plus** a measured number (γ_obs, RULER@L, NIAH%).
- The tool validates it against the dataset schema and renders the Prediction-vs-Reality table for it.

Everything stays in the browser. Their data never leaves unless they choose to contribute (next).

## 3. Contribute back (community, server-less)

The honest server-less mechanism: the tool **generates a ready-to-submit record** in the dataset schema
and gives a one-click path to submit it as a **PR / HF dataset contribution** to the public repo
(`karlexmarin/taf-attention-decay` on HF + GitHub):

- Button: "➕ Contribute this measurement" → produces the JSON record + opens the HF dataset
  "Add file / discussion" or a prefilled GitHub PR link.
- Maintainer (Carles) reviews + merges. Merged records ship in the next dataset version → **every user's
  tool then shows them** (the dataset is bundled). So one user's measurement benefits all.
- This is a feature, not a bug: PR review keeps the dataset clean (anti-bullshit ethos). No server, no
  spam surface, no cost.

Optional later: "Load a community dataset URL" to compare against a shared/forked measurement set.

## 4. Honest framing (surfaced in-tool)

- "Measured" must always show its **source + date** (dataset / your CLI / published) — never blur a
  measurement with a prediction.
- A measurement is a single data point under one protocol; the tool notes the protocol (e.g. γ_obs
  measured on random vs natural text — the C1 raw/softmax caveat already exists).
- Contribution is opt-in and goes through human review; nothing auto-uploads.

## 5. Reuse / effort

- Reuse: the shipped `data/` dataset, the Diagnose CLI JSON format, `padé_deviation_index` (γ_obs→PDI),
  the Confidence engine (#5), the config-fetch plumbing.
- New: a `js/prediction_reality.js` (load dataset + match measured + diff vs prediction), a BYOD form,
  a contribution-record exporter (JSON + PR/HF link), i18n ×4.
- Effort: medium. No new compute, no server. Tests: dataset-match + diff + record-schema validation.

## 6. Why this is the right version of review-#1

The review's "app auto-runs RULER/NIAH" would force a server+GPU and kill the tool's reason to exist.
This delivers the same payoff — *predictions you can check against reality, growing a shared truth set* —
with zero inference, zero server, zero cost, and a cleaner honesty story (measured vs predicted, sourced).
