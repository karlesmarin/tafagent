import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.TAF_URL||'http://127.0.0.1:8877/';
const live=!!process.env.TAF_URL;
const q=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url))).models.find(x=>x.id==='Qwen/Qwen3-8B');
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async r=>{
  const url=r.request().url();
  if(url.includes('pyodide.js'))return r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'});
  // Known fixture for the real-input path; no GPU execution or real model measurement.
  if(url.startsWith('https://huggingface.co/api/models?'))return r.fulfill({json:[{id:q.id}]});
  if(url.startsWith('https://huggingface.co/api/models/'))return r.fulfill({json:{sha:q.revision}});
  if(url.startsWith('https://huggingface.co/')&&url.includes('/resolve/'))return r.fulfill({json:q.config});
  if(!url.startsWith(base))return r.abort();
  if(live)return r.continue();
  const path=resolve(root,decodeURIComponent(new URL(url).pathname.slice(new URL(base).pathname.length))||'index.html');
  if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!existsSync(path))return r.fulfill({status:404,body:''});
  return r.fulfill({path});
 });
 const el=id=>page.locator('#resolver-'+id);
 async function exportCase(){const pending=page.waitForEvent('download');await el('export').click();return JSON.parse(readFileSync(await(await pending).path(),'utf8'));}
 async function peak(value='22528',metric='allocated'){
  await el('peak-fields').evaluate(e=>e.open=true);await el('peak').fill(value);await el('peakUnit').selectOption('MiB');await el('peakMetric').selectOption(metric);await el('peakSame').check();await el('peakIsolated').check();
 }
 async function run(){await el('run').click();await el('export').waitFor();}
 for(const lang of ['en','es','fr','zh']){
  const tr=k=>RESOLVER_TRANSLATIONS[lang]['resolver.'+k];
  await page.goto(base+'?resolve=memory&lang='+lang);await el('dialog').waitFor();
  await el('demo').click();await el('export').waitFor();await el('check-examples').evaluate(e=>e.open=true);
  await page.locator('[data-check-example="peak"]').click();await el('peak-result').waitFor();
  let report=await exportCase();assert.equal(report.result.memoryPeak.source,'illustrative');assert.equal(report.result.memoryPeak.reported_GiB,22);
  assert.ok((await el('peak-result').innerText()).includes(tr('demo_note')));
  assert.ok((await el('memory-phase').innerText()).includes(tr('peak_phase_prefill')));
  const a=el('case-summary').locator('a');assert.equal(new URL(await a.getAttribute('href')).hash,'#sec-resolver-memory-peaks');
  await el('own-case').click();assert.equal(await el('peak').inputValue(),'');assert.equal(await el('peakSame').isChecked(),false);
  await el('model').fill(q.id);await el('vram').fill('24');await el('context').fill('4096');await el('stage').selectOption('prefill');await peak();await run();
  report=await exportCase();assert.equal(report.result.memoryPeak.source,'user_reported');assert.equal(report.result.memoryPeak.reported_GiB,22);assert.equal(report.result.memoryPeak.status,'baseline_comparison');assert.equal(report.review.memory_peak.independently_verified,false);
  assert.ok((await el('peak-result').innerText()).includes(tr('peak_provenance')));
  await page.evaluate(()=>document.querySelector('.lang-btn[data-lang="es"]').click());
  assert.equal(await el('peak').inputValue(),'22528');assert.ok((await el('peak-result').innerText()).includes(RESOLVER_TRANSLATIONS.es['resolver.peak_provenance']));
  await page.evaluate(lang=>document.querySelector('.lang-btn[data-lang="'+lang+'"]').click(),lang);
  for(const metric of ['reserved','device','unknown']){await el('peakMetric').selectOption(metric);await run();report=await exportCase();assert.equal(report.result.memoryPeak.difference_GiB,null);assert.ok((await el('peak-result').innerText()).includes(tr('peak_block_metric')));}
  for(const stage of ['load','decode','generate']){
   await el('stage').selectOption(stage);assert.equal(await el('peak').inputValue(),'');await peak();await run();report=await exportCase();
   assert.equal(report.result.memoryPeak.phase,stage);assert.ok((await el('memory-phase').innerText()).includes(tr('peak_phase_'+stage)));
   if(stage==='generate')assert.equal(report.result.memoryPeak.status,'not_comparable');
   if(stage==='load'){assert.equal(report.result.memoryPeak.baseline_kind,'resident_weights');assert.equal(await el('result').locator(':scope > dl').count(),1);}
  }
  await el('peakSame').uncheck();await run();assert.ok((await exportCase()).result.memoryPeak.blockers.includes('workload'));
  await el('peakSame').check();await el('peakIsolated').uncheck();await run();assert.ok((await exportCase()).result.memoryPeak.blockers.includes('isolated'));
  await el('stage').selectOption('prefill');await peak();await run();
  await page.setViewportSize({width:390,height:844});assert.ok(await el('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  if(process.env.TAF_SCREENSHOTS){mkdirSync(process.env.TAF_SCREENSHOTS,{recursive:true});await el('peak-result').screenshot({path:process.env.TAF_SCREENSHOTS+'/peak-'+lang+'.png'});}
  await page.setViewportSize({width:1280,height:900});
  const quant=el('result').locator('.resolver-actions').first().locator('button').first();await quant.click();assert.equal(await el('peak').inputValue(),'');assert.equal((await exportCase()).result.memoryPeak,null);
  for(const [id,value] of [['vram','25'],['context','5000'],['model','Qwen/Other']]){await peak();await el(id).fill(value);assert.equal(await el('peak').inputValue(),'');}
  await el('precision').selectOption('BF16');await peak();await el('precision').selectOption('FP16');assert.equal(await el('peak').inputValue(),'');
  await el('peak-fields').locator('summary').focus();await page.keyboard.press('Enter');assert.equal(await el('peak-fields').evaluate(e=>e.open),false);
 }
 assert.deepEqual(errors,[]);console.log('Memory peak browser PASS: four phases/languages, units, synthetic vs reported data, gates, JSON, stale resets, language refresh, keyboard and mobile.');
}finally{await browser.close();}
