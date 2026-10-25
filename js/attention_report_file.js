import {normalizeMeasured,predictionContext,missingProtocolFields} from './prediction_reality.js';
// Bound work before recursive protocol inspection. Contents remain user declarations.
export const ATTENTION_FILE_LIMIT=50000;
export function readAttentionReport(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>ATTENTION_FILE_LIMIT)throw new Error('attention_file_large');
 const body=text.replace(/^\uFEFF/,'');
 let record;try{record=JSON.parse(body);}catch{throw new Error('attention_file_invalid');}
 if(!record||typeof record!=='object'||Array.isArray(record))throw new Error('attention_file_invalid');
 const todo=[[record,0]];let count=0;
 while(todo.length){
  const [value,depth]=todo.pop();if(depth>20||++count>25000)throw new Error('attention_file_invalid');
  if(typeof value==='number'&&!Number.isFinite(value))throw new Error('attention_file_invalid');
  if(value&&typeof value==='object')for(const child of Object.values(value))todo.push([child,depth+1]);
 }
 const measured=normalizeMeasured(record);
 if(!measured||!Number.isFinite(measured.gamma_obs))throw new Error('attention_file_gamma');
 const label=x=>typeof x==='string'?x.slice(0,160):null;
 return {text:body,preview:{gamma:measured.gamma_obs,model:label(measured.model),revision:label(measured.revision),
  source:label(record.source),context:predictionContext(measured,{}).status,missing:missingProtocolFields(measured).length}};
}
