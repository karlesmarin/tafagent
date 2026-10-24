import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {guideLink,local} from '../js/guide_bridge.js';
import {CASES} from '../js/resolver.js';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {existsSync} from 'node:fs';
const base=process.env.TAF_URL||'http://127.0.0.1:8877/';
const browser=await chromium.launch({headless:true,timeout:20000});
try {
 const context=await browser.newContext(),page=await context.newPage(),errors=[];let metadata=0;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/pyodide.js',r=>r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'}));
 await context.route('https://huggingface.co/**',r=>{metadata++;return r.abort();});
 // Serve the real TAF files under each known origin; clicks remain genuine round trips.
 const root=fileURLToPath(new URL('../',import.meta.url));
 for(const origin of [base,'https://karlesmarin.github.io/tafagent/','https://karlexmarin-taf-agent.static.hf.space/'])
  await context.route(origin+'**',async r=>{
   const suffix=new URL(r.request().url()).pathname.slice(new URL(origin).pathname.length);
   const path=resolve(root,decodeURIComponent(suffix)||'index.html');
   if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!existsSync(path))return r.fulfill({status:404,body:''});
   await r.fulfill({path});
  });
 for(const lang of ['es','en','fr','zh'])for(const app of ['github','hf'])for(const route of ['memory','pvr']) {
  const guideLang=lang==='es'?'es':'en';
  await page.route('**/guide-fixture?**',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="${guideLang}"><main></main><script type="module">import {initGuidePage} from './js/guide_bridge.js';initGuidePage();</script></html>`}));
  const q=new URL(guideLink(CASES[route].topic,0,{mode:CASES[route].mode,resolve:route,lang,app,model:'Qwen/Qwen3-8B'})).search;
  await page.goto(base+'guide-fixture'+q);
  const back=page.locator('#taf-reading-context a').filter({hasText:local('backResolver',guideLang)});
  await back.click();await page.locator('#resolver-dialog[open]').waitFor();
  assert.equal(new URL(page.url()).searchParams.get('resolve'),route);
  assert.equal(new URL(page.url()).searchParams.get('lang'),lang);
  assert.equal(new URL(page.url()).hostname,app==='hf'?'karlexmarin-taf-agent.static.hf.space':'karlesmarin.github.io');
  assert.equal(await page.locator('#resolver-export').count(),0,'Returning does not run a check');
  if(route==='memory')assert.equal(await page.locator('#resolver-model').inputValue(),'Qwen/Qwen3-8B');
  else assert.equal(await page.locator('#resolver-local-text').inputValue(),'','No measurement is transmitted');
  await page.locator('#resolver-demo').click();await page.locator('#resolver-export').waitFor();
  const onward=new URL(await page.locator('#resolver-case-summary a').getAttribute('href'));
  assert.equal(onward.searchParams.get('resolve'),route);assert.equal(onward.searchParams.get('app'),app==='hf'?'hf':null);
  assert.equal(onward.searchParams.has('model'),false,'Saved demo does not claim the user model');
  await page.unroute('**/guide-fixture?**');
 }
 assert.equal(metadata,0);assert.deepEqual(errors,[]);
 console.log('Resolver return PASS: real link clicks, both origins, four languages, memory and imported-measurement forms, no auto-run or private data.');
}finally{await browser.close();}
