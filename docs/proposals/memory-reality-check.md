# Proposal — 🧠 Memory Reality Check (mode spec)

> Status: DESIGN / profile (not implemented). Author: Carles Marín + Claude, 2026-06-14.
> Browser-only (config.json + math, no inference). Composes with Unmask (SWA) and NIAH→Reason (full-attn).

## 1. The confusion it kills

HF advertises one number — "context length" — but it means **structurally different things** per
architecture, and users conflate them constantly on the forum:

> **Advertised context = how many tokens the model can READ.
> Effective recall = how many of them it can FIND AGAIN on demand.
> For fixed-state models these are very different numbers.**

The recurring forum pains:
1. "Says 128k/1M but fails past ~30k" (full-attention overclaim via positional decay).
2. "Is this new Mamba / RWKV / DeltaNet / Titans / hybrid actually good at long context?" (people don't
   know what "context" even means for a fixed-state model).
3. "Why does my linear-attention model fail needle-in-haystack / exact recall?" (it compresses; this is
   structural, not a bug — SR-TTT, arXiv:2603.06642).

No existing HF tool explains, per architecture, *what its context length actually means and how it
fails*. This mode does, from `config.json` alone.

## 2. The core explainer (in-line educational content — the heart of the mode)

Shown as an always-visible intro panel (collapsible "What does context length really mean?"):

> A transformer's **"context length"** is not one thing. It depends on how the model *stores* what it
> has read.
>
> **Full attention** (LLaMA, Qwen, Mistral-dense, GPT): every token can look directly at every other
> token. 128k context = 128k tokens in genuine *random-access* memory. The catch is **positional
> decay** — attention fades with distance, so the *effective* length where it still retrieves reliably
> is usually well below the advertised one (this is the "128k claimed, 64k effective" gap).
>
> **Linear attention / State-Space (Mamba, RWKV, GLA, RetNet):** the model reads the whole stream but
> compresses everything-seen-so-far into a **fixed-size state** — a matrix that does **not** grow with
> sequence length. So "1M context" means *"it can process a 1M-token stream"*, **not** *"it can recall
> any of those 1M tokens on demand."* It keeps a rolling, lossy summary. The honest analogy: reading a
> long book while keeping notes of a *fixed, bounded length* — you remember the gist, not every sentence
> verbatim. Predictable failure: pulling back one specific, arbitrary fact buried in the middle
> (needle-in-a-haystack, exact recall).
>
> **Test-time-training / delta-rule (DeltaNet, Gated DeltaNet, Titans, In-Place TTT):** same fixed-size
> state, but updated more cleverly *at inference* — it can overwrite and correct, so recall beats
> vanilla linear attention. Still bounded compression: *surprising / unique* tokens get overwritten
> fastest (the SR-TTT finding). Better at gist + recent detail; still weak at exact recall of old
> needles.
>
> **Hybrid (Jamba, Zamba, Nemotron-H, MiniMax):** a few full-attention layers interleaved among many
> linear/SSM layers. The **attention layers carry the real random-access recall**; the linear layers do
> cheap bulk processing. Effective recall ≈ what those few attention layers can hold.
>
> **Takeaway:** before trusting a long-context number, ask *which kind of memory is behind it.* This
> mode tells you, and names the failure mode to watch for.

Per-class tooltips (short, on the verdict tile) reuse the bolded sentences above.

## 3. Architecture taxonomy + EXACT detection from config.json

Reuse the existing config parser (the one that already reads `rope_theta`, GQA ratio, `sliding_window`).
Priority cascade — **first match wins**:

| # | Class | Detection markers (from `config.json`) | Extract |
|---|-------|----------------------------------------|---------|
| 1 | **HYBRID** | `model_type` ∈ {jamba, zamba, zamba2, nemotron_h, granitemoehybrid, bamba, falcon_h1, minimax} **OR** presence of a layer map: `layers_block_type` / `hybrid_override_pattern` / `attn_layer_indices` / `attention_layer_indices` | n_attn_layers / n_total |
| 2 | **SSM** (state-space) | `model_type` ∈ {mamba, mamba2, falcon_mamba, codestral_mamba} **OR** (`state_size`\|`d_state` **and** `conv_kernel`\|`d_conv` present **and** no `num_attention_heads`) | `d_state`, `d_inner`, n_layers |
| 3 | **RWKV** (linear-recurrent) | `model_type` startswith `rwkv` | hidden_size, version (5/6/7) |
| 4 | **LINEAR / TTT** | `model_type` ∈ {gla, retnet, delta_net, deltanet, gated_deltanet, rwkv7, lightning_attn, based, hgrn, hgrn2} **OR** any `architectures[]` name contains those **OR** flag `linear_attention`\|`use_linear_attention`\|`attn_type=="linear"` | subtype: delta/gated_delta/Titans → **TTT** (test-time-updated); else **LINEAR** |
| 5 | **SWA** (windowed full-attn) | `sliding_window` present & not null & `< max_position_embeddings` **OR** `layer_types` contains `sliding_attention` | window size → **defer to Unmask** for the number |
| 6 | **FULL** (default) | has `num_attention_heads` + softmax + (`rope_theta`\|alibi\|learned pos) | → **defer to γ / Unmask / NIAH→Reason** |
| 7 | **UNKNOWN** | none of the above | show manual checklist |

