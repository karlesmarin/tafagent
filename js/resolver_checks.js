// Priorities based on available evidence only. No inference or automatic fixes.
export function selectResolverChecks({route,result,inputs={}}){
 if(!result)return null;
 let priority;
 if(route==='memory'){
  if(!['limited','weights_bound','load_other','kv_bound','fits_tight','fits_comfortably'].includes(result.status))return null;
  priority=result.status==='limited'?'architecture':result.status==='weights_bound'?'weights':inputs.stage==='load'?'load':result.status==='kv_bound'?'kv':result.status==='fits_tight'?'tight':'fit';
 }else if(route==='template'){
  if(!['missing','multiple','present'].includes(result.status))return null;
  priority=result.status;
 }
 else if(route==='adapter'){
  const e=result.adapterEvidence;
  if(!e)return null;
  const notices=new Set(result.notices.map(n=>n.key));
  priority=['base_unknown','base_declared'].includes(e.base)?'base':e.base==='base_mismatch'?'mismatch':e.base==='base_match_family'?'family':e.usesTargets&&e.targets==='targets_empty'?'targets':notices.has('adapter_modules_to_save_embed')?'embeddings':notices.has('adapter_patterns')?'patterns':notices.has('adapter_scaling_high')||notices.has('adapter_scaling_low')?'scale':'activation';
 }else return null;
 const code=route+'_'+priority;
 const tools=route==='memory'?(priority==='architecture'?['memreal']:['launch','memreal']):route==='template'?(priority==='present'?['cot','drift']:['template']):priority==='activation'?['peft']:['adapter'];
 return {version:1,route,priority:code,title_key:'checks_'+code,steps:['check_'+code,'check_'+route+'_observe','check_'+route+'_interpret'],tools,executed:false};
}

export const CHECK_DEMOS={memory:['kv','weights','load','fit'],template:['present','missing','multiple'],adapter:['mismatch','base','activation']};
export function checkDemo(route,scenario,bundle){
 if(bundle?.origin!=='demo'||!CHECK_DEMOS[route]?.includes(scenario))throw new Error('demo');
 if(route==='memory')return {bundle,inputs:{vram:scenario==='weights'?4:24,context:scenario==='kv'?131072:4096,precision:'BF16',stage:scenario==='load'?'load':'generate'}};
 if(route==='template')return {bundle:{...bundle,template:null,tokenizer:scenario==='missing'?{}:{chat_template:scenario==='multiple'?{chat:'{{ messages }}',tools:'{{ tools }}'}:'{{ messages }}'}},inputs:{}};
 const cfg={peft_type:'LORA',base_model_name_or_path:'Example/Base-A',r:8,lora_alpha:16,target_modules:['q_proj','v_proj']};
 return {bundle,inputs:{text:JSON.stringify(cfg,null,2),base:scenario==='base'?'':scenario==='mismatch'?'Example/Base-B':'Example/Base-A'}};
}
