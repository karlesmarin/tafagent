import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {TRANSLATIONS} from '../js/i18n.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.TAF_URL || 'http://127.0.0.1:8877/';
const live=!!process.env.TAF_URL;
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 const errors=[];
 await context.route('**/*',async route=>{
  const url=route.request().url();
  if(url.includes('pyodide.js'))return route.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'});
  if(!url.startsWith(base))return route.abort();
  if(live)return route.continue();
  const path=resolve(root,decodeURIComponent(new URL(url).pathname.slice(1))||'index.html');
  if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!existsSync(path))return route.fulfill({status:404,body:''});
  return route.fulfill({path});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'?mode=memreal&lang=en');
 await page.locator('#memreal-paste').evaluate(el=>el.closest('details').open=true);
 await page.locator('#memreal-paste').fill(JSON.stringify({model_type:'llama',num_hidden_layers:32,num_attention_heads:32,num_key_value_heads:8,hidden_size:4096,max_position_embeddings:8192}));
 await page.locator('#memreal-paste-btn').click();
 const widget=page.locator('#memreal-output [data-score-kind="evidence_checklist"]');
 await widget.waitFor();
 for(const lang of ['en','es','fr','zh']){
  await page.locator('.lang-btn[data-lang="'+lang+'"]').click();
  assert.equal(await widget.locator('[data-i18n="conf.label"]').innerText(),TRANSLATIONS[lang]['conf.label']);
  assert.equal(await widget.locator('.evidence-score-note').innerText(),TRANSLATIONS[lang]['conf.note']);
  assert.match(await widget.innerText(),/75 \/ 100/);
  assert.ok(!(await widget.innerText()).includes('%'));
  const summary=widget.locator('summary');await summary.focus();
  if(!(await widget.locator('details').evaluate(el=>el.open)))await page.keyboard.press('Enter');
  assert.equal(await widget.locator('details p').innerText(),TRANSLATIONS[lang]['conf.method_detail']);
  assert.ok(!(await widget.innerText()).includes('conf.'));
  await page.setViewportSize({width:390,height:844});
  assert.ok(await widget.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  if(process.env.TAF_SCREENSHOTS){mkdirSync(process.env.TAF_SCREENSHOTS,{recursive:true});await widget.screenshot({path:process.env.TAF_SCREENSHOTS+'/evidence-'+lang+'.png'});}
  await page.setViewportSize({width:1280,height:900});
 }
 // The guided Memory Reality demo uses the same live widget, in every language.
 for(const lang of ['en','es','fr','zh']){
  await page.goto(base+'?mode=memreal&lang='+lang);
  await page.locator('#memreal-section .taf-demo-btn').click();
  await page.locator('#memreal-section #__taf_demo_explain').waitFor({timeout:30000});
  assert.equal(await widget.locator('.evidence-score-note').innerText(),TRANSLATIONS[lang]['conf.note']);
  assert.ok(!(await widget.innerText()).includes('%'));
 }
 await page.goto(base+'?mode=pvr&lang=en');
 await page.locator('#pvr-control-btn').click();
 await page.locator('.pvr-context[data-context="documented"]').waitFor();
 assert.equal(await page.locator('#pvr-output .taf-confidence').count(),0);
 assert.deepEqual(errors,[]);
 console.log('Evidence score: four languages, live language changes, keyboard, mobile, four demos and PVR separation passed.');
}finally{await browser.close();}
