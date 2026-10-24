import assert from 'node:assert/strict';
import {progressPlan,progressReport,markProgress,demoProgress} from '../js/resolver_progress.js';
import {CHECK_DEMOS,checkDemo} from '../js/resolver_checks.js';
import {LOCAL_DEMOS} from '../js/resolver_local.js';
import {solveCase} from '../js/resolver.js';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
import {readFileSync} from 'node:fs';
const c=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url)));
const q={...c.models.find(m=>m.id==='Qwen/Qwen3-8B'),origin:'demo'};
const cases=Object.keys(CHECK_DEMOS).map(route=>{const e=checkDemo(route,CHECK_DEMOS[route][0],q);return {route,...e,result:solveCase(route,e.bundle,e.inputs)};});
cases.push({route:'pvr',bundle:{origin:'local'},inputs:LOCAL_DEMOS.pvr,result:solveCase('pvr',{},LOCAL_DEMOS.pvr)});
for(const state of cases){
 const r=progressReport(state);assert.equal(r.steps.length,3);assert.equal(r.next_kind,'pending');assert.equal(r.next_index,0);
 let marks=markProgress(state,null,0,'checked');marks=markProgress(state,marks,1,'blocked');
 assert.equal(progressReport(state,marks).next_kind,'blocked');assert.equal(progressReport(state,marks).next_index,1);
 marks=markProgress(state,marks,2,'issue');assert.equal(progressReport(state,marks).next_index,2);
 assert.equal(progressReport(state,marks).next_kind,'issue');
 for(let i=0;i<3;i++)marks=markProgress(state,marks,i,'checked');
 const complete=progressReport(state,marks);assert.equal(complete.next_kind,'reviewed');assert.equal(complete.checked_count,3);assert.equal(complete.next_index,null);
 assert.equal(complete.independently_verified,false);assert.equal(complete.executed_by_taf,false);
 for(const lang of ['en','es','fr','zh'])for(const k of [...r.steps.map(s=>s.key),'progress_next_reviewed','progress_help'])assert.ok(RESOLVER_TRANSLATIONS[lang]['resolver.'+k]);
 assert.throws(()=>markProgress(state,marks,3,'checked'));assert.throws(()=>markProgress(state,marks,0,'verified'));
 const invalid=progressReport(state,{key:r.plan_key,states:['PRIVATE',true,{}],private:'SECRET'});
 assert.equal(invalid.next_kind,'pending');assert.ok(!JSON.stringify(invalid).includes('SECRET'));
 assert.equal(progressReport(state,{key:'other',states:['checked','checked','checked']}).checked_count,0);
 if(state.bundle.origin==='demo'){assert.equal(progressReport(state,demoProgress(state)).source,'illustrative');assert.equal(progressReport(state,demoProgress(state)).next_kind,'blocked');}
 else assert.throws(()=>demoProgress(state));
}
assert.equal(progressPlan({route:'pvr',result:{}}),null);
assert.equal(progressReport({route:'bad'}),null);
console.log('Resolver progress PASS: nine routes, declared priority, no verified/executed outcomes, demo boundary, safe exports and four languages.');
