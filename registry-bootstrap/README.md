# 🌐 TAF Agent — Public Registry

> Community-curated archive of TAF (Thermodynamic Attention Framework) analyses
> for transformer LLMs. Submitted by users of [TAF Agent](https://karlesmarin.github.io/tafagent).

This repository **stores no code**. It exists purely as a **public Issues board**
where users of the TAF Agent web tool submit their model analyses for the
community to verify, refute, comment on, or reuse.

---

## How it works

1. A user runs the [TAF Agent](https://karlesmarin.github.io/tafagent) on a model
2. They click **📤 Submit to registry**
3. A new GitHub Issue opens with the analysis pre-filled in this repo
4. The user reviews, optionally adds a comment, and clicks Submit
5. The analysis becomes a permanent public record

---

## Browsing

- 📂 [All issues](https://github.com/karlesmarin/tafagent-registry/issues) —
  every submission ever made
- 🟢 [Verified](https://github.com/karlesmarin/tafagent-registry/issues?q=label%3Averified) —
  marked as independently verified
- 🔴 [Refuted](https://github.com/karlesmarin/tafagent-registry/issues?q=label%3Arefuted) —
  empirical measurement contradicts the prediction
- 🔍 Search by **input hash** to find existing analyses for the same config:
  e.g. `#8d29feb8` finds all analyses for the same model+T_eval+arch params

---

## The hash system (deduplication)

Every TAF analysis is hashed from its **canonical inputs**. Identical inputs
(same model, same T_eval, same flags) always produce the same 8-character
hex hash. Different inputs produce different hashes.

This means:
- **Searching `#a1b2c3d4`** finds all submissions for the exact same config
- **Independent verification** of an existing analysis = comment on the
  existing issue (not a new one)
- **Refutation** = reply with empirical evidence, the maintainers will add
  the `refuted` label
- **No duplicate spam**: contributors are nudged to search before submitting

---

## What submissions look like

Each issue follows the title pattern:
```
[TAF Profile] Meta-Llama-3-8B @ T=32000  #8d29feb8
[TAF X-2] Meta-Llama-3-8B → YES  #a1b2c3d4
[TAF Compare] X-2 × 3 models  #c5d6e7f8
```

Body contains the verdict, key numbers, and a collapsible JSON of the full
analysis chain. See any [recent issue](https://github.com/karlesmarin/tafagent-registry/issues)
for examples.

---

## Contributing

### To submit an analysis

Just run the [TAF Agent](https://karlesmarin.github.io/tafagent) and click
**📤 Submit to registry**. The form pre-fills everything.

### To verify an existing analysis

1. Find an issue (search by hash if you know one, or browse)
2. Run the same analysis yourself
3. If your result matches → comment "✅ Verified — [evidence link / setup details]"
4. A maintainer will add the `verified` label

### To refute a prediction

1. Find an issue with a verdict you disagree with
2. Run the **actual measurement** (not just TAF prediction) — e.g. for
   Long-Context (X-2), run NIAH evaluation on real GPU
3. Comment with:
   - Your measurement value + std
   - Hardware + software setup (vLLM version, GPU, etc.)
   - Repro recipe (script or command)
4. A maintainer will add the `refuted` label and link to your evidence

Refutations are first-class citizens here. The TAF framework is designed to
be falsifiable — if a prediction is wrong, we want to know.

### To propose a new recipe

Open an issue with title `[Proposal] X-NN — <name>` describing:
- The practical question the recipe answers
- The chain of formulas it would use
- An example use case

If the recipe is feasible, the maintainer adds it to the
[TAF Agent codebase](https://github.com/karlesmarin/tafagent) and labels
your issue `recipe-proposed`.

### To add a model preset

Open an issue with title `[Preset] <model-id>` listing:
- `rope_theta`, `max_position_embeddings`, `num_attention_heads`,
  `num_key_value_heads`, `head_dim`, `num_hidden_layers`, `n_params`,
  `has_SWA`
- A link to the model's HuggingFace page

These get bundled into the next release of TAF Agent.

---

## Labels

- `verified` — analysis independently confirmed by another user
- `refuted` — empirical measurement contradicts TAF prediction
- `recipe-proposed` — request for a new TAF recipe
- `preset-proposed` — request for a new model preset
- `discussion` — ongoing community discussion (no consensus yet)
- `question` — clarification request
- `frontier` — recently published model (< 1 month old) being evaluated

---

## What we DON'T accept

- Closed/proprietary model analyses without permission to share publicly
- API keys, tokens, or credentials of any kind
- Commercial advertisements or unrelated content
- Submissions without input hash in title (suggests not from the official tool)

---

## Code of conduct

- Be technical and specific. Disagreements are about the math, not people.
- Refutations require evidence. Opinions don't count, measurements do.
- Cite your sources (paper sections, GitHub commits, vendor docs).
- Assume good faith. Most "wrong" submissions are misunderstandings,
  not bad actors.

---

## License

Submissions are released under [CC0 (public domain dedication)](https://creativecommons.org/publicdomain/zero/1.0/)
unless otherwise noted by the contributor. The TAF Agent code itself is
[Apache-2.0](https://github.com/karlesmarin/tafagent/blob/main/LICENSE).

---

## Related

- 🔬 [TAF Agent web tool](https://karlesmarin.github.io/tafagent) — the diagnostic itself
- 📦 [TAF Agent source](https://github.com/karlesmarin/tafagent) — open source
- 📄 [Underlying paper](https://github.com/karlesmarin/NeurIPS) — Marin 2026,
  *Transformer Thermodynamics*

---

*Maintained by Carles Marin and the TAF community.*
