---
name: ➕ Add new model preset
about: Add a popular/recent model to the curated preset list
title: '[Preset] '
labels: preset-proposed
---

## Model id

Full HuggingFace path: `__/__`

Link: https://huggingface.co/__

## Why this model deserves a preset

E.g. recently released, widely used, fills a gap in the current panel
(unique architecture combination, etc.)

## Config values

Paste from the model's `config.json`:

```json
{
  "rope_theta": __,
  "max_position_embeddings": __,
  "num_attention_heads": __,
  "num_key_value_heads": __,
  "hidden_size": __,
  "num_hidden_layers": __,
  "head_dim": __  (or computed from hidden_size / num_attention_heads),
  "sliding_window": __ or null,
  "model_type": "__"
}
```

## Parameter count

Total params: __ (from model card)

## Architecture family

- [ ] RoPE-MHA
- [ ] RoPE-GQA
- [ ] ALiBi
- [ ] AbsPE
- [ ] SWA
- [ ] SSM
- [ ] Other: __

## Anything unusual

E.g. uses MLA, custom rotary, alternating SWA layers, etc.
