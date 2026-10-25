// Priorities based on available evidence only. No inference or automatic fixes.
export function selectResolverChecks({route,result,inputs={}}){
 if(!result)return null;
 let priority;
 if(route==='compatibility'){
  if(!['geometry','limited'].includes(result.status)||!Array.isArray(result.reasons))return null;
  const outside=['multimodal','moe','mla','hybrid','window','position','rope','unreviewed'];
  priority=result.status==='geometry'?'geometry':result.reasons.some(r=>outside.includes(r))?'scope':'metadata';
 }else if(route==='cot'){
  const codes={anti_pattern:'order',good_order:'ordered',missing_reasoning:'unclassified',missing_answer:'unclassified',no_cot_fields:'unclassified',empty_fields:'unclassified'};
  if(!Object.hasOwn(codes,result.checkCode))return null;
  priority=codes[result.checkCode];
 }else if(route==='peft'){
  if(!['no_peft_calls','clean','errors_found','warnings_only','info_only'].includes(result.checkCode)||!Array.isArray(result.notices))return null;
  const keys=new Set(result.notices.map(n=>n.key));
  priority=result.checkCode==='no_peft_calls'?'unrecognized':keys.has('peft_silent_base_load')?'load':keys.has('peft_qlora_order')?'order':keys.has('peft_target_modules_mismatch')?'targets':keys.has('peft_alpha_not_2r')?'scale':'clear';
 }else if(route==='memory'){
  if(!['limited','weights_bound','load_other','kv_bound','fits_tight','fits_comfortably'].includes(result.status))return null;
  priority=result.status==='limited'?'architecture':result.status==='weights_bound'?'weights':inputs.stage==='load'?'load':result.status==='kv_bound'?'kv':['prefill','decode'].includes(inputs.stage)?inputs.stage:result.status==='fits_tight'?'tight':'fit';
 }else if(route==='template'){
  if(!['missing','multiple','present'].includes(result.status))return null;
  priority=result.status;
 }
 else if(route==='adapter'){
  const e=result.adapterEvidence;
  if(!e)return null;
  const notices=new Set(result.notices.map(n=>n.key));
  priority=['base_unknown','base_declared'].includes(e.base)?'base':e.base==='base_mismatch'?'mismatch':e.base==='base_match_family'?'family':e.usesTargets&&e.targets==='targets_empty'?'targets':notices.has('adapter_modules_to_save_embed')?'embeddings':notices.has('adapter_patterns')?'patterns':notices.has('adapter_scaling_high')||notices.has('adapter_scaling_low')?'scale':'activation';
 }else if(route==='cache'){
  if(!['identical','append','shortened','start','changed'].includes(result.cacheEvidence?.relation))return null;
  priority=result.cacheEvidence.relation;
 }else if(route==='drift'){
  const e=result.driftEvidence;
  if(!e||!['templateUnknown','templateMismatch','aboveHeuristic'].every(k=>typeof e[k]==='boolean')||!Array.isArray(e.changedSettings))return null;
  priority=e.templateUnknown?'unknown':e.templateMismatch?'templates':e.changedSettings.length?'settings':e.aboveHeuristic?'repeat':'within';
 }else return null;
 const code=route+'_'+priority;
 const tools=route==='compatibility'?(priority==='geometry'?['fitcheck','launch']:['inspector','memreal']):route==='cot'?['cot']:route==='peft'?['adapter']:route==='memory'?(priority==='architecture'?['memreal']:['launch','memreal']):route==='template'?(priority==='present'?['cot','drift']:['template']):route==='cache'?['tax']:route==='drift'?(['unknown','templates'].includes(priority)?['template']:['drift']):priority==='activation'?['peft']:['adapter'];
 return {version:1,route,priority:code,title_key:'checks_'+code,steps:['check_'+code,'check_'+route+'_observe','check_'+route+'_interpret'],tools,executed:false};
}

