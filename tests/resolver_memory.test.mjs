import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {solveCase,resolverLink} from '../js/resolver.js';
import {compareMemoryPeak} from '../js/resolver_memory.js';
import {buildResolverReview} from '../js/resolver_review.js';
import {buildResolverSummary} from '../js/resolver_summary.js';
import {selectResolverChecks,checkDemo} from '../js/resolver_checks.js';
import {memoryRows} from '../js/resolver_memory_i18n.js';
const entry=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url))).models.find(x=>x.id==='Qwen/Qwen3-8B');
const bundle={...entry,model:entry.id,origin:'hf'};
const inputs={vram:24,context:4096,precision:'BF16',stage:'prefill',peak:22,peakUnit:'GiB',peakMetric:'allocated',peakSame:true,peakIsolated:true};
const solve=patch=>solveCase('memory',bundle,{...inputs,...patch});
const result=solve({}),fit=result.fit,p=result.memoryPeak;
assert.equal(result.status,'fits_comfortably');assert.equal(p.status,'baseline_comparison');
assert.equal(p.source,'user_reported');assert.equal(p.independently_verified,false);assert.equal(p.executed_by_taf,false);
assert.equal(p.baseline_GiB,fit.totalGB);assert.equal(p.difference_GiB,22-fit.totalGB);assert.ok(p.difference_GiB>0);assert.equal(p.exceeds_entered_budget,false);
assert.equal(solve({peak:22528,peakUnit:'MiB'}).memoryPeak.reported_GiB,22);
assert.equal(solve({peak:22*2**30/1e9,peakUnit:'GB'}).memoryPeak.reported_GiB,22);
assert.equal(solve({peak:0}).memoryPeak.reported_GiB,0);
for(const peak of [null,undefined,''])assert.equal(solve({peak}).memoryPeak,null);
for(const patch of [{peak:-1},{peak:NaN},{peak:Infinity},{peak:'22'},{peakUnit:'__proto__'},{peakMetric:'max'},{stage:'train'}])assert.throws(()=>solve(patch),/inputs/);
for(const [patch,reason] of [[{stage:'generate'},'phase'],[{peakMetric:'reserved'},'metric'],[{peakMetric:'device'},'metric'],[{peakMetric:'unknown'},'metric'],[{peakSame:false},'workload'],[{peakSame:'true'},'workload'],[{peakIsolated:false},'isolated']]){
 const x=solve(patch).memoryPeak;assert.equal(x.status,'not_comparable');assert.ok(x.blockers.includes(reason));assert.equal(x.difference_GiB,null);assert.equal(x.baseline_GiB,null);
}
const limited=solveCase('memory',{...bundle,config:{}},inputs);
assert.equal(limited.status,'limited');assert.ok(limited.memoryPeak.blockers.includes('scope'));assert.equal(limited.memoryPeak.baseline_GiB,null);
assert.equal(solve({stage:'load'}).memoryPeak.baseline_GiB,fit.weightsGB);
assert.equal(solve({stage:'load'}).memoryPeak.baseline_kind,'resident_weights');
assert.equal(solve({stage:'decode'}).memoryPeak.baseline_GiB,fit.totalGB);
assert.equal(solve({peak:30}).memoryPeak.exceeds_entered_budget,true);
for(const stage of ['prefill','decode']){
 const state={route:'memory',bundle,inputs:{...inputs,stage},result:solve({stage})};
 assert.equal(selectResolverChecks(state).priority,'memory_'+stage);
 const kv=solve({stage,context:131072});assert.equal(kv.status,'kv_bound');assert.ok(kv.smallerContext>0);
 assert.equal(solve({stage,context:kv.smallerContext}).fit.fits,true);
 for(const lang of ['en','es','fr','zh']){
  const review=buildResolverReview(state,lang),summary=buildResolverSummary(state,lang);
  assert.equal(review.memory_peak.source,'user_reported');assert.equal(review.independently_verified,false);
  assert.ok(new URL(summary.guide.url).pathname.endsWith('/R5-tafagent.html'));assert.equal(new URL(summary.guide.url).hash,'#sec-resolver-memory-peaks');
  for(const text of [summary.problem,summary.next,...summary.checks.instructions])assert.ok(text&&!text.includes('undefined'));
 }
}
for(const values of Object.values(memoryRows))assert.ok(values.length===4&&values.every(x=>typeof x==='string'&&x.trim()));
const demo=checkDemo('memory','peak',{...bundle,origin:'demo'});
assert.equal(solveCase('memory',demo.bundle,demo.inputs).memoryPeak.source,'illustrative');
assert.equal(compareMemoryPeak({...inputs,peakSame:false,peakIsolated:false,stage:'generate',peakMetric:'unknown'},fit).blockers.length,4);
assert.ok(!resolverLink('memory',entry.id,'https://example.org/?peak=22&metric=allocated','en').includes('peak'));
console.log('Memory phases PASS: conversions, zero/missing/invalid peaks, phase and workload gates, architecture limits, descriptive baselines, provenance and four languages.');
