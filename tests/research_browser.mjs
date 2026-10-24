// UI regression with Pyodide held pending: research must work independently.
// Start `python -m http.server 8877`, then `node tests/research_browser.mjs`.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
const base = process.env.TAF_URL || "http://127.0.0.1:8877/";
const browser = await chromium.launch({headless:true});
const errors = [];
const shots = process.env.TAF_SCREENSHOTS;
if (shots) mkdirSync(shots, {recursive:true});
try {
  const context = await browser.newContext({locale:"es-ES", viewport:{width:1365,height:1000}});
  await context.route("**/pyodide.js", route => route.fulfill({contentType:"text/javascript", body:"window.loadPyodide = () => new Promise(() => {});"}));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${base}?mode=research#research-section`);
  await page.waitForFunction(() => document.querySelectorAll(".research-card").length === 7);
  assert.equal(await page.locator('.mode-btn.active').getAttribute('data-mode'), 'research');
  assert.equal(await page.locator('#research-section').getAttribute('lang'),'es');
  await page.locator('#research-topic').selectOption('compression');
  await page.locator('#research-publication').selectOption('published');
  assert.equal(await page.locator('.research-card').count(),1);
  assert.equal(await page.locator('.research-card').getAttribute('data-paper'),'shotkv');
  await page.locator('#research-clear').click();
  await page.locator('#research-search').fill('BLOCK-GTQ cuantizacion');
  assert.equal(await page.locator('.research-card').getAttribute('data-paper'),'blockgtq');
  await page.locator('.research-card summary').click();
  await page.waitForFunction(() => document.querySelector('.research-card details').open);

  for (const lang of ['fr','zh','en','es']) {
    await page.locator(`.lang-btn[data-lang="${lang}"]`).click();
    assert.equal(await page.locator('#research-search').inputValue(),'BLOCK-GTQ cuantizacion');
    assert.equal(await page.locator('#research-section').getAttribute('lang'),lang);
    assert.ok(await page.locator('.research-card details').getAttribute('open') !== null);
    const guide=await page.locator('.research-links a').nth(1).getAttribute('href');
    assert.ok(guide.includes(`/${lang === 'es' ? 'es' : 'en'}/chapters/`));
    const text=await page.locator('#research-section').innerText();
    assert.ok(!/research\.(?:topic|status|count|limit|experiment)/.test(text));
  }
  const downloading = page.waitForEvent('download');
  await page.locator('#research-export').click();
  const download=await downloading;
  const exported=JSON.parse(readFileSync(await download.path(),'utf8'));
  assert.equal(exported.papers.length,1);
  assert.equal(exported.papers[0].id,'blockgtq');
  assert.equal(exported.language,'es');
  assert.equal(exported.papers[0].experiment_status,'proposed_not_run');
  await page.locator('#research-search').fill('no-such-study-anywhere');
  assert.equal(await page.locator('.research-card').count(),0);
  assert.ok(await page.locator('#research-export').isDisabled());
  assert.ok(await page.locator('.research-empty').isVisible());
  await page.locator('#research-clear').click();
  await page.locator('#research-section').scrollIntoViewIfNeeded();
  if(shots) await page.screenshot({path:`${shots}/research-desktop.png`});
  await page.setViewportSize({width:390,height:844});
  await page.locator('#research-topic').selectOption('memory');
  await page.locator('#research-section').scrollIntoViewIfNeeded();
  const overflow=await page.locator('#research-section').evaluate(el => el.scrollWidth>el.clientWidth+2);
  assert.equal(overflow,false,'Research panel must fit mobile width');
  if(shots) await page.screenshot({path:`${shots}/research-mobile.png`});
  await page.locator('#research-clear').click();
  await page.locator('[data-paper="blockgtq"] [data-mode-link="quant"]').click();
  assert.equal(await page.locator('.mode-btn.active').getAttribute('data-mode'),'quant');
  assert.ok(!(await page.locator('#research-section').isVisible()));
  await page.locator('header [data-mode-link="research"]').click();
  assert.ok(await page.locator('#research-section').isVisible());

  // A failed fetch must expose a localized retry and must not cache the failure.
  let failCatalog=true;
  const recovery=await context.newPage();
  recovery.on('pageerror',e=>errors.push(e.message));
  await recovery.route('**/data/research_studies.json',route=>failCatalog
    ? route.fulfill({status:503,body:'unavailable'}) : route.continue());
  await recovery.goto(`${base}?mode=research#research-section`);
  await recovery.locator('#research-retry').waitFor({state:'visible'});
  assert.ok(await recovery.locator('#research-export').isDisabled());
  failCatalog=false;
  await recovery.locator('#research-retry').click();
  await recovery.waitForFunction(()=>document.querySelectorAll('.research-card').length===7);
  assert.ok(!(await recovery.locator('#research-retry').isVisible()));
  assert.deepEqual(errors,[]);
  console.log('Research UI PASS: independent startup, filters, 4 languages, export, mobile, mode links, retry.');
} finally {
  await browser.close();
}
