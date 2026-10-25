import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {existsSync,readFileSync,mkdirSync} from 'node:fs';
import {OBSERVATIONS} from '../js/resolver_observations.js';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base='http://127.0.0.1:8877/';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[];let hf=0;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async r=>{
  const url=r.request().url();
  if(url.includes('pyodide.js'))return r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'});
  if(!url.startsWith(base)){if(url.startsWith('https://huggingface.co/'))hf++;return r.abort();}
  const path=resolve(root,decodeURIComponent(new URL(url).pathname.slice(1))||'index.html');
  if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!existsSync(path))return r.fulfill({status:404,body:''});
  return r.fulfill({path});
 });
 const download=async()=>{const p=page.waitForEvent('download');await page.locator('#resolver-export').click();return JSON.parse(readFileSync(await (await p).path(),'utf8'));};
 const record=async(code,step='1')=>{
  await page.locator('#resolver-observation-step').selectOption(step);
  await page.locator('#resolver-observation-choice').selectOption(code);
  await page.locator('#resolver-observation-save').click();
 };
 for(const lang of ['en','es','fr','zh'])for(const [route,choices] of Object.entries(OBSERVATIONS)){
  await page.goto(base+'?resolve='+route+'&lang='+lang);await page.locator('#resolver-demo').click();
  const original=(await download()).result;
  await page.locator('#resolver-failed').click();
  assert.equal(await page.locator('#resolver-observations').evaluate(e=>e.open),true);
  await page.locator('#resolver-observation-save').click();
  assert.ok(await page.locator('#resolver-observation-status').innerText());
  for(const code of Object.keys(choices)){
   await record(code);
   const report=await download(),entry=report.observations.current;
   assert.equal(entry.code,code);assert.equal(report.observations.source,'illustrative');
   assert.deepEqual(report.result,original);
   const next=RESOLVER_TRANSLATIONS[lang]['resolver.observation_next_'+route+'_'+code];
   assert.ok((await page.locator('#resolver-followup').innerText()).includes(next));
   await page.locator('#resolver-observation-tool').click();
   assert.equal(await page.locator('#resolver-catalog-select').inputValue(),choices[code]);
  }
  await record('unavailable','2');const report=await download();
  assert.equal(report.observations.entries.length,4);assert.equal(report.observations.current.step,2);
  assert.equal(await page.locator('#resolver-observation-tool').count(),0);
  assert.equal(report.observations.executed_by_taf,false);
  assert.equal(report.observations.independently_verified,false);
  await page.locator('#resolver-observation-clear').click();assert.equal((await download()).observations.entries.length,0);
 }
 await page.goto(base+'?resolve=peft&lang=es');
 await page.locator('#resolver-local-text').fill('config = LoraConfig(r=8, lora_alpha=16)\n# PRIVATE_SECRET');
 await page.locator('#resolver-run').click();await page.locator('#resolver-failed').click();await record('runtime');
 assert.equal((await download()).observations.source,'user_reported');
 assert.ok(!JSON.stringify(await download()).includes('PRIVATE_SECRET'));
 await page.locator('#resolver-close').click();await page.locator('[data-lang="fr"]').click();await page.locator('[data-resolver-open]').first().click();
 assert.equal((await download()).observations.current.code,'runtime');
 await page.locator('#resolver-failed').click();
 assert.ok((await page.locator('#resolver-observation-result').innerText()).includes(RESOLVER_TRANSLATIONS.fr['resolver.observation_next_peft_runtime']));
 await page.locator('#resolver-local-text').fill('config = LoraConfig(r=16, lora_alpha=32)');
 await page.locator('#resolver-run').click();assert.equal((await download()).observations.current,null);
 await page.goto(base+'?resolve=memory&lang=es');await page.locator('#resolver-demo').click();await page.locator('#resolver-failed').click();
 await record('short_only');await page.locator('#resolver-reduce').click();assert.equal((await download()).observations.current,null);
 await page.locator('#resolver-failed').click();await record('generation_failure');
 await page.locator('#resolver-check-examples > summary').click();await page.locator('[data-check-example="load"]').click();
 assert.equal((await download()).observations.current,null);
 await page.setViewportSize({width:390,height:844});await page.locator('#resolver-failed').click();await record('load_failure');
 assert.ok(await page.locator('#resolver-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 mkdirSync('tmp/resolver',{recursive:true});await page.screenshot({path:'tmp/resolver/observations-mobile.png'});
 await page.reload();assert.equal(await page.locator('#resolver-observations').count(),0);
 assert.equal(hf,0);assert.deepEqual(errors,[]);
 console.log('Observation browser PASS: nine routes × four languages × four outcomes, contextual follow-up, tool links, history, resets, private exports and mobile.');
}finally{await browser.close();}

