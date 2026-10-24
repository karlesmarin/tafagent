// Adapters to existing TAF computations. No fetch, eval, model execution or pricing claims.
import {lintJsonCot,reorderJsonText} from './json_cot_linter.js';
import {lintPeftCode} from './peft_anti_pattern.js';
import {longestCommonPrefix} from './prompt_cache_diff.js';
import {computeDriftBound,FRAMEWORKS,DTYPES} from './cross_drift.js';
import {normalizeMeasured,predictionContext,predictionVsReality,missingProtocolFields,compareProtocols} from './prediction_reality.js';
import {parseAdapterConfig,compatChecks} from './adapter_reality.js';
import {reviewProtocol} from './resolver_protocol.js';

const textField=(id,label,required=true)=>({id,label,type:'textarea',required});
export const LOCAL_CASES={
 cot:{mode:'cot',topic:'setup',source:'local',fields:[textField('text','schema')]},
 peft:{mode:'peft',topic:'adaptation',source:'local',fields:[textField('text','code')]},
 cache:{mode:'cache',topic:'memory',source:'local',fields:[textField('text','old_prompt'),textField('text2','new_prompt')]},
 drift:{mode:'drift',topic:'evidence',source:'local',fields:[
  ...['a','b'].flatMap(side=>[
   {id:'score_'+side,label:'score_'+side,type:'number',min:0,max:100,step:'any',required:true},
   {id:'framework_'+side,label:'framework_'+side,type:'select',options:FRAMEWORKS.map(x=>[x.id,x.label])},
   {id:'dtype_'+side,label:'dtype_'+side,type:'select',options:DTYPES.map(x=>[x.id,x.label])},
   {id:'batch_'+side,label:'batch_'+side,type:'number',min:1,max:100000,required:true},
   {id:'template_'+side,label:'template_'+side,type:'select',options:['unknown','applied','not_applied'].map(x=>[x,'@drift.template.'+x])},
  ]),{id:'comparable',label:'comparable',type:'checkbox',required:true}]},
 pvr:{mode:'pvr',topic:'gamma',source:'local',fields:[textField('text','measurement'),textField('text2','reference',false)]},
 adapter:{mode:'adapter',topic:'adaptation',source:'local',fields:[textField('text','adapter_config'),{id:'base',label:'base_model',type:'text',required:false}]},
};
export const LOCAL_DEMOS={
 cot:{text:'{"type":"object","properties":{"answer":{"type":"string"},"reasoning":{"type":"string"}},"required":["answer","reasoning"]}'},
 peft:{text:'config = LoraConfig(r=8, lora_alpha=16)\nmodel = get_peft_model(base_model, config)\nmodel = prepare_model_for_kbit_training(model)'},
 cache:{text:'You help users.\nVersion: 1\nQuestion: What is KV cache?',text2:'You help users.\nVersion: 2\nQuestion: What is KV cache?'},
 drift:{score_a:67.2,score_b:65.1,framework_a:'lm-eval-hf',framework_b:'vllm-served',dtype_a:'bf16',dtype_b:'bf16',batch_a:1,batch_b:8,template_a:'applied',template_b:'not_applied',comparable:true},
 pvr:{text:JSON.stringify({model:'Synthetic/uniform',gamma:0,theta:10000,T_eval:32,protocol:{length:32},source:'analytic_uniform_example'},null,2)},
 adapter:{text:JSON.stringify({peft_type:'LORA',base_model_name_or_path:'Example/Base-A',r:8,lora_alpha:16,target_modules:['q_proj','v_proj']},null,2),base:'Example/Base-B'},
};
const object=v=>v && typeof v==='object' && !Array.isArray(v);
function parseObject(text){const obj=JSON.parse(text);if(!object(obj))throw new Error('inputs');return obj;}
function checkedInputs(id,inputs){
 if(!Object.hasOwn(LOCAL_CASES,id))throw new Error('case');const entry=LOCAL_CASES[id];
 for(const f of entry.fields){const v=inputs[f.id];
  if(f.type==='number' && (!Number.isFinite(v)||v<f.min||v>f.max||(f.step!=='any'&&!Number.isInteger(v))))throw new Error('inputs');
  if(f.type==='select'&&!f.options.some(([key])=>key===v))throw new Error('inputs');
  if(f.type==='checkbox'&&v!==true)throw new Error('inputs');
  if(['textarea','text'].includes(f.type)&&(typeof v!=='string'&&(f.required||v!=null)||typeof v==='string'&&(v.length>50000||(f.required&&!v.trim()))))throw new Error('inputs');
 }
}
export function solveLocalCase(id,inputs){
 checkedInputs(id,inputs);
 const out={caseId:id,status:'local_result',summaryKey:'local_'+id,summaryParams:{},facts:[],notices:[],nextKey:'next_'+id};
 const fact=(key,value)=>out.facts.push({key,value});
 if(id==='cot'){
  const parsed=parseObject(inputs.text);if(parsed.properties!=null&&!object(parsed.properties))throw new Error('inputs');
  if(parsed.required!=null&&(!Array.isArray(parsed.required)||parsed.required.some(x=>typeof x!=='string')))throw new Error('inputs');
  const r=lintJsonCot(inputs.text);out.checkCode=r.code;
  out.summaryKey=r.code==='anti_pattern'?'cot_review':r.code==='good_order'?'cot_ordered':'cot_unclassified';
  fact('field_count',r.params.field_count||0);
  if(r.code==='anti_pattern')out.suggestion=reorderJsonText(inputs.text,r.params.suggested_order);
 }else if(id==='peft'){
  const r=lintPeftCode(inputs.text);out.checkCode=r.code;
  out.notices=r.findings.map(f=>({key:'peft_'+f.rule,line:f.line}));
  out.summaryKey=r.code==='no_peft_calls'?'peft_absent':r.code==='clean'?'peft_clear':'peft_review';
  out.summaryParams={count:r.findings.length};fact('finding_count',r.findings.length);
 }else if(id==='cache'){
  const common=longestCommonPrefix(inputs.text,inputs.text2);
  out.cacheEvidence={relation:inputs.text===inputs.text2?'identical':common===inputs.text.length?'append':common===inputs.text2.length?'shortened':common===0?'start':'changed'};
  out.summaryKey=inputs.text===inputs.text2?'cache_identical':'cache_changed';
  out.summaryParams={common,total:inputs.text2.length};fact('prefix_units',common);fact('new_units',inputs.text2.length);fact('changed_units',inputs.text2.length-common);
 }else if(id==='drift'){
  const setup=s=>({score:inputs['score_'+s],framework:inputs['framework_'+s],dtype:inputs['dtype_'+s],batch:inputs['batch_'+s],chat_template:inputs['template_'+s]});
  const r=computeDriftBound(setup('a'),setup('b'));
  out.driftEvidence={templateUnknown:[inputs.template_a,inputs.template_b].includes('unknown'),templateMismatch:r.breakdown.template_mismatch,changedSettings:['framework','dtype','batch'].filter(k=>inputs[k+'_a']!==inputs[k+'_b']),aboveHeuristic:r.observed_gap>r.numerical_band};
  out.summaryKey=r.observed_gap<=r.numerical_band?'drift_within':'drift_review';out.summaryParams={gap:r.observed_gap,band:r.numerical_band};
  fact('score_gap',r.observed_gap);fact('heuristic_band',r.numerical_band);
  if(r.breakdown.template_mismatch)out.notices.push({key:'drift_templates'});
 }else if(id==='pvr'){
  const m=normalizeMeasured(parseObject(inputs.text));if(!m||!Number.isFinite(m.gamma_obs))throw new Error('inputs');
  const context=predictionContext(m,{}),missing=missingProtocolFields(m);
  if(context.status!=='documented')out.notices.push({key:'pvr_context_'+context.status});
  fact('gamma_measured',m.gamma_obs);fact('missing_fields',missing.length);
  out.summaryKey='pvr_incomplete';out.summaryParams={count:missing.length};
  if(context.status==='documented'){
   const row=predictionVsReality({},m).find(x=>x.metric==='gamma');
   if(row&&Number.isFinite(row.predicted)&&Number.isFinite(row.delta)){out.summaryKey='pvr_compared';out.summaryParams={measured:row.measured,predicted:row.predicted,delta:row.delta};fact('gamma_baseline',row.predicted);fact('gamma_delta',row.delta);}
  }
  let reference=null;
  if(inputs.text2?.trim()){
   reference=normalizeMeasured(parseObject(inputs.text2));if(!reference||!Number.isFinite(reference.gamma_obs))throw new Error('inputs');
   const comparison=compareProtocols(m,reference);out.notices.push({key:'protocol_'+comparison.status});
  }
  out.protocolReview=reviewProtocol(m,reference);
 }else if(id==='adapter'){
  const cfg=parseObject(inputs.text);
  if(typeof cfg.peft_type!=='string'||!cfg.peft_type.trim()||(cfg.r!=null&&(!Number.isInteger(cfg.r)||cfg.r<=0))||(cfg.lora_alpha!=null&&(!Number.isFinite(cfg.lora_alpha)||cfg.lora_alpha<0)))throw new Error('inputs');
  const parsed=parseAdapterConfig(cfg),checks=compatChecks(parsed,inputs.base||'');
  // Soft-prompt methods do not require LoRA-style target modules.
  const usesTargets=!['prompt_tuning','p_tuning','prefix_tuning','multitask_prompt_tuning'].includes(parsed.peftType);
  const warnings=checks.filter(c=>['warn','bad'].includes(c.level)&&(usesTargets||c.code!=='targets_empty'));
  out.adapterEvidence={base:checks.find(c=>c.code.startsWith('base_'))?.code||'base_unknown',targets:checks.find(c=>c.code.startsWith('targets_'))?.code||'targets_empty',usesTargets};
  out.summaryKey=checks.some(c=>c.code==='base_mismatch')?'adapter_mismatch':warnings.length?'adapter_review':'adapter_metadata';
  out.summaryParams={count:warnings.length};fact('finding_count',warnings.length);
  out.notices.push(...warnings.map(c=>({key:'adapter_'+c.code})));
  if(parsed.r!=null)fact('rank',parsed.r);if(parsed.scaling!=null)fact('scaling',parsed.scaling);
  if(checks.some(c=>c.code==='base_match_family'))out.notices.push({key:'adapter_family_only'});
  if(parsed.rankPattern||parsed.alphaPattern)out.notices.push({key:'adapter_patterns'});
 }
 return out;
}
// Do not include pasted prompts, Python, measurements, adapter files or proposals in reports.
export function publicLocalInputs(id,inputs){return Object.fromEntries(LOCAL_CASES[id].fields.filter(f=>['number','select','checkbox'].includes(f.type)).map(f=>[f.id,inputs[f.id]]));}
