import {compareMemoryMeasurements} from './memory_comparison.js';
import {reviewMemoryMeasurement} from './memory_measurement.js';
// A user-reported peak is unverified evidence, never an executed GPU measurement.
export const MEMORY_STAGES=['load','prefill','decode','generate'];
export function compareMemoryPeak(inputs,fit,origin='hf',bundle={}) {
 const {peak,peakUnit,peakMetric,peakSame,peakIsolated,stage}=inputs;
 if(inputs.measurementAfter!=null&&(!inputs.measurement||peak==null||peak===''))throw new Error('inputs');
 if(peak==null||peak==='')return null;
 const units={GiB:1,GB:1e9/2**30,MiB:1/1024};
 if(typeof peak!=='number'||!Number.isFinite(peak)||peak<0||peak>1e9||!Object.hasOwn(units,peakUnit)||
   !['allocated','reserved','device','unknown'].includes(peakMetric)||!MEMORY_STAGES.includes(stage))throw new Error('inputs');
 const reportedGiB=peak*units[peakUnit];
 const blockers=[];
 if(stage==='generate')blockers.push('phase');
 if(peakMetric!=='allocated')blockers.push('metric');
 if(peakSame!==true)blockers.push('workload');
 if(peakIsolated!==true)blockers.push('isolated');
 if(!fit?.ok)blockers.push('scope');
 const measurement=inputs.measurement?reviewMemoryMeasurement(inputs.measurement,inputs,bundle):null;
 if(measurement&&!measurement.compatible)blockers.push('measurement');
 const canCompare=!blockers.length;
 const baseline=canCompare?(stage==='load'?fit.weightsGB:fit.totalGB):null;
 return {version:1,source:origin==='demo'?'illustrative':'user_reported',independently_verified:false,executed_by_taf:false,
  measurement,comparison:inputs.measurementAfter?compareMemoryMeasurements(inputs.measurement,inputs.measurementAfter,inputs,bundle,fit):null,phase:stage,reported_value:peak,reported_unit:peakUnit,metric:peakMetric,reported_GiB:reportedGiB,
  same_workload:peakSame===true,phase_isolated:peakIsolated===true,status:canCompare?'baseline_comparison':'not_comparable',blockers,
  baseline_kind:canCompare?(stage==='load'?'resident_weights':'steady_estimate'):null,baseline_GiB:baseline,
  difference_GiB:canCompare?reportedGiB-baseline:null,exceeds_entered_budget:reportedGiB>inputs.vram};
}
