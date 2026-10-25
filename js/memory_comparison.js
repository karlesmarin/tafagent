import {normalizeMemoryMeasurement,reviewMemoryMeasurement} from './memory_measurement.js';
// Two declared runs, not a causal estimate or an independently verified repair.
export function compareMemoryMeasurements(before,after,inputs,bundle,fit){
 const a=normalizeMemoryMeasurement(before),b=normalizeMemoryMeasurement(after);
 const first=reviewMemoryMeasurement(a,inputs,bundle);
 const second=reviewMemoryMeasurement(b,{...inputs,peak:b.peak.value,peakUnit:b.peak.unit,peakMetric:b.peak.metric},bundle);
 const checks=['engine','version','device'].map(field=>({field,status:!a.runtime[field]?.trim()||!b.runtime[field]?.trim()?'missing':a.runtime[field]===b.runtime[field]?'match':'different'}));
 const start=Date.parse(a.measured_at),end=Date.parse(b.measured_at);
 checks.push({field:'order',status:!Number.isFinite(start)||!Number.isFinite(end)?'missing':end>start?'match':'different'});
 const blockers=[];
 if(!first.compatible)blockers.push('before');
 if(!second.compatible)blockers.push('after');
 if(a.phase==='generate'||b.phase==='generate')blockers.push('phase');
 if(a.peak.metric!=='allocated'||b.peak.metric!=='allocated')blockers.push('metric');
 if(!fit?.ok)blockers.push('scope');
 if(inputs.comparisonSame!==true||inputs.peakSame!==true||inputs.peakIsolated!==true)blockers.push('confirmation');
 if(checks.slice(0,3).some(x=>x.status!=='match'))blockers.push('runtime');
 if(checks.at(-1).status!=='match')blockers.push('order');
 if(bundle.origin==='demo')blockers.push('example');
 const units={GiB:1,GB:1e9/2**30,MiB:1/1024};
 const firstGiB=a.peak.value*units[a.peak.unit],lastGiB=b.peak.value*units[b.peak.unit],ok=!blockers.length;
 const percent=ok&&firstGiB!==0?100*(lastGiB-firstGiB)/firstGiB:NaN;
 return {version:1,source:'imported_files',independently_verified:false,executed_by_taf:false,
  status:ok?'declared_comparison':'not_comparable',blockers,checks,before:first,after:second,
  before_GiB:firstGiB,after_GiB:lastGiB,delta_GiB:ok?lastGiB-firstGiB:null,
  delta_percent:Number.isFinite(percent)?percent:null,
  percent_unavailable:!ok?'not_comparable':firstGiB===0?'zero':!Number.isFinite(percent)?'range':null,
  direction:ok?(lastGiB<firstGiB?'lower':lastGiB>firstGiB?'higher':'equal'):null};
}
