import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { ENTROPY_TRANSLATIONS, ENTROPY_DEMO_TRANSLATIONS } from '../js/entropy_i18n.js';
const base=process.env.TAF_URL || 'http://127.0.0.1:8877/';
const browser=await chromium.launch({headless:true});
const errors=[], requests=[];
try {
  const context=await browser.newContext({locale:'es-ES',viewport:{width:1280,height:960}});
  await context.route('**/pyodide.js', r=>r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'}));
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  await page.goto(`${base}?mode=diagnose#diagnose-section`);
  assert.equal(await page.locator('.mode-btn.active').getAttribute('data-mode'),'diagnose');
  assert.equal(await page.locator('#diag-measure-entropy').isChecked(),false);
  assert.equal(await page.locator('#diag-entropy-only').isChecked(),false);
  await page.locator('#diag-build-btn').click();
  assert.ok(!(await page.locator('#diag-cmd').innerText()).includes('--entropy'));
  await page.locator('#diag-entropy-options summary').click();
  await page.locator('#diag-measure-entropy').check();
  await page.locator('#diag-build-btn').click();
  assert.match(await page.locator('#diag-cmd').innerText(),/--measure-entropy/);
  await page.locator('#diag-entropy-only').check();
  await page.locator('#diag-build-btn').click();
  assert.match(await page.locator('#diag-cmd').innerText(),/--entropy-only/);
  assert.ok(!(await page.locator('#diag-cmd').innerText()).includes('--measure-entropy'));

  for(const lang of ['en','es','fr','zh']) {
    await page.locator(`.lang-btn[data-lang="${lang}"]`).click();
    assert.equal(await page.locator('[data-i18n="diagnose.entropy.note"]').innerText(),ENTROPY_TRANSLATIONS[lang]['diagnose.entropy.note']);
    await page.locator('#help-btn').click();
    const summary=page.locator('#help-modal [data-i18n="help.entropy.title"]');
    if (!(await summary.evaluate(el => el.parentElement.open))) await summary.click();
    assert.equal(await summary.innerText(),ENTROPY_TRANSLATIONS[lang]['help.entropy.title']);
    assert.ok((await page.locator('[data-i18n="help.entropy.example"]').innerText()).includes('--entropy-only'));
    assert.ok(!/help\.entropy\.|diagnose\.entropy\./.test(await page.locator('#help-modal').innerText()));
    if(lang==='es' && process.env.TAF_SCREENSHOTS) {
      mkdirSync(process.env.TAF_SCREENSHOTS,{recursive:true});
      await summary.scrollIntoViewIfNeeded();
      await page.screenshot({path:`${process.env.TAF_SCREENSHOTS}/entropy-help-es.png`});
    }
    await page.locator('#help-close').click();
    for(const mode of ['diagnose','pvr','entropy','protocol','research']) {
      const panel = mode==='entropy'?'diagnose':mode==='protocol'?'pvr':mode;
      await page.locator(`.mode-btn[data-mode="${panel}"]`).evaluate(el => { for(let p=el.parentElement;p;p=p.parentElement) if(p.tagName==='DETAILS') p.open=true; });
      await page.locator(`.mode-btn[data-mode="${panel}"]`).click();
      if(mode==='pvr') await page.locator('#pvr-reference').fill('{bad previous record');
      await page.locator('#__taf_demo_explain').evaluateAll(nodes=>nodes.forEach(n=>n.remove()));
      await page.locator(`.taf-demo-btn[data-demo-mode="${mode}"]`).click();
      await page.locator('#__taf_demo_explain').waitFor({timeout:20000});
      const expected=mode==='protocol'?ENTROPY_DEMO_TRANSLATIONS[lang]['protocol.explain']:
        mode==='entropy'?ENTROPY_TRANSLATIONS[lang]['diagnose.entropy.note']:
        ENTROPY_DEMO_TRANSLATIONS[lang][`${mode}.x.l4`];
      if(expected) assert.ok((await page.locator('#__taf_demo_explain').innerText()).includes(expected));
      if(mode==='protocol') assert.equal(await page.locator('.pvr-comparison[data-comparison="different"]').count(),1);
      if(mode==='research') assert.equal(await page.locator('.research-card').getAttribute('data-paper'),'shotkv');
      if(mode==='pvr') {
        assert.equal(await page.locator('#pvr-reference').inputValue(),'');
        assert.equal(await page.locator('[data-context="legacy"]').count(),1);
      }
      await page.locator('#__taf_demo_banner').click();
    }
    console.log(`Help, builder and five guided demos: ${lang} PASS`);
    await page.locator('.mode-btn[data-mode="diagnose"]').click();
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#diag-entropy-options').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#diag-entropy-options').evaluate(el=>el.scrollWidth>el.clientWidth+2),false);
  assert.ok(!requests.some(url=>url.includes('/entropy_scanner.js')),'Scanner must remain disconnected');
  const modes=await page.locator('.mode-btn').evaluateAll(nodes=>nodes.map(n=>n.dataset.mode));
  const demos=await page.locator('.taf-demo-btn').evaluateAll(nodes=>nodes.map(n=>n.dataset.demoMode));
  assert.deepEqual(modes.filter(mode=>!demos.includes(mode)),[],'Every mode must offer an optional demo');
  assert.deepEqual(errors,[]);
  console.log('Entropy UI: help, demos, defaults, commands, languages, mobile and inactive scanner PASS');
} finally { await browser.close(); }
