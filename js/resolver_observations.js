import {progressPlan} from './resolver_progress.js';

// User-reported categories; no runtime measurement or automatic repair.
export const OBSERVATIONS={
 memory:{short_only:'launch',load_failure:'fitcheck',generation_failure:'launch'},
 template:{different:'template',not_applied:'template',same:'drift'},
 compatibility:{unsupported:'memreal',missing:'inspector',accepted:'launch'},
 cot:{invalid:'cot',schema:'cot',quality:'drift'},
 peft:{inactive:'adapter',targets:'peft',runtime:'peft'},
 cache:{tokens_differ:'tax',no_hits:'cache',hits_slow:'launch'},
 drift:{controls_differ:'template',gap_persists:'drift',gap_gone:'drift'},
 pvr:{protocol_differs:'pvr',curve_differs:'diagnose',stable:'pvr'},
 adapter:{base_differs:'adapter',inactive:'peft',active_same:'peft'},
};
export const OBSERVATION_LIMIT=12;
export function observationChoices(route){
 return Object.hasOwn(OBSERVATIONS,route)?[...Object.keys(OBSERVATIONS[route]),'unavailable']:[];
}
export function observationReport(state,history=[]){
 const plan=progressPlan(state);
 if(!plan||!Object.hasOwn(OBSERVATIONS,state.route))return null;
 const entries=(Array.isArray(history)?history:[]).filter(e=>e?.route===state.route&&e.plan_key===plan.key&&observationChoices(state.route).includes(e.code)&&Number.isInteger(e.step)&&e.step>=0&&e.step<plan.steps.length).slice(-OBSERVATION_LIMIT).map(e=>({
  route:state.route,plan_key:plan.key,step:e.step,step_key:plan.steps[e.step],code:e.code,
  label_key:e.code==='unavailable'?'observation_unavailable':'observation_'+state.route+'_'+e.code,
  next_key:e.code==='unavailable'?'observation_next_unavailable':'observation_next_'+state.route+'_'+e.code,
  tool:e.code==='unavailable'?null:OBSERVATIONS[state.route][e.code],
 }));
 return {version:1,source:state.bundle?.origin==='demo'?'illustrative':'user_reported',entries,
  current:entries.at(-1)||null,limit:OBSERVATION_LIMIT,independently_verified:false,executed_by_taf:false};
}
export function recordObservation(state,history,step,code){
 const report=observationReport(state,history),plan=progressPlan(state);
 if(!report||!Number.isInteger(step)||step<0||step>=plan.steps.length||!observationChoices(state.route).includes(code))throw new Error('observation');
 return [...report.entries.map(e=>({route:e.route,plan_key:e.plan_key,step:e.step,code:e.code})),{route:state.route,plan_key:plan.key,step,code}].slice(-OBSERVATION_LIMIT);
}

