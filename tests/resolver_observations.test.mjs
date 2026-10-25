import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OBSERVATIONS,observationChoices,observationReport,recordObservation,OBSERVATION_LIMIT} from '../js/resolver_observations.js';
import {CHECK_DEMOS,checkDemo} from '../js/resolver_checks.js';
import {LOCAL_DEMOS} from '../js/resolver_local.js';
import {solveCase} from '../js/resolver.js';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
import {TOOL_CATALOG} from '../js/resolver_catalog.js';
const c=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url)));
const q={...c.models.find(m=>m.id==='Qwen/Qwen3-8B'),origin:'demo'};
const states=Object.entries(CHECK_DEMOS).flatMap(([route,scenarios])=>scenarios.map(scenario=>{
 const e=checkDemo(route,scenario,q);return {route,...e,result:solveCase(route,e.bundle,e.inputs)};
}));
states.push({route:'pvr',bundle:{origin:'local'},inputs:LOCAL_DEMOS.pvr,result:solveCase('pvr',{},LOCAL_DEMOS.pvr)});
for(const state of states){
 const original=JSON.stringify(state);let history=[];
 assert.equal(observationReport(state).current,null);
 for(const code of observationChoices(state.route)){
  history=recordObservation(state,history,1,code);
  const report=observationReport(state,history),entry=report.current;
  assert.equal(entry.code,code);assert.equal(entry.step,1);
  assert.equal(report.source,state.bundle.origin==='demo'?'illustrative':'user_reported');
  assert.equal(report.executed_by_taf,false);assert.equal(report.independently_verified,false);
  if(entry.tool)assert.ok(TOOL_CATALOG.some(t=>t.mode===entry.tool));
  for(const lang of ['en','es','fr','zh'])for(const key of [entry.label_key,entry.next_key,entry.step_key,'observation_help'])assert.ok(RESOLVER_TRANSLATIONS[lang]['resolver.'+key],lang+': '+key);
 }
 assert.equal(JSON.stringify(state),original,'Observations must not rewrite the analysis');
 for(let i=0;i<20;i++)history=recordObservation(state,history,i%3,'unavailable');
 assert.equal(history.length,OBSERVATION_LIMIT);
 assert.equal(observationReport(state,history).current.step,1);
 for(const bad of ['verified','__proto__','PRIVATE_SECRET'])assert.throws(()=>recordObservation(state,history,0,bad));
 for(const index of [-1,3,1.5,NaN])assert.throws(()=>recordObservation(state,history,index,'unavailable'));
 const poisoned=[...history,{...history[0],secret:'PRIVATE_SECRET',tool:'https://private.invalid',next_key:'PRIVATE_SECRET'}];
 assert.ok(!JSON.stringify(observationReport(state,poisoned)).includes('PRIVATE_SECRET'));
 assert.ok(!JSON.stringify(observationReport(state,poisoned)).includes('private.invalid'));
 assert.equal(observationReport(state,history.map(h=>({...h,plan_key:'stale'}))).entries.length,0);
 assert.equal(observationReport(state,history.map(h=>({...h,route:'unknown'}))).entries.length,0);
 assert.equal(observationReport(state,{}).entries.length,0);
}
assert.deepEqual(Object.keys(OBSERVATIONS).sort(),['memory','template','compatibility','cot','peft','cache','drift','pvr','adapter'].sort());
assert.equal(observationReport({route:'unknown'}),null);
console.log('Observation PASS: 33 example states, 27 specific branches plus missing evidence, four languages, bounded history, invalid/stale/private input rejection and unchanged analysis.');

