import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base=process.env.TAF_URL||'http://127.0.0.1:8877/',live=!!process.env.TAF_URL;
const a={model:'PRIVATE_MODEL',revision:'PRIVATE_REV',corpus:'PRIVATE_CORPUS',theta:10000,gamma:0,distance:[1,2,3],protocol:{id:'PRIVATE_ID',length:4,queries:[3],sink_tokens:0,samples:2,pooling:'mean',fit:'OLS',layer:0,head:0,backend:'numpy',dtype:'float64',quantization:'none',seed:0,tokenizer_revision:'not_used'},notes:'PRIVATE_NOTES'};
const b={...a,gamma:0.1,protocol:{...a.protocol,seed:1}};
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
 async function file(field,text){await el('attention-import-'+field).evaluate(e=>e.open=true);await el('attention-file-'+field).setInputFiles({name:'attention.json',mimeType:'application/json',buffer:Buffer.from(text)});}
 for(const lang of ['en','es','fr','zh']){
  const tr=k=>RESOLVER_TRANSLATIONS[lang]['resolver.'+k];
  await page.goto(base+'?resolve=pvr&lang='+lang);await el('local-text').fill(JSON.stringify(a));await el('local-text2').fill('');await run();
  const original=JSON.parse(await download());
  for(const [text,key] of [['{bad','attention_file_invalid'],['{"gamma":"0"}','attention_file_gamma'],[' '.repeat(50001),'attention_file_large']]){
   await file('text',text);await page.waitForFunction(()=>document.getElementById('resolver-attention-status-text').textContent.length);
   assert.equal(await el('attention-status-text').innerText(),tr(key));assert.deepEqual(JSON.parse(await download()).result,original.result);
  }
  await file('text2',JSON.stringify(b));await el('attention-apply-text2').waitFor();assert.ok((await el('attention-preview-text2').innerText()).includes(tr('attention_file_unverified')));
  assert.equal(await el('local-text2').inputValue(),'');await el('attention-cancel-text2').click();assert.deepEqual(JSON.parse(await download()).result,original.result);
  await file('text2',JSON.stringify(b));await el('attention-apply-text2').click();assert.equal(await el('export').count(),0);assert.equal(await el('local-text').inputValue(),JSON.stringify(a));assert.equal(await el('local-text2').inputValue(),JSON.stringify(b));await run();
  let report=JSON.parse(await download());assert.equal(report.result.protocolReview.priority,'align');assert.ok(!JSON.stringify(report).includes('PRIVATE_'));assert.deepEqual(report.inputs,{});
  const variable={...a,protocol:{...a.protocol,length_policy:'distance_plus_50'}};const raw=JSON.stringify(variable,null,2);
  await file('text',raw.replace(/\n/g,'\r\n'));await el('attention-apply-text').waitFor();assert.ok((await el('attention-preview-text').innerText()).includes(tr('attention_context_variable')));
  const link=new URL(await el('attention-import-text').locator('a').getAttribute('href'));assert.equal(link.hash,'#sec-resolver-attention-import');assert.equal(link.searchParams.get('resolve'),'pvr');assert.equal(link.searchParams.get('lang'),lang);assert.equal(link.searchParams.get('app'),new URL(base).hostname.includes('.hf.space')?'hf':null);assert.ok(!link.href.includes('PRIVATE_'));
  await page.setViewportSize({width:390,height:844});await el('attention-preview-text').evaluate(e=>e.scrollIntoView({block:'start'}));assert.ok(await el('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  if(process.env.TAF_SCREENSHOTS){mkdirSync(process.env.TAF_SCREENSHOTS,{recursive:true});await page.screenshot({path:process.env.TAF_SCREENSHOTS+'/attention-'+lang+'.png'});}
  await el('attention-apply-text').focus();await page.keyboard.press('Enter');assert.equal(await el('local-text').inputValue(),raw);await page.setViewportSize({width:1280,height:900});await run();
  report=JSON.parse(await download());assert.equal(report.result.protocolReview.priority,'context');
  await el('save-case').evaluate(e=>e.open=true);const saved=await download('save-case-button');assert.equal(JSON.parse(saved).version,1);assert.ok(saved.includes('PRIVATE_NOTES'));
  await page.reload();await el('case-open').evaluate(e=>e.open=true);await el('case-file').setInputFiles({name:'case.json',mimeType:'application/json',buffer:Buffer.from(saved)});await el('case-apply').click();await el('export').waitFor();assert.equal(await el('local-text').inputValue(),raw);assert.equal(await el('local-text2').inputValue(),JSON.stringify(b));
  await page.evaluate(()=>document.querySelector('.lang-btn[data-lang="es"]').click());assert.equal(await el('local-text').inputValue(),raw);
  // A file read completing after an ordinary edit must not reintroduce stale preview.
  await page.evaluate(()=>{const original=File.prototype.text;File.prototype.text=async function(){await new Promise(r=>setTimeout(r,300));return original.call(this);};});
  await file('text',JSON.stringify(a));await el('local-text').fill(raw+' ');await page.waitForTimeout(450);assert.equal(await el('attention-apply-text').count(),0);assert.equal(await el('local-text').inputValue(),raw+' ');
 }
 assert.equal(external,0);assert.deepEqual(errors,[]);console.log('Attention file browser PASS: four languages, primary/reference preview/apply, invalid/cancel preservation, explicit analysis, protocol priorities, privacy, v1 reopen, stale reads, guide, keyboard/mobile and no HF requests.');
}finally{await browser.close();}