Detection is heuristic (config conventions vary); on low confidence, label "best-guess" and show the
markers used so the user can correct. Validate the marker table against ~10 real configs before ship.

## 4. Per-class output (verdict tile)

Each tile: **class badge · what its context means · failure mode · the benchmark that tests it · honest line**.

| Class | "Context" means | Failure mode to watch | Test that exposes it |
|-------|-----------------|-----------------------|----------------------|
| FULL | random access, but decays | effective < advertised | NIAH sweep + RULER multi-hop |
| SWA | hard window | nothing survives past the window | Unmask (already in tool) |
| SSM / LINEAR | fixed-state lossy summary | exact recall of arbitrary old token | NIAH (single-needle) |
| TTT / delta | updated lossy summary | surprising/unique-token recall | NIAH with hard distractors |
| HYBRID | recall = the few attn layers | recall capacity ≈ attn-layer budget | NIAH + per-layer probe |

**Compression-pressure indicator (honest, config-derived, fixed-state classes only):**
`pressure ≈ (advertised_context × d_model) / (n_layers × d_inner × d_state)` — order-of-magnitude ratio
of "tokens it claims to hold" vs "numbers in its fixed state." Higher = more aggressive compression =
higher exact-recall risk. **Explicitly labelled an order-of-magnitude indicator, NOT a guarantee** (the
mapping ratio→recall is empirical; we only flag the regime). Hidden for FULL/SWA (not applicable).

## 5. UX

- New tile in the recipe/inventory grid: **🧠 Memory Reality Check** — "what does this model's context
  length actually mean, and how does it fail?"
- Input: one model id (HF autocomplete, same as other modes). No length, no inference.
- Output: the intro explainer panel (collapsible) + the class verdict tile + failure mode + recommended
  test + (fixed-state only) compression-pressure indicator + honest-limits footer.
- Composes: if SWA → link to Unmask; if FULL → link to NIAH→Reason and the γ panel.

## 6. i18n keys (× EN/ES/FR/ZH; parity check enforces completeness)

```
memreal.title, memreal.tagline, memreal.intro.toggle, memreal.intro.body,
memreal.class.full, memreal.class.swa, memreal.class.ssm, memreal.class.linear,
memreal.class.ttt, memreal.class.hybrid, memreal.class.unknown,
memreal.means.<class>, memreal.failmode.<class>, memreal.test.<class>,
memreal.pressure.label, memreal.pressure.help, memreal.limits.body,
memreal.unknown.checklist, mode_desc.memreal, help.memreal.title, help.memreal.example,
inv.recipes.memreal.title, inv.recipes.memreal.body
```

## 7. Honest limits (surfaced in-tool footer)

- Classification is from config conventions → can mis-detect bespoke/renamed architectures (shows the
  markers it used; user can override).
- It gives the **structural failure mode** (derivable from architecture), **not** an exact effective
  length in tokens — that needs measurement (NIAH sweep / Diagnose CLI γ_obs). Same honesty rule as the
  d_horizon tautology fix: structural facts from config, measured numbers from the CLI.
- Compression-pressure is an order-of-magnitude regime flag, not a recall prediction.

## 8. Implementation notes

- New `js/memory_reality.js` (detection cascade + render) + i18n keys + one inventory/recipe tile.
- Reuse the existing config fetch + parser; add the marker checks above.
- No Python/Pyodide needed (pure config + arithmetic) → also works when Pyodide is still loading.
- Effort: medium. Tests: a `tests/` fixture of ~12 real configs (1 per class + edge cases) asserting
  the detected class — this doubles as the marker-table validation.
