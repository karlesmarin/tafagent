import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CASES,suggestCases,validResolverModel,solveCase,templateInspection,fetchResolverBundle,resolverLink} from '../js/resolver.js';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
import {buildResolverSummary} from '../js/resolver_summary.js';
const catalog=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url)));
const q=catalog.models.find(x=>x.id==='Qwen/Qwen3-8B'),hybrid=catalog.models.find(x=>x.id.includes('Qwen3.8'));
const opts={vram:24,context:131072,precision:'BF16',stage:'generate'};
let r=solveCase('memory',q,opts);
assert.equal(r.status,'kv_bound');assert.ok(r.smallerContext>0&&r.smallerContext<opts.context);
assert.equal(solveCase('memory',q,{...opts,context:r.smallerContext}).fit.fits,true);
const adjustedInputs={...opts,context:r.smallerContext};
const adjusted=solveCase('memory',q,adjustedInputs);
for(const lang of ['es','en','fr','zh']) {
 const summary=buildResolverSummary({route:'memory',bundle:{...q,model:q.id,origin:'demo'},initial:{inputs:opts,result:r},inputs:adjustedInputs,result:adjusted},lang);
 const url=new URL(summary.guide.url);
 assert.ok(url.pathname.endsWith('/20-kv-cache.html'));
 assert.equal(url.hash,lang==='es'?'#el-problema':'#the-problem');
 assert.equal(url.searchParams.has('model'),false);
 assert.ok(summary.change.includes('→'));
 assert.ok(summary.finding.includes(r.fit.totalGB.toLocaleString(lang,{maximumFractionDigits:2})));
 assert.ok(summary.change.includes(adjusted.fit.totalGB.toLocaleString(lang,{maximumFractionDigits:2})));
 assert.ok(!summary.problem.includes('undefined'));
}
for(const [caseId,bundle,inputs,path] of [
 ['memory',q,{...opts,vram:4},'35-compresion'],
 ['memory',q,{...opts,stage:'load'},'36-serving'],
 ['memory',hybrid,opts,'18-taxonomia'],
 ['template',{tokenizer:{}},{},'40-evaluacion'],
 ['compatibility',q,{},'18-taxonomia'],
]) {
 const result=solveCase(caseId,bundle,inputs);
 const summary=buildResolverSummary({route:caseId,bundle:{...bundle,model:'Owner/Model',origin:'hf'},inputs,result},'en');
 assert.ok(new URL(summary.guide.url).pathname.endsWith(path+'.html'));
 assert.equal(new URL(summary.guide.url).searchParams.get('model'),'Owner/Model');
 assert.equal(summary.change,null);
}
assert.ok(r.alternatives.every(x=>['INT8','NF4'].includes(x.precision)));
assert.equal(solveCase('memory',q,{...opts,stage:'load'}).status,'load_other');
assert.equal(solveCase('memory',q,{...opts,vram:4,stage:'load'}).status,'weights_bound');
assert.equal(solveCase('memory',hybrid,opts).status,'limited');
assert.equal(solveCase('compatibility',hybrid).memory.cls,'HYBRID');
assert.equal(solveCase('compatibility',q).status,'geometry');
for(const inputs of [{...opts,vram:NaN},{...opts,context:0},{...opts,context:1.2},{...opts,precision:'bad'},{...opts,stage:'training'}])assert.throws(()=>solveCase('memory',q,inputs));
assert.throws(()=>solveCase('__proto__',q));
assert.equal(templateInspection({}).status,'missing');
assert.equal(templateInspection({chat_template:'<|im_start|><|im_end|>'}).family,'chatml');
assert.equal(templateInspection({chat_template:[{name:'a',template:'a'},{name:'b',template:'b'}]}).status,'multiple');
assert.equal(templateInspection({chat_template:{default:'ok',tool_use:'x'}}).status,'present');
assert.equal(templateInspection({chat_template:'old'},'new').length,3);
assert.equal(templateInspection({chat_template:'old'},'').status,'missing');
for(const text of ['sin memoria','out of memory','mémoire GPU','显存不足'])assert.ok(suggestCases(text).includes('memory'));
assert.deepEqual(suggestCases('hello'),[]);assert.equal(validResolverModel('https://evil.example'),false);
assert.equal(validResolverModel('Owner/../secret'),false);
const url=new URL(resolverLink('memory','Qwen/Qwen3-8B','https://example.org/?error=secret&token=xxx#private','es'));
assert.deepEqual([...url.searchParams.keys()],['resolve','model','lang']);assert.equal(url.hash,'');
for(const lang of ['es','fr','zh'])assert.deepEqual(Object.keys(RESOLVER_TRANSLATIONS[lang]),Object.keys(RESOLVER_TRANSLATIONS.en));
const calls=[];const fetcher=async url=>{
 calls.push(url);
 return new Response(JSON.stringify(url.includes('/api/models/')?{sha:q.revision}:q.config),{status:200});
};
const bundle=await fetchResolverBundle(q.id,'memory',{fetcher});
assert.equal(bundle.revision,q.revision);assert.equal(calls.length,2);assert.ok(calls[1].includes('/resolve/'+q.revision+'/'));
assert.equal(bundle.origin,'hf');
await assert.rejects(()=>fetchResolverBundle(q.id,'memory',{fetcher:async()=>new Response('',{status:401})}),/restricted/);
await assert.rejects(()=>fetchResolverBundle(q.id,'memory',{fetcher:async()=>new Response('{"sha":"main"}') }),/revision/);
const templateBundle=await fetchResolverBundle(q.id,'template',{fetcher:async url=>new Response(url.includes('/api/models/')?JSON.stringify({sha:q.revision}):'',{status:url.includes('/api/models/')?200:404})});
assert.equal(solveCase('template',templateBundle).status,'missing');assert.equal(templateBundle.sources.filter(s=>s.status===404).length,2);
assert.equal(Object.keys(CASES).length,3);
console.log('Resolver PASS: three routes, load/generation distinction, estimate boundaries, template variants, revision provenance, translations and private-data-free links.');
