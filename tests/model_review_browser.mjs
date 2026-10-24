import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {MODEL_TRANSLATIONS} from '../js/model_i18n.js';
const catalog=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url)));
const q=catalog.models.find(r=>r.id==='Qwen/Qwen3-0.6B');
const hybrid=catalog.models.find(r=>r.id.includes('Qwen3.8'));
const base=process.env.TAF_URL||'http://127.0.0.1:8877/';
const browser=await chromium.launch({headless:true,timeout:20000});
mkdirSync('tmp/model-review',{recursive:true});
try {
 const page=await browser.newPage(); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://huggingface.co/**/resolve/main/config.json',route=>{
   const cfg=route.request().url().includes('Qwen3.8')?hybrid.config:q.config;
   return route.fulfill({json:cfg});
 });
 await page.goto(base+'?mode=profile&lang=es&example=Qwen%2FQwen3-0.6B');
 await page.waitForFunction(()=>!document.getElementById('profile-btn').disabled,null,{timeout:120000});
 await page.locator('#model-review-load').waitFor();
 assert.equal(await page.locator('#model-review').getAttribute('open'),'');
 assert.equal(await page.locator('#model-review-select option').count(),11);
 for (const lang of ['es','en','fr','zh']) {
   await page.locator(`.lang-btn[data-lang="${lang}"]`).click();
   assert.ok((await page.locator('#model-review-detail').innerText()).includes(MODEL_TRANSLATIONS[lang]['models.reference']));
   await page.locator('#model-review-select').selectOption(hybrid.id);
   assert.ok((await page.locator('#model-review-detail').innerText()).includes(MODEL_TRANSLATIONS[lang]['models.reason.hybrid']));
   assert.equal(await page.locator('#model-review-load').count(),0);
   await page.locator('#model-review-select').selectOption('google/gemma-3-4b-it');
   assert.ok((await page.locator('#model-review-detail').innerText()).includes(MODEL_TRANSLATIONS[lang]['models.gated']));
   await page.locator('#model-review-select').selectOption(q.id);
 }
 await page.locator('.lang-btn[data-lang="es"]').click();
 await page.locator('#model-review-load').click();
 assert.equal(await page.locator('#profile-d_head').inputValue(),'128');
 assert.equal(await page.locator('#profile-T_train').inputValue(),'32768');
 await page.locator('#profile-btn').click();
 await page.locator('[data-explain-metric="gamma_pade"]').waitFor();
 // A blocked import must not run the previous model's values.
 await page.locator('#profile-hf-id').fill(hybrid.id);
 await page.locator('#profile-hf-id').press('Escape');
 await page.locator('#profile-fetch-btn').click();
 await page.waitForFunction(()=>document.getElementById('profile-hf-status').textContent.includes('detenida'));
 await page.locator('#profile-btn').click();
 assert.equal(await page.locator('#profile-output').isVisible(),false);
 assert.ok((await page.locator('#profile-hf-status').innerText()).includes('antes de ejecutar'));
 await page.locator('#profile-manual').click();
 assert.equal(await page.locator('#profile-hf-id').inputValue(),'');
 await page.locator('#profile-btn').click();
 assert.equal(await page.locator('#profile-output').isVisible(),true);
 // Live import is a provisional configured context, unlike the curated native reference.
 await page.locator('#profile-hf-id').fill(q.id); await page.locator('#profile-hf-id').press('Escape');
 await page.locator('#profile-fetch-btn').click();
 await page.waitForFunction(()=>document.getElementById('profile-T_train').value==='40960');
 assert.equal(await page.locator('#profile-import-note').isVisible(),true);
 await page.locator('#profile-theta').fill('2000000');
 assert.equal(await page.locator('#profile-hf-id').inputValue(),'');
 // Check the narrow mobile layout as well as keyboard access to the native selector.
 await page.setViewportSize({width:390,height:844});
 await page.locator('#model-review-select').selectOption(hybrid.id);
 await page.screenshot({path:'tmp/model-review/mobile.png',fullPage:true});
 const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,elements:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1 && e.getBoundingClientRect().width>0).map(e=>[e.tagName,e.id,e.className,e.getBoundingClientRect().right]).slice(0,15)}));
 assert.ok(overflow.scroll<=overflow.width+1,JSON.stringify(overflow));
 await page.setViewportSize({width:1280,height:900});
 for (const [mode, field, fetchButton, runButton] of [
   ['depth','depth-hf-id','depth-fetch-btn','depth-btn'],
   ['fitcheck','fitcheck-model','fitcheck-fetch-btn','fitcheck-btn'],
   ['launch','launch-model','launch-fetch-btn','launch-gen-btn']]) {
   await page.locator(`.mode-btn[data-mode="${mode}"]`).evaluate(el=>el.click());
   await page.locator('#'+field).fill(hybrid.id); await page.locator('#'+field).press('Escape');
   await page.locator('#'+fetchButton).click();
   const status=mode==='depth'?'depth-hf-status':mode+'-status';
   await page.waitForFunction(id=>document.getElementById(id).textContent.includes('detenida'),status);
   await page.locator('#'+runButton).click();
   if (mode==='depth') assert.ok((await page.locator('#depth-out').innerText()).includes('antes de ejecutar'));
   else assert.equal(await page.locator('#'+mode+'-output').isVisible(),false);
 }
 await page.locator('.mode-btn[data-mode="inspector"]').evaluate(el=>el.click());
 await page.locator('#inspector-json').fill(JSON.stringify(hybrid.config));
 await page.locator('#inspector-btn').click();
 assert.ok((await page.locator('#inspector-status').innerText()).includes('detenida'));
 assert.equal(await page.locator('#profile-output').isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log('Model review browser PASS: 4 languages, offline examples, guarded imports, explicit manual scenarios, real Pyodide profile and mobile layout.');
} finally {await browser.close();}
