import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {words,modeTopics,local} from '../js/guide_bridge.js';
import {RESEARCH_TRANSLATIONS} from '../js/research_i18n.js';
const base=process.env.TAF_URL || 'http://127.0.0.1:8877/';
const guide=process.env.GUIDE_URL;
const browser=await chromium.launch({headless:true});
try {
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.route('**/pyodide.js',r=>r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'}));
  const page=await context.newPage(); const errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message)); page.on('request',r=>requests.push(r.url()));
  for(const lang of ['en','es','fr','zh']) {
    await page.goto(`${base}?mode=profile&model=EleutherAI%2Fpythia-70m&lang=${lang}`);
    await page.locator('#guide-for-profile-section').waitFor();
    assert.equal(await page.locator('.mode-btn.active').getAttribute('data-mode'),'profile');
    assert.equal(await page.locator('#profile-hf-id').inputValue(),'EleutherAI/pythia-70m');
    assert.equal(await page.locator('[data-guide-mode]').count(),33);
    const panel=page.locator('#guide-for-profile-section');
    await panel.locator('summary').click();
    assert.equal(await panel.locator('summary').innerText(),`📖 ${local('title',lang)}`);
    await panel.locator('select').selectOption('horizon');
    assert.ok((await panel.innerText()).includes('T_eval'));
    const url=new URL(await panel.locator('ol a').first().getAttribute('href'));
    assert.equal(url.searchParams.get('model'),'EleutherAI/pythia-70m');
    assert.ok(url.pathname.includes(`/${lang==='es'?'es':'en'}/`));
    // Exercise result updates including zero gamma; no inference or invented measured values.
    await page.evaluate(async()=>{
      const module=await import('./js/guide_panel.js');
      module.recordGuideResult('profile',{gamma_pade:0.85,d_horizon:32768,kv_memory_per_request_GB:2});
      module.recordGuideResult('pvr',{gamma_obs:0},{model:'EleutherAI/pythia-70m',mismatch:true});
    });
    await panel.locator('select').selectOption('metric:gamma_pade');
    assert.ok((await panel.innerText()).includes(local('predicted',lang)));
    let metricURL=new URL(await panel.locator('ol a').first().getAttribute('href'));
    assert.equal(metricURL.searchParams.get('metric'),'gamma_pade');
    assert.equal(metricURL.searchParams.get('value'),'0.85');
    assert.equal(metricURL.searchParams.has('model'),false,'Manual profile must not inherit an unverified model ID');
    await page.locator('.mode-btn[data-mode="pvr"]').evaluate(el=>el.click());
    const pvr=page.locator('#guide-for-pvr-section'); await pvr.locator('summary').click();
    await pvr.locator('select').selectOption('metric:gamma_obs');
    assert.ok((await pvr.innerText()).includes(local('mismatch',lang)));
    metricURL=new URL(await pvr.locator('ol a').first().getAttribute('href'));
    assert.equal(metricURL.searchParams.get('value'),'0');
    assert.ok((await pvr.innerText()).includes(local('measured',lang)));
    await page.locator('#help-btn').click();
    assert.equal(await page.locator('#guide-help-body').textContent(),local('help',lang));
    for(const key of ['title','guide','studies','demos','data','open_guide']) {
      assert.equal(await page.locator(`#manual-updates [data-i18n="updates.${key}"]`).textContent(),RESEARCH_TRANSLATIONS[lang][`updates.${key}`]);
    }
    await page.locator('#help-close').click();
    await page.locator('#inventory-btn').click();
    for(const key of ['title','guide','studies','demos','data','open_guide']) {
      assert.equal(await page.locator(`#inventory-updates [data-i18n="updates.${key}"]`).textContent(),RESEARCH_TRANSLATIONS[lang][`updates.${key}`]);
    }
    assert.ok((await page.locator('#inventory-updates a').getAttribute('href')).includes(`/${lang==='es'?'es':'en'}/chapters/R5-tafagent.html`));
    await page.locator('#inventory-close').click();
    for(const mode of Object.keys(modeTopics)) {
      await page.locator(`.mode-btn[data-mode="${mode}"]`).evaluate(el=>el.click());
      assert.equal(await page.locator(`#guide-for-${mode}-section`).isVisible(),true,mode);
    }
    console.log(`31 modes, contextual explanations, value provenance, help: ${lang} PASS`);
  }
  await page.locator('.mode-btn[data-mode="pvr"]').evaluate(el=>el.click());
  await page.locator('.taf-demo-btn[data-demo-mode="protocol"]').click();
  await page.locator('#__taf_demo_explain').waitFor({timeout:20000});
  const pair=page.locator('#guide-for-pvr-section');
  assert.equal(await pair.locator('option[value="metric:gamma_obs_a"]').count(),1);
  assert.equal(await pair.locator('option[value="metric:gamma_obs_b"]').count(),1);
  await page.goto(`${base}?mode=profile&demo=guide&lang=es`);
  await page.locator('#__taf_demo_explain').waitFor({timeout:10000});
  assert.ok((await page.locator('#__taf_demo_explain').innerText()).includes(local('help','es')));
  assert.ok(!requests.some(u=>/huggingface.co\/api\/models\/EleutherAI|pythia-70m\/resolve/.test(u)),'Prefill must not fetch the model');
  await page.setViewportSize({width:390,height:844});
  const panel=page.locator('#guide-for-profile-section');
  assert.equal(await panel.evaluate(e=>e.scrollWidth>e.clientWidth+2),false);
  if(process.env.TAF_SCREENSHOTS){mkdirSync(process.env.TAF_SCREENSHOTS,{recursive:true}); await panel.scrollIntoViewIfNeeded(); await page.screenshot({path:`${process.env.TAF_SCREENSHOTS}/taf-guide-mobile.png`});}
  await page.goto(`${base}?mode=%22%5D&lang=es&model=javascript:alert(1)`);
  await page.locator('#guide-for-profile-section').waitFor();
  assert.deepEqual(errors,[]);
  if(guide) {
    for(const lang of ['es','en']) {
      const g=await context.newPage(); g.on('pageerror',e=>errors.push(e.message));
      await g.goto(`${guide}${lang}/chapters/15-ley-gamma.html?topic=gamma&mode=pvr&metric=gamma_obs&value=0&model=EleutherAI%2Fpythia-70m&lang=${lang}`);
      await g.locator('#taf-reading-context').waitFor();
      assert.ok((await g.locator('#taf-reading-context').innerText()).includes(local('measured',lang)));
      const back=g.locator('#taf-reading-context a').filter({hasText:local('back',lang)});
      const backURL=new URL(await back.getAttribute('href'));
      assert.equal(backURL.searchParams.get('mode'),'pvr'); assert.equal(backURL.searchParams.get('model'),'EleutherAI/pythia-70m');
      await g.goto(`${guide}${lang}/chapters/R5-tafagent.html`);
      await g.locator('#taf-route-task').waitFor();
      await g.locator('#taf-route-task').selectOption('fitcheck');
      await g.locator('#taf-route-model').fill('Qwen/Qwen2.5-7B');
      const open=g.locator('[data-taf-selector] a').filter({hasText:local('open',lang)});
      assert.equal(new URL(await open.getAttribute('href')).searchParams.get('mode'),'fitcheck');
      await g.locator('#taf-route-task').selectOption('contam');
      assert.equal(await g.locator('#taf-route-model').isDisabled(),true);
      assert.equal(new URL(await open.getAttribute('href')).searchParams.has('model'),false);
      await g.locator('#taf-route-task').selectOption('fitcheck');
      await g.locator('#taf-route-model').fill('https://bad.example');
      assert.equal(await open.getAttribute('href'),null);
      await g.locator('[data-taf-selector] button').click();
      assert.equal(await g.locator('#taf-route-task').inputValue(),'diagnose');
      assert.ok((await g.locator('[data-taf-selector] [role="status"]').innerText()).includes(local('demoNote',lang)));
      await g.setViewportSize({width:390,height:844});
      assert.equal(await g.locator('[data-taf-selector] section').evaluate(e=>e.scrollWidth>e.clientWidth+2),false);
      if(process.env.TAF_SCREENSHOTS){await g.locator('[data-taf-selector]').scrollIntoViewIfNeeded();await g.screenshot({path:`${process.env.TAF_SCREENSHOTS}/guide-selector-${lang}.png`});}
      console.log(`Guide round trip, selector, optional demo, invalid ID, mobile: ${lang} PASS`);
      await g.goto(`${guide}${lang}/chapters/20-kv-cache.html`);
      await g.locator('.taf-guide-context').waitFor();
      assert.ok((await g.locator('.taf-guide-context').innerText()).includes('Fit Check'));
      await g.close();
    }
  }
  assert.deepEqual(errors,[]); console.log('Guide bridge browser PASS');
} finally {await browser.close();}
