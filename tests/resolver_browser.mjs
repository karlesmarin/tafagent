import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
import {DEMO_STRINGS} from '../js/demo_i18n.js';
const base=process.env.TAF_URL||'http://127.0.0.1:8877/';
const catalog=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url)));
const q=catalog.models.find(x=>x.id==='Qwen/Qwen3-8B');
mkdirSync('tmp/resolver',{recursive:true});
const browser=await chromium.launch({headless:true,timeout:20000});
try{
 const page=await browser.newPage({viewport:{width:1150,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.resolverDemoSteps=[];
  new MutationObserver(()=>{
   const text=document.getElementById('__taf_demo_banner')?.textContent;
   if(text && !window.resolverDemoSteps.includes(text))window.resolverDemoSteps.push(text);
  }).observe(document,{childList:true,subtree:true,characterData:true});
 });
 await page.route('**/pyodide.js',r=>r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'}));
 let metadataRequests=0;
 await page.route('https://huggingface.co/api/models?**',r=>r.fulfill({json:[{id:q.id,downloads:100}]}));
 await page.route('https://huggingface.co/api/models/**',async r=>{metadataRequests++;return r.fulfill({json:{sha:q.revision}});});
 await page.route('https://huggingface.co/**/resolve/**',r=>r.fulfill({json:q.config}));
 for(const lang of ['es','en','fr','zh']){
  await page.goto(base+(lang==='es'?'?resolve=choose':lang==='fr'?'?resolve=demo':'?demo=resolver')+'&lang='+lang);
  if(lang==='es')await page.locator('.taf-demo-btn[data-demo-mode="resolver"]').click();
  await page.locator('#resolver-dialog #__taf_demo_explain').waitFor({timeout:35000});
  const finalSummary=page.locator('#resolver-demo-summary');
  assert.equal(await page.locator('#resolver-review').evaluate(el=>el.open),true);
  assert.ok((await page.locator('#resolver-review').innerText()).includes(RESOLVER_TRANSLATIONS[lang]['resolver.review_memory_limit']));
  assert.ok((await finalSummary.innerText()).includes(RESOLVER_TRANSLATIONS[lang]['resolver.summary_problem']));
  assert.ok((await finalSummary.innerText()).includes('→'));
  const finalLink=new URL(await finalSummary.locator('a').getAttribute('href'));
  assert.ok(finalLink.pathname.endsWith('/20-kv-cache.html'));
  assert.equal(finalLink.hash,lang==='es'?'#el-problema':'#the-problem');
  const steps=await page.evaluate(()=>window.resolverDemoSteps);
  for(let i=1;i<=6;i++)assert.ok(steps.some(s=>s.includes(DEMO_STRINGS[lang]['resolver.s'+i])),`Narrated step ${i}, ${lang}`);
  assert.equal(await page.locator('#resolver-symptom').inputValue(),'memory');
  assert.equal(await page.locator('#resolver-symptom-detail').inputValue(),'generate');
  assert.equal(await page.locator('#resolver-description').inputValue(),'','Guided demo must not require pasted error text');
  assert.ok(Number(await page.locator('#resolver-context').inputValue())<131072);
  assert.ok((await page.locator('#resolver-followup').innerText()).includes(RESOLVER_TRANSLATIONS[lang]['resolver.followup']));
  await page.locator('#resolver-own-case').click();
  for(const id of ['model','vram','context'])assert.equal(await page.locator('#resolver-'+id).inputValue(),'');
  assert.equal(await page.locator('#resolver-export').count(),0);
  await page.goto(base+'?resolve=memory&lang='+lang);
  await page.locator('#resolver-dialog[open]').waitFor();
  assert.equal(await page.locator('#resolver-title span').innerText(),RESOLVER_TRANSLATIONS[lang]['resolver.title']);
  await page.locator('#resolver-direct').evaluate(el=>el.open=true);
  for(const route of ['memory','template','compatibility']){
   await page.locator(`[data-resolver-case="${route}"]`).click();
   await page.locator('#resolver-demo').click();
   await page.locator('#resolver-export').waitFor();
   const summaryLink=new URL(await page.locator('#resolver-case-summary a').getAttribute('href'));
   assert.ok(summaryLink.pathname.includes(route==='memory'?'20-kv-cache':route==='template'?'40-evaluacion':'10-arquitecturas'));
   assert.ok((await page.locator('#resolver-result').innerText()).includes(RESOLVER_TRANSLATIONS[lang]['resolver.demo_note']));
   if(route==='memory'){
    assert.ok((await page.locator('#resolver-result').innerText()).includes(RESOLVER_TRANSLATIONS[lang]['resolver.kv_bound']));
    await page.locator('#resolver-reduce').click();
    assert.ok(Number(await page.locator('#resolver-context').inputValue())<131072);
   }
   await page.locator('#resolver-failed').click();
   assert.ok((await page.locator('#resolver-followup').innerText()).includes(RESOLVER_TRANSLATIONS[lang]['resolver.followup']));
   await page.locator('#resolver-worked').click();
   assert.ok((await page.locator('#resolver-followup').innerText()).includes(RESOLVER_TRANSLATIONS[lang]['resolver.solved']));
  }
 }
 assert.equal(metadataRequests,0,'Offline examples must not fetch model metadata');
 // Closing during guided selection stops the script; replay remains available.
 await page.goto(base+'?demo=resolver&lang=es');
 await page.locator('#resolver-dialog #__taf_demo_banner').waitFor();
 await page.locator('#resolver-close').click();
 const stoppedText=await page.locator('#resolver-description').inputValue();
 await page.waitForTimeout(250);
 assert.equal(await page.locator('#resolver-description').inputValue(),stoppedText);
 assert.equal(await page.locator('#resolver-dialog #__taf_demo_explain').count(),0);
 await page.locator('[data-resolver-open]').first().click();
 await page.locator('#resolver-start-demo').click();
 await page.locator('#resolver-dialog #__taf_demo_banner').waitFor();
 await page.locator('#resolver-description').fill('My own question');
 await page.locator('#resolver-description').press('End');
 await page.waitForTimeout(250);
 assert.equal(await page.locator('#resolver-description').inputValue(),'My own question');
 await page.goto(base+'?resolve=memory&lang=es&model=Qwen%2FQwen3-8B');
 await page.locator('#resolver-form').waitFor();assert.equal(metadataRequests,0,'Deep link does not run');
 await page.locator('#resolver-vram').fill('24');await page.locator('#resolver-context').fill('131072');
 await page.locator('#resolver-run').click();await page.locator('#resolver-export').waitFor();
 assert.equal(metadataRequests,1);
 assert.ok((await page.locator('#resolver-result').innerText()).includes('GiB'));
 const downloadPromise=page.waitForEvent('download');await page.locator('#resolver-export').click();
 const download=await downloadPromise;const report=JSON.parse(readFileSync(await download.path(),'utf8'));
 assert.equal(report.origin,'hf');assert.equal(report.revision,q.revision);assert.equal(report.inputs.context,131072);
 assert.equal(report.initial_inputs.context,131072);assert.ok(report.summary.guide.url.includes('20-kv-cache'));
 // Inputs invalidate earlier answers, so a changed model cannot inherit a verdict.
 await page.locator('#resolver-model').fill('Other/Model');
 assert.equal(await page.locator('#resolver-export').count(),0);
 // The dropdown is visible in a native dialog's top layer and supports keyboard selection.
 await page.locator('#resolver-model').fill('Qwen');
 await page.locator('#resolver-dialog [role="option"]').first().waitFor();
 await page.locator('#resolver-model').press('ArrowDown');await page.locator('#resolver-model').press('Enter');
 assert.equal(await page.locator('#resolver-model').inputValue(),q.id);
 await page.locator('#resolver-description').fill('secret-test-token sin memoria');
 await page.locator('#resolver-share').click();
 const share=await page.locator('#resolver-share-value').inputValue();assert.ok(!share.includes('secret-test-token'));assert.ok(!share.includes('131072'));
 // All rendering treats untrusted pasted text as data.
 await page.locator('#resolver-description').fill('<img src=x onerror=alert(1)> sin memoria');
 await page.locator('#resolver-suggest').click();assert.equal(await page.locator('#resolver-suggestions img').count(),0);
 await page.setViewportSize({width:390,height:844});
 await page.locator('#resolver-demo').click();await page.locator('#resolver-export').waitFor();
 assert.ok(await page.locator('#resolver-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await page.locator('#resolver-dialog').screenshot({path:'tmp/resolver/mobile.png'});
 await page.locator('#resolver-close').click();assert.equal(await page.locator('#resolver-dialog').isVisible(),false);
 await page.locator('[data-resolver-open]').first().click();await page.locator('#resolver-dialog[open]').waitFor();
 // Restricted metadata cannot leave a previous result on screen; the same form can retry.
 await page.route('https://huggingface.co/api/models/Denied/Model',r=>r.fulfill({status:401,body:'restricted'}));
 await page.locator('#resolver-model').fill('Denied/Model');await page.locator('#resolver-vram').focus();
 await page.locator('#resolver-run').click();
 await page.waitForFunction(()=>document.getElementById('resolver-status').textContent.includes('No se ha podido'));
 assert.equal(await page.locator('#resolver-export').count(),0);
 // An old response must not overwrite newer input, including when its request finishes later.
 let release, started;const ready=new Promise(resolve=>{started=resolve;});
 await page.route('https://huggingface.co/api/models/Slow/Model',async r=>{started();await new Promise(resolve=>{release=resolve;});try{await r.fulfill({json:{sha:q.revision}});}catch{}});
 await page.locator('#resolver-model').fill('Slow/Model');await page.locator('#resolver-vram').focus();
 await page.locator('#resolver-run').click();await ready;
 await page.locator('#resolver-model').fill('Fresh/Model');release();
 await page.waitForTimeout(100);
 assert.equal(await page.locator('#resolver-export').count(),0);
 assert.equal(await page.locator('#resolver-model').inputValue(),'Fresh/Model');
 assert.deepEqual(errors,[]);
 console.log('Resolver browser PASS: 3 offline routes × 4 languages, follow-up, recalculation, pinned live import, export, safe links, dialog autocomplete, mobile and no Pyodide dependency.');
}finally{await browser.close();}
await import('./resolver_local_browser.mjs');
await import('./resolver_return_browser.mjs');
await import('./resolver_protocol_browser.mjs');
await import('./resolver_checks_browser.mjs');
await import('./resolver_progress_browser.mjs');
