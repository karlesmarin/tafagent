# Reviewed model examples — 2026-10-24

`data/model_catalog.json` contains eight public `config.json` snapshots pinned to
HF commit revisions, their source URLs and original-byte SHA-256 hashes. Two
restricted Gemma 3 configurations are recorded as **unverified** after HTTP 401;
no mirrored values are substituted in this catalog. This is a dated sample, not
a list of the newest or best models. It contains no weights or measurements.

Profile's optional **Reviewed model examples** panel works from these saved
snapshots. Select a model to see its source, configured context and architecture
limits. The two dense Qwen3 examples can populate Profile without contacting HF.
The older 11 presets remain reference scenarios, including architecture
simplifications; they are not retroactively certified by this review.

| Example | Automatic dense Profile import |
|---|---|
| Qwen3-0.6B, Qwen3-8B | Explicit dense RoPE geometry; theoretical estimates only |
| Qwen3-30B-A3B | Stopped: MoE total versus active weights |
| Qwen3.8-2.4T-A95B | Stopped: linear/full hybrid, MoE, partial RoPE |
| SmolLM3-3B | Stopped: layers without RoPE |
| DeepSeek-V3.2 | Stopped: MLA, sparse attention, MoE and scaled RoPE |
| gpt-oss-20b | Stopped: mixed windows, MoE and scaled RoPE |
| Ministral-3-3B-Instruct-2512 | Stopped: nested multimodal text backbone and scaled RoPE |
| Gemma-3-1b-it, Gemma-3-4b-it | Restricted configuration; not inspected |

The shared guard applies to automatic configuration imports in **Profile,
recipes, Inspector, Compare, Depth, Fit Check and Launch**. It conservatively
rejects missing or inconsistent geometry and architectures outside its reviewed
dense schema. This does not mean the model is defective or cannot run. Other
TAF modes have their own assumptions; no claim of universal compatibility is made.
Manual scenarios and historical presets remain available with their limitations.

## Two quantities that must not be conflated

The [Qwen3-8B card](https://huggingface.co/Qwen/Qwen3-8B) distinguishes the native
32,768-token reference from `max_position_embeddings=40960` and optional YaRN
extension. Both new presets use the card's **32,768** reference. Live config imports
use the **configured maximum provisionally**, clearly labelled; it is not evidence
of actual training sequence lengths. Verify `T_train` against the model's sources
before drawing conclusions. The two card parameter counts are rounded (0.6B/8.2B).

Live dense parameter estimates use explicit head dimensions, Q/K/V/O projections,
gated FFN dimensions and tied/untied embeddings. They exclude small norms/biases
and are estimates, not counts from weights. In particular Qwen3-0.6B declares
`head_dim=128`, although `hidden_size/num_attention_heads=64`. Neither active MoE
parameters nor packed safetensors element counts stand in for total model weights.

## Memory classification and stale inputs

Memory Reality reads nested `text_config`, recognizes explicit linear/full layer
maps and counts Qwen3.8's 23 full-attention layers out of 92. An unknown
`model_type` alone no longer implies full attention. These are configuration
observations, not measured recall capabilities.

Profile rejects running a newly entered or failed model with an earlier model's
form. Editing architecture inputs detaches the model; the manual-scenario button
does so explicitly. Depth and serving imports also reject incompatible configs.
No extra inference backend, automatic telemetry, benchmark refresh or new atlas
measurement is included in this update.

Tests: `node tests/model_compatibility.test.mjs`,
`node tests/model_review_browser.mjs`, and the existing regression suites.
