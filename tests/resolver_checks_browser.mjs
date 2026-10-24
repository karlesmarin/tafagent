import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {existsSync,readFileSync,mkdirSync} from 'node:fs';
import {CHECK_DEMOS} from '../js/resolver_checks.js';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base=process.env.TAF_URL||'http://127.0.0.1:8877/';
const browser=await chromium.launch({headless:true,timeout:20000});
try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[];let hf=0;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route(base+'**',async r=>{
  const suffix=new URL(r.request().url()).pathname.slice(new URL(base).pathname.length),path=resolve(root,decodeURIComponent(suffix)||'index.html');
  if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!existsSync(path))return r.fulfill({status:404,body:''});
  await r.fulfill({path});
 });
 await context.route('**/pyodide.js',r=>r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'}));
 await context.route('https://huggingface.co/**',r=>{hf++;return r.abort();});
 for(const lang of ['en','es','fr','zh'])for(const [route,scenarios] of Object.entries(CHECK_DEMOS)){
  const tr=k=>RESOLVER_TRANSLATIONS[lang]['resolver.'+k];
  await page.goto(base+'?resolve='+route+'&lang='+lang);await page.locator('#resolver-dialog[open]').waitFor();
  await page.locator('#resolver-demo').click();await page.locator('#resolver-show-checks').waitFor();
  await page.locator('#resolver-show-checks').click();assert.equal(await page.locator('#resolver-checks li').count(),3);
  for(const scenario of scenarios){
   await page.locator('#resolver-check-examples > summary').click();
   await page.locator(`[data-check-example="${scenario}"]`).click();
   const code=route+'_'+scenario;
   assert.ok((await page.locator('#resolver-checks').innerText()).includes(tr('checks_'+code)));
   assert.ok((await page.locator('#resolver-case-summary').innerText()).includes(tr('check_'+code)));
   await page.locator('#resolver-failed').click();
   assert.ok((await page.locator('#resolver-followup').innerText()).includes(tr('check_'+route+'_interpret')));
   const pending=page.waitForEvent('download');await page.locator('#resolver-export').click();
   const report=JSON.parse(readFileSync(await (await pending).path(),'utf8'));
   assert.equal(report.demo_scenario,scenario);assert.equal(report.review.checks.priority,code);assert.equal(report.review.checks.executed,false);
   assert.equal(report.summary.checks.priority,code);assert.equal(report.review.independently_verified,false);
   for(const mode of report.review.checks.tools){
    await page.locator(`[data-check-tool="${mode}"]`).click();assert.equal(await page.locator('#resolver-catalog-select').inputValue(),mode);
    assert.ok((await page.locator('#resolver-case-summary').innerText()).includes(tr('check_'+code)));
   }
  }
  if(route==='memory'){
   await page.locator('#resolver-check-examples > summary').click();await page.locator('[data-check-example="kv"]').click();
   await page.locator('#resolver-reduce').click();
   assert.ok((await page.locator('#resolver-case-summary').innerText()).includes('→'));
   assert.ok(!(await page.locator('#resolver-checks').innerText()).includes(tr('checks_memory_kv')));
  }
 }
 // A real local input drops example controls and exports no private model identifiers.
 await page.goto(base+'?resolve=adapter&lang=zh');await page.locator('#resolver-dialog[open]').waitFor();
 await page.locator('#resolver-local-text').fill(JSON.stringify({peft_type:'PROMPT_TUNING',base_model_name_or_path:'PRIVATE/Base'}));
 assert.equal(await page.locator('#resolver-checks').count(),0);
 await page.locator('#resolver-local-base').fill('PRIVATE/Base');await page.locator('#resolver-run').click();await page.locator('#resolver-export').waitFor();
 assert.equal(await page.locator('#resolver-check-examples').count(),0);
 const pending=page.waitForEvent('download');await page.locator('#resolver-export').click();const raw=readFileSync(await (await pending).path(),'utf8');
 assert.ok(!raw.includes('PRIVATE'));assert.equal(JSON.parse(raw).review.checks.priority,'adapter_activation');
 await page.setViewportSize({width:390,height:844});await page.locator('#resolver-show-checks').click();
 assert.ok(await page.locator('#resolver-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 mkdirSync('tmp/resolver',{recursive:true});await page.screenshot({path:'tmp/resolver/checks-mobile.png'});
 assert.equal(hf,0);assert.deepEqual(errors,[]);
 console.log('Resolver checks browser PASS: 20 examples × four languages, ordered checks, recalculation, follow-up, private exports, no HF requests and mobile.');
}finally{await browser.close();}
