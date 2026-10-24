import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildResolverReview} from '../js/resolver_review.js';
import {solveCase} from '../js/resolver.js';
import {LOCAL_DEMOS} from '../js/resolver_local.js';
import {reviewRows} from '../js/resolver_review_i18n.js';
import {readContext,tafLink} from '../js/guide_bridge.js';
const catalog=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url)));
const model=catalog.models.find(m=>m.id==='Qwen/Qwen3-8B');
const memory={vram:24,context:131072,precision:'BF16',stage:'generate'};
const examples={memory:{bundle:{...model,model:model.id},inputs:memory},template:{bundle:{tokenizer:{chat_template:'{{ messages }}'}},inputs:{}},compatibility:{bundle:model,inputs:{}},...Object.fromEntries(Object.entries(LOCAL_DEMOS).map(([id,inputs])=>[id,{bundle:{model:null},inputs}]))};
for(const values of Object.values(reviewRows))assert.ok(values.length===4&&values.every(x=>typeof x==='string'&&x.length>0));
for(const lang of ['en','es','fr','zh'])for(const [route,{bundle,inputs}] of Object.entries(examples)) {
 const result=solveCase(route,bundle,inputs);
 for(const origin of ['demo',route in LOCAL_DEMOS?'local':'hf']) {
  const r=buildResolverReview({route,bundle:{...bundle,origin},inputs,result,app:'hf'},lang);
  const back=new URL(tafLink(readContext(new URL(r.guide.url).search)));
  assert.equal(back.hostname,'karlexmarin-taf-agent.static.hf.space');assert.equal(back.searchParams.get('resolve'),route);
  assert.equal(r.independently_verified,false);
  assert.equal(r.demonstration,origin==='demo');
  for(const key of ['basis','provenance','limitation','next_check'])assert.ok(r[key]?.length>0&&!r[key].includes('undefined'),`${lang}/${route}/${key}`);
  assert.ok(new URL(r.guide.url).pathname.includes('/'+(lang==='es'?'es':'en')+'/chapters/'));
  if(route==='pvr'){assert.equal(r.evidence_kind,'imported_measurement');assert.ok(r.missing_protocol_fields>0);}
  if(route==='memory')assert.equal(r.evidence_kind,'configuration_estimate');
  if(route==='drift')assert.equal(r.evidence_kind,'heuristic_comparison');
  assert.ok(!JSON.stringify(r).includes(inputs.text||'PRIVATE_UNSET'));
 }
}
const limited={route:'memory',bundle:{config:{},origin:'hf'},inputs:memory,result:solveCase('memory',{config:{}},memory)};
assert.equal(buildResolverReview(limited).evidence_kind,'static_inspection');
assert.equal(buildResolverReview(limited).basis,reviewRows.review_limited[0]);
const conflict={...JSON.parse(LOCAL_DEMOS.pvr.text),T_eval:64,protocol:{length:32}};
const pvrInputs={text:JSON.stringify(conflict)};
const review=buildResolverReview({route:'pvr',bundle:{origin:'local'},inputs:pvrInputs,result:solveCase('pvr',{},pvrInputs)});
assert.ok(review.observations.length>0);
assert.equal(review.independently_verified,false);
assert.throws(()=>buildResolverReview({route:'__proto__'}));
console.log('Resolver review PASS: nine routes, provenance, protocol conflicts, four languages, privacy and no invented verification.');
