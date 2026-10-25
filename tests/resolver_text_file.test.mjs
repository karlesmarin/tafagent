import assert from 'node:assert/strict';
import {readResolverTextFile,TEXT_FILE_LIMIT} from '../js/resolver_text_file.js';
import {solveLocalCase,publicLocalInputs} from '../js/resolver_local.js';
import {saveCase,readSavedCase} from '../js/resolver_session.js';
const bytes=x=>new TextEncoder().encode(x),read=(route,text)=>readResolverTextFile(route,bytes(text));
for(const route of ['peft','cache']){
 assert.equal(read(route,'\ufeffPRIVATE_A\r\nPRIVATE_B\rC').text,'PRIVATE_A\nPRIVATE_B\nC');
 const p=read(route,'a\n'.repeat(20)+'PRIVATE_TAIL');assert.equal(p.preview.lines,21);assert.equal(p.preview.truncated,true);assert.equal(p.preview.sample.split('\n').length,12);assert.ok(p.text.includes('PRIVATE_TAIL'));
 const emoji=read(route,'😀'.repeat(1300));assert.equal(Array.from(emoji.preview.sample).length,1200);assert.equal(emoji.preview.bytes,5200);
 assert.equal(read(route,'x'.repeat(TEXT_FILE_LIMIT)).text.length,TEXT_FILE_LIMIT);
 assert.throws(()=>read(route,'x'.repeat(TEXT_FILE_LIMIT+1)),/text_file_large/);
 assert.throws(()=>read(route,'汉'.repeat(20000)),/text_file_large/);
 for(const empty of ['',' \r\n','\ufeff','a\0b'])assert.throws(()=>read(route,empty),/text_file_invalid/);
 assert.throws(()=>readResolverTextFile(route,new Uint8Array([0xc3,0x28])),/text_file_encoding/);
 assert.throws(()=>readResolverTextFile(route,new Uint8Array([0xff,0xfe,65,0])),/text_file_encoding/);
}
assert.throws(()=>read('adapter','{}'),/text_file_invalid/);
assert.throws(()=>readResolverTextFile('peft','code'),/text_file_invalid/);
const raw='{"type":"object","properties":{"answer":{"type":"string"},"reasoning":{"type":"string"},"__proto__":{"type":"string"}},"required":["answer","PRIVATE_REQUIRED"],"private":"PRIVATE_NOTES"}';
assert.equal(read('cot',raw).text,raw);assert.equal({}.private,undefined);
for(const invalid of ['[]','null','true','{bad','{"properties":[]}','{"required":[3]}','{"x":1e400}'])assert.throws(()=>read('cot',invalid),/text_file_json/);
let deep={};for(let i=0;i<22;i++)deep={x:deep};assert.throws(()=>read('cot',JSON.stringify(deep)),/text_file_json/);
const fixtures={cot:{text:raw},peft:{text:'# PRIVATE_NOTE\nmodel = get_peft_model(base, cfg)\nmodel = prepare_model_for_kbit_training(model)'},cache:{text:'PRIVATE_PREFIX\r\nA',text2:'PRIVATE_PREFIX\nB'}};
for(const [route,initial] of Object.entries(fixtures)){
 const inputs=Object.fromEntries(Object.entries(initial).map(([k,v])=>[k,read(route,v).text]));
 const result=solveLocalCase(route,inputs);assert.deepEqual(publicLocalInputs(route,inputs),{});
 // JSON suggestions can contain private input; they must be projected out by UI export.
 if(route!=='cot')assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
 if(route==='cot'){const proposed=JSON.parse(result.suggestion);assert.deepEqual(proposed.required,['answer','PRIVATE_REQUIRED']);assert.ok(Object.hasOwn(proposed.properties,'__proto__'));}
 if(route==='cache')assert.equal(result.facts.find(x=>x.key==='prefix_units').value,'PRIVATE_PREFIX\n'.length);
 const state={route,bundle:{origin:'local',model:null,sources:[]},inputs,result,initial:{inputs,result}};
 const saved=saveCase(state),restored=readSavedCase(saved);assert.equal(JSON.parse(saved).version,1);assert.ok(saved.includes('PRIVATE_'));assert.deepEqual(restored.inputs,inputs);assert.deepEqual(restored.result,result);
}
assert.equal(solveLocalCase('peft',{text:read('peft','this is not Python').text}).summaryKey,'peft_absent');
assert.equal(read('cache','<script>globalThis.bad=true</script>').text,'<script>globalThis.bad=true</script>');
console.log('Text files PASS: three routes, UTF-8/BOM/LF, size/structure bounds, partial preview, raw privacy, schema preservation, code-as-text and private v1 continuity.');
