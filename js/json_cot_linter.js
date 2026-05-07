// JSON CoT-aware Linter (v0.8.2 anti-bullshit pack #8)
//
// Pain (Solutions Hub `structured_outputs`): JSON schema engines fail
// silently and CoT models commit to the answer before reasoning when
// the schema places `answer` before `reasoning` — constrained decoding
// emits keys in property order, so the model has to commit a final
// answer first and only then writes the rationale to justify it,
// defeating Chain-of-Thought entirely.
//
// Source citations:
//   - https://collinwilkins.com/articles/structured-output (field
//     ordering anti-pattern explained)
//   - JSONSchemaBench (10K real schemas) — most are not CoT-aware
//   - llguidance / Outlines / SGLang grammars — all respect property order
//
// Pure logic — no human strings. Returns codes+params; main.js does
// the i18n lookup.

// Heuristic field classifiers. Tested against real schemas + examples
// in the smoke harness; conservative on `other` to avoid mislabeling
// ambiguous fields (e.g. a `score` could be either reasoning-side or
// answer-side, but lexically it patterns as answer-side and the
// false-anti-pattern cost is only "review the schema", which is fine).
const REASONING_PATTERNS = [
  /reason/i,
  /think/i,
  /thought/i,
  /\bcot\b/i,
  /chain.of.thought/i,
  /analysis/i,
  /\bexplanation\b/i,
  /rationale/i,
  /step.by.step/i,
  /scratchpad/i,
  /justif/i,
  /deliberat/i,
  /\bplan\b/i,
  /\bwhy\b/i,
];

const ANSWER_PATTERNS = [
  /^answer$/i,
  /^result$/i,
  /^output$/i,
  /^response$/i,
  /^final/i,
  /^verdict$/i,
  /^decision$/i,
  /^prediction$/i,
  /^conclusion$/i,
  /^value$/i,
  /^score$/i,
  /^classif/i,
  /^label$/i,
  /^choice$/i,
  /^selected/i,
];

export function classifyFieldName(name) {
  if (typeof name !== "string" || !name) return "other";
  for (const pat of REASONING_PATTERNS) {
    if (pat.test(name)) return "reasoning";
  }
  for (const pat of ANSWER_PATTERNS) {
    if (pat.test(name)) return "answer";
  }
  return "other";
}

// Decide whether `parsed` is a JSON Schema (has `properties` / `$schema`
// / `type: object`) or a plain example object. Both have ordered keys
// in modern JS (ES2015+ insertion-order preservation for non-integer
// string keys), and constrained decoders honor that order, so the
// detection works on either form.
function extractFieldOrder(parsed) {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { kind: "non_object", fields: [] };
  }
  // Schema form
  if (parsed.properties && typeof parsed.properties === "object") {
    return { kind: "schema", fields: Object.keys(parsed.properties) };
  }
  // Example object form
  return { kind: "example", fields: Object.keys(parsed) };
}

function buildFieldAnnotations(fields) {
  return fields.map((name, idx) => ({
    name,
    idx,
    type: classifyFieldName(name),
  }));
}

function suggestReorder(annotations) {
  // Strategy: keep relative order within each type bucket, but emit
  // reasoning fields first, then `other`, then answer fields. That
  // way CoT runs first, the model can reference any context fields,
  // and the answer comes last (constrained decoding commits the
  // answer after the rationale).
  const reasoning = annotations.filter(a => a.type === "reasoning").map(a => a.name);
  const other     = annotations.filter(a => a.type === "other").map(a => a.name);
  const answer    = annotations.filter(a => a.type === "answer").map(a => a.name);
  return [...reasoning, ...other, ...answer];
}

// Public entry point. `text` is the user-pasted JSON Schema or example.
// Returns { code, params } where `code` is one of:
//   - invalid_json
//   - non_object
//   - empty_fields
//   - good_order        (reasoning before answer — CoT honored)
//   - anti_pattern      (answer before reasoning — model commits early)
//   - missing_reasoning (answer-like fields present, no reasoning)
//   - missing_answer    (reasoning fields present, no answer-like field)
//   - no_cot_fields     (object has fields but none look reasoning/answer)
export function lintJsonCot(text) {
  if (typeof text !== "string" || !text.trim()) {
    return { code: "empty_fields", params: { reason: "empty_input" } };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      code: "invalid_json",
      params: { error: String(e && e.message || e).slice(0, 200) },
    };
  }
  const { kind, fields } = extractFieldOrder(parsed);
  if (kind === "non_object") {
    return { code: "non_object", params: { kind: Array.isArray(parsed) ? "array" : typeof parsed } };
  }
  if (fields.length === 0) {
    return { code: "empty_fields", params: { kind } };
  }

  const annotations = buildFieldAnnotations(fields);
  const reasoningIdx = annotations.findIndex(a => a.type === "reasoning");
  const answerIdx    = annotations.findIndex(a => a.type === "answer");
  const hasReasoning = reasoningIdx !== -1;
  const hasAnswer    = answerIdx !== -1;

  const baseParams = {
    kind,
    fields: annotations,
    field_count: annotations.length,
    reasoning_idx: hasReasoning ? reasoningIdx : null,
    answer_idx: hasAnswer ? answerIdx : null,
    suggested_order: suggestReorder(annotations),
  };

  if (!hasReasoning && !hasAnswer) {
    return { code: "no_cot_fields", params: baseParams };
  }
  if (hasReasoning && !hasAnswer) {
    return { code: "missing_answer", params: baseParams };
  }
  if (!hasReasoning && hasAnswer) {
    return { code: "missing_reasoning", params: baseParams };
  }
  // Both present — order is decisive.
  if (reasoningIdx < answerIdx) {
    return { code: "good_order", params: baseParams };
  }
  return { code: "anti_pattern", params: baseParams };
}

// Build a properties-reordered JSON string preserving the original
// shape (schema vs example). Used by the UI to show "suggested fix".
export function reorderJsonText(text, suggestedOrder) {
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { return null; }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  // Reorder properties within a plain object preserving values.
  const reorderObj = (obj, order) => {
    const out = {};
    // First emit suggested keys that exist on the object.
    for (const k of order) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
    }
    // Then any keys not in the suggested order (defensive: keeps unknowns).
    for (const k of Object.keys(obj)) {
      if (!Object.prototype.hasOwnProperty.call(out, k)) out[k] = obj[k];
    }
    return out;
  };

  if (parsed.properties && typeof parsed.properties === "object") {
    parsed.properties = reorderObj(parsed.properties, suggestedOrder);
    // If `required` array exists, mirror suggested order so generators
    // that emit fields in `required[]` order also benefit. Keep only
    // the keys originally present in `required`.
    if (Array.isArray(parsed.required)) {
      const wasRequired = new Set(parsed.required);
      parsed.required = suggestedOrder.filter(k => wasRequired.has(k));
    }
    return JSON.stringify(parsed, null, 2);
  }
  return JSON.stringify(reorderObj(parsed, suggestedOrder), null, 2);
}
