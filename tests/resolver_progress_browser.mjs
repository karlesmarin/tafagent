import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {existsSync,readFileSync,mkdirSync} from 'node:fs';
import {CASES} from '../js/resolver.js';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base=process.env.TAF_URL||'http://127.0.0.1:8877/';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[];let hf=0;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route(base+'**',async r=>{const path=resolve(root,decodeURIComponent(new URL(r.request().url()).pathname.slice(new URL(base).pathname.length))||'index.html');if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!existsSync(path))return r.fulfill({status:404,body:''});await r.fulfill({path});});
 await context.route('**/pyodide.js',r=>r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'}));
 await context.route('https://huggingface.co/**',r=>{hf++;return r.abort();});
 const download=async()=>{const p=page.waitForEvent('download');await page.locator('#resolver-export').click();return JSON.parse(readFileSync(await (await p).path(),'utf8'));};
 for(const lang of ['en','es','fr','zh'])for(const route of Object.keys(CASES)){
  const tr=k=>RESOLVER_TRANSLATIONS[lang]['resolver.'+k];
  await page.goto(base+'?resolve='+route+'&lang='+lang);await page.locator('#resolver-dialog[open]').waitFor();
  await page.locator('#resolver-demo').click();await page.locator('#resolver-progress').waitFor();
  await page.locator('#resolver-progress > summary').click();
  assert.equal(await page.locator('#resolver-progress select').count(),3);
  await page.locator('#resolver-progress-demo').click();
  assert.equal(await page.locator('#resolver-progress-step-0').inputValue(),'checked');
  assert.ok((await page.locator('#resolver-progress-next').innerText()).includes(tr('progress_next_blocked')));
  await page.locator('#resolver-progress-go').click();assert.equal(await page.locator('#resolver-progress-step-1').evaluate(e=>e===document.activeElement),true);
  await page.locator('#resolver-progress-step-2').selectOption('issue');
  assert.equal((await download()).progress.next_index,2);
  await page.locator('#resolver-failed').click();assert.ok((await page.locator('#resolver-followup').innerText()).includes(tr('progress_next_issue')));
  for(let i=0;i<3;i++)await page.locator('#resolver-progress-step-'+i).selectOption('checked');
  const report=await download();assert.equal(report.progress.next_kind,'reviewed');assert.equal(report.progress.checked_count,3);
  assert.equal(report.progress.independently_verified,false);assert.equal(report.progress.executed_by_taf,false);assert.equal(report.progress.source,'illustrative');
  assert.equal(await page.locator('#resolver-progress-go').isVisible(),false);
  assert.ok((await page.locator('#resolver-followup').innerText()).includes(tr('progress_next_reviewed')));
  await page.locator('#resolver-progress-clear').click();assert.equal((await download()).progress.checked_count,0);
 }
 // Real local inputs: no simulated actions, no raw code in exported progress.
 await page.goto(base+'?resolve=peft&lang=es');await page.locator('#resolver-local-text').fill('config = LoraConfig(r=8, lora_alpha=16)\n# PRIVATE_SECRET');
 await page.locator('#resolver-run').click();await page.locator('#resolver-progress > summary').click();
 assert.equal(await page.locator('#resolver-progress-demo').count(),0);
 await page.locator('#resolver-progress-step-0').selectOption('checked');
 const real=await download();assert.equal(real.progress.source,'user_reported');assert.ok(!JSON.stringify(real).includes('PRIVATE_SECRET'));
 // Closing and changing language preserve the current result's declarations.
 await page.locator('#resolver-close').click();await page.locator('[data-lang="fr"]').click();
 await page.locator('[data-resolver-open]').first().click();await page.locator('#resolver-progress > summary').click();
 assert.equal(await page.locator('#resolver-progress-step-0').inputValue(),'checked');
 assert.ok((await page.locator('#resolver-progress').innerText()).includes(RESOLVER_TRANSLATIONS.fr['resolver.progress_note']));
 // New inputs and an unchanged priority must still clear marks on rerun.
 await page.locator('#resolver-local-text').fill('config = LoraConfig(r=16, lora_alpha=32)');
 assert.equal(await page.locator('#resolver-progress').count(),0);
 await page.locator('#resolver-run').click();assert.equal((await download()).progress.checked_count,0);
 // Same-case recalculation, not just changed priority, clears marks.
 await page.goto(base+'?resolve=memory&lang=es');await page.locator('#resolver-demo').click();
 await page.locator('#resolver-progress > summary').click();await page.locator('#resolver-progress-demo').click();
 await page.locator('#resolver-reduce').click();assert.equal((await download()).progress.checked_count,0);
 await page.locator('#resolver-progress > summary').click();await page.locator('#resolver-progress-demo').click();
 await page.locator('#resolver-check-examples > summary').click();await page.locator('[data-check-example="load"]').click();
 assert.equal((await download()).progress.checked_count,0);
 await page.setViewportSize({width:390,height:844});await page.locator('#resolver-progress > summary').click();
 await page.locator('#resolver-progress-demo').click();assert.ok(await page.locator('#resolver-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
 mkdirSync('tmp/resolver',{recursive:true});await page.screenshot({path:'tmp/resolver/progress-mobile.png'});
 assert.equal(hf,0);assert.deepEqual(errors,[]);
 console.log('Resolver progress browser PASS: nine routes × four languages, declarations, automatic priority, reset boundaries, language retention, demo, private exports and mobile.');
}finally{await browser.close();}
