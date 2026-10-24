import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {local} from '../js/guide_bridge.js';
const base=process.env.TAF_URL||'http://127.0.0.1:8877/';
const guide=process.env.GUIDE_URL;
const browser=await chromium.launch({headless:true});
try {
 for(const lang of ['es','en']) {
  const context=await browser.newContext({viewport:{width:1100,height:900}});
  const page=await context.newPage(), errors=[], requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  let releaseOld, oldStarted, retry=false;
  const oldReady=new Promise(resolve=>{oldStarted=resolve;});
  await page.route('https://huggingface.co/api/models?**',async route=>{
    const q=new URL(route.request().url()).searchParams.get('search')||'';
    if(q==='Old') { releaseOld=()=>route.fulfill({json:[{id:'Example/Old'}]});oldStarted();return; }
    if(q==='Offline'&&!retry)return route.abort();
    if(q==='Limited')return route.fulfill({status:429,json:{}});
    const models=q==='Nothing'?[]:q==='New'?[{id:'Example/New'}]:q==='Offline'?[{id:'Example/Recovered'}]:[{id:'Qwen/Qwen2.5-7B',downloads:1234},{id:'EleutherAI/pythia-70m',downloads:800}];
    return route.fulfill({json:models});
  });
  const fixture=new URL('guide-model-test.html',base).href;
  if(!guide)await page.route(fixture,r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html lang="${lang}"><main><div data-taf-selector></div></main><script type="module">import {initGuidePage} from '${new URL('js/guide_bridge.js',base).href}';initGuidePage();</script></html>`}));
  await page.goto(guide?`${guide}${lang}/chapters/R5-tafagent.html`:fixture);
  const input=page.locator('#taf-route-model'),list=page.locator('.hf-guide-dropdown');
  await input.waitFor();await page.waitForTimeout(150);
  assert.equal(requests.filter(u=>u.startsWith('https://huggingface.co/')).length,0,'No HF query on page load');
  await input.click();await list.locator('[role=option]').first().waitFor();
  assert.equal(await list.locator('[role=option]').count(),2);
  assert.equal(await input.getAttribute('aria-expanded'),'true');
  await input.press('ArrowDown');await input.press('Enter');
  assert.equal(await input.inputValue(),'Qwen/Qwen2.5-7B');
  const open=page.locator('[data-taf-selector] a').filter({hasText:local('open',lang)});
  assert.equal(new URL(await open.getAttribute('href')).searchParams.get('model'),'Qwen/Qwen2.5-7B');
  await input.fill('Old');await oldReady;await input.fill('New');
  await list.getByText('Example/New',{exact:true}).waitFor();await releaseOld();await page.waitForTimeout(100);
  assert.equal(await list.locator('[role=option]').count(),1);assert.ok((await list.innerText()).includes('Example/New'));
  await list.locator('[role=option]').click();assert.equal(await input.inputValue(),'Example/New');
  await input.fill('Nothing');await list.getByText(local('modelEmpty',lang),{exact:true}).waitFor();
  await input.press('Escape');assert.equal(await input.getAttribute('aria-expanded'),'false');
  await input.fill('Offline');await list.getByText(local('modelError',lang),{exact:true}).waitFor();
  assert.equal(new URL(await open.getAttribute('href')).searchParams.get('model'),'Offline','Manual ID still works');
  retry=true;await input.click();await list.getByText('Example/Recovered',{exact:true}).waitFor();
  await input.fill('Limited');await list.getByText(local('modelRate',lang),{exact:true}).waitFor();
  await page.locator('#taf-route-task').selectOption('contam');assert.ok(await input.isDisabled());
  await page.waitForFunction(()=>document.querySelector('#taf-route-model').getAttribute('aria-expanded')==='false');
  await page.locator('#taf-route-task').selectOption('profile');await input.fill('');await input.click();
  await list.locator('[role=option]').first().waitFor();
  await page.setViewportSize({width:390,height:844});await input.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const r=document.querySelector('.hf-guide-dropdown').getBoundingClientRect();return r.x>=0&&r.right<=innerWidth+1&&r.y>=0&&r.bottom<=innerHeight+1;},{},{timeout:3000});
  const rect=await list.boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=391&&rect.y>=0&&rect.y+rect.height<=845,JSON.stringify(rect));
  if(process.env.TAF_SCREENSHOTS){mkdirSync(process.env.TAF_SCREENSHOTS,{recursive:true});await page.screenshot({path:`${process.env.TAF_SCREENSHOTS}/model-picker-${lang}.png`});}
  assert.ok(!requests.some(u=>/huggingface.co\/.*\/resolve\//.test(u)),'Selection must not fetch model files');
  assert.deepEqual(errors,[]);await context.close();
  console.log(`Guide model picker ${lang}: popular/search, keyboard, selection link, stale response, offline/retry, rate limit, disabled and mobile PASS`);
 }
}finally{await browser.close();}
