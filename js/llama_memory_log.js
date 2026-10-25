// Local, unauthenticated llama.cpp buffer declarations. Never GPU peak counters.
export const LLAMA_LOG_LIMIT=262144;
const fail=()=>{throw new Error('llama_invalid');};
export function normalizeLlamaLog(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>LLAMA_LOG_LIMIT)throw new Error('llama_large');
 text=text.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
 if(!text.trim()||text.includes('\0'))fail();
 return text;
}
export function readLlamaLog(bytes){
 if(!(bytes instanceof Uint8Array)&&!(bytes instanceof ArrayBuffer))fail();
 if(bytes.byteLength>LLAMA_LOG_LIMIT)throw new Error('llama_large');
 let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{fail();}
 text=normalizeLlamaLog(text);parseLlamaLog(text);return text;
}
export function parseLlamaLog(text){
 text=normalizeLlamaLog(text);
 const rows=[],issues=new Set(),seen=new Set(),meta={context:null,sequences:null,cells:null,k:null,v:null,offloaded:null,layers:null,build:null};
 const put=(key,value)=>{if(meta[key]!==null)issues.add('ambiguous');else meta[key]=value;};
 const number=s=>{const x=Number(s);if(!Number.isFinite(x)||x<0||x>1e9)fail();return x;};
 const families={model:'weights',KV:'kv',RS:'recurrent',compute:'compute',output:'output'};
 for(const [i,raw] of text.split('\n').entries()){
  // ANSI colour is cosmetic; otherwise prefixes/formats outside this grammar stay unrecognized.
  const line=raw.replace(/\x1b\[[0-9;]*m/g,'').trim();
  const match=line.match(/^(load_tensors|llama_model_load_tensors|llama_context|llama_new_context_with_model|llama_kv_cache|llama_kv_cache_init|llama_memory_recurrent):\s+(\S{1,64})\s+(model|KV|RS|compute|output) buffer size\s*=\s*(\d+(?:\.\d+)?) MiB$/);
  if(match){
   const [,fn,label,kind,size]=match;
   const valid=(kind==='model'&&/^(load_tensors|llama_model_load_tensors)$/.test(fn))||
    (kind==='KV'&&/^llama_kv_cache(?:_init)?$/.test(fn))||
    (kind==='RS'&&fn==='llama_memory_recurrent')||
    (['compute','output'].includes(kind)&&/^(llama_context|llama_new_context_with_model)$/.test(fn));
   if(!valid){issues.add('unrecognized');continue;}
   const location=/^CUDA\d{1,3}$/.test(label)?label:/^(CPU|CPU_Mapped|CUDA_Host)$/.test(label)?label:'other';
   if(location==='other')issues.add('backend');
   const category=families[kind],key=location+':'+category;
   if(seen.has(key))issues.add('ambiguous');seen.add(key);
   rows.push({line:i+1,location,category,MiB:number(size)});
   if(rows.length>128)fail();
   continue;
  }
  // Do not silently accept alternative units, negative/nonfinite sizes or changing formats.
  if(/\bbuffer size\s*=/.test(line))issues.add('unrecognized');
  let m=line.match(/^(?:llama_context|llama_new_context_with_model):\s+(n_ctx|n_seq_max)\s*=\s*(\d+)$/);
  if(m)put(m[1]==='n_ctx'?'context':'sequences',number(m[2]));
  m=line.match(/^(?:load_tensors|llama_model_load_tensors): offloaded (\d+)\/(\d+) layers to GPU$/);
  if(m){put('offloaded',number(m[1]));put('layers',number(m[2]));}
  m=line.match(/^llama_kv_cache(?:_init)?: size\s*=\s*\d+(?:\.\d+)? MiB \(\s*(\d+) cells,.*\), K \(([a-z0-9_]+)\):.* V \(([a-z0-9_]+)\):/);
  if(m){const dtype=s=>['f16','bf16','f32','q8_0','q4_0','q4_1','q5_0','q5_1','iq4_nl'].includes(s)?s:'unknown';put('cells',number(m[1]));put('k',dtype(m[2]));put('v',dtype(m[3]));}
  m=line.match(/^(?:main: )?build:\s*(\d{1,10})\s*\(([a-f0-9]{7,40})\)(?:\s|$)/i);
  if(m)put('build',m[1]+' ('+m[2].toLowerCase()+')');
 }
 if(!rows.length)fail();
 const devices=[...new Set(rows.filter(r=>/^CUDA\d+$/.test(r.location)).map(r=>r.location))];
 const groups=[...new Set(rows.map(r=>r.location))].map(location=>({location,
  // Repeated buffers could be reloads or shards; neither is silently summed.
  listed_MiB:issues.has('ambiguous')?null:rows.filter(r=>r.location===location).reduce((a,r)=>a+r.MiB,0)}));
 return {rows,groups,devices,meta,issues:[...issues]};
}
export function reviewLlamaLog(inputs,fit,origin='hf'){
 if(inputs.llamaLog==null){if(inputs.llamaSame!=null)fail();return null;}
 if(typeof inputs.llamaSame!=='boolean')fail();
 const log=parseLlamaLog(inputs.llamaLog),{meta}=log;
 const shared=[...log.issues];
 if(origin==='demo')shared.push('example');
 if(!fit?.ok)shared.push('scope');
 if(!inputs.llamaSame)shared.push('identity');
 if(!meta.build)shared.push('build');
 if(log.devices.length!==1)shared.push('devices');
 if(!(meta.layers>0&&meta.offloaded===meta.layers))shared.push('offload');
 const comparisons=['weights','kv'].map(category=>{
  const blockers=[...shared],gpu=log.rows.filter(r=>/^CUDA\d+$/.test(r.location)&&r.category===category);
  if(gpu.length!==1)blockers.push('missing');
  if(log.rows.some(r=>!/^CUDA\d+$/.test(r.location)&&r.category===category&&r.MiB>0))blockers.push('host');
  if(category==='kv'){
   if(inputs.stage==='load')blockers.push('phase');
   if(meta.context!==inputs.context||meta.cells!==inputs.context)blockers.push('context');
   if(meta.sequences!==1)blockers.push('sequences');
   if(meta.k!=='f16'||meta.v!=='f16')blockers.push('dtype');
   if(log.rows.some(r=>r.category==='recurrent'))blockers.push('recurrent');
  }
  const estimated_GiB=fit?.ok?(category==='weights'?fit.weightsGB:fit.kvGB):null;
  const reported_GiB=gpu.length===1?gpu[0].MiB/1024:null;
  return {category,estimated_GiB,reported_GiB,blockers:[...new Set(blockers)],
   difference_GiB:blockers.length?null:reported_GiB-estimated_GiB};
 });
 // No source text, filenames, paths, GPU product names or arbitrary log strings in reports.
 return {version:1,source:'imported_llamacpp_log',metric:'declared_buffer_sizes',
  independently_verified:false,executed_by_taf:false,...log,comparisons};
}
