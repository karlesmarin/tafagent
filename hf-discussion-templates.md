# HF Discussion templates

Post in **Community → Discussions → New Discussion** of each model.
Use a variant — don't copy-paste identical text (looks like spam).

---

## Template 1 — Llama-3-8B / Llama-3.3-70B-Instruct

**Title**: TAF Agent: I built a free browser tool that predicts this model's long-context viability

**Body**:
```
Hi! I built TAF Agent, a free in-browser diagnostic for transformer LLMs.

I used it on this model and the prediction was:
[paste your X-2 verdict here, e.g. "YES at 32K with 33% margin, but DEGRADED at 64K"]

You can verify on your own model in 30s:
https://huggingface.co/spaces/karlexmarin/taf-agent
→ Profile mode → paste this model's id → Generate

Curious if anyone has measured NIAH retrieval on this model at long
contexts and if the predictions match. Falsifications welcome:
https://github.com/karlesmarin/tafagent-registry/issues

Built solo by an independent researcher; open source Apache-2.0;
$0/month forever (browser-side compute).
```

---

## Template 2 — Mistral-7B / Mistral-Small-3.1

**Title**: Tested this model in TAF Agent — interesting result on KV compression

**Body**:
```
Hey, I built a small browser tool that predicts viability of transformer
LLMs from their config. Ran it on this model:

X-2 (long context): [your verdict]
X-19 (KV compression): [your verdict — soft decay applies?]

The interesting part is that γ_Padé = [value] places this model in the
[Phase A / Phase B / borderline] regime per the underlying paper
(Marin 2026, "Predicting How Transformers Attend").

Try it: https://huggingface.co/spaces/karlexmarin/taf-agent

If you've measured this model empirically at long context and the
prediction is wrong, I'd love to know — refutations are first-class
citizens here:
https://github.com/karlesmarin/tafagent-registry/issues
```

---

## Template 3 — Qwen2.5-7B / Qwen2.5-32B / Qwen3

**Title**: Free browser diagnostic for transformer viability — ran on Qwen2.5

**Body**:
```
Built TAF Agent — a browser tool that predicts practical viability of
transformer LLMs (long-context, KV compression, hardware fit, etc.) from
config alone.

Ran it on this model. Quick observations:
- γ_Padé(T=32K) = [value] → [Phase classification]
- d_horizon = [value]
- For NIAH retrieval at 32K: [verdict]

Qwen2.5 has interesting design choices (high rope_theta, low n_kv) that
the framework analyzes nicely.

Tool URL: https://huggingface.co/spaces/karlexmarin/taf-agent
Source: https://github.com/karlesmarin/tafagent

If you've actually measured long-context retrieval on this model and the
prediction is off, please open a falsification issue:
https://github.com/karlesmarin/tafagent-registry
```

---

## Template 4 — Phi-3-mini / Phi-4

**Title**: TAF Agent diagnostic for this model

**Body**:
```
Tried this model in TAF Agent (browser-based viability diagnostic):

- Architecture class: [classification]
- Long-context verdict at [your target T]: [verdict]
- KV compression strategy: [recommendation]

This is a small/edge-friendly model — TAF identifies that it's well-suited
for [your context range].

Try it on your own deployment scenario:
https://huggingface.co/spaces/karlexmarin/taf-agent

100% browser-side, no auth, no rate limits, no cost.
```

---

## Template 5 — gemma-2-9b-it / gemma-2-27b-it

**Title**: Gemma's SWA architecture in TAF Agent — interesting Δγ signature

**Body**:
```
Built a browser diagnostic for transformer LLMs. Gemma family is
interesting because of the alternating SWA pattern.

Per the underlying framework (Marin 2026, "Predicting How Transformers Attend"),
SWA gives a distinctive Δγ ≈ +0.5 signature visible in attention
fingerprinting.

For this specific model:
- Architecture detected: [class]
- Verdict at [your T]: [verdict]
- KV compression recommendation: [strategy]

Tool: https://huggingface.co/spaces/karlexmarin/taf-agent

Can be useful before deployment to predict context-length behavior.
```

---

## Template 6 — SmolLM2-1.7B / Llama-3.2-1B (small models)

**Title**: TAF Agent works on small models too — good for edge inference planning

**Body**:
```
Built a free browser diagnostic for transformer LLMs. Just ran it on
this small model.

For edge / mobile / browser inference, the relevant questions are
different (latency-sensitive, memory-constrained). TAF Agent's hardware
recipe (X-5) gives concrete tok/s + $/Mtok numbers across consumer GPUs
and Apple Silicon.

For this model: [verdict on edge feasibility]

Tool: https://huggingface.co/spaces/karlexmarin/taf-agent

(Bonus: the tool ITSELF runs in browser via WebLLM with a small model.
So if you want to see how a 1B Instruct model handles tool-use synthesis,
it's the synthesis LLM by default.)
```

---

## Template 7 — DeepSeek-V3 / DeepSeek-V2-Lite

**Title**: DeepSeek architecture analyzed in TAF Agent

**Body**:
```
DeepSeek's MLA (Multi-head Latent Attention) is interesting — TAF Agent
classifies it under the GQA-like family for first-order analysis,
though MLA itself isn't natively in the framework yet.

Ran X-2 on this model: [verdict]
Ran X-1 (custom vs API): [verdict given DeepSeek's pricing]

URL: https://huggingface.co/spaces/karlexmarin/taf-agent

DeepSeek's API pricing makes interesting math for cost recipes — the
break-even calculations show very different results vs frontier US APIs.

Source: https://github.com/karlesmarin/tafagent
```

---

## Tips para postear sin parecer spam

1. **Personaliza** — cada post menciona algo específico del modelo
2. **Aporta valor** — no solo "look at my tool", sino observación concreta del análisis
3. **Pide feedback genuino** — preguntas, falsificaciones, confirmaciones
4. **Espacia los posts** — no postees los 8 en 10 minutos. Uno cada 2-3h
5. **Responde si comentan** — engagement real, no fire-and-forget
6. **No prometas lo que no es** — no es benchmark, no es leaderboard
7. **Reconoce los limites del tool** — humildad

## En qué ORDEN recomiendo postear

Día 1:
- HF Posts announcement (template separado)
- 1-2 model discussions (empezar con SmolLM2 o phi-3 — comunidad menos competitiva)

Día 2-3:
- 2-3 más (Llama-3-8B, Mistral, Qwen)

Semana 1+:
- Engage con comentarios
- Submit ANALYSIS results del registry como proof
- Ir respondiendo dudas

## Si alguien refuta la predicción

¡Genial! Eso es **exactamente lo que queremos** para validar el framework.

Respuesta tipo:
> "Thanks for the falsification — please open an issue in the registry with your
> setup details so it's permanently logged. The framework is designed to be
> falsifiable; refutations help us bound validity zones better."

Link: https://github.com/karlesmarin/tafagent-registry/issues/new?template=refutation.md
