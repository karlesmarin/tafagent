import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base=process.env.TAF_URL||'http://127.0.0.1:8877/',live=!!process.env.TAF_URL;
const q=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url))).models.find(x=>x.id==='Qwen/Qwen3-8B');
const fixture={format:'taf-memory-measurement',version:1,kind:'measurement',model:q.id,revision:q.revision,phase:'prefill',tokens:4096,precision:'BF16',measured_at:'2026-10-25T12:00:00Z',phase_isolated:true,peak:{value:22528,unit:'MiB',metric:'allocated'},workload:{gpu_count:1,batch_size:1,resident_weights:true,kv_dtype:'FP16'},runtime:{engine:'pytorch',version:'browser-fixture',device:'PRIVATE-runtime-device'}};
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
 async function file(text){await el('measurement-import').evaluate(e=>e.open=true);await el('measurement-file').setInputFiles({name:'measurement.json',mimeType:'application/json',buffer:Buffer.from(text)});}
 async function attach(record){const count=hf;await file(JSON.stringify(record));await el('measurement-apply').click();await el('export').waitFor();assert.equal(hf,count);assert.equal(await el('peakSame').isChecked(),false);assert.equal(await el('peakIsolated').isChecked(),false);}
 async function confirm(){await el('peak-fields').evaluate(e=>e.open=true);await el('peakSame').check();await el('peakIsolated').check();await run();}
 async function afterFile(record){await el('comparison').evaluate(e=>e.open=true);await el('comparison-file').setInputFiles({name:'after.json',mimeType:'application/json',buffer:Buffer.from(typeof record==='string'?record:JSON.stringify(record))});}
 async function afterAttach(record){const count=hf;await afterFile(record);await el('comparison-apply').click();assert.equal(hf,count);assert.equal(await el('comparison-confirm').isChecked(),false);}
 const after={...fixture,measured_at:'2026-10-25T13:00:00Z',peak:{value:20,unit:'GiB',metric:'allocated'}};
 for(const lang of ['en','es','fr','zh']){
  await page.goto(base+'?resolve=memory&lang='+lang);await el('model').fill(q.id);await el('vram').fill('24');await el('context').fill('4096');await el('stage').selectOption('prefill');await run();
  assert.equal(await el('comparison').count(),0);await attach(fixture);await confirm();
  await afterAttach(after);let report=JSON.parse(await download());assert.equal(report.result.memoryPeak.comparison.delta_GiB,null);
  const count=hf;await el('comparison-confirm').check();assert.equal(hf,count);report=JSON.parse(await download());assert.equal(report.result.memoryPeak.comparison.delta_GiB,-2);assert.equal(report.result.memoryPeak.comparison.direction,'lower');
  assert.equal(report.inputs.measurementAfter,undefined);assert.ok(!JSON.stringify(report).includes('PRIVATE-runtime-device'));
  await el('save-case').evaluate(e=>e.open=true);const saved=await download('save-case-button');assert.equal(JSON.parse(saved).version,3);assert.equal(JSON.parse(saved).inputs.measurementAfter.runtime.device,fixture.runtime.device);
  await page.reload();await el('case-open').evaluate(e=>e.open=true);await el('case-file').setInputFiles({name:'private.json',mimeType:'application/json',buffer:Buffer.from(saved)});await el('case-apply').click();await el('export').waitFor();
  report=JSON.parse(await download());assert.equal(report.result.memoryPeak.comparison.delta_GiB,-2);assert.equal(report.restored_from_file,true);
  const before=await download();await afterFile('{bad');await page.waitForFunction(()=>document.getElementById('resolver-comparison-status').textContent.length);assert.deepEqual(JSON.parse(await download()).result,JSON.parse(before).result);
  await afterFile(' '.repeat(65537));await page.waitForFunction(()=>document.getElementById('resolver-comparison-status').textContent.length);assert.deepEqual(JSON.parse(await download()).result,JSON.parse(before).result);
  for(const patch of [{revision:null},{kind:'example'},{runtime:{...after.runtime,version:'changed'}},{measured_at:fixture.measured_at}]){
   await afterAttach({...after,...patch});await el('comparison-confirm').check();report=JSON.parse(await download());assert.equal(report.result.memoryPeak.comparison.delta_GiB,null);
  }
  await afterAttach(after);await el('comparison-confirm').focus();await page.keyboard.press('Space');report=JSON.parse(await download());assert.equal(report.result.memoryPeak.comparison.delta_GiB,-2);
  await page.setViewportSize({width:390,height:844});await el('comparison-result').evaluate(e=>e.scrollIntoView({block:'start'}));assert.ok(await el('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  if(process.env.TAF_SCREENSHOTS){mkdirSync(process.env.TAF_SCREENSHOTS,{recursive:true});await page.screenshot({path:process.env.TAF_SCREENSHOTS+'/comparison-'+lang+'.png'});}
  const link=new URL(await el('comparison').locator('a').getAttribute('href'));assert.equal(link.hash,'#sec-resolver-memory-comparison');assert.ok(link.pathname.endsWith('/R5-tafagent.html'));
  await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>document.querySelector('.lang-btn[data-lang="es"]').click());report=JSON.parse(await download());assert.equal(report.result.memoryPeak.comparison.delta_GiB,-2);
  await el('comparison').evaluate(e=>e.open=true);await el('comparison-clear').click();report=JSON.parse(await download());assert.equal(report.result.memoryPeak.comparison,null);assert.ok(report.result.memoryPeak.measurement);
  await afterAttach(after);await el('comparison-confirm').check();await attach(fixture);report=JSON.parse(await download());assert.equal(report.result.memoryPeak.comparison,null);
  await confirm();await afterAttach(after);await el('context').fill('8192');assert.equal(await el('peak').inputValue(),'');await run();assert.equal(JSON.parse(await download()).result.memoryPeak,null);assert.equal(await el('comparison').count(),0);
 }
 assert.deepEqual(errors,[]);console.log('Memory pair browser PASS: four languages, preview/apply, guards, confirmations, local-only comparison, privacy, v3 restore, invalid files, clearing, guide, keyboard/mobile.');
}finally{await browser.close();}
