import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const base=process.env.TAF_URL||'http://127.0.0.1:8877/';
const guide=process.env.GUIDE_URL;
const shots=process.env.TAF_SCREENSHOTS;
if(shots)mkdirSync(shots,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1100,height:900},reducedMotion:'reduce'});
 await context.route('**/pyodide.js',r=>r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'}));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 for(const lang of ['en','es','fr','zh'])for(const id of ['softmax-fix','mhc']){
  console.log(`Checking ${lang}/${id}`);
  await page.goto(`${base}?mode=research&study=${id}&lang=${lang}`);
  await page.locator(`[data-paper="${id}"]`).waitFor();
  assert.equal(await page.locator('.research-card').count(),1);
  assert.equal(await page.locator('.research-lab').count(),0,'No demo work before opt-in');
  await page.locator('.research-demo summary').click();
  const lab=page.locator('.research-lab');await lab.waitFor();assert.equal(await lab.getAttribute('lang'),lang);
  const slider=lab.locator('input[type=range]').first();await slider.focus();await slider.press('ArrowRight');
  await lab.locator('button').click();
  if(id==='softmax-fix'){
   assert.equal(await slider.inputValue(),'18');assert.equal(await lab.locator('dd').first().innerText(),'0');
   assert.match(await lab.locator('dd').nth(1).innerText(),/^-/);
  }else{
   assert.equal(await lab.locator('svg').count(),1);
   await lab.locator('input[type=checkbox]').check();
   await lab.locator('input[type=range]').nth(1).fill('30');
   assert.ok(Number(await lab.locator('dd').nth(1).innerText())>1);
  }
  await page.setViewportSize({width:390,height:844});await lab.scrollIntoViewIfNeeded();
  assert.equal(await lab.evaluate(e=>e.scrollWidth>e.clientWidth+2),false);
  if(shots&&lang==='es')await lab.screenshot({path:`${shots}/${id}-es.png`});
  await page.setViewportSize({width:1100,height:900});
 }
 // A supplied study name is matched against the catalogue, never interpreted as markup.
 await page.goto(`${base}?mode=research&study=%3Cscript%3E&lang=en`);
 await page.waitForFunction(()=>document.querySelectorAll('.research-card').length===15);
 if(guide)for(const lang of ['en','es'])for(const [chapter,id] of [['07-residual-norm','mhc'],['24-grokking','softmax-fix']]){
  await page.goto(`${guide}${lang}/chapters/${chapter}.html`);
  const host=page.locator(`[data-research-lab="${id}"]`);
  await host.locator('..').locator('summary').click();await host.locator('input').first().waitFor();
  assert.equal(await host.getAttribute('lang'),lang);
  const link=page.locator(`main a[href*="study=${id}"]`).first();assert.ok((await link.getAttribute('href')).includes(`lang=${lang}`));
  if(shots)await host.screenshot({path:`${shots}/guide-${id}-${lang}.png`});
 }
 assert.deepEqual(errors,[]);
 console.log('Research demos PASS: opt-in, keyboard, 4 languages, numbers, mobile, reduced motion, safe study links'+(guide?', ES/EN guide.':'.'));
}finally{await browser.close();}
