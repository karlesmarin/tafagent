// Chat-template sniffer (v0.7.1 anti-bullshit pack #2)
// Parses tokenizer_config.json and detects which chat-template family the
// model uses. Pure logic — no human-readable strings. main.js renders via i18n.
//
// Why this matters: lm-eval-harness applied via vLLM-served API auto-applies
// the chat_template; local `hf`/`vllm` mode does NOT. This silently halves
// accuracy on multi-turn evals. Issue #1841 in lm-evaluation-harness.

// Distinctive markers per family. Order matters: more specific first.
const FAMILIES = [
  {
    id: "llama-3",
    label: "Llama-3 instruct",
    // begin_of_text uses bos_token variable in real templates, not literal —
    // these two are the reliable signature.
    markers: ["<|start_header_id|>", "<|eot_id|>"],
    chatTemplateName: "llama-3",
    vllmTemplate: "examples/template_llama_3.jinja",
  },
  {
    id: "chatml",
    label: "ChatML (Qwen, OpenAI-style)",
    markers: ["<|im_start|>", "<|im_end|>"],
    chatTemplateName: "chatml",
    vllmTemplate: "examples/template_chatml.jinja",
  },
  {
    id: "mistral",
    label: "Mistral instruct",
    markers: ["[INST]", "[/INST]"],
    chatTemplateName: "mistral",
    vllmTemplate: "examples/template_mistral.jinja",
  },
  {
    id: "gemma",
    label: "Gemma",
    markers: ["<start_of_turn>", "<end_of_turn>"],
    chatTemplateName: "gemma",
    vllmTemplate: "examples/template_gemma.jinja",
  },
  {
    id: "phi-3",
    label: "Phi-3",
    markers: ["<|user|>", "<|assistant|>", "<|end|>"],
    chatTemplateName: "phi-3",
    vllmTemplate: "examples/template_phi3.jinja",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    // DeepSeek uses full-width unicode bars (U+FF5C). Check the codepoint
    // explicitly so source files staying ASCII-safe still match.
    markers: ["｜User｜", "｜Assistant｜"],
    chatTemplateName: "deepseek",
    vllmTemplate: null,
  },
  {
    id: "alpaca",
    label: "Alpaca",
    markers: ["### Instruction:", "### Response:"],
    chatTemplateName: "alpaca",
    vllmTemplate: null,
  },
];

export function sniffChatTemplate(tokenizerConfig) {
  const out = {
    hasChatTemplate: false,
    rawTemplate: null,
    rawTemplateLength: 0,
    detectedFamily: null,
    detectedLabel: null,
    chatTemplateName: null,
    vllmTemplate: null,
    addGenerationPromptDetected: false,
    matchedMarkers: [],
    verdict: "unknown",   // ok | custom | missing | base_model | unknown
    warnings: [],         // each: { code, params }
  };

  const tpl = tokenizerConfig?.chat_template;
  if (typeof tpl === "string" && tpl.length > 0) {
    out.hasChatTemplate = true;
    out.rawTemplate = tpl.length > 600 ? tpl.slice(0, 600) + "…" : tpl;
    out.rawTemplateLength = tpl.length;
    out.addGenerationPromptDetected = /add_generation_prompt/.test(tpl);

    // Try each family in order. Match if ALL markers are present in the template.
    for (const fam of FAMILIES) {
      const hits = fam.markers.filter(m => tpl.includes(m));
      if (hits.length === fam.markers.length) {
        out.detectedFamily = fam.id;
        out.detectedLabel = fam.label;
        out.chatTemplateName = fam.chatTemplateName;
        out.vllmTemplate = fam.vllmTemplate;
        out.matchedMarkers = hits;
        out.verdict = "ok";
        break;
      }
    }
    if (!out.detectedFamily) {
      out.detectedFamily = "custom";
      out.detectedLabel = null;
      out.verdict = "custom";
      out.warnings.push({ code: "custom_template", params: { length: out.rawTemplateLength } });
    }
  } else {
    // No chat_template at all — typical for base / pretrained-only models.
    // Could still be a legitimate base model, so verdict depends on caller intent.
    out.verdict = "missing";
    out.warnings.push({ code: "no_chat_template", params: {} });
  }

  // Universal warning: lm-eval-harness silent halving.
  if (out.hasChatTemplate) {
    out.warnings.push({ code: "lm_eval_apply", params: {} });
  }
  // vLLM warning if template requires explicit --chat-template flag
  if (out.hasChatTemplate && out.detectedFamily !== "alpaca" && out.detectedFamily !== "deepseek") {
    out.warnings.push({ code: "vllm_apply", params: { name: out.chatTemplateName ?? "auto" } });
  }

  return out;
}
