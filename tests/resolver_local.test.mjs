import assert from 'node:assert/strict';
import {LOCAL_CASES,LOCAL_DEMOS,solveLocalCase,publicLocalInputs} from '../js/resolver_local.js';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
import {buildResolverSummary} from '../js/resolver_summary.js';
import {TOOL_CATALOG} from '../js/resolver_catalog.js';
import {modeTopics,tafLink} from '../js/guide_bridge.js';
import {computeDriftBound} from '../js/cross_drift.js';
import {reorderJsonText} from '../js/json_cot_linter.js';
import {lintPeftCode} from '../js/peft_anti_pattern.js';
import {TRIAGE,triageNoteKey} from '../js/resolver_triage.js';
import {CASES} from '../js/resolver.js';
for(const [category,choices] of Object.entries(TRIAGE))for(const choice of choices){
 const [key,route,mode]=choice;if(route)assert.ok(Object.hasOwn(CASES,route));if(mode)assert.ok(Object.hasOwn(modeTopics,mode));
 for(const lang of ['en','es','fr','zh'])for(const k of ['triage_'+category,'triage_'+key,triageNoteKey(choice)])assert.ok(RESOLVER_TRANSLATIONS[lang]['resolver.'+k],lang+' '+k);
}
assert.deepEqual(TOOL_CATALOG.map(x=>x.mode).sort(),Object.keys(modeTopics).sort());
for(const entry of TOOL_CATALOG){
 assert.equal(entry.description.length,4);assert.ok(entry.description.every(x=>typeof x==='string'&&x.length>20));
 assert.equal(new URL(tafLink({mode:entry.mode,demo:true})).searchParams.get('demo'),entry.mode);
}
for(const [id,demo] of Object.entries(LOCAL_DEMOS)){
 const result=solveLocalCase(id,demo);
 for(const lang of ['en','es','fr','zh']){
  const dict=RESOLVER_TRANSLATIONS[lang];
  for(const key of [id,result.status,result.summaryKey,result.nextKey,...result.facts.map(x=>x.key),...result.notices.map(x=>x.key),...LOCAL_CASES[id].fields.map(x=>x.label)])assert.ok(dict['resolver.'+key],`${lang}: ${id}: ${key}`);
  const summary=buildResolverSummary({route:id,bundle:{origin:'demo'},inputs:demo,result},lang);
  assert.ok(summary.finding&&!summary.finding.includes('undefined')&&!summary.finding.includes('{'));
  assert.ok(summary.next.length>20);assert.ok(summary.guide.url.includes('/chapters/'));assert.equal(summary.demo,true);
 }
 assert.ok(!JSON.stringify(publicLocalInputs(id,demo)).includes('text'));
}
assert.equal(solveLocalCase('cot',LOCAL_DEMOS.cot).summaryKey,'cot_review');
const ordered=solveLocalCase('cot',LOCAL_DEMOS.cot).suggestion;
assert.equal(solveLocalCase('cot',{text:ordered}).summaryKey,'cot_ordered');
const special='{"properties":{"answer":{},"reasoning":{},"__proto__":{"type":"string"}},"required":["answer","extension"],"additionalProperties":true}';
const original=JSON.parse(special),reordered=JSON.parse(reorderJsonText(special,['reasoning','answer','__proto__']));
assert.deepEqual(new Set(reordered.required),new Set(original.required));
assert.equal(Object.hasOwn(reordered.properties,'__proto__'),true);
assert.deepEqual(reordered.properties,original.properties);
for(const text of ['null','[]','{','{"properties":[]}','{"required":"answer"}'])assert.throws(()=>solveLocalCase('cot',{text}));
assert.equal(solveLocalCase('cache',{text:'AB😀same',text2:'AB😀different'}).facts[0].value,4);
assert.equal(solveLocalCase('cache',{text:'abc',text2:'abc'}).summaryKey,'cache_identical');
assert.ok(solveLocalCase('peft',LOCAL_DEMOS.peft).notices.some(x=>x.key==='peft_qlora_order'));
assert.ok(lintPeftCode('config = LoraConfig(r=8, lora_alpha=64)').findings.some(x=>x.rule==='alpha_not_2r'));
assert.ok(!lintPeftCode('config = LoraConfig(r=8, lora_alpha=16)').findings.some(x=>x.rule==='alpha_not_2r'));
const a={score:70,framework:'vllm-served',dtype:'bf16',batch:1,chat_template:'applied'},b={...a,score:69,framework:'tgi'};
assert.equal(computeDriftBound(a,b).breakdown.framework,computeDriftBound(b,a).breakdown.framework);
assert.equal(computeDriftBound(a,b).breakdown.framework,.20);
for(const extra of [{score_a:NaN},{batch_a:1.5},{score_b:101},{comparable:false},{dtype_a:'invented'}])assert.throws(()=>solveLocalCase('drift',{...LOCAL_DEMOS.drift,...extra}));
assert.equal(solveLocalCase('adapter',LOCAL_DEMOS.adapter).summaryKey,'adapter_mismatch');
assert.throws(()=>solveLocalCase('adapter',{text:'{"peft_type":"LORA","r":0}'}));
assert.throws(()=>solveLocalCase('pvr',{text:'{"gamma":"0.5"}'}));
const measurement={gamma:0.6,theta:10000,T_eval:128,protocol:{length:128}};
assert.equal(solveLocalCase('pvr',{text:JSON.stringify(measurement)}).summaryKey,'pvr_compared');
assert.equal(solveLocalCase('pvr',{text:JSON.stringify({...measurement,protocol:{length:256}})}).summaryKey,'pvr_incomplete');
assert.equal(solveLocalCase('pvr',{text:JSON.stringify(measurement),text2:JSON.stringify({...measurement,protocol:{length:256}})}).notices[0].key,'protocol_different');
console.log('Resolver local PASS: six computations, 31-mode coverage, four-language explanations, schema preservation, validation and calibrated scope.');
