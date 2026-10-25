import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeMemoryMeasurement,readMemoryMeasurement,reviewMemoryMeasurement,publicMemoryInputs,MEASUREMENT_LIMIT} from '../js/memory_measurement.js';
import {solveCase} from '../js/resolver.js';
import {saveCase,readSavedCase} from '../js/resolver_session.js';
const q=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url))).models.find(x=>x.id==='Qwen/Qwen3-8B');
const bundle={origin:'hf',model:q.id,revision:q.revision,config:q.config,sources:[]};
const record={format:'taf-memory-measurement',version:1,kind:'measurement',model:q.id,revision:q.revision,phase:'prefill',tokens:4096,precision:'BF16',measured_at:'2026-10-25T12:00:00Z',phase_isolated:true,peak:{value:22528,unit:'MiB',metric:'allocated'},workload:{gpu_count:1,batch_size:1,resident_weights:true,kv_dtype:'FP16'},runtime:{engine:'pytorch',version:'test-fixture',device:'private-device-label'}};
const inputs={vram:24,context:4096,precision:'BF16',stage:'prefill',peak:22528,peakUnit:'MiB',peakMetric:'allocated',peakSame:true,peakIsolated:true,measurement:record};
const answer=solveCase('memory',bundle,inputs);assert.equal(answer.memoryPeak.status,'baseline_comparison');assert.equal(answer.memoryPeak.reported_GiB,22);assert.equal(answer.memoryPeak.measurement.compatible,true);assert.equal(answer.memoryPeak.independently_verified,false);
for(const [field,value] of [['model','Other/Model'],['revision','a'.repeat(40)],['revision',null],['phase','decode'],['tokens',8192],['tokens',null],['precision','NF4'],['phase_isolated',false],['kind','example']]){
 const m={...record,[field]:value};const result=solveCase('memory',bundle,{...inputs,measurement:m});assert.equal(result.memoryPeak.difference_GiB,null,field);assert.ok(result.memoryPeak.blockers.includes('measurement'));
}
for(const [key,value] of [['gpu_count',2],['batch_size',null],['resident_weights',false],['kv_dtype','BF16']])assert.equal(solveCase('memory',bundle,{...inputs,measurement:{...record,workload:{...record.workload,[key]:value}}}).memoryPeak.status,'not_comparable',key);
for(const patch of [{peakSame:false},{peakIsolated:false},{peak:1},{peakMetric:'reserved'}])assert.equal(solveCase('memory',bundle,{...inputs,...patch}).memoryPeak.status,'not_comparable');
const load={...record,phase:'load',tokens:null,workload:{...record.workload,kv_dtype:null}};
assert.equal(solveCase('memory',bundle,{...inputs,stage:'load',measurement:load}).memoryPeak.status,'baseline_comparison');
const unknown={...record,phase:'generate'};assert.equal(solveCase('memory',bundle,{...inputs,stage:'generate',measurement:unknown}).memoryPeak.status,'not_comparable');
for(const patch of [{version:2},{peak:{...record.peak,value:null}},{tokens:true},{runtime:null},{revision:'main'},{phase_isolated:'true'},{peak:{...record.peak,value:Infinity}}])assert.throws(()=>normalizeMemoryMeasurement({...record,...patch}));
assert.equal(normalizeMemoryMeasurement({...record,peak:{...record.peak,value:0}}).peak.value,0);
assert.throws(()=>readMemoryMeasurement(' '.repeat(MEASUREMENT_LIMIT+1)));assert.throws(()=>readMemoryMeasurement('{oops'));
const normalized=readMemoryMeasurement(JSON.stringify({...record,secret:'do-not-retain',runtime:{...record.runtime,token:'do-not-retain'}}));assert.equal(normalized.secret,undefined);assert.equal(normalized.runtime.token,undefined);
assert.ok(!JSON.stringify(publicMemoryInputs(inputs)).includes('private-device-label'));assert.ok(!JSON.stringify(answer).includes('private-device-label'));
const state={route:'memory',bundle,inputs,result:answer,initial:{inputs:{...inputs,measurement:undefined},result:answer}};
// Actual initial inputs omit absent optional values.
delete state.initial.inputs.measurement;
const saved=saveCase(state);assert.equal(JSON.parse(saved).version,2);const restored=readSavedCase(saved);assert.deepEqual(restored.inputs.measurement,record);assert.deepEqual(restored.result,answer);
const downgrade=JSON.parse(saved);downgrade.version=1;assert.throws(()=>readSavedCase(JSON.stringify(downgrade)));
assert.equal(readSavedCase(saveCase({...state,inputs:state.initial.inputs})).inputs.measurement,undefined);
assert.equal(reviewMemoryMeasurement(record,inputs,{}).compatible,false);
console.log('Memory import PASS: identity/phase/workload gates, null/zero/type bounds, examples, manual confirmations, privacy, raw-data normalization and v1/v2 private-case roundtrip.');
