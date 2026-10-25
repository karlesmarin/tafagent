import {compareMemoryMeasurements} from '../js/memory_comparison.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeMemoryMeasurement,readMemoryMeasurement,reviewMemoryMeasurement,publicMemoryInputs,MEASUREMENT_LIMIT} from '../js/memory_measurement.js';
import {solveCase} from '../js/resolver.js';
import {saveCase,readSavedCase} from '../js/resolver_session.js';
const q=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url))).models.find(x=>x.id==='Qwen/Qwen3-8B');
const bundle={origin:'hf',model:q.id,revision:q.revision,config:q.config,sources:[]};
const record={format:'taf-memory-measurement',version:1,kind:'measurement',model:q.id,revision:q.revision,phase:'prefill',tokens:4096,precision:'BF16',measured_at:'2026-10-25T12:00:00Z',phase_isolated:true,peak:{value:22528,unit:'MiB',metric:'allocated'},workload:{gpu_count:1,batch_size:1,resident_weights:true,kv_dtype:'FP16'},runtime:{engine:'pytorch',version:'test-fixture',device:'private-device-label'}};
const inputs={vram:24,context:4096,precision:'BF16',stage:'prefill',peak:22528,peakUnit:'MiB',peakMetric:'allocated',peakSame:true,peakIsolated:true,measurement:record};
const after={...record,measured_at:'2026-10-25T13:00:00Z',peak:{value:20,unit:'GiB',metric:'allocated'}};
const paired={...inputs,measurementAfter:after,comparisonSame:true};
const run=(patch={})=>solveCase('memory',bundle,{...paired,...patch}).memoryPeak.comparison;
const result=run();assert.equal(result.status,'declared_comparison');assert.equal(result.before_GiB,22);assert.equal(result.after_GiB,20);assert.equal(result.delta_GiB,-2);assert.equal(result.direction,'lower');assert.equal(result.delta_percent,100*(-2)/22);assert.equal(result.independently_verified,false);
for(const patch of [{comparisonSame:false},{peakSame:false},{peakIsolated:false}])assert.ok(run(patch).blockers.includes('confirmation'));
for(const patch of [{revision:null},{revision:'a'.repeat(40)},{model:'Other/Model'},{tokens:8192},{precision:'NF4'},{phase:'decode'},{kind:'example'},{phase_isolated:false},{workload:{...after.workload,batch_size:2}}]){
 const r=run({measurementAfter:{...after,...patch}});assert.equal(r.delta_GiB,null);assert.ok(r.blockers.includes('after'));
}
for(const key of ['engine','version','device'])for(const value of [null,'','different'])assert.ok(run({measurementAfter:{...after,runtime:{...after.runtime,[key]:value}}}).blockers.includes('runtime'));
for(const value of [null,record.measured_at,'2026-10-24T10:00:00Z'])assert.ok(run({measurementAfter:{...after,measured_at:value}}).blockers.includes('order'));
assert.ok(run({measurementAfter:{...after,peak:{...after.peak,metric:'reserved'}}}).blockers.includes('metric'));
assert.equal(run({measurementAfter:{...after,peak:{...after.peak,value:22}}}).direction,'equal');
assert.equal(run({measurementAfter:{...after,peak:{...after.peak,value:23}}}).direction,'higher');
const zero={...record,peak:{...record.peak,value:0}};assert.equal(run({measurement:zero,peak:0}).delta_percent,null);assert.equal(run({measurement:zero,peak:0}).delta_GiB,20);
assert.equal(run({measurementAfter:{...after,peak:{value:20*2**30/1e9,unit:'GB',metric:'allocated'}}}).delta_GiB,-2);
assert.throws(()=>run({measurement:null}));assert.throws(()=>run({peak:null}));
const state={route:'memory',bundle,inputs:paired,initial:{inputs,result:solveCase('memory',bundle,inputs)}};
const saved=saveCase(state);assert.equal(JSON.parse(saved).version,3);const restored=readSavedCase(saved);assert.deepEqual(restored.inputs.measurementAfter,after);assert.deepEqual(restored.result.memoryPeak.comparison,result);
for(const version of [1,2,4]){const raw=JSON.parse(saved);raw.version=version;assert.throws(()=>readSavedCase(JSON.stringify(raw)));}
for(const change of [x=>delete x.inputs.measurement,x=>x.inputs.comparisonSame='true',x=>x.inputs.measurementAfter.runtime=null]){const raw=JSON.parse(saved);change(raw);assert.throws(()=>readSavedCase(JSON.stringify(raw)));}
assert.ok(!JSON.stringify(publicMemoryInputs(paired)).includes('private-device-label'));assert.equal(publicMemoryInputs(paired).measurementAfter,undefined);assert.ok(!JSON.stringify(result).includes('private-device-label'));
assert.equal(JSON.parse(saveCase({...state,inputs})).version,2);
const tiny={...record,peak:{value:1e-310,unit:'GiB',metric:'allocated'}};const overflow=run({measurement:tiny,peak:1e-310,peakUnit:'GiB'});assert.equal(overflow.delta_percent,null);assert.equal(overflow.percent_unavailable,'range');
assert.ok(compareMemoryMeasurements(record,after,paired,bundle,null).blockers.includes('scope'));
const whole={...record,phase:'generate'};assert.ok(compareMemoryMeasurements(whole,{...after,phase:'generate'},{...paired,stage:'generate'},bundle,{ok:true}).blockers.includes('phase'));
const load={...record,phase:'load',tokens:null,workload:{...record.workload,kv_dtype:null}};
assert.equal(compareMemoryMeasurements(load,{...load,measured_at:after.measured_at,peak:after.peak},{...paired,stage:'load'},bundle,{ok:true}).status,'declared_comparison');
console.log('Memory pair PASS: normalized units, before/after guards, timestamps, runtime, confirmations, zero, privacy and v1/v2/v3 session boundaries.');
