import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base=process.env.TAF_URL||'http://127.0.0.1:8877/',live=!!process.env.TAF_URL;
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];
 let external=0;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async r=>{
  const url=r.request().url();
  if(url.includes('pyodide.js'))return r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'});
  if(!url.startsWith(base)){external++;return r.abort();}
  if(live)return r.continue();
  const path=resolve(root,decodeURIComponent(new URL(url).pathname.slice(new URL(base).pathname.length))||'index.html');
  if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!existsSync(path))return r.fulfill({status:404,body:''});
  return r.fulfill({path});
 });
 const el=id=>page.locator('#resolver-'+id);
 async function download(id){const pending=page.waitForEvent('download');await el(id).click();return readFileSync(await(await pending).path(),'utf8');}
 async function openFile(text){await el('case-open').evaluate(e=>e.open=true);await el('case-file').setInputFiles({name:'saved.json',mimeType:'application/json',buffer:Buffer.from(text)});}
 for(const lang of ['en','es','fr','zh']){
  const tr=k=>RESOLVER_TRANSLATIONS[lang]['resolver.'+k];
  for(const route of ['memory','template','compatibility','cot','peft','cache','drift','pvr','adapter']){
   await page.goto(base+'?resolve='+route+'&lang='+lang);await el('dialog').waitFor();
   await el('demo').click();await el('export').waitFor();
   if(route==='memory'){
    await el('check-examples').evaluate(e=>e.open=true);await page.locator('[data-check-example="peak"]').click();
   }
   await el('progress').evaluate(e=>e.open=true);await el('progress-step-1').selectOption('blocked');
   await el('failed').click();await el('observation-step').selectOption('1');await el('observation-choice').selectOption('unavailable');await el('observation-save').click();
   const report=JSON.parse(await download('export'));
   await el('save-case').evaluate(e=>e.open=true);assert.ok((await el('save-case').innerText()).includes(tr('case_save_note')));
   const saved=await download('save-case-button');assert.equal(JSON.parse(saved).route,route);
   await page.reload();await el('dialog').waitFor();
   const before=external;
   await openFile(saved);await el('case-apply').waitFor();
   assert.ok((await el('case-preview').innerText()).includes(tr('case_ready')));
   await el('case-apply').click();await el('export').waitFor();assert.equal(external,before,'Import must not contact external services');
   const restored=JSON.parse(await download('export'));
   assert.equal(restored.restored_from_file,true);assert.equal(restored.review.restored_from_file,true);
   assert.deepEqual(restored.result,report.result,route);assert.deepEqual(restored.inputs,report.inputs);
   assert.equal(restored.progress.steps[1].status,'blocked');assert.equal(restored.observations.current.code,'unavailable');assert.equal(restored.user_feedback,'failed');
   assert.equal(restored.origin,'demo');assert.ok((await el('result').innerText()).includes(tr('case_restored')));
   if(['peft','cache','pvr','adapter','cot'].includes(route))assert.equal(restored.inputs.text,undefined,'Reduced report still omits pasted input');
   await el('progress').evaluate(e=>e.open=true);await el('progress-step-1').selectOption('checked');
   assert.equal(JSON.parse(await download('export')).progress.steps[1].status,'checked');
   if(route==='memory'){
    assert.equal(await el('peak').inputValue(),'22');assert.equal(await el('peakSame').isChecked(),true);
    await page.evaluate(()=>document.querySelector('.lang-btn[data-lang="es"]').click());assert.equal(await el('peak').inputValue(),'22');
    await page.evaluate(lang=>document.querySelector('.lang-btn[data-lang="'+lang+'"]').click(),lang);
    await openFile('{broken');await page.waitForFunction(()=>document.getElementById('resolver-case-file-status').textContent.length>0);assert.equal(await el('case-file-status').innerText(),tr('case_file_invalid'));
    assert.equal(await el('export').count(),1);assert.equal(await el('case-apply').count(),0);
    await openFile(JSON.stringify(report));await page.waitForFunction(()=>document.getElementById('resolver-case-file-status').textContent.length>0);assert.equal(await el('case-file-status').innerText(),tr('case_file_report'));
    await openFile(saved);await el('case-apply').waitFor();await el('case-cancel').click();assert.equal(await el('case-apply').count(),0);assert.equal(await el('export').count(),1);
    await page.setViewportSize({width:390,height:844});await openFile(saved);await el('case-apply').waitFor();assert.ok(await el('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    if(process.env.TAF_SCREENSHOTS){mkdirSync(process.env.TAF_SCREENSHOTS,{recursive:true});await el('case-open').screenshot({path:process.env.TAF_SCREENSHOTS+'/resume-'+lang+'.png'});}
    await el('case-apply').focus();await page.keyboard.press('Enter');await el('export').waitFor();await page.setViewportSize({width:1280,height:900});
    await el('context').fill('2048');assert.equal(await el('export').count(),0);
   }
  }
 }
 // Real-input path: memory alternatives retain original inputs; refresh is explicit.
 const q=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url))).models.find(x=>x.id==='Qwen/Qwen3-8B');
 let hfReads=0;
 await context.route('https://huggingface.co/api/models?*',r=>r.fulfill({json:[{id:q.id}]}));
 await context.route('https://huggingface.co/api/models/'+q.id, r=>{hfReads++;return r.fulfill({json:{sha:q.revision}});});
 await context.route('https://huggingface.co/'+q.id+'/resolve/**',r=>r.fulfill({json:q.config}));
 await page.goto(base+'?resolve=memory&lang=es');await el('dialog').waitFor();
 await el('model').fill(q.id);await el('vram').fill('24');await el('context').fill('131072');await el('run').click();await el('reduce').waitFor();await el('reduce').click();
 const initialReport=JSON.parse(await download('export'));assert.notEqual(initialReport.initial_inputs.context,initialReport.inputs.context);
 await el('save-case').evaluate(e=>e.open=true);const realSaved=await download('save-case-button');
 await page.reload();await el('dialog').waitFor();const readCount=hfReads;
 await openFile(realSaved);await el('case-apply').click();await el('export').waitFor();
 const realRestored=JSON.parse(await download('export'));assert.equal(hfReads,readCount);
 assert.deepEqual(realRestored.initial_inputs,initialReport.initial_inputs);assert.deepEqual(realRestored.inputs,initialReport.inputs);assert.equal(realRestored.origin,'hf');assert.equal(realRestored.restored_from_file,true);
 await el('run').click();await el('export').waitFor();assert.equal(hfReads,readCount+1);assert.equal(JSON.parse(await download('export')).restored_from_file,false);
 assert.deepEqual(errors,[]);
 console.log('Private case browser PASS: nine routes x four languages, reload, follow-up, peaks, private/reduced exports, local recalculation, malformed/old files, cancel, language changes, keyboard and mobile.');
}finally{await browser.close();}
