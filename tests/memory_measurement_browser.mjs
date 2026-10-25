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
 for(const lang of ['en','es','fr','zh']){
  const tr=k=>RESOLVER_TRANSLATIONS[lang]['resolver.'+k];
  await page.goto(base+'?resolve=memory&lang='+lang);await el('model').fill(q.id);await el('vram').fill('24');await el('context').fill('4096');await el('stage').selectOption('prefill');await run();
  const sampled={...fixture,peak:{value:450,unit:'MiB',metric:'device'},sampling:{method:'nvidia-smi',count:3,interval_ms:250,max_gap_ms:300,duration_ms:600,baseline_MiB:400,total_MiB:1000}};
  await attach(sampled);assert.ok((await el('peak-result').innerText()).includes(tr('device_sampling_note')));assert.equal(JSON.parse(await download()).result.memoryPeak.difference_GiB,null);
  await el('save-case').evaluate(e=>e.open=true);assert.equal(JSON.parse(await download('save-case-button')).inputs.measurement.sampling.count,3);
  await attach(fixture);
  let report=JSON.parse(await download());assert.equal(report.result.memoryPeak.status,'not_comparable');assert.equal(report.inputs.measurement,undefined);
  assert.ok((await el('peak-result').innerText()).includes(tr('measurement_unverified')));
  await confirm();report=JSON.parse(await download());assert.equal(report.result.memoryPeak.status,'baseline_comparison');assert.equal(report.result.memoryPeak.reported_GiB,22);
  assert.ok(!JSON.stringify(report).includes('PRIVATE-runtime-device'));assert.equal(report.result.memoryPeak.measurement.compatible,true);
  await el('save-case').evaluate(e=>e.open=true);const saved=await download('save-case-button');assert.equal(JSON.parse(saved).version,2);assert.equal(JSON.parse(saved).inputs.measurement.runtime.device,fixture.runtime.device);
  await page.reload();await el('case-open').evaluate(e=>e.open=true);await el('case-file').setInputFiles({name:'private.json',mimeType:'application/json',buffer:Buffer.from(saved)});await el('case-apply').click();await el('export').waitFor();
  report=JSON.parse(await download());assert.equal(report.result.memoryPeak.measurement.compatible,true);assert.equal(report.restored_from_file,true);
  for(const patch of [{revision:'a'.repeat(40)},{tokens:null},{workload:{...fixture.workload,gpu_count:2}},{kind:'example'}]){
   await attach({...fixture,...patch});await confirm();report=JSON.parse(await download());assert.equal(report.result.memoryPeak.difference_GiB,null);assert.ok(report.result.memoryPeak.blockers.includes('measurement'));
  }
  await attach(fixture);await confirm();const before=await download();
  await file('{invalid');await page.waitForFunction(()=>document.getElementById('resolver-measurement-status').textContent.length);assert.equal(await el('measurement-status').innerText(),tr('measurement_invalid'));assert.deepEqual(JSON.parse(await download()).result,JSON.parse(before).result);
  await file(' '.repeat(65537));await page.waitForFunction(()=>document.getElementById('resolver-measurement-status').textContent.length);assert.equal(await el('measurement-status').innerText(),tr('measurement_large'));
  await file(JSON.stringify({...fixture,revision:null}));await el('measurement-apply').waitFor();
  const link=new URL(await el('measurement-import').locator('a').getAttribute('href'));assert.ok(link.pathname.endsWith('/chapters/R5-tafagent.html'));assert.equal(link.hash,'#sec-resolver-memory-import');
  await page.setViewportSize({width:390,height:844});assert.ok(await el('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  if(process.env.TAF_SCREENSHOTS){mkdirSync(process.env.TAF_SCREENSHOTS,{recursive:true});await el('measurement-preview').evaluate(e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:process.env.TAF_SCREENSHOTS+'/measurement-'+lang+'.png'});}
  await el('measurement-apply').focus();await page.keyboard.press('Enter');await el('export').waitFor();
  await page.setViewportSize({width:1280,height:900});
  await page.evaluate(()=>document.querySelector('.lang-btn[data-lang="es"]').click());assert.equal(await el('peak').inputValue(),'22528');
  await el('context').fill('8192');assert.equal(await el('peak').inputValue(),'');await run();assert.equal(JSON.parse(await download()).result.memoryPeak,null);
  // Manual edits detach the imported declaration, including unchanged identity.
  await el('context').fill('4096');await run();await attach(fixture);await el('peak').fill('12');await run();report=JSON.parse(await download());assert.equal(report.result.memoryPeak.measurement,null);
 }
 assert.deepEqual(errors,[]);console.log('Memory import browser PASS: four languages, preview/apply, matches/mismatches, manual confirmations, unverified provenance, privacy, v2 reopen, invalid files, clearing, guide, keyboard/mobile and no import network calls.');
}finally{await browser.close();}
