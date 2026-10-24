// Browser checks for imports, honest comparison, round trips and language changes.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
const base = process.env.TAF_URL || "http://127.0.0.1:8877/";
const browser = await chromium.launch({headless:true});
const errors = [];
try {
  const context = await browser.newContext({locale:"es-ES",viewport:{width:1280,height:960}});
  await context.route("**/pyodide.js", r => r.fulfill({contentType:"text/javascript",body:"window.loadPyodide=()=>new Promise(()=>{});"}));
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(`${base}?mode=pvr#pvr-section`);
  await page.locator('#pvr-control-btn').click();
  await page.locator('.pvr-context[data-context="documented"]').waitFor();
  const control=JSON.parse(await page.locator('#pvr-paste').inputValue());
  assert.ok(Math.abs(control.gamma)<1e-12);
  assert.equal(await page.locator('#pvr-output .confidence-bar').count(),0);
  let exported=JSON.parse(await page.locator('#pvr-output textarea').inputValue());
  assert.deepEqual(exported.protocol,control.protocol);
  assert.deepEqual(exported.mean_attention,control.mean_attention);
  assert.match(await page.locator('#pvr-output').innerText(),/0[,.]982/);
  const other=structuredClone(control);
  other.gamma=0.4;
  other.protocol.sink_tokens=4;
  other.protocol['<img src=x onerror="window.pvrInjected=1">']='x';
  await page.locator('#pvr-reference').fill(JSON.stringify(other));
  await page.locator('#pvr-paste-btn').click();
  await page.locator('.pvr-comparison[data-comparison="different"]').waitFor();
  assert.equal(await page.evaluate(()=>window.pvrInjected),undefined);
  assert.equal(await page.locator('.pvr-comparison img').count(),0);
  for(const lang of ['fr','zh','en','es']) {
    await page.locator(`.lang-btn[data-lang="${lang}"]`).click();
    assert.equal(await page.locator('.pvr-comparison[data-comparison="different"]').count(),1);
    assert.equal(JSON.parse(await page.locator('#pvr-reference').inputValue()).gamma,0.4);
    assert.ok((await page.locator('.pvr-protocol a').first().getAttribute('href')).includes(`/${lang==='es'?'es':'en'}/`));
    assert.ok(!/pvr\.lab\./.test(await page.locator('#pvr-section').innerText()));
  }
  await page.setViewportSize({width:390,height:844});
  if(process.env.TAF_SCREENSHOTS) {
    mkdirSync(process.env.TAF_SCREENSHOTS,{recursive:true});
    await page.locator('#pvr-output .unmask-result').first().scrollIntoViewIfNeeded();
    await page.screenshot({path:`${process.env.TAF_SCREENSHOTS}/measurement-mobile.png`});
  }
  const overflowing = await page.locator('#pvr-section').evaluate(el => [...el.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>el.getBoundingClientRect().right+2).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,width:e.clientWidth,scroll:e.scrollWidth})));
  assert.equal(await page.locator('#pvr-section').evaluate(el=>el.scrollWidth>el.clientWidth+2),false,JSON.stringify(overflowing));
  await page.locator('#pvr-reference').fill('{bad json');
  await page.locator('#pvr-paste-btn').click();
  assert.equal(await page.locator('#pvr-output').innerText(),'');
  assert.match(await page.locator('#pvr-status').innerText(),/segundo registro/);
  await page.locator('#pvr-reference').fill('');
  const variable={model:'fixture/cli',gamma:0.7,N:2000,theta_nom:10000,
    D90:750,fit_power_law:{R2:0.99},attn_by_distance:{10:0.1,50:0.01}};
  await page.locator('#pvr-paste').fill(JSON.stringify(variable));
  await page.locator('#pvr-paste-btn').click();
  assert.equal(await page.locator('[data-context="variable"]').count(),1);
  assert.ok(!(await page.locator('#pvr-output').innerText()).includes('750'));
  // Direct, unannotated guide output must remain visible without theta or model.
  const guide={gamma:0,r2_log:null,distance:[1,2,3],mean_attention:[.25,.25,.25],
    protocol:{id:'guide-distance-mean-v1',length:4,queries:[3],sink_tokens:0,samples:1,
      pooling:'arithmetic_mean_per_distance',fit:'unweighted_OLS_log_mean_vs_log_distance'}};
  await page.locator('#pvr-paste').fill(JSON.stringify(guide));
  await page.locator('#pvr-reference').fill(JSON.stringify(guide));
  await page.locator('#pvr-paste-btn').click();
  assert.equal(await page.locator('[data-context="missing"]').count(),2);
  assert.equal(await page.locator('[data-comparison="unknown"]').count(),1);
  exported=JSON.parse(await page.locator('#pvr-output textarea').first().inputValue());
  assert.deepEqual(exported.mean_attention,guide.mean_attention);
  assert.deepEqual(errors,[]);
  console.log('Measurement browser: controls, protocols, safe rendering, export, 4 languages and mobile passed.');
} finally { await browser.close(); }
