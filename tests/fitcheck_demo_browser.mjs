import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {existsSync,readFileSync} from 'node:fs';
import {DEMO_STRINGS} from '../js/demo_i18n.js';
const root=fileURLToPath(new URL('../',import.meta.url)),base='http://127.0.0.1:8877/';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[];let hf=0,fail=false,allowMetadata=false;
 const catalog=JSON.parse(readFileSync(new URL('../data/model_catalog.json',import.meta.url)));
 const fixture=catalog.models.find(m=>m.id==='Qwen/Qwen3-8B').config;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async r=>{
  const url=r.request().url();
  if(url.includes('pyodide.js'))return r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'});
  if(!url.startsWith(base)){
   if(url.startsWith('https://huggingface.co/')){hf++;if(allowMetadata)return r.fulfill({json:url.includes('/api/models')?[]:fixture});}
   return r.abort();
  }
  if(url.endsWith('/data/model_catalog.json')&&fail)return r.fulfill({status:503,body:''});
  const path=resolve(root,decodeURIComponent(new URL(url).pathname.slice(1))||'index.html');
  if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!existsSync(path))return r.fulfill({status:404,body:''});
  return r.fulfill({path});
 });
 for(const lang of ['en','es','fr','zh']){
  await page.goto(base+'?demo=fitcheck&lang='+lang);
  await page.locator('#fitcheck-section #__taf_demo_explain').waitFor({timeout:30000});
  assert.equal(await page.locator('#fitcheck-model').inputValue(),'Qwen/Qwen3-8B');
  assert.equal(await page.locator('#fitcheck-ctx').inputValue(),'131072');
  assert.equal(await page.locator('#fitcheck-output table').count(),1);
  assert.equal(await page.locator('#fitcheck-output').isVisible(),true);
  assert.ok((await page.locator('#fitcheck-status').innerText()).includes(DEMO_STRINGS[lang]['fitcheck.saved']));
  assert.ok(!/NaN|Infinity|Fetch a model first/.test(await page.locator('#fitcheck-section').innerText()));
 }
 assert.equal(hf,0);
 allowMetadata=true;
 await page.goto(base+'?mode=fitcheck&lang=en');
 await page.locator('#fitcheck-model').fill('Example/Dense');
 await page.locator('#fitcheck-fetch-btn').click();
 await page.waitForFunction(()=>document.getElementById('fitcheck-status').textContent.includes('Example/Dense'));
 await page.locator('#fitcheck-ctx').fill('4096');await page.locator('#fitcheck-btn').click();
 assert.equal(await page.locator('#fitcheck-output table').count(),1);
 await page.locator('#fitcheck-model').fill('Example/Changed');
 assert.equal(await page.locator('#fitcheck-output').isVisible(),false);
 assert.equal(await page.locator('#fitcheck-status').innerText(),'');
 allowMetadata=false;hf=0;
 fail=true;
 const failed=new Promise(resolve=>page.on('console',msg=>{if(msg.text().includes('demo failed:'))resolve();}));
 await page.goto(base+'?demo=fitcheck&lang=es');await failed;
 assert.equal(await page.locator('#fitcheck-output table').count(),0);
 assert.equal(await page.locator('#fitcheck-section #__taf_demo_explain').count(),0);
 assert.equal(hf,0);assert.deepEqual(errors,[]);
 console.log('Fit Check demo PASS: saved budget in four languages, no HF/config download, normal fetching/invalidation, missing example does not display completion.');
}finally{await browser.close();}

