// Config inspection is not a measurement or certification of TAF predictions.
// Only explicitly represented, conventional dense RoPE geometry is auto-imported.
const DENSE = new Set(['llama', 'mistral', 'qwen2', 'qwen3', 'gemma', 'phi3']);
const positive = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
export function textConfig(config) {
  return config?.text_config && typeof config.text_config === 'object' ? config.text_config : (config || {});
}
export function inspectModel(config) {
  const c = textConfig(config), reasons = [];
  const mt = String(c.model_type || '').toLowerCase();
  const layers = Array.isArray(c.layer_types) ? c.layer_types : [];
  const rope = c.rope_parameters || c.rope_scaling || {};
  const theta = c.rope_theta ?? c.rotary_emb_base ?? rope.rope_theta ?? null;
  const heads = c.num_attention_heads ?? c.n_head ?? null;
  const kv = c.num_key_value_heads ?? null;
  const hidden = c.hidden_size ?? c.n_embd ?? null;
  const head = c.head_dim ?? (positive(hidden) && positive(heads) ? hidden / heads : null);
  const nl = c.num_hidden_layers ?? c.n_layer ?? null;
  const context = c.max_position_embeddings ?? c.max_sequence_length ?? c.n_positions ?? c.n_ctx ?? null;
  const scaling = rope.rope_type ?? rope.type ?? 'default';
  const activeWindow = positive(c.sliding_window) && c.use_sliding_window !== false && (!positive(context) || c.sliding_window < context);
  if (config?.text_config) reasons.push('multimodal');
  if (c.num_experts > 1 || c.num_local_experts > 1 || c.n_routed_experts > 1 || /moe/.test(mt)) reasons.push('moe');
  if (c.kv_lora_rank != null || c.qk_nope_head_dim != null) reasons.push('mla');
  if (layers.some(x => /linear|mamba|ssm|recurrent/i.test(x)) || c.layers_block_type || c.hybrid_override_pattern || /mamba|jamba|rwkv|nemotron_h/.test(mt)) reasons.push('hybrid');
  if (layers.some(x => /sliding/i.test(x)) || activeWindow || /gemma2|gemma3|gpt_oss/.test(mt)) reasons.push('window');
  if (c.no_rope_layers != null || c.no_rope_layer_interval != null || c.alibi || c.position_embedding_type === 'absolute') reasons.push('position');
  if (scaling !== 'default' || (rope.factor != null && rope.factor !== 1) ||
      Object.values(rope).some(x => x && typeof x === 'object') ||
      (c.partial_rotary_factor ?? c.rotary_pct ?? rope.partial_rotary_factor ?? 1) !== 1) reasons.push('rope');
  if (!DENSE.has(mt)) reasons.push('unreviewed');
  if (![theta, heads, kv, head, nl, context].every(positive) || theta <= 1 ||
      ![heads, kv, head, nl, context].every(Number.isInteger) || kv > heads || heads % kv !== 0 ||
      (positive(c.rope_theta) && positive(rope.rope_theta) && c.rope_theta !== rope.rope_theta) ||
      (layers.length && (layers.length !== nl || layers.some(x => x !== 'full_attention')))) reasons.push('incomplete');
  // Explicit projection/FFN sizes; estimate excludes biases and small norms.
  // Never infer total MoE weights from active experts or packed safetensors counts.
  let params = null;
  if (positive(c.num_parameters)) params = c.num_parameters;
  else if (!reasons.length && [hidden, c.intermediate_size, c.vocab_size].every(positive) && typeof c.tie_word_embeddings === 'boolean') {
    params = Math.round(nl * (2 * hidden * head * (heads + kv) + 3 * hidden * c.intermediate_size)
      + c.vocab_size * hidden * (c.tie_word_embeddings ? 1 : 2));
  }
  return { modelType: mt, reasons: [...new Set(reasons)], eligible: !reasons.length,
    configuredContext: positive(context) ? context : null, parameterEstimate: params,
    geometry: { theta, n_attention_heads: heads, n_kv_heads: kv, d_head: head, n_layers: nl, has_SWA: activeWindow },
    textOnly: c !== config, mirror: config?.__via_mirror || null };
}

export function presetFromConfig(config, modelId, translate = key => key) {
  const r = inspectModel(config);
  if (!r.eligible || !positive(r.parameterEstimate)) {
    const reasons = [...r.reasons, ...(!positive(r.parameterEstimate) ? ['parameters'] : [])];
    const error = new Error(translate('models.blocked') + ' ' + reasons.map(k => translate('models.reason.' + k)).join(' · '));
    error.compatibility = r;
    throw error;
  }
  return { ...r.geometry, T_train: r.configuredContext, n_params: r.parameterEstimate,
    _family: r.geometry.n_kv_heads < r.geometry.n_attention_heads ? 'rope-gqa' : 'rope-mha',
    _model_id: modelId, _context_source: 'configured_not_training', _parameters_source: 'config_estimate' };
}
