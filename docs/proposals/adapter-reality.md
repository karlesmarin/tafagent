# Proposal — 🔌 Adapter Reality Check (mode spec)

> Status: DESIGN / profile (not implemented). Author: Carles Marín + Claude, 2026-06-28.
> Browser-only (`adapter_config.json` + KB lookup + arithmetic, no inference).
> First real consumer of the (currently unwired) `forgetting_lit_explorer.js` + `data/forgetting_kb.json`.
> Composes with: Memory Reality (base arch), PEFT Anti-Pattern (code linter), Forgetting Lit Explorer (raw KB).

## 1. The pain it kills

A user downloads a published LoRA/PEFT adapter from the Hub to stack on a base model. Two recurring,
expensive confusions, neither addressed by any HF tool:

1. **"Will it even load on my base?"** — `base_model_name_or_path` mismatch, wrong `target_modules`,
   arch incompatibility, embedding-resize (`modules_to_save`) surprises → silent wrong-base loads or
   crashes (the PEFT #2115 family, but for a *published* adapter, not the user's training code).
2. **"How much will it make the base forget?"** — people pick `r` blindly. The literature
   (Biderman 2024 *LoRA Learns Less and Forgets Less*; SMoLoRA; rank-tradeoffs 2025) shows rank and
   domain drive a wide forgetting range. No tool maps a *concrete adapter's* rank to that evidence.

Today `peft_anti_pattern.js` lints **your training code**; `forgetting_lit_explorer.js` queries the KB
with **manual filters**. Neither reads a **real published adapter** and tells you, from its config alone,
*will this load* and *what does the evidence say it forgets*. This mode does.

## 2. Browser-only signal: `adapter_config.json`

Fetched from the Hub exactly like the existing modes fetch `config.json` (HF autocomplete on the input;
gated → "log in / paste it" fallback; paste-raw-JSON textarea like memreal/pvr). Fields read (PEFT schema):

| Field | Use |
|-------|-----|
| `peft_type` | LORA / ADALORA / DORA / IA3 / LOHA / LOKR / VERA / PROMPT_TUNING / … — gates which checks apply |
| `r` | rank → forgetting bucket + α/r scaling |
| `lora_alpha` | with `r` → effective scaling `α/r` (or `α/√r` if `use_rslora`) |
| `target_modules` | compatibility: attention-only vs MLP-inclusive; empty/odd → warn |
| `base_model_name_or_path` | base match + family mapping for the KB |
| `modules_to_save` | embed_tokens/lm_head present → embedding resize → merge/tokenizer caveat |
| `task_type` | CAUSAL_LM vs SEQ_CLS etc. — must match intended use |
| `use_rslora`, `use_dora` | change the scaling/quality story → notes |
| `bias`, `fan_in_fan_out`, `init_lora_weights` | minor sanity notes |
| `rank_pattern`, `alpha_pattern` | per-layer overrides → "non-uniform rank" note |

Non-LoRA `peft_type` (prompt/prefix tuning, IA3) → no `r`: skip the forgetting band, keep compatibility +
an honest "this adapter type isn't rank-based; forgetting evidence N/A" note.

## 3. Output (verdict tile) — three blocks

**A. Compatibility** (traffic-light)
- Base match: does `base_model_name_or_path` match the base the user names (optional 2nd input)? exact /
  same-family / mismatch / unknown.
- `target_modules` sanity vs detected family (e.g. llama expects `q,k,v,o,gate,up,down_proj`); attention-only
  vs full → note (affects both quality and forgetting).
- α/r scaling: flag extreme ratios (`α/r` ≫ 4 or ≪ 0.25) as aggressive/weak.
- `modules_to_save` embeddings → "resizes embeddings: tokenizer must match; affects merge."

**B. Forgetting band** (from the KB — the evidence, not a prediction)
- Map `r` → `rankBucket` (`low ≤16` · `med 17–128` · `high >128`), `base` → `family`, then call the existing
  `queryKB({ family, rankBucket })`. Render the returned Δpp **range + median + n + citations**, and reuse the
  module's existing honest warnings (`high_variance`, `sign_mixed`, `consistent_forgetting`, redflag anchors).
- If the KB has 0 matches for that (family, bucket): say so and broaden (family→any) with a clear "evidence
  is from related setups" label. **Never fabricate a number.**

**C. Merge & deploy sanity**
- LoRA → mergeable (note `merge_and_unload` caveats: `use_dora`, `modules_to_save`, quant base).
- Reminder: forgetting is measured on the *merged/served* model; the band is **illustrative from literature**,
  not a measurement of THIS adapter (honest-limits footer).

## 4. UX (one screen, one decision)

- New tile: **🔌 Adapter Reality** — "will this LoRA load on my base, and what does the evidence say it forgets?"
- Inputs: adapter model-id (HF autocomplete) **or** raw `adapter_config.json` paste; optional base model-id.
- Output: the three blocks above; progressive disclosure (markers/citations behind a collapsible "why").
- Composes: base arch → link Memory Reality; training-code worries → link PEFT Anti-Pattern; raw evidence →
  link Forgetting Lit Explorer (which this mode finally surfaces).

## 5. Implementation notes

- New `js/adapter_reality.js`: pure `parseAdapterConfig(json)` + `compatChecks(cfg, baseId?)` +
  `forgettingBand(cfg)` (wraps `loadForgettingKB` + `queryKB`). No human strings (codes+params), i18n in main.js
  — same shape as `forgetting_lit_explorer.js` / `json_cot_linter.js`.
- `main.js`: `initAdapter()` (lazy, like other modes) + render + autocomplete attach + one inventory/recipe tile.
- `index.html`: one `<section id="adapter-section">` with the two inputs + run button + results div.
- `js/i18n.js`: `adapter.*` keys (title, tagline, inputs, the three block headers, each compat code, each
  forgetting verdict/warning reuse from the existing forgetting keys where possible, honest-limits) × EN/ES/FR/ZH.
  **i18n parity check enforced (4/4).**
- `data/forgetting_kb.json`: unchanged (reused). This mode finally wires it in.
- Tests: `tests/adapter_reality.test.mjs` — fixtures of ~6 real `adapter_config.json` (LoRA r=8/64/256, a
  DoRA, an IA3/prompt-tuning, a `modules_to_save` embedding case) asserting parse + bucket + compat codes.

Effort: **medium** (bigger than the BEC badge: new section + 4-lang i18n + tests). Self-contained.

## 6. Honest limits (surfaced in-tool footer)

- The forgetting band is **literature evidence keyed by rank/family**, NOT a measurement of THIS adapter.
  Same honesty rule as the BEC badge and the d_horizon tautology fix: config-derivable facts vs measured numbers.
- Base-match is by string/family heuristic; renamed/merged bases can mis-detect (shows what it matched).
- KB is small (25 datapoints, 4 papers) → bands are wide and flagged high-variance by design. That honesty IS
  the feature (the lit itself shows magnitude is variance-dominated).

## 7. Why this is the right next addition

- Solves a real, frequent, growing pain (everyone stacks adapters) browser-only, $0, on-brand.
- **Activates dormant work**: surfaces the unwired forgetting KB + module through a concrete, useful entry point.
- Materializes Part III "Future Work #2" (catastrophic forgetting / frozen subspaces) as a shipping tool.
- Honest by construction: refuses to fake a per-adapter number; shows the evidence range + citations.
