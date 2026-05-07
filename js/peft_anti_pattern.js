// PEFT Anti-Pattern Checker (v0.8.3 anti-bullshit pack #9)
//
// Static linter for PEFT / LoRA training code paths. Targets the most
// expensive bugs the community has documented: silent base-model loads
// (peft #2115), QLoRA ordering errors, and arch/target_modules mismatch.
//
// Pain (Solutions Hub `peft_loading`): `get_peft_model()` called before
// `PeftModel.from_pretrained()` silently loads the base model and a
// FRESH adapter, ignoring the user's saved LoRA weights. Hours of
// training thrown away with no error.
//
// Source citations:
//   - peft #2115 — original silent-load bug
//   - https://huggingface.co/docs/peft/main/en/developer_guides/troubleshooting
//   - PEFT `get_layer_status() / get_model_status()` runtime check
//
// Pure logic — no human strings. Returns codes+params; main.js does
// the i18n lookup. Same shape as json_cot_linter.js.

// =============================================================================
// Token/pattern definitions
// =============================================================================

// Rough comment + string stripping. NOT a real Python parser; we only
// need to remove obvious noise so regex matches don't fire inside
// docstrings or commented-out code. Anything still in scope after this
// is treated as "live" Python.
function stripCommentsAndStrings(code) {
  // Remove triple-quoted strings (greedy match across newlines)
  let s = code.replace(/"""[\s\S]*?"""/g, "");
  s = s.replace(/'''[\s\S]*?'''/g, "");
  // Remove single-line strings (but keep the line so line numbers stay valid)
  s = s.replace(/"(?:\\.|[^"\\\n])*"/g, '""');
  s = s.replace(/'(?:\\.|[^'\\\n])*'/g, "''");
  // Remove `# ...` comments to end of line
  s = s.replace(/#[^\n]*/g, "");
  return s;
}

function findFirstMatchLine(stripped, pattern) {
  const lines = stripped.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) return i + 1; // 1-indexed
  }
  return null;
}

function findAllMatchLines(stripped, pattern) {
  const out = [];
  const lines = stripped.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) out.push(i + 1);
  }
  return out;
}

// Extract STRING LITERALS from the ORIGINAL code (we kept them in the
// raw text so we can scan their contents for adapter/checkpoint hints).
// Returns array of { value, line }.
function extractStringLiterals(code) {
  const out = [];
  const re = /(["'])((?:\\.|(?!\1)[^\\\n])*)\1/g;
  const lines = code.split("\n");
  let lineStart = 0;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let m;
    re.lastIndex = 0;
    const lineRe = new RegExp(re.source, re.flags);
    while ((m = lineRe.exec(line)) !== null) {
      out.push({ value: m[2], line: lineIdx + 1 });
    }
  }
  return out;
}

// Extract `target_modules=[...]` literal lists. Returns array of
// { modules: [..], line }. Best-effort; only catches literal lists.
function extractTargetModules(code) {
  const out = [];
  const re = /target_modules\s*=\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const inner = m[1];
    const modules = (inner.match(/["']([^"']+)["']/g) || []).map(s => s.slice(1, -1));
    // Compute line number
    const before = code.slice(0, m.index);
    const line = before.split("\n").length;
    out.push({ modules, line });
  }
  return out;
}

// Extract `r=N` and `lora_alpha=N` from the same call site. Best-effort.
function extractLoraConfig(code) {
  const out = [];
  // Find LoraConfig(...) calls and capture the args block (single-line or balanced).
  const re = /LoraConfig\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const args = m[1];
    const r = args.match(/\br\s*=\s*(\d+)/);
    const alpha = args.match(/lora_alpha\s*=\s*(\d+)/);
    const before = code.slice(0, m.index);
    const line = before.split("\n").length;
    out.push({
      r: r ? parseInt(r[1], 10) : null,
      lora_alpha: alpha ? parseInt(alpha[1], 10) : null,
      line,
    });
  }
  return out;
}

// =============================================================================
// Architecture → conventional target_modules
// =============================================================================

