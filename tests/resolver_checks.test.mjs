import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectResolverChecks,CHECK_DEMOS,checkDemo} from '../js/resolver_checks.js';
import {checksRows} from '../js/resolver_checks_i18n.js';
import {solveCase} from '../js/resolver.js';
import {buildResolverSummary} from '../js/resolver_summary.js';
import {modeTopics} from '../js/guide_bridge.js';
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
for(const state of cases)for(const lang of ['en','es','fr','zh']){
 const summary=buildResolverSummary(state,lang),c=summary.checks;
 assert.equal(c.executed,false);assert.equal(c.instructions.length,3);assert.equal(summary.next,c.instructions[0]);
 for(const mode of c.tools)assert.ok(Object.hasOwn(modeTopics,mode));
 for(const text of [c.title,...c.instructions])assert.ok(text&&!text.includes('undefined')&&!text.includes('PRIVATE'));
}
for(const values of Object.values(checksRows))assert.ok(values.length===4&&values.every(Boolean));
for(const [route,scenarios] of Object.entries(CHECK_DEMOS))for(const scenario of scenarios){
 const example=checkDemo(route,scenario,q),result=solveCase(route,example.bundle,example.inputs);
 assert.equal(selectResolverChecks({route,result,inputs:example.inputs}).priority,route+'_'+scenario);
}
assert.throws(()=>checkDemo('memory','kv',{origin:'hf'}));assert.throws(()=>checkDemo('memory','__proto__',q));
assert.equal(selectResolverChecks({route:'memory',result:{status:'unknown'}}),null);
assert.equal(selectResolverChecks({route:'template',result:{status:'unknown'}}),null);
assert.equal(selectResolverChecks({route:'pvr',result:{}}),null);
console.log('Resolver checks PASS: 17 priorities, soft-prompt boundaries, ten optional examples, four languages and unexecuted/private-data-free plans.');