- Literature to cite in the help text: SR-TTT (2603.06642, recall failure of TTT), Mamba/RWKV/GLA
  (state-space), Jamba/Zamba/Nemotron-H (hybrid), the effective-context overclaim (RULER, 2402.10790).

## 9. Why this is the right addition

- Solves a real, frequent, **growing** HF confusion no tool addresses honestly.
- Browser-only, $0, on-brand (anti-bullshit), upgrades the current "SSM: γ doesn't apply" stub into a
  real mode.
- Honest: explains structural failure modes (config-derivable) and refuses to fake an exact number —
  consistent with the v0.9.x d_horizon-tautology honesty fix.

## 10. VALIDATION (2026-06-14) — refined rules from 13 live HF configs

Validated against real configs (fixture: `tests/fixtures/memory_reality_configs.json`). The marker
table was wrong in 3 ways that would have produced **false classifications**:

- **R1 — "has `num_attention_heads`" is NOT a full-attention signal.** RWKV-v6 declares
  `num_attention_heads: 64` yet is linear-recurrent. → **FULL = `model_type` allow-list + "nothing else
  matched"**, never "has heads". Detection order is: HYBRID → SSM → RWKV → LINEAR/TTT → SWA → FULL.
- **R2 — `sliding_window` present ≠ SWA.** Qwen2.5-7B sets `sliding_window=131072 (==max_pos)` and
  Qwen2.5-7B-Instruct-1M sets `sliding_window=32768` while serving 1.01M — both with
  **`use_sliding_window: false`**. → **SWA requires `sliding_window` non-null AND `< max_position_embeddings`
  AND `use_sliding_window != false`.** Without the third guard a 1M full-attention model is mis-tagged SWA.
- **R3 — fla-linear family secondary marker:** `attn_mode ∈ {chunk, fused_recurrent}` (seen on GLA,
  DeltaNet) confirms the linear/TTT class even when `model_type` is unfamiliar.
- **R4 — hybrid recall-layer count is per-family:**
  - Jamba: `floor(num_hidden_layers / attn_layer_period)` (e.g. 32/8 = **4** attention layers).
  - Zamba2: count `"hybrid"`/attention entries in the `layers_block_type` array.
  - Nemotron-H: count non-`M` tokens in the `hybrid_override_pattern` string (`"M-M-M-M*-..."`).
- **Gated configs** (gemma-2, Llama-3.1, gated_deltanet) return HTTP 401 → show "config gated, log in
  to HF or paste it", same as the tool's other modes. Not a detection failure.

## 11. Also clarifies (extra config confusions found during validation — fold in as side-flags)

These are common HF pains that fall out of the same config read; surface as small badges/notes, not new modes:

- **MoE total-vs-active.** `num_experts` + `num_experts_per_tok` (Qwen3-30B-**A3B**: 128 experts, 8 active;
  Jamba: 16/2). Badge: *"MoE — N total experts, k active per token → the '30B' runs like ~3B active."*
  Kills the recurring "why is my 30B so fast / why does VRAM not match params" confusion.
- **Ghost sliding window.** `sliding_window` set but `use_sliding_window: false` → note *"declares a
  window but it's disabled (full attention)."*
- **Extended context.** `rope_scaling` present (YaRN/NTK factor) **or** `max_position_embeddings` far above
  the trained length → note *"this length is EXTENDED, not native — extension ≠ free quality"* and link the
  YaRN Planner.
- **Tokens ≠ words.** One didactic line on every context number: *"128k tokens ≈ ~96k English words ≈
  ~50k for code — and that's what it READS, not necessarily what it recalls."*

## 12. Ease-of-use / didactic principles (the point of the mode)

Built to solve problems, but **usage must be effortless**:

- **One screen, one decision.** Paste a model id → a colour badge + ONE plain sentence + the concrete
  analogy + ONE recommended action. No length input, no inference, no jargon up front.
- **"What to do", not just "what's wrong".** Every verdict ends with a next step (run NIAH, use RAG for
  exact recall, expect gist-only, etc.).
- **Progressive disclosure.** Plain verdict first; the detection markers, layer counts, compression
  pressure, and citations live behind a collapsible "details / why" — present for the curious, invisible
  for the hurried.
- **Traffic-light per failure-risk** (green = random-access recall / red = lossy fixed-state recall) so
  the headline reads in one second.
- The big explainer panel (§2) is the didactic anchor; per-class tooltips reuse its bolded sentences so
  the teaching is consistent everywhere.
