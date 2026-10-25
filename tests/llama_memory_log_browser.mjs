import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base=process.env.TAF_URL||'http://127.0.0.1:8877/',live=!!process.env.TAF_URL;
const q=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url))).models.find(x=>x.id==='Qwen/Qwen3-8B');
const fixture=`main: build: 1234 (abcdef0)
private path: /home/PRIVATE-PATH/model.gguf
load_tensors: offloaded 33/33 layers to GPU
load_tensors: CUDA0 model buffer size = 8192.00 MiB
llama_context: n_ctx = 4096
llama_context: n_seq_max = 1
llama_kv_cache: CUDA0 KV buffer size = 512.00 MiB
llama_kv_cache: size = 512.00 MiB (4096 cells, 32 layers, 1/1 seqs), K (f16): 256.00 MiB, V (f16): 256.00 MiB
llama_context: CUDA0 compute buffer size = 128.00 MiB
llama_context: CUDA_Host output buffer size = 1.00 MiB`;
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];let hf=0;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async r=>{
  const url=r.request().url();
  if(url.includes('pyodide.js'))return r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'});
  if(url.startsWith('https://huggingface.co/api/models?'))return r.fulfill({json:[{id:q.id}]});
  if(url.startsWith('https://huggingface.co/api/models/')){hf++;return r.fulfill({json:{sha:q.revision}});}
  if(url.startsWith('https://huggingface.co/')&&url.includes('/resolve/'))return r.fulfill({json:q.config});
  if(!url.startsWith(base))return r.abort();
  if(live)return r.continue();
  const path=resolve(root,decodeURIComponent(new URL(url).pathname.slice(new URL(base).pathname.length))||'index.html');
  if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!existsSync(path))return r.fulfill({status:404,body:''});
  return r.fulfill({path});
 });
 const el=id=>page.locator('#resolver-'+id);
 async function download(id='export'){const done=page.waitForEvent('download');await el(id).click();return readFileSync(await(await done).path(),'utf8');}
 async function run(){await el('run').click();await el('export').waitFor();}

 async function open(){await el('llama-import').evaluate(e=>e.open=true);}
 async function file(text){await open();await el('llama-file').setInputFiles({name:'private.log',mimeType:'text/plain',buffer:Buffer.from(text)});}
 async function attach(text){const count=hf;await file(text);await el('llama-apply').click();await el('export').waitFor();assert.equal(hf,count);assert.equal(await el('llama-same').isChecked(),false);}
 for(const lang of ['en','es','fr','zh']){
  const tr=k=>RESOLVER_TRANSLATIONS[lang]['resolver.llama_'+k];
  await page.goto(base+'?resolve=memory&lang='+lang);await el('model').fill(q.id);await el('vram').fill('24');await el('context').fill('4096');await el('stage').selectOption('prefill');await run();
  const baseline=JSON.parse(await download());
  await open();await el('llama-example').click();assert.equal(await el('llama-apply').count(),0);assert.ok((await el('llama-preview').innerText()).includes(tr('example_note')));await el('llama-cancel').click();
  await attach(fixture);let report=JSON.parse(await download());assert.equal(report.result.llamaLog.metric,'declared_buffer_sizes');assert.equal(report.result.llamaLog.comparisons[0].difference_GiB,null);assert.equal(report.result.memoryPeak,null);
  assert.ok(!JSON.stringify(report).includes('PRIVATE-PATH'));assert.equal(report.inputs.llamaLog,undefined);
  await el('llama-same').check();report=JSON.parse(await download());assert.notEqual(report.result.llamaLog.comparisons[0].difference_GiB,null);assert.notEqual(report.result.llamaLog.comparisons[1].difference_GiB,null);
  assert.ok(!(await el('llama-import').innerText()).includes('â€'));
  if(process.env.TAF_SCREENSHOTS&&lang==='es'){mkdirSync(process.env.TAF_SCREENSHOTS,{recursive:true});await el('llama-import').locator('table').last().evaluate(e=>e.scrollIntoView({block:'center'}));await page.screenshot({path:process.env.TAF_SCREENSHOTS+'/llama-table-es.png'});}
  assert.deepEqual(report.result.fit,baseline.result.fit);
  await el('save-case').evaluate(e=>e.open=true);const saved=await download('save-case-button');assert.equal(JSON.parse(saved).version,4);assert.equal(JSON.parse(saved).inputs.llamaLog,fixture);
  await page.reload();await el('case-open').evaluate(e=>e.open=true);const count=hf;await el('case-file').setInputFiles({name:'private.json',mimeType:'application/json',buffer:Buffer.from(saved)});await el('case-apply').click();await el('export').waitFor();assert.equal(hf,count);report=JSON.parse(await download());assert.equal(report.restored_from_file,true);assert.notEqual(report.result.llamaLog.comparisons[1].difference_GiB,null);
  const before=report.result;
  for(const text of ['invalid', ' '.repeat(262145)]){await file(text);await page.waitForFunction(()=>document.getElementById('resolver-llama-status').textContent);assert.deepEqual(JSON.parse(await download()).result,before);assert.equal(await el('llama-apply').count(),0);}
  await el('llama-file').setInputFiles({name:'bad.log',mimeType:'text/plain',buffer:Buffer.from([0xff])});await page.waitForFunction(()=>document.getElementById('resolver-llama-status').textContent);assert.equal(await el('llama-status').innerText(),tr('invalid'));
  await el('llama-text').fill(fixture.replaceAll('f16','q8_0'));await el('llama-preview-button').click();await el('llama-apply').focus();await page.keyboard.press('Enter');await el('llama-same').check();report=JSON.parse(await download());assert.equal(report.result.llamaLog.comparisons[1].difference_GiB,null);assert.ok(report.result.llamaLog.comparisons[1].blockers.includes('dtype'));
  const url=new URL(await el('llama-import').locator('a').getAttribute('href'));assert.equal(url.hash,'#sec-resolver-llama-log');assert.equal(url.searchParams.get('lang'),lang);
  await page.setViewportSize({width:390,height:844});assert.ok(await el('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  if(process.env.TAF_SCREENSHOTS){mkdirSync(process.env.TAF_SCREENSHOTS,{recursive:true});await el('llama-import').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:process.env.TAF_SCREENSHOTS+'/llama-'+lang+'.png'});}
  await page.setViewportSize({width:1280,height:900});
  await page.evaluate(()=>document.querySelector('.lang-btn[data-lang="es"]').click());report=JSON.parse(await download());assert.ok(report.result.llamaLog);assert.equal(report.result.llamaLog.meta.k,'q8_0');
  // Literal data never becomes HTML, and a partial/multi-run excerpt cannot enable a delta.
  await attach(fixture+'\n<img src=x onerror="window.LOG_EXECUTED=true">\nload_tensors: CUDA0 model buffer size = 1.00 MiB');await el('llama-same').check();assert.equal(await page.evaluate(()=>window.LOG_EXECUTED),undefined);report=JSON.parse(await download());assert.equal(report.result.llamaLog.groups[0].listed_MiB,null);assert.equal(report.result.llamaLog.comparisons[0].difference_GiB,null);
  await el('llama-clear').click();assert.equal(JSON.parse(await download()).result.llamaLog,null);
  await attach(fixture);await el('context').fill('8192');await run();assert.equal(JSON.parse(await download()).result.llamaLog,null);
  // A late file read cannot attach to a different case after an input edit.
  await page.evaluate(()=>{const original=File.prototype.arrayBuffer;File.prototype.arrayBuffer=async function(){await new Promise(r=>setTimeout(r,300));return original.call(this);};});
  await file(fixture);await el('context').fill('4096');await page.waitForTimeout(450);await run();assert.equal(await el('llama-apply').count(),0);
 }
 assert.deepEqual(errors,[]);console.log('llama.cpp browser PASS: four languages, file/paste/preview/example/apply, gated deltas, private v4, privacy, malformed data, stale reads, clearing, guide, keyboard/mobile; no import requests.');
}finally{await browser.close();}
