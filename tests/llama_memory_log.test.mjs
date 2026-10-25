import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readLlamaLog,parseLlamaLog,reviewLlamaLog,LLAMA_LOG_LIMIT} from '../js/llama_memory_log.js';
import {solveCase} from '../js/resolver.js';
import {publicMemoryInputs} from '../js/memory_measurement.js';
import {saveCase,readSavedCase} from '../js/resolver_session.js';
import {buildResolverReview} from '../js/resolver_review.js';
export const fixture=`main: build: 1234 (abcdef0)
private path: /home/PRIVATE-PATH/model.gguf
load_tensors: offloaded 33/33 layers to GPU
load_tensors: CUDA0 model buffer size = 8192.00 MiB
llama_context: n_ctx = 4096
llama_context: n_seq_max = 1
llama_kv_cache: CUDA0 KV buffer size = 512.00 MiB
llama_kv_cache: size = 512.00 MiB (4096 cells, 32 layers, 1/1 seqs), K (f16): 256.00 MiB, V (f16): 256.00 MiB
llama_context: CUDA0 compute buffer size = 128.00 MiB
llama_context: CUDA_Host output buffer size = 1.00 MiB`;
const q=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url))).models.find(x=>x.id==='Qwen/Qwen3-8B');
const bundle={origin:'hf',model:q.id,revision:q.revision,config:q.config,sources:[]};
const inputs={vram:24,context:4096,precision:'BF16',stage:'prefill',llamaLog:fixture,llamaSame:true};
const fit={ok:true,weightsGB:7,kvGB:0.25};
const enc=s=>new TextEncoder().encode(s);
assert.equal(readLlamaLog(enc('\uFEFF'+fixture.replaceAll('\n','\r\n'))),fixture);
const parsed=parseLlamaLog(fixture);assert.equal(parsed.rows.length,4);assert.equal(parsed.groups[0].listed_MiB,8832);assert.equal(parsed.meta.context,4096);assert.equal(parsed.meta.k,'f16');
assert.ok(!JSON.stringify(parsed).includes('PRIVATE-PATH'));
const r=reviewLlamaLog(inputs,fit);assert.equal(r.comparisons[0].difference_GiB,1);assert.equal(r.comparisons[1].difference_GiB,0.25);assert.equal(r.independently_verified,false);
assert.equal(reviewLlamaLog({...inputs,llamaSame:false},fit).comparisons[0].difference_GiB,null);
assert.equal(reviewLlamaLog(inputs,fit,'demo').comparisons[0].difference_GiB,null);
for(const [log,code,index] of [
 [fixture.replace('33/33','20/33'),'offload',0],
 [fixture.replace('main: build: 1234 (abcdef0)',''),'build',0],
 [fixture.replace('n_seq_max = 1','n_seq_max = 2'),'sequences',1],
 [fixture.replace('4096 cells','4352 cells'),'context',1],
 [fixture.replaceAll('(f16)','(q8_0)'),'dtype',1],
 [fixture+'\nload_tensors: CPU_Mapped model buffer size = 20.00 MiB','host',0],
 [fixture+'\nllama_kv_cache: CPU KV buffer size = 20.00 MiB','host',1],
 [fixture+'\nllama_memory_recurrent: CUDA0 RS buffer size = 20.00 MiB','recurrent',1],
 [fixture+'\nload_tensors: CUDA1 model buffer size = 20.00 MiB','devices',0],
 [fixture+'\nload_tensors: Metal model buffer size = 20.00 MiB','backend',0],
 [fixture+'\nload_tensors: CUDA0 model buffer size = 1.00 MiB','ambiguous',0],
 [fixture+'\nllama_context: n_ctx = 4096','ambiguous',1],
 [fixture+'\nunknown: CUDA0 KV buffer size = 10.00 GB','unrecognized',1],
 ]){
 const x=reviewLlamaLog({...inputs,llamaLog:log},fit);assert.ok(x.comparisons[index].blockers.includes(code),code);assert.equal(x.comparisons[index].difference_GiB,null);
 if(code==='ambiguous')assert.ok(x.groups.every(g=>g.listed_MiB===null));
 }
assert.ok(reviewLlamaLog({...inputs,stage:'load'},fit).comparisons[1].blockers.includes('phase'));
assert.ok(reviewLlamaLog(inputs,null).comparisons[0].blockers.includes('scope'));
const zero=parseLlamaLog('load_tensors: CUDA0 model buffer size = 0.00 MiB');assert.equal(zero.rows[0].MiB,0);assert.equal(zero.meta.context,null);
for(const text of ['', 'no buffer',fixture+'\0', ' '.repeat(LLAMA_LOG_LIMIT+1),'load_tensors: CUDA0 model buffer size = 1e999 MiB'])assert.throws(()=>parseLlamaLog(text));
assert.throws(()=>readLlamaLog(new Uint8Array([0xff])));
assert.throws(()=>reviewLlamaLog({...inputs,llamaSame:'true'},fit));
const answer=solveCase('memory',bundle,inputs),state={route:'memory',bundle,inputs,result:answer,initial:{inputs,result:answer}};
const saved=saveCase(state);assert.equal(JSON.parse(saved).version,4);const reopened=readSavedCase(saved);assert.deepEqual(reopened.result,answer);assert.equal(reopened.inputs.llamaLog,fixture);
const bad=JSON.parse(saved);bad.version=3;assert.throws(()=>readSavedCase(JSON.stringify(bad)));
const initialOnly={...state,inputs:{vram:24,context:4096,precision:'BF16',stage:'prefill'}};
assert.equal(JSON.parse(saveCase(initialOnly)).version,4);assert.equal(readSavedCase(saveCase(initialOnly)).result.llamaLog,null);
const measurement=JSON.parse(readFileSync(new URL('../data/memory_measurement_example.json',import.meta.url)));
const combined={...inputs,measurement,measurementAfter:measurement,comparisonSame:false,peak:measurement.peak.value,peakUnit:measurement.peak.unit,peakMetric:measurement.peak.metric,peakSame:false,peakIsolated:false};
const pairCase=readSavedCase(saveCase({...state,inputs:combined}));assert.ok(pairCase.result.llamaLog);assert.ok(pairCase.result.memoryPeak.comparison);assert.equal(pairCase.inputs.measurementAfter.kind,'example');
assert.equal(parseLlamaLog(fixture.replaceAll('(f16)','(private_secret)')).meta.k,'unknown');
for(const data of [publicMemoryInputs(inputs),answer,buildResolverReview(state)])assert.ok(!JSON.stringify(data).includes('PRIVATE-PATH'));
const hybrid=solveCase('memory',{...bundle,config:{...bundle.config,model_type:'jamba'}},inputs);assert.equal(hybrid.status,'limited');assert.equal(hybrid.llamaLog.rows.length,4);assert.equal(hybrid.llamaLog.comparisons[0].estimated_GiB,null);
console.log('llama.cpp logs PASS: units, components, scope/missing/ambiguous conditions, private v4, reduced privacy, hybrid evidence without estimates.');
