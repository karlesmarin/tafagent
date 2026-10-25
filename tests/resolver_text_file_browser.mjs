import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base=process.env.TAF_URL||'http://127.0.0.1:8877/',live=!!process.env.TAF_URL;
const payload='<script>globalThis.FILE_EXECUTED=true</script>';
const schema=JSON.stringify({type:'object',properties:{answer:{type:'string'},reasoning:{type:'string'}},required:['answer','PRIVATE_REQUIRED'],notes:'PRIVATE_JSON '+payload},null,2);
const code='# PRIVATE_CODE\n'+payload+'\nmodel = get_peft_model(base, cfg)\nmodel = prepare_model_for_kbit_training(model)\n'+'# extra\n'.repeat(15)+'# PRIVATE_TAIL';
const prompt='PRIVATE_PREFIX\n'+payload+'\n'+'a'.repeat(1300)+'\nPRIVATE_TAIL';
const fixtures={cot:{text:schema},peft:{text:code},cache:{text:prompt,text2:prompt+'\nnew'}};
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
 async function file(field,data){await el('text-import-'+field).evaluate(e=>e.open=true);await el('text-file-'+field).setInputFiles({name:'local.txt',mimeType:'text/plain',buffer:Buffer.isBuffer(data)?data:Buffer.from(data)});}
 for(const lang of ['en','es','fr','zh'])for(const [route,values] of Object.entries(fixtures)){
  const tr=k=>RESOLVER_TRANSLATIONS[lang]['resolver.'+k];
  await page.goto(base+'?resolve='+route+'&lang='+lang);
  for(const [field,value] of Object.entries(values))await el('local-'+field).fill(value);
  await run();const original=JSON.parse(await download());
  for(const [data,key] of [['','text_file_invalid'],[' '.repeat(50001),'text_file_large'],[Buffer.from([0xc3,0x28]),'text_file_encoding'],...(route==='cot'?[['[]','text_file_json']]:[])]){
   await file('text',data);await page.waitForFunction(()=>document.getElementById('resolver-text-status-text').textContent.length);
   assert.equal(await el('text-status-text').innerText(),tr(key));assert.deepEqual(JSON.parse(await download()).result,original.result);assert.equal(await el('local-text').inputValue(),values.text);
  }
  await file('text',values.text);await el('text-apply-text').waitFor();assert.equal(await el('text-preview-text').locator('script').count(),0);assert.equal(await page.evaluate(()=>globalThis.FILE_EXECUTED),undefined);
  await el('text-cancel-text').click();assert.deepEqual(JSON.parse(await download()).result,original.result);
  for(const [field,value] of Object.entries(values)){
   const other=field==='text'?'text2':'text',prior=route==='cache'?await el('local-'+other).inputValue():null;
   await file(field,'\ufeff'+value.replace(/\n/g,'\r\n'));await el('text-apply-'+field).waitFor();
   if(route!=='cot')assert.ok((await el('text-preview-'+field).innerText()).includes(tr('text_file_partial')));
   const link=new URL(await el('text-import-'+field).locator('a').getAttribute('href'));assert.equal(link.hash,'#sec-resolver-text-import');assert.equal(link.searchParams.get('resolve'),route);assert.equal(link.searchParams.get('lang'),lang);assert.equal(link.searchParams.get('app'),new URL(base).hostname.includes('.hf.space')?'hf':null);assert.ok(!link.href.includes('PRIVATE'));
   await page.setViewportSize({width:390,height:844});await el('text-preview-'+field).evaluate(e=>e.scrollIntoView({block:'start'}));assert.ok(await el('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
   if(process.env.TAF_SCREENSHOTS){mkdirSync(process.env.TAF_SCREENSHOTS,{recursive:true});await page.screenshot({path:process.env.TAF_SCREENSHOTS+'/'+route+'-'+field+'-'+lang+'.png'});}
   await el('text-apply-'+field).focus();await page.keyboard.press('Enter');assert.equal(await el('local-'+field).inputValue(),value);assert.equal(await el('export').count(),0);
   if(route==='cache')assert.equal(await el('local-'+other).inputValue(),prior);
   await page.setViewportSize({width:1280,height:900});
  }
  await run();const report=JSON.parse(await download());assert.ok(!JSON.stringify(report).includes('PRIVATE'));assert.deepEqual(report.inputs,{});assert.equal(await page.evaluate(()=>globalThis.FILE_EXECUTED),undefined);
  if(route==='cot')assert.equal(report.result.suggestion,undefined);
  if(route==='cache')assert.equal(report.result.cacheEvidence.relation,'append');
  await el('save-case').evaluate(e=>e.open=true);const saved=await download('save-case-button');assert.equal(JSON.parse(saved).version,1);assert.ok(saved.includes('PRIVATE'));
  await page.reload();await el('case-open').evaluate(e=>e.open=true);await el('case-file').setInputFiles({name:'case.json',mimeType:'application/json',buffer:Buffer.from(saved)});await el('case-apply').click();await el('export').waitFor();
  for(const [field,value] of Object.entries(values))assert.equal(await el('local-'+field).inputValue(),value);
  // A language change preserves applied text, discards the old preview.
  await file('text',values.text);await el('text-apply-text').waitFor();await page.evaluate(lang=>document.querySelector('.lang-btn[data-lang="'+lang+'"]').click(),lang==='es'?'en':'es');assert.equal(await el('text-apply-text').count(),0);assert.equal(await el('local-text').inputValue(),values.text);
  await page.evaluate(()=>{const original=File.prototype.arrayBuffer;File.prototype.arrayBuffer=async function(){await new Promise(r=>setTimeout(r,300));return original.call(this);};});
  await file('text',values.text);await el('local-text').fill(values.text+' ');await page.waitForTimeout(450);assert.equal(await el('text-apply-text').count(),0);
  if(route==='cache'){
   await file('text',values.text);await file('text2',values.text2);await el('text-apply-text2').waitFor();assert.equal(await el('text-apply-text').count(),0);await el('text-cancel-text2').click();
  }
  await el('direct').locator('summary').click();await file('text',values.text);await page.locator('[data-resolver-case="adapter"]').click();await page.waitForTimeout(450);assert.equal(await el('text-apply-text').count(),0);assert.equal(await el('adapter-import').count(),1);
 }
 assert.equal(external,0);assert.deepEqual(errors,[]);console.log('Text file browser PASS: JSON/PEFT/two prompt fields x four languages, bounds/encoding, literal preview, explicit apply/check, preservation, privacy, v1, stale reads, guides and mobile; no HF/model requests.');
}finally{await browser.close();}
