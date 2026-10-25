// Local file data is a declaration, not authenticated runtime evidence.
export const MEASUREMENT_LIMIT=65536;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const str=(x,n)=>typeof x==='string'&&x.length<=n;
const invalid=()=>{throw new Error('measurement_invalid');};
export function normalizeMemoryMeasurement(x){
 if(!obj(x)||x.format!=='taf-memory-measurement'||x.version!==1||!['measurement','example'].includes(x.kind))invalid();
 if(x.model!==null&&(!str(x.model,200)||!/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(x.model)||x.model.includes('..')))invalid();
 if(x.revision!==null&&(!str(x.revision,40)||!/^[a-f0-9]{40}$/.test(x.revision)))invalid();
 if(!['load','prefill','decode','generate'].includes(x.phase))invalid();
 if(x.tokens!==null&&(!Number.isInteger(x.tokens)||x.tokens<1||x.tokens>10000000))invalid();
 if(x.precision!==null&&(!str(x.precision,64)||!x.precision.trim()))invalid();
 if(x.measured_at!==null&&(!str(x.measured_at,40)||!/^\d{4}-\d\d-\d\dT/.test(x.measured_at)||!Number.isFinite(Date.parse(x.measured_at))))invalid();
 if(x.phase_isolated!==null&&typeof x.phase_isolated!=='boolean')invalid();
 if(!obj(x.peak)||typeof x.peak.value!=='number'||!Number.isFinite(x.peak.value)||x.peak.value<0||x.peak.value>1e9||!['GiB','GB','MiB'].includes(x.peak.unit)||!['allocated','reserved','device','unknown'].includes(x.peak.metric))invalid();
 if(!obj(x.workload)||!obj(x.runtime))invalid();
 for(const k of ['gpu_count','batch_size'])if(x.workload[k]!==null&&(!Number.isInteger(x.workload[k])||x.workload[k]<1||x.workload[k]>100000))invalid();
 if(x.workload.resident_weights!==null&&typeof x.workload.resident_weights!=='boolean')invalid();
 if(x.workload.kv_dtype!==null&&!str(x.workload.kv_dtype,64))invalid();
 for(const k of ['engine','version','device'])if(x.runtime[k]!==null&&!str(x.runtime[k],120))invalid();
 return {format:x.format,version:1,kind:x.kind,model:x.model,revision:x.revision,phase:x.phase,tokens:x.tokens,precision:x.precision,
  measured_at:x.measured_at,phase_isolated:x.phase_isolated,peak:{value:x.peak.value,unit:x.peak.unit,metric:x.peak.metric},
  workload:{gpu_count:x.workload.gpu_count,batch_size:x.workload.batch_size,resident_weights:x.workload.resident_weights,kv_dtype:x.workload.kv_dtype},
  runtime:{engine:x.runtime.engine,version:x.runtime.version,device:x.runtime.device}};
}
export function readMemoryMeasurement(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MEASUREMENT_LIMIT)throw new Error('measurement_large');
 return normalizeMemoryMeasurement(JSON.parse(text));
}
export function reviewMemoryMeasurement(record,inputs,bundle={}){
 const m=normalizeMemoryMeasurement(record),checks=[];
 const check=(field,a,b)=>checks.push({field,status:a==null||b==null?'missing':a===b?'match':'different'});
 check('model',m.model,bundle.model);check('revision',m.revision,bundle.revision);
 check('phase',m.phase,inputs.stage);check('precision',m.precision,inputs.precision);
 if(m.phase==='load'&&inputs.stage==='load')checks.push({field:'tokens',status:'not_applicable'});else check('tokens',m.tokens,inputs.context);
 check('gpu_count',m.workload.gpu_count,1);check('batch_size',m.workload.batch_size,1);check('resident_weights',m.workload.resident_weights,true);
 // Loading has no KV budget; other phases use the existing FP16 KV assumption.
 if(m.phase==='load'&&inputs.stage==='load')checks.push({field:'kv_dtype',status:'not_applicable'});else check('kv_dtype',m.workload.kv_dtype,'FP16');
 check('isolation',m.phase_isolated,true);
 check('peak_value',m.peak.value,inputs.peak);check('peak_unit',m.peak.unit,inputs.peakUnit);check('peak_metric',m.peak.metric,inputs.peakMetric);
 const compatible=m.kind==='measurement'&&checks.every(c=>['match','not_applicable'].includes(c.status));
 return {version:1,source:'imported_file',kind:m.kind,checks,compatible,independently_verified:false,executed_by_taf:false};
}
export function publicMemoryInputs(inputs){const {measurement,measurementAfter,...rest}=inputs;return rest;}
