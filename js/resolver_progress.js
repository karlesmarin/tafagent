import {selectResolverChecks} from './resolver_checks.js';

// User-declared follow-up, scoped to the current result. Never a measured repair.
export const PROGRESS_STATES=['pending','checked','issue','blocked'];
export function progressPlan(state){
 const checks=selectResolverChecks(state);
 if(checks)return {key:checks.priority,steps:checks.steps};
 const priority=state.route==='pvr'&&state.result?.protocolReview?.priority;
 if(!['context','reference_context','align','document','repeat'].includes(priority))return null;
 return {key:'pvr_'+priority,steps:['protocol_first_'+priority,'progress_attention_observe','progress_attention_interpret']};
}
export function progressReport(state,marks=null){
 const plan=progressPlan(state);if(!plan)return null;
 const states=plan.steps.map((_,i)=>marks?.key===plan.key&&PROGRESS_STATES.includes(marks.states?.[i])?marks.states[i]:'pending');
 const nextState=['issue','blocked','pending'].find(s=>states.includes(s))||'reviewed';
 return {version:1,route:state.route,plan_key:plan.key,source:state.bundle?.origin==='demo'?'illustrative':'user_reported',
  steps:plan.steps.map((key,i)=>({key,status:states[i]})),checked_count:states.filter(s=>s==='checked').length,
  next_kind:nextState,next_index:nextState==='reviewed'?null:states.indexOf(nextState),
  independently_verified:false,executed_by_taf:false};
}
export function markProgress(state,marks,index,status){
 const report=progressReport(state,marks);
 if(!report||!Number.isInteger(index)||index<0||index>=report.steps.length||!PROGRESS_STATES.includes(status))throw new Error('progress');
 const states=report.steps.map(s=>s.status);states[index]=status;
 return {key:report.plan_key,states};
}
export function demoProgress(state){
 if(state.bundle?.origin!=='demo')throw new Error('demo');
 const report=progressReport(state);if(!report)throw new Error('progress');
 return {key:report.plan_key,states:['checked','blocked','pending']};
}
