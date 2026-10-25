import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base=process.env.TAF_URL||'http://127.0.0.1:8877/',live=!!process.env.TAF_URL;
const a={peft_type:'LORA',base_model_name_or_path:'PRIVATE/Base-A',revision:'PRIVATE_REV',r:8,lora_alpha:0,target_modules:['q_proj','v_proj'],extra:{notes:'PRIVATE_NOTES'}};
const raw=JSON.stringify(a,null,2),other='PRIVATE/Base-B';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),errors=[];let external=0;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async r=>{
  const url=r.request().url();if(url.includes('pyodide.js'))return r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'});
  if(!url.startsWith(base)){if(url.startsWith('https://huggingface.co/'))external++;return r.abort();}
  if(live)return r.continue();
  const path=resolve(root,decodeURIComponent(new URL(url).pathname.slice(new URL(base).pathname.length))||'index.html');
  if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!existsSync(path))return r.fulfill({status:404,body:''});return r.fulfill({path});
 });
 const el=id=>page.locator('#resolver-'+id);
 async function download(id='export'){const p=page.waitForEvent('download');await el(id).click();return readFileSync(await(await p).path(),'utf8');}
 async function run(){await el('run').click();await el('export').waitFor();}
 async function file(text){await el('adapter-import').evaluate(e=>e.open=true);await el('adapter-file').setInputFiles({name:'adapter_config.json',mimeType:'application/json',buffer:Buffer.from(text)});}
 for(const lang of ['en','es','fr','zh']){
  const tr=k=>RESOLVER_TRANSLATIONS[lang]['resolver.'+k];
  await page.goto(base+'?resolve=adapter&lang='+lang);await el('local-text').fill(raw);await el('local-base').fill(other);await run();
  const original=JSON.parse(await download());assert.equal(original.result.adapterEvidence.base,'base_mismatch');
  for(const [text,key] of [['{bad','adapter_file_invalid'],['{"peft_type":"LORA","r":"8"}','adapter_file_invalid'],[' '.repeat(50001),'adapter_file_large']]){
   await file(text);await page.waitForFunction(()=>document.getElementById('resolver-adapter-file-status').textContent.length);
   assert.equal(await el('adapter-file-status').innerText(),tr(key));assert.deepEqual(JSON.parse(await download()).result,original.result);assert.equal(await el('local-text').inputValue(),raw);assert.equal(await el('local-base').inputValue(),other);
  }
  await file(raw);await el('adapter-file-apply').waitFor();assert.ok((await el('adapter-preview').innerText()).includes(tr('adapter_file_unverified')));
  await el('adapter-file-cancel').click();assert.deepEqual(JSON.parse(await download()).result,original.result);assert.equal(await el('local-base').inputValue(),other);
  await file('\ufeff'+raw.replace(/\n/g,'\r\n'));await el('adapter-file-apply').waitFor();
  const link=new URL(await el('adapter-import').locator('a').getAttribute('href'));assert.equal(link.hash,'#sec-resolver-adapter-import');assert.equal(link.searchParams.get('resolve'),'adapter');assert.equal(link.searchParams.get('lang'),lang);assert.equal(link.searchParams.get('app'),new URL(base).hostname.includes('.hf.space')?'hf':null);assert.ok(!link.href.includes('PRIVATE'));
  await page.setViewportSize({width:390,height:844});await el('adapter-preview').evaluate(e=>e.scrollIntoView({block:'start'}));assert.ok(await el('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  if(process.env.TAF_SCREENSHOTS){mkdirSync(process.env.TAF_SCREENSHOTS,{recursive:true});await page.screenshot({path:process.env.TAF_SCREENSHOTS+'/adapter-'+lang+'.png'});}
  await el('adapter-file-apply').focus();await page.keyboard.press('Enter');assert.equal(await el('local-text').inputValue(),raw);assert.equal(await el('local-base').inputValue(),other);assert.equal(await el('export').count(),0);await page.setViewportSize({width:1280,height:900});await run();
  let report=JSON.parse(await download());assert.equal(report.result.adapterEvidence.base,'base_mismatch');assert.ok(!JSON.stringify(report).includes('PRIVATE'));assert.deepEqual(report.inputs,{});
  await el('save-case').evaluate(e=>e.open=true);const saved=await download('save-case-button');assert.equal(JSON.parse(saved).version,1);assert.ok(saved.includes('PRIVATE_NOTES'));
  await page.reload();await el('case-open').evaluate(e=>e.open=true);await el('case-file').setInputFiles({name:'case.json',mimeType:'application/json',buffer:Buffer.from(saved)});await el('case-apply').click();await el('export').waitFor();assert.equal(await el('local-text').inputValue(),raw);assert.equal(await el('local-base').inputValue(),other);
  await page.evaluate(()=>document.querySelector('.lang-btn[data-lang="es"]').click());assert.equal(await el('local-text').inputValue(),raw);assert.equal(await el('local-base').inputValue(),other);
  await file(raw);await el('adapter-file-apply').waitFor();await el('local-base').fill('');assert.equal(await el('adapter-file-apply').count(),0);
  await file('{"peft_type":"PROMPT_TUNING","unknown":"PRIVATE_EXTRA"}');await el('adapter-file-apply').click();assert.equal(await el('local-base').inputValue(),'');await run();
  report=JSON.parse(await download());assert.equal(report.result.adapterEvidence.usesTargets,false);assert.equal(report.result.adapterEvidence.base,'base_unknown');assert.ok(!report.result.notices.some(x=>x.key==='adapter_targets_empty'));
  // Edits, navigation and a newer selection invalidate asynchronous file reads.
  await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=async function(){await new Promise(r=>setTimeout(r,300));return original.call(this);};});
  await file(raw);await el('local-base').fill(other);await page.waitForTimeout(450);assert.equal(await el('adapter-file-apply').count(),0);
  await file(raw);await file('{"peft_type":"PREFIX_TUNING"}');await el('adapter-file-apply').waitFor();assert.ok((await el('adapter-preview').innerText()).includes('PREFIX_TUNING'));assert.ok(!(await el('adapter-preview').innerText()).includes('PRIVATE/Base-A'));
  await el('adapter-file-cancel').click();await el('direct').locator('summary').click();await file(raw);await page.locator('[data-resolver-case="pvr"]').click();await page.waitForTimeout(450);assert.equal(await el('adapter-file-apply').count(),0);assert.equal(await el('attention-import-text').count(),1);
 }
 assert.equal(external,0);assert.deepEqual(errors,[]);console.log('Adapter file browser PASS: four languages, preview/apply/cancel, invalid preservation, unchanged base, explicit analysis, private v1, reduced privacy, soft prompts, stale reads, guide links, keyboard/mobile and no HF requests.');
}finally{await browser.close();}
