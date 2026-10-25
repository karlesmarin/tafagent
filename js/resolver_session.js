import {CASES,solveCase,validResolverModel} from './resolver.js';
import {LOCAL_CASES} from './resolver_local.js';
import {PROGRESS_STATES,progressPlan} from './resolver_progress.js';
import {observationChoices,OBSERVATION_LIMIT} from './resolver_observations.js';

// Portable private inputs, not a trusted result or executable session.
export const CASE_FILE_LIMIT=4*1024*1024;
const fail=()=>{throw new Error('case_file_invalid');};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const string=(x,max=50000)=>typeof x==='string'&&x.length<=max;
const date=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT/.test(x)&&Number.isFinite(Date.parse(x));
function bounded(value,depth=0,count={n:0}){
 if(depth>30||++count.n>100000)fail();
 if(value===null||typeof value==='boolean')return;
 if(typeof value==='number'){if(!Number.isFinite(value))fail();return;}
 if(typeof value==='string'){if(value.length>2000000)fail();return;}
 if(!object(value)&&!Array.isArray(value))fail();
 for(const [key,v] of Object.entries(value)){
  if(['__proto__','prototype','constructor'].includes(key))fail();
  bounded(v,depth+1,count);
 }
}
function inputFields(route,data){
 if(!object(data))fail();
 const keys=LOCAL_CASES[route]?.fields.map(f=>f.id)??(route==='memory'?['vram','context','precision','stage','peak','peakUnit','peakMetric','peakSame','peakIsolated']:[]);
 if(Object.keys(data).some(k=>!keys.includes(k)))fail();
 const copy=Object.fromEntries(keys.filter(k=>Object.hasOwn(data,k)).map(k=>[k,data[k]]));
 if(route==='memory'){
  if(!Number.isFinite(copy.vram)||copy.vram<=0||copy.vram>100000||!Number.isInteger(copy.context)||copy.context<1||copy.context>10000000)fail();
  if(!['BF16','FP16','FP32','INT8','NF4','F16','Q8_0','Q4_K_M'].includes(copy.precision)||!['load','generate','prefill','decode'].includes(copy.stage))fail();
  if(copy.peak!=null&&(!Number.isFinite(copy.peak)||copy.peak<0||copy.peak>1e9))fail();
  if(copy.peakUnit!=null&&!['GiB','GB','MiB'].includes(copy.peakUnit))fail();
  if(copy.peakMetric!=null&&!['unknown','allocated','reserved','device'].includes(copy.peakMetric))fail();
  for(const k of ['peakSame','peakIsolated'])if(copy[k]!=null&&typeof copy[k]!=='boolean')fail();
 }
 return copy;
}
function metadata(route,data){
 if(!object(data)||!['local','hf','demo'].includes(data.origin))fail();
 const local=CASES[route].source==='local';
 if(local&&data.origin==='hf'||!local&&data.origin==='local')fail();
 if(data.model!=null&&!string(data.model,200))fail();
 if(data.origin==='hf'&&(!validResolverModel(data.model)||!/^\w{40}$/.test(data.revision||'')||!/^[a-f0-9]+$/.test(data.revision)))fail();
 if(data.revision!=null&&!/^[a-f0-9]{40}$/.test(data.revision))fail();
 if(data.checkedAt!=null&&!date(data.checkedAt))fail();
 if(data.demoScenario!=null&&(!string(data.demoScenario,80)||data.origin!=='demo'))fail();
 const bundle={origin:data.origin,model:local?null:data.model??null,revision:data.revision??null,checkedAt:data.checkedAt??null,sources:[]};
 if(data.demoScenario!=null)bundle.demoScenario=data.demoScenario;
 if(!local){
  if(!Array.isArray(data.sources)||data.sources.length>10)fail();
  for(const source of data.sources){
   if(!object(source)||!string(source.url,2000)||![200,404].includes(source.status))fail();
   const url=new URL(source.url);
   if(url.protocol!=='https:'||url.hostname!=='huggingface.co'||url.port||url.username||url.password)fail();
   bundle.sources.push({url:url.href,status:source.status});
  }
  if(route==='template'){
   if(!object(data.tokenizer))fail();
   // Keep only the inspected template, never unrelated tokenizer metadata.
   bundle.tokenizer=Object.hasOwn(data.tokenizer,'chat_template')?{chat_template:data.tokenizer.chat_template}:{};
   if(data.template!=null&&!string(data.template,2000000))fail();
   bundle.template=data.template??null;
  }else{
   if(!object(data.config))fail();
   bundle.config=data.config;
  }
 }
 return bundle;
}
export function readSavedCase(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>CASE_FILE_LIMIT)throw new Error('case_file_large');
 const file=JSON.parse(text);bounded(file);
 if(!object(file))fail();
 if(file.schema_version!=null&&file.format==null)throw new Error('case_file_report');
 if(file.format!=='taf-resolver-private-case'||file.version!==1||!Object.hasOwn(CASES,file.route)||!date(file.saved_at))fail();
 const route=file.route,bundle=metadata(route,file.bundle),inputs=inputFields(route,file.inputs),first=inputFields(route,file.initial_inputs);
 const result=solveCase(route,bundle,inputs),initial={inputs:first,result:solveCase(route,bundle,first)};
 const state={route,bundle,inputs,result,initial},plan=progressPlan(state);
 let progressMarks=null,planChanged=false;
 if(file.progress!==null){
  const p=file.progress;
  if(!object(p)||!string(p.key,100)||!Array.isArray(p.states)||p.states.length!==3||p.states.some(s=>!PROGRESS_STATES.includes(s)))fail();
  if(p.key===plan?.key)progressMarks={key:p.key,states:[...p.states]};else planChanged=true;
 }
 if(!Array.isArray(file.observations)||file.observations.length>OBSERVATION_LIMIT)fail();
 const observations=[];
 for(const e of file.observations){
  if(!object(e)||e.route!==route||!string(e.plan_key,100)||!Number.isInteger(e.step)||e.step<0||e.step>=3||!observationChoices(route).includes(e.code))fail();
  if(e.plan_key===plan?.key)observations.push({route,plan_key:e.plan_key,step:e.step,code:e.code});else planChanged=true;
 }
 if(!['','worked','failed'].includes(file.feedback))fail();
 // Every import remains unverified, even if its declared origin says "hf".
 bundle.restoredFromFile=true;
 return {...state,progressMarks,observations,feedback:planChanged?'':file.feedback,savedAt:file.saved_at,planChanged};
}
export function saveCase(state,progress=null,observations=[],feedback=''){
 const {route,bundle,inputs,initial}=state;
 if(!Object.hasOwn(CASES,route)||!bundle||!initial)fail();
 const cleanBundle=metadata(route,bundle);
 const file={format:'taf-resolver-private-case',version:1,saved_at:new Date().toISOString(),route,bundle:cleanBundle,
  inputs:inputFields(route,inputs),initial_inputs:inputFields(route,initial.inputs),progress,observations,feedback};
 const text=JSON.stringify(file,null,2);
 readSavedCase(text); // Same limits and recomputation as import; no result is trusted.
 return text;
}
