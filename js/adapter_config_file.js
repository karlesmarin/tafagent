import {solveLocalCase} from './resolver_local.js';
// File input contract only: no remote access, expression evaluation or model run.
export const ADAPTER_FILE_LIMIT=50000;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function readAdapterConfigFile(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>ADAPTER_FILE_LIMIT)throw new Error('adapter_file_large');
 const body=text.replace(/^\uFEFF/,'');
 let record;try{record=JSON.parse(body);}catch{throw new Error('adapter_file_invalid');}
 if(!object(record))throw new Error('adapter_file_invalid');
 const todo=[[record,0]];let count=0;
 while(todo.length){
  const [value,depth]=todo.pop();if(depth>20||++count>25000)throw new Error('adapter_file_invalid');
  if(typeof value==='number'&&!Number.isFinite(value))throw new Error('adapter_file_invalid');
  if(object(value)||Array.isArray(value))for(const child of Object.values(value))todo.push([child,depth+1]);
 }
 const invalid=()=>{throw new Error('adapter_file_invalid');};
 for(const key of ['base_model_name_or_path','revision','task_type'])if(record[key]!=null&&typeof record[key]!=='string')invalid();
 for(const key of ['use_rslora','use_dora'])if(record[key]!=null&&typeof record[key]!=='boolean')invalid();
 const strings=x=>Array.isArray(x)&&x.every(v=>typeof v==='string');
 if(record.target_modules!=null&&typeof record.target_modules!=='string'&&!strings(record.target_modules))invalid();
 if(record.modules_to_save!=null&&!strings(record.modules_to_save))invalid();
 for(const key of ['rank_pattern','alpha_pattern'])if(record[key]!=null){
  if(!object(record[key])||!Object.values(record[key]).every(v=>Number.isFinite(v)&&(key==='rank_pattern'?Number.isInteger(v)&&v>0:v>=0)))invalid();
 }
 try{solveLocalCase('adapter',{text:body,base:''});}catch{invalid();}
 const label=x=>typeof x==='string'&&x.trim()?x.slice(0,160):null;
 return {text:body,preview:{type:label(record.peft_type),base:label(record.base_model_name_or_path),
  revision:label(record.revision),task:label(record.task_type),rank:record.r??null,alpha:record.lora_alpha??null}};
}
