// Real Pyodide profile: verifies the displayed values, explanation controls and exported context agree.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.TAF_URL || 'http://127.0.0.1:8877/';
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage(); const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}?mode=profile&lang=es`);
  await page.waitForFunction(()=>!document.getElementById('profile-btn').disabled,{},{timeout:120000});
  await page.locator('#profile-btn').click();
  await page.locator('[data-explain-metric="gamma_pade"]').waitFor({timeout:15000});
  assert.equal(await page.locator('[data-explain-metric]').count(),6);
  await page.locator('[data-explain-metric="gamma_pade"]').click();
  const panel=page.locator('#guide-for-profile-output');
  assert.equal(await panel.getAttribute('open'),'');
  assert.equal(await panel.locator('select').inputValue(),'metric:gamma_pade');
  const url=new URL(await panel.locator('ol a').first().getAttribute('href'));
  assert.equal(url.searchParams.get('metric'),'gamma_pade');
  const value=Number(url.searchParams.get('value')); assert.ok(Number.isFinite(value));
  assert.ok((await panel.innerText()).includes('Estimación desde la configuración'));
  await page.locator('.lang-btn[data-lang="fr"]').click();
  assert.ok((await panel.innerText()).includes('Estimation à partir de la configuration'));
  assert.equal(new URL(await panel.locator('ol a').first().getAttribute('href')).searchParams.get('value'),String(value));
  await page.locator('[data-explain-metric="kv_memory_per_request_GB"]').click();
  assert.equal(await panel.locator('select').inputValue(),'metric:kv_memory_per_request_GB');
  assert.ok((await panel.innerText()).includes('VRAM'));
  assert.deepEqual(errors,[]);
  console.log('Real Pyodide profile: six metric explanations, exact value handoff and language refresh PASS');
} finally {await browser.close();}
