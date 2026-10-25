// Bounded local UTF-8 input. This never evaluates code or prompts.
export const TEXT_FILE_LIMIT=50000;
export const TEXT_FILE_ROUTES=['cot','peft','cache'];
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function readResolverTextFile(route,bytes){
 if(!TEXT_FILE_ROUTES.includes(route))throw new Error('text_file_invalid');
 if(!(bytes instanceof Uint8Array)&&!(bytes instanceof ArrayBuffer))throw new Error('text_file_invalid');
 if(bytes.byteLength>TEXT_FILE_LIMIT)throw new Error('text_file_large');
 let body;try{body=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{throw new Error('text_file_encoding');}
 body=body.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
 if(!body.trim()||body.includes('\0'))throw new Error('text_file_invalid');
 if(route==='cot'){
  let record;try{record=JSON.parse(body);}catch{throw new Error('text_file_json');}
  if(!object(record)||(record.properties!=null&&!object(record.properties))||
    (record.required!=null&&(!Array.isArray(record.required)||record.required.some(x=>typeof x!=='string'))))throw new Error('text_file_json');
  const todo=[[record,0]];let count=0;
  while(todo.length){const [value,depth]=todo.pop();if(depth>20||++count>25000)throw new Error('text_file_json');
   if(typeof value==='number'&&!Number.isFinite(value))throw new Error('text_file_json');
   if(object(value)||Array.isArray(value))for(const child of Object.values(value))todo.push([child,depth+1]);
  }
 }
 const lines=body.split('\n'),sample=Array.from(lines.slice(0,12).join('\n')).slice(0,1200).join('');
 return {text:body,preview:{bytes:bytes.byteLength,lines:lines.length,sample,truncated:sample!==body}};
}