export const CHECK_DEMOS={memory:['kv','weights','load','fit','peak'],template:['present','missing','multiple'],adapter:['mismatch','base','activation'],cache:['changed','identical','append','shortened','start'],drift:['templates','unknown','settings','repeat','within'],compatibility:['scope','metadata','geometry'],cot:['order','ordered','unclassified'],peft:['order','load','targets','scale','unrecognized','clear']};
export function checkDemo(route,scenario,bundle){
 if(bundle?.origin!=='demo'||!CHECK_DEMOS[route]?.includes(scenario))throw new Error('demo');
 if(route==='compatibility'){
  const dense={model_type:'llama',rope_theta:10000,num_attention_heads:8,num_key_value_heads:2,hidden_size:512,num_hidden_layers:4,head_dim:64,max_position_embeddings:2048,intermediate_size:1024,vocab_size:1024,tie_word_embeddings:false};
  const config=scenario==='metadata'?{model_type:'llama'}:scenario==='scope'?{...dense,num_local_experts:4,num_parameters:10000000}:dense;
  return {bundle:{origin:'demo',model:null,revision:null,sources:[],config},inputs:{}};
 }
 if(route==='cot'){
  const fields=scenario==='unclassified'?{city:{type:'string'}}:scenario==='order'?{answer:{type:'string'},reasoning:{type:'string'}}:{reasoning:{type:'string'},answer:{type:'string'}};
  return {bundle,inputs:{text:JSON.stringify({type:'object',properties:fields,required:Object.keys(fields)},null,2)}};
 }
 if(route==='peft'){
  const snippets={
   order:'config = LoraConfig(r=8, lora_alpha=16)\nmodel = get_peft_model(base_model, config)\nmodel = prepare_model_for_kbit_training(model)',
   load:'adapter_path = "Example/trained_lora"\nmodel = get_peft_model(base_model, config)',
   targets:'model_id = "Example/llama"\nconfig = LoraConfig(r=8, lora_alpha=16, target_modules=["does_not_exist"])',
   scale:'config = LoraConfig(r=8, lora_alpha=64)',
   unrecognized:'model = custom_adapter_loader(base_model)',
   clear:'model = prepare_model_for_kbit_training(base_model)\nconfig = LoraConfig(r=8, lora_alpha=16)\nmodel = get_peft_model(model, config)',
  };
  return {bundle,inputs:{text:snippets[scenario]}};
 }
 if(route==='memory'&&scenario==='peak')return {bundle,inputs:{vram:24,context:4096,precision:'BF16',stage:'prefill',peak:22,peakUnit:'GiB',peakMetric:'allocated',peakSame:true,peakIsolated:true}};
 if(route==='memory')return {bundle,inputs:{vram:scenario==='weights'?4:24,context:scenario==='kv'?131072:4096,precision:'BF16',stage:scenario==='load'?'load':'generate'}};
 if(route==='template')return {bundle:{...bundle,template:null,tokenizer:scenario==='missing'?{}:{chat_template:scenario==='multiple'?{chat:'{{ messages }}',tools:'{{ tools }}'}:'{{ messages }}'}},inputs:{}};
 if(route==='cache'){
  const text='You help users.\nVersion: 1\nQuestion: What is KV cache?';
  const variants={changed:text.replace('Version: 1','Version: 2'),identical:text,append:text+' Explain briefly.',shortened:'You help users.',start:'Please help users.\nQuestion: What is KV cache?'};
  return {bundle,inputs:{text,text2:variants[scenario]}};
 }
 if(route==='drift'){
  const inputs={score_a:67.2,score_b:65.1,framework_a:'lm-eval-hf',framework_b:'lm-eval-hf',dtype_a:'bf16',dtype_b:'bf16',batch_a:1,batch_b:1,template_a:'applied',template_b:'applied',comparable:true};
  if(scenario==='templates'){inputs.template_b='not_applied';inputs.framework_b='vllm-served';inputs.batch_b=8;}
  if(scenario==='unknown')inputs.template_b='unknown';
  if(scenario==='settings'){inputs.framework_b='vllm-served';inputs.batch_b=8;}
  if(scenario==='within')inputs.score_b=67.1;
  return {bundle,inputs};
 }
 const cfg={peft_type:'LORA',base_model_name_or_path:'Example/Base-A',r:8,lora_alpha:16,target_modules:['q_proj','v_proj']};
 return {bundle,inputs:{text:JSON.stringify(cfg,null,2),base:scenario==='base'?'':scenario==='mismatch'?'Example/Base-B':'Example/Base-A'}};
}
