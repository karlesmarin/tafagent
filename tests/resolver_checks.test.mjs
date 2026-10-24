import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectResolverChecks,CHECK_DEMOS,checkDemo} from '../js/resolver_checks.js';
import {checksRows} from '../js/resolver_checks_i18n.js';
import {solveCase} from '../js/resolver.js';
import {buildResolverSummary} from '../js/resolver_summary.js';
import {modeTopics} from '../js/guide_bridge.js';
import {LOCAL_DEMOS,publicLocalInputs} from '../js/resolver_local.js';
const catalog=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url)));
const q={...catalog.models.find(m=>m.id==='Qwen/Qwen3-8B'),origin:'demo',model:'Qwen/Qwen3-8B'};
const memory={vram:24,context:4096,precision:'BF16',stage:'generate'};
const full={peft_type:'LORA',base_model_name_or_path:'PRIVATE/Base',r:8,lora_alpha:16,target_modules:['q_proj']};
const cases=[];
function record(route,bundle,inputs,expected){
 const result=solveCase(route,bundle,inputs),state={route,bundle,inputs,result};
 assert.equal(selectResolverChecks(state).priority,expected);cases.push(state);return result;
}
record('memory',q,{...memory,context:131072},'memory_kv');
record('memory',q,{...memory,vram:4},'memory_weights');
record('memory',q,{...memory,stage:'load'},'memory_load');
record('memory',{origin:'demo',config:{}},memory,'memory_architecture');
const fit=record('memory',q,memory,'memory_fit');
record('memory',q,{...memory,vram:fit.fit.totalGB+.1},'memory_tight');
for(const [tokenizer,priority] of [[{},'missing'],[{chat_template:{a:'a',b:'b'}},'multiple'],[{chat_template:'x'},'present']])record('template',{tokenizer,origin:'demo'},{},'template_'+priority);
const adapter=(cfg,base,priority)=>record('adapter',{origin:'local'},{text:JSON.stringify(cfg),base},'adapter_'+priority);
adapter(full,'','base');adapter(full,'Other/Base','mismatch');
adapter({...full,base_model_name_or_path:'meta-llama/Llama-3-8B'},'meta-llama/Llama-3-70B','family');
adapter({...full,target_modules:undefined},'PRIVATE/Base','targets');
adapter({...full,modules_to_save:['embed_tokens']},'PRIVATE/Base','embeddings');
adapter({...full,alpha_pattern:{q_proj:64}},'PRIVATE/Base','patterns');
adapter({...full,lora_alpha:128},'PRIVATE/Base','scale');adapter(full,'PRIVATE/Base','activation');
for(const peft_type of ['PROMPT_TUNING','P_TUNING','PREFIX_TUNING','MULTITASK_PROMPT_TUNING']){
 const r=adapter({peft_type,base_model_name_or_path:'PRIVATE/Base'},'PRIVATE/Base','activation');
 assert.ok(!r.notices.some(n=>n.key==='adapter_targets_empty'));
}
adapter({peft_type:'IA3',base_model_name_or_path:'PRIVATE/Base'},'PRIVATE/Base','targets');
const drift={...LOCAL_DEMOS.drift,framework_b:'lm-eval-hf',batch_b:1,template_b:'applied'};
const local={origin:'local'};
record('drift',local,{...drift,template_b:'unknown'},'drift_unknown');
record('drift',local,{...drift,template_b:'not_applied',score_b:drift.score_a},'drift_templates');
for(const fields of [{framework_b:'vllm-served'},{dtype_b:'fp16'},{batch_b:8}]){
 const r=record('drift',local,{...drift,...fields,score_b:drift.score_a},'drift_settings');
 assert.equal(r.driftEvidence.changedSettings.length,1);
}
record('drift',local,drift,'drift_repeat');
record('drift',local,{...drift,score_b:67.1},'drift_within');
record('drift',local,{...drift,template_a:'unknown',template_b:'unknown',score_b:drift.score_a},'drift_unknown');
for(const [text,text2,priority] of [['PRIVATE😀','PRIVATE😀','identical'],['PRIVATE😀','PRIVATE😀尾','append'],['PRIVATE😀尾','PRIVATE😀','shortened'],[' PRIVATE','PRIVATE','start'],['PRIVATE😀','PRIVATE😁','changed']]){
 const r=record('cache',local,{text,text2},'cache_'+priority);
 assert.ok(!JSON.stringify(r).includes('PRIVATE'));
 assert.deepEqual(publicLocalInputs('cache',{text,text2}),{});
}
for(const route of ['compatibility','cot','peft'])for(const scenario of CHECK_DEMOS[route]){
 const e=checkDemo(route,scenario,q);
 record(route,e.bundle,e.inputs,route+'_'+scenario);
 if(route==='compatibility'){assert.equal(e.bundle.model,null);assert.equal(e.bundle.revision,null);assert.deepEqual(e.bundle.sources,[]);}
}
for(const text of ['{}','{"answer":"PRIVATE"}','{"properties":{"explanation":{"type":"string"}}}','{"properties":{"nested":{"properties":{"answer":{},"reasoning":{}}}}}'])record('cot',local,{text},'cot_unclassified');
const order=record('cot',local,LOCAL_DEMOS.cot,'cot_order');
record('cot',local,{text:order.suggestion},'cot_ordered');
const mixed='adapter_path="PRIVATE/trained_lora"\n'+LOCAL_DEMOS.peft.text;
const peft=record('peft',local,{text:mixed},'peft_load');
assert.ok(peft.notices.some(x=>x.key==='peft_qlora_order'));
assert.ok(!JSON.stringify(peft).includes('PRIVATE'));
record('peft',local,{text:'# get_peft_model(base, cfg)\ncustom_loader()'},'peft_unrecognized');
record('compatibility',{origin:'local',config:{...q.config,rope_theta:null}},{},'compatibility_metadata');
record('compatibility',{origin:'local',config:{...q.config,num_local_experts:4,rope_theta:null}},{},'compatibility_scope');
for(const state of cases)for(const lang of ['en','es','fr','zh']){
 const summary=buildResolverSummary(state,lang),c=summary.checks;
 assert.equal(c.executed,false);assert.equal(c.instructions.length,3);assert.equal(summary.next,c.instructions[0]);
 for(const mode of c.tools)assert.ok(Object.hasOwn(modeTopics,mode));
 for(const text of [c.title,...c.instructions])assert.ok(text&&!text.includes('undefined')&&!text.includes('PRIVATE'));
 if(['cache','drift'].includes(state.route))assert.equal(new URL(summary.guide.url).hash,'#sec-resolver-'+state.route);
 const anchors={compatibility:'architecture',cot:'json',peft:'peft'};
 if(anchors[state.route])assert.equal(new URL(summary.guide.url).hash,'#sec-resolver-'+anchors[state.route]);
 const chapters={compatibility:'10-arquitecturas',cot:'30-prompting',peft:'28-peft',cache:'36-serving',drift:'40-evaluacion'};
 if(chapters[state.route]){
  const url=new URL(summary.guide.url);
  assert.ok(url.pathname.endsWith('/'+chapters[state.route]+'.html'));
  assert.equal(url.searchParams.get('resolve'),state.route);assert.equal(url.searchParams.get('lang'),lang);
 }
}
for(const values of Object.values(checksRows))assert.ok(values.length===4&&values.every(Boolean));
for(const [route,scenarios] of Object.entries(CHECK_DEMOS))for(const scenario of scenarios){
 const example=checkDemo(route,scenario,q),result=solveCase(route,example.bundle,example.inputs);
 assert.equal(selectResolverChecks({route,result,inputs:example.inputs}).priority,route+'_'+scenario);
}
// Initial examples and alternate scenarios must agree on their labels.
for(const route of ['cache','drift','cot','peft'])assert.equal(selectResolverChecks({route,result:solveCase(route,local,LOCAL_DEMOS[route])}).priority,route+'_'+CHECK_DEMOS[route][0]);
assert.throws(()=>checkDemo('memory','kv',{origin:'hf'}));assert.throws(()=>checkDemo('memory','__proto__',q));
assert.equal(selectResolverChecks({route:'memory',result:{status:'unknown'}}),null);
assert.equal(selectResolverChecks({route:'template',result:{status:'unknown'}}),null);
assert.equal(selectResolverChecks({route:'pvr',result:{}}),null);
assert.equal(selectResolverChecks({route:'cache',result:{}}),null);
assert.equal(selectResolverChecks({route:'drift',result:{driftEvidence:{templateUnknown:false}}}),null);
for(const route of ['compatibility','cot','peft'])assert.equal(selectResolverChecks({route,result:{}}),null);
console.log('Resolver checks PASS: 39 priorities, 32 examples, schema and static-code boundaries, synthetic provenance, four languages and private-data-free plans.');
