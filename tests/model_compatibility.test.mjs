import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectModel, presetFromConfig } from '../js/model_compatibility.js';
import { classifyMemory } from '../js/memory_reality.js';
import { MODEL_TRANSLATIONS } from '../js/model_i18n.js';
const catalog = JSON.parse(readFileSync(new URL('../data/model_catalog.json', import.meta.url)));
assert.equal(catalog.models.length, 10);
assert.equal(catalog.models.filter(r => r.config).length, 8);
for (const r of catalog.models) {
  if (!r.config) { assert.equal(r.access, 'restricted'); assert.equal(r.reference_context, undefined); continue; }
  assert.match(r.revision, /^[0-9a-f]{40}$/);
  assert.ok(r.source.includes('/resolve/' + r.revision + '/'));
  const report = inspectModel(r.config);
  for (const reason of report.reasons) for (const lang of ['en','es','fr','zh']) assert.ok(MODEL_TRANSLATIONS[lang]['models.reason.' + reason]);
  if (r.reference_context) {
    const p = presetFromConfig(r.config, r.id);
    assert.equal(report.eligible, true);
    assert.equal(p.d_head, 128);
    assert.equal(p.T_train, 40960); // Explicitly configured, not native/training context.
    assert.equal(r.reference_context, 32768);
    assert.equal(p._context_source, 'configured_not_training');
  } else assert.throws(() => presetFromConfig(r.config, r.id));
}
const get = s => catalog.models.find(r => r.id.includes(s)).config;
const q = get('Qwen3-0.6B');
assert.equal(q.hidden_size / q.num_attention_heads, 64);
assert.equal(presetFromConfig(q, '').d_head, 128); // Honor explicit head_dim.
assert.equal(inspectModel({...q, rope_theta: undefined}).geometry.theta, null);
assert.throws(() => presetFromConfig({...q, rope_theta: undefined}, ''));
assert.throws(() => presetFromConfig({...q, model_type: 'future_model'}, ''));
assert.throws(() => presetFromConfig({...q, vocab_size: undefined}, ''));
assert.throws(() => presetFromConfig({...q, num_key_value_heads: 3}, ''));
assert.throws(() => presetFromConfig({...q, num_key_value_heads: undefined}, ''));
assert.throws(() => presetFromConfig({...q, rope_parameters:{rope_theta:10000}}, ''));
assert.throws(() => presetFromConfig({...q, rope_scaling:{factor:4}}, ''));
assert.throws(() => presetFromConfig({...q, rope_scaling:{rope_type:'yarn', factor:4}}, ''));
assert.throws(() => presetFromConfig({...q, layer_types:['full_attention']}, ''));
assert.equal(inspectModel({...q, sliding_window:4096, use_sliding_window:false}).eligible, true);
assert.equal(inspectModel({...q, sliding_window:4096, use_sliding_window:true}).eligible, false);
assert.equal(inspectModel({...q, rope_theta:undefined, rope_parameters:{rope_theta:1e6,rope_type:'default'}}).eligible, true);
const hybrid = get('Qwen3.8');
assert.equal(inspectModel(hybrid).geometry.theta, 1e7);
assert.equal(classifyMemory(hybrid).cls, 'HYBRID');
assert.equal(classifyMemory(hybrid).recallLayers, 23);
assert.equal(classifyMemory(hybrid).totalLayers, 92);
assert.equal(classifyMemory({model_type:'future_model'}).cls, 'UNKNOWN');
assert.equal(classifyMemory({text_config:q}).cls, 'FULL');
assert.equal(classifyMemory(get('Ministral')).claimedContext, 262144);
assert.equal(classifyMemory(get('DeepSeek')).moe.experts, 256);
assert.ok(inspectModel(get('SmolLM3')).reasons.includes('position'));
assert.ok(inspectModel(get('DeepSeek')).reasons.includes('mla'));
assert.ok(inspectModel(get('gpt-oss')).reasons.includes('window'));
console.log('Model review PASS: 8 pinned configs, restricted sources, explicit dimensions, context provenance, architecture boundaries and 4-language reasons.');
