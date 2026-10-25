# Guided demo review — 25 October 2026

**EN:** All 35 guided demos completed their tested flows in EN/ES/FR/ZH. This is a
dated interaction review, not a model benchmark or a promise of future availability.

**ES:** Las 35 demos completaron sus recorridos comprobados en EN/ES/FR/ZH. Es una
revisión de interacción fechada, no un benchmark ni una garantía de disponibilidad futura.

**FR :** Les 35 démos ont terminé les parcours testés en EN/ES/FR/ZH. Il s’agit d’une
vérification datée des interactions, pas d’un benchmark ni d’une garantie de disponibilité future.

**中文：** 35 个引导演示均在英、西、法、中四种语言下完成了所测试的流程。这是有日期的交互检查，不是模型基准测试，也不保证未来持续可用。

## What was checked

Tested source: [4ecd89b](https://github.com/karlesmarin/tafagent/commit/4ecd89b593030ae48c7fa14ae79f32e98a0faf1f).
The browser ran against a local copy of that source with real public dependencies,
including Pyodide, configuration/tokenizer downloads and GGUF header requests
where the demo uses them. Thirty-four demos were checked in four browser language
sessions (136 runs). Resolver was checked in the four-language resolver suite,
bringing the coverage to **35 demos × 4 languages**. The 35 entries include
supplementary guide, entropy and protocol demos; they are not 35 distinct app modes.

Checks covered demo completion and the relevant result or prepared interaction,
with no JavaScript errors observed during these tested demo flows. Result checks
excluded the final explanatory card so that it could not count as a computation.
Canvas/navigation demos were checked as interactions. Ask deliberately prepares
an example without starting a model download or inference. Resolver uses saved
or synthetic examples. The separate two research labs also passed their
four-language, keyboard and mobile checks.

[Compact coverage evidence](validation/demos-2026-10-25.json) lists all demo IDs,
languages and the two corrected test-environment issues. It is a derived summary,
not a full execution transcript or independently signed attestation.

## Coverage

All rows were checked in **English, Spanish, French and Chinese**.

| Group | Demo IDs |
|---|---|
| Guided help | resolver, guide, research, entropy, protocol |
| Configuration and planning | depth, profile, phase, unmask, memreal, yarn, inspector, recipe, compare, launch, fitcheck, gguf |
| Evaluation and evidence | contam, drift, longscore, saturation, arena, pvr, niah, quant |
| Formats and workflows | cot, diagnose, peft, cache, hub, adapter, template, speculative, tax, ask |

## Issues during the review

- The first Depth check targeted a nonexistent `#depth-summary` element. The
  test selector was corrected to `#depth-out`; all four language reruns passed.
  No application change was required for this issue.
- The first resolver-suite attempt hit browser `ERR_INSUFFICIENT_RESOURCES`;
  the local server also recorded `MemoryError`. The complete suite passed after
  reducing simultaneous browser work. This was a test-environment interruption.

The full resolver suite subsequently passed direct/local routes, guide return,
protocol checks, scenarios, progress, observations and the Fit Check demo.
Private-case, memory-import and Before/After tests were checked separately,
including public GitHub/HF copies and the ES/EN guide.

## Limits and repeating checks

This review does not validate scientific heuristics, model quality, a GPU memory
measurement, a repair, every possible input or every network-failure path.
External services and downloads can change. Existing narrated demos/videos do
not demonstrate the new memory-file import and Before/After controls; those flows
have dedicated browser tests and [written instructions](memory-measurement.md).

For the maintained resolver checks, start the static server with `python serve.py`,
set `TAF_URL=http://127.0.0.1:8000/`, and run `npm run test:resolver`.
`npm run test:fitcheck-demo`, `npm run test:memory-import` and
`npm run test:memory-pair` use the documented local browser fixtures by default.
Playwright and its Chromium browser must be installed. These commands cover their
named flows; they do not rerun the entire one-off 35-demo catalog audit.
For a fresh catalog review, run each demo button in each language and inspect its
actual result; the final completion card alone is insufficient.