// Mapping built from public PEFT docs + transformers configs. Conservative:
// only architectures with stable, well-documented module names. When the
// user's target_modules don't match the listed arch family, we flag it.
const ARCH_TARGET_MODULES = {
  llama:   ["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
  mistral: ["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
  qwen2:   ["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
  phi:     ["q_proj","k_proj","v_proj","dense","fc1","fc2"],
  phi3:    ["qkv_proj","o_proj","gate_up_proj","down_proj"],
  gemma:   ["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
  falcon:  ["query_key_value","dense","dense_h_to_4h","dense_4h_to_h"],
  bloom:   ["query_key_value","dense","dense_h_to_4h","dense_4h_to_h"],
  gpt2:    ["c_attn","c_proj","c_fc"],
  gptneox: ["query_key_value","dense","dense_h_to_4h","dense_4h_to_h"],
  mpt:     ["Wqkv","out_proj","up_proj","down_proj"],
};

// Token hints in HF model ids that map to the keys above. Any one of
// these matching is enough to claim "the user is targeting arch X".
const ARCH_ID_HINTS = {
  llama:   /\b(?:llama|llama-?[123]|tinyllama|vicuna|alpaca|deepseek|mixtral)\b/i,
  mistral: /\bmistral\b/i,
  qwen2:   /\bqwen2?\b/i,
  phi:     /\bphi-?[12]\b/i,
  phi3:    /\bphi-?3\b/i,
  gemma:   /\bgemma\b/i,
  falcon:  /\bfalcon\b/i,
  bloom:   /\bbloom\b/i,
  gpt2:    /\bgpt-?2\b/i,
  gptneox: /\b(?:gpt-?neox|pythia|dolly)\b/i,
  mpt:     /\bmpt\b/i,
};

function detectArch(stringLiterals) {
  for (const lit of stringLiterals) {
    for (const [arch, hint] of Object.entries(ARCH_ID_HINTS)) {
      if (hint.test(lit.value)) {
        return { arch, source: lit.value, line: lit.line };
      }
    }
  }
  return null;
}

// =============================================================================
// Heuristics for detecting "this string is a saved adapter checkpoint path"
// =============================================================================

const CHECKPOINT_HINT_RE =
  /(?:adapter[_-]?(?:config|model)|adapter\.safetensors|adapter_model\.bin|peft[_-]?model|lora[_-]?weights?|checkpoint(?:[-_/]\d+)?|\boutput[_-]?dir\b|trained?[_-]?lora)/i;

function findAdapterCheckpointHint(stringLiterals) {
  for (const lit of stringLiterals) {
    if (CHECKPOINT_HINT_RE.test(lit.value)) return lit;
  }
  return null;
}

// =============================================================================
// Public entry point
// =============================================================================

const RULES = {
  // Strong correctness issues — almost certainly a bug
  silent_base_load: { severity: "error" },
  qlora_order:      { severity: "error" },
  target_modules_mismatch: { severity: "warning" },
  // Optional / informational
  alpha_not_2r:     { severity: "info" },
  no_peft_calls:    { severity: "info" },
};

export function lintPeftCode(text) {
  if (typeof text !== "string" || !text.trim()) {
    return { code: "empty_input", findings: [] };
  }

  const stripped = stripCommentsAndStrings(text);

  // Bail if no PEFT-related calls at all — unhelpful otherwise.
  const hasGetPeftModel    = /\bget_peft_model\s*\(/.test(stripped);
  const hasFromPretrained  = /\bPeftModel\s*\.\s*from_pretrained\s*\(/.test(stripped);
  const hasPrepareKbit     = /\bprepare_model_for_kbit_training\s*\(/.test(stripped);
  const hasLoraConfig      = /\bLoraConfig\s*\(/.test(stripped);
  const hasBnbConfig       = /\bBitsAndBytesConfig\s*\(/.test(stripped);

  if (
    !hasGetPeftModel &&
    !hasFromPretrained &&
    !hasPrepareKbit &&
    !hasLoraConfig
  ) {
    return {
      code: "no_peft_calls",
      findings: [{
        rule: "no_peft_calls",
        severity: "info",
        line: null,
        params: {},
      }],
    };
  }

  const findings = [];
  const stringLiterals = extractStringLiterals(text);

  // ─── Rule A: silent base-model load (peft #2115) ─────────────────────────
  // Pattern: `get_peft_model(...)` is the only model-creation path AND
  // there's a string literal that looks like a saved adapter path.
  // Likely user wants to LOAD a saved adapter but is creating a new one.
  if (hasGetPeftModel && !hasFromPretrained) {
    const hint = findAdapterCheckpointHint(stringLiterals);
    if (hint) {
      const getPeftLine = findFirstMatchLine(stripped, /\bget_peft_model\s*\(/);
      findings.push({
        rule: "silent_base_load",
        severity: "error",
        line: getPeftLine,
        params: {
          checkpoint_hint: hint.value,
          checkpoint_line: hint.line,
          fix: `PeftModel.from_pretrained(base_model, ${JSON.stringify(hint.value)})`,
        },
      });
    }
  }

  // ─── Rule B: QLoRA ordering — prepare_model_for_kbit_training AFTER get_peft_model ──
  if (hasPrepareKbit && hasGetPeftModel) {
    const prepLine = findFirstMatchLine(stripped, /\bprepare_model_for_kbit_training\s*\(/);
    const peftLine = findFirstMatchLine(stripped, /\bget_peft_model\s*\(/);
    if (prepLine !== null && peftLine !== null && prepLine > peftLine) {
      findings.push({
        rule: "qlora_order",
        severity: "error",
        line: prepLine,
        params: {
          prepare_line: prepLine,
          get_peft_model_line: peftLine,
        },
      });
    }
  }

  // ─── Rule C: target_modules / arch mismatch ─────────────────────────────
  const targetModuleCalls = extractTargetModules(text);
  const detectedArch = detectArch(stringLiterals);
  if (targetModuleCalls.length > 0 && detectedArch !== null) {
    const expected = ARCH_TARGET_MODULES[detectedArch.arch];
    if (expected) {
      const expectedSet = new Set(expected);
      for (const tm of targetModuleCalls) {
        if (tm.modules.length === 0) continue;
        const hits = tm.modules.filter(m => expectedSet.has(m)).length;
        const ratio = hits / tm.modules.length;
        // Less than half of user's specified modules are in the expected list.
        if (ratio < 0.5) {
          findings.push({
            rule: "target_modules_mismatch",
            severity: "warning",
            line: tm.line,
            params: {
              user_modules: tm.modules,
              detected_arch: detectedArch.arch,
              detected_from: detectedArch.source,
              expected_modules: expected,
              hits,
              total: tm.modules.length,
            },
          });
        }
      }
    }
  }

  // ─── Rule D: lora_alpha ≠ 2*r convention ────────────────────────────────
  // Common rule of thumb: alpha = 2*r gives roughly unit-scale LoRA.
  // alpha = r is also seen but reduces effective LR. Anything else is
  // worth surfacing as info.
  const loraCfgs = extractLoraConfig(text);
  for (const cfg of loraCfgs) {
    if (cfg.r != null && cfg.lora_alpha != null) {
      const ratio = cfg.lora_alpha / cfg.r;
      if (ratio !== 1 && ratio !== 2) {
        findings.push({
          rule: "alpha_not_2r",
          severity: "info",
          line: cfg.line,
          params: {
            r: cfg.r,
            lora_alpha: cfg.lora_alpha,
            ratio: Math.round(ratio * 100) / 100,
          },
        });
      }
    }
  }

  // ─── Aggregate verdict code ──────────────────────────────────────────────
  let code;
  if (findings.length === 0) {
    code = "clean";
  } else if (findings.some(f => f.severity === "error")) {
    code = "errors_found";
  } else if (findings.some(f => f.severity === "warning")) {
    code = "warnings_only";
  } else {
    code = "info_only";
  }
  return { code, findings, summary: { total: findings.length } };
}

export { ARCH_TARGET_MODULES, ARCH_ID_HINTS };
