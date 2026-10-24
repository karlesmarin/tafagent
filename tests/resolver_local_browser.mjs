import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {LOCAL_DEMOS} from '../js/resolver_local.js';
import {TOOL_CATALOG} from '../js/resolver_catalog.js';
import {TRIAGE} from '../js/resolver_triage.js';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
const base=process.env.TAF_URL||'http://127.0.0.1:8877/';
mkdirSync('tmp/resolver',{recursive:true});
const browser=await chromium.launch({headless:true,timeout:20000});
try{
 const page=await browser.newPage({viewport:{width:1150,height:950}}),errors=[];let hfRequests=0;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/pyodide.js',r=>r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'}));
 await page.route('https://huggingface.co/**',r=>{hfRequests++;return r.abort();});
 for(const lang of ['es','en','fr','zh']){
  await page.goto(base+'?resolve=choose&lang='+lang);
  await page.locator('#resolver-dialog[open]').waitFor();
  if(lang==='es')await page.locator('#resolver-dialog').screenshot({path:'tmp/resolver/symptoms-desktop.png'});
  for(const [category,choices] of Object.entries(TRIAGE)){
   await page.locator('#resolver-symptom').selectOption(category);
   for(const [key,route,mode] of choices){
    await page.locator('#resolver-symptom-detail').selectOption(key);
    const answer=await page.locator('#resolver-triage-answer').innerText();assert.ok(answer&&!/resolver\.|undefined/.test(answer),lang+' '+key);
    assert.equal(await page.locator('#resolver-form').isVisible(),false);
    if(route||mode){
     await page.locator('#resolver-triage-continue').click();
     if(route){assert.equal(await page.locator('#resolver-route-title').innerText(),RESOLVER_TRANSLATIONS[lang]['resolver.'+route]);if(key==='load')assert.equal(await page.locator('#resolver-stage').inputValue(),'load');}
     else assert.equal(await page.locator('#resolver-catalog-select').inputValue(),mode);
    }else{assert.equal(await page.locator('#resolver-triage-continue').count(),0);assert.ok(answer.length>100);}
   }
  }
  await page.locator('#resolver-direct').evaluate(el=>el.open=true);
  for(const id of Object.keys(LOCAL_DEMOS)){
   await page.locator(`[data-resolver-case="${id}"]`).click();
   assert.equal(await page.locator('#resolver-hf-fields').isVisible(),false);
   await page.locator('#resolver-demo').click();await page.locator('#resolver-export').waitFor();
   await page.locator('#resolver-review > summary').click();
   assert.ok((await page.locator('#resolver-review').innerText()).includes(RESOLVER_TRANSLATIONS[lang]['resolver.review_'+id+'_limit']));
   assert.ok((await page.locator('#resolver-review').innerText()).includes(RESOLVER_TRANSLATIONS[lang]['resolver.review_demo']));
   const text=await page.locator('#resolver-result').innerText();
   assert.ok(!text.includes('undefined')&&!/resolver\.|drift\.template\./.test(text),lang+' '+id+': '+text);
   const next={pvr:'protocol_first_document',adapter:'check_adapter_mismatch',cache:'check_cache_changed',drift:'check_drift_templates'};
   assert.ok(text.includes(RESOLVER_TRANSLATIONS[lang]['resolver.'+(next[id]||'next_'+id)]));
   if(id==='pvr'){
    await page.locator('#resolver-show-protocol').click();
    const protocol=await page.locator('#resolver-protocol').innerText();
    assert.ok(protocol.includes('protocol.seed')&&protocol.includes('protocol.tokenizer_revision'));
    assert.ok(protocol.includes(RESOLVER_TRANSLATIONS[lang]['resolver.protocol_absent']));
   }
   const url=new URL(await page.locator('#resolver-case-summary a').getAttribute('href'));
   assert.ok(url.pathname.includes('/'+(lang==='es'?'es':'en')+'/chapters/'));
   await page.locator('#resolver-run').click();await page.locator('#resolver-export').waitFor();
   const pending=page.waitForEvent('download');await page.locator('#resolver-export').click();
   const download=await pending,report=JSON.parse(readFileSync(await download.path(),'utf8'));
   assert.equal(report.origin,'local');assert.equal(report.route,id);assert.equal(report.result.suggestion,undefined);
   assert.equal(report.schema_version,3);assert.equal(report.review.demonstration,false);assert.equal(report.review.independently_verified,false);
   assert.ok(!JSON.stringify(report.review).includes(LOCAL_DEMOS[id].text||'PRIVATE_UNSET'));
   assert.ok(!Object.hasOwn(report.inputs,'text')&&!Object.hasOwn(report.initial_inputs,'text'));
   if(id==='cot'){
    await page.locator('#resolver-result details').first().locator('summary').click();
    await page.locator('#resolver-try-proposal').click();await page.locator('#resolver-export').waitFor();
    assert.equal(await page.locator('#resolver-try-proposal').count(),0);
    assert.ok((await page.locator('#resolver-case-summary').innerText()).includes(RESOLVER_TRANSLATIONS[lang]['resolver.cot_ordered']));
   }
  }
  await page.locator('#resolver-catalog > details').evaluate(el=>el.open=true);
  assert.equal(await page.locator('#resolver-catalog-select option').count(),32);
  for(const {mode} of TOOL_CATALOG){
   await page.locator('#resolver-catalog-select').selectOption(mode);
   const card=page.locator('#resolver-catalog-card');
   const text=await card.innerText();assert.ok(!text.includes('undefined')&&!/modes\./.test(text),lang+' '+mode);
   const urls=await card.locator('a').evaluateAll(els=>els.map(x=>x.href));
   assert.equal(new URL(urls[0]).searchParams.get('mode'),mode);
   assert.equal(new URL(urls[1]).searchParams.get('demo'),mode);
   assert.ok(new URL(urls[2]).pathname.includes('/chapters/'));
  }
 }
 assert.equal(hfRequests,0,'The six local routes must not query HF.');
 // Invalid input clears stale output, does not render pasted HTML, and is recoverable.
 await page.goto(base+'?resolve=cot&model=Secret%2FUnrelated&lang=es');
 await page.locator('#resolver-local-text').fill('{"answer":"SECRET-PROMPT-123<img src=x>","reasoning":"SECRET-PROMPT-123"}');
 await page.locator('#resolver-run').click();await page.locator('#resolver-export').waitFor();
 assert.equal(await page.locator('#resolver-result img').count(),0);
 const pending=page.waitForEvent('download');await page.locator('#resolver-export').click();const report=readFileSync(await (await pending).path(),'utf8');
 assert.ok(!report.includes('SECRET-PROMPT-123')&&!report.includes('Secret/Unrelated'));
 await page.locator('#resolver-share').click();const share=await page.locator('#resolver-share-value').inputValue();
 assert.ok(!share.includes('SECRET')&&!share.includes('model='));
 await page.locator('#resolver-local-text').fill('invalid');assert.equal(await page.locator('#resolver-export').count(),0);
 await page.locator('#resolver-run').click();assert.ok((await page.locator('#resolver-status').innerText()).length);
 await page.locator('#resolver-demo').click();await page.locator('#resolver-export').waitFor();
 // A recognizable problem can route to a specialized tool without inventing a diagnosis.
 await page.locator('#resolver-description').fill('GGUF');await page.locator('#resolver-suggest').click();
 await page.locator('#resolver-suggestions button').click();assert.equal(await page.locator('#resolver-catalog-select').inputValue(),'gguf');
 await page.locator('#resolver-catalog-search').fill('unmatchablezzzz');assert.equal(await page.locator('#resolver-catalog-card').innerText(),'');
 await page.setViewportSize({width:390,height:844});
 await page.locator('#resolver-direct').evaluate(el=>el.open=true);
 await page.locator('[data-resolver-case="drift"]').click();await page.locator('#resolver-demo').click();await page.locator('#resolver-export').waitFor();
 await page.locator('#resolver-review > summary').click();
 await page.locator('#resolver-review').scrollIntoViewIfNeeded();
 await page.locator('#resolver-review').screenshot({path:'tmp/resolver/review-mobile.png'});
 assert.ok(await page.locator('#resolver-dialog').evaluate(x=>x.scrollWidth<=x.clientWidth+1));
 await page.locator('#resolver-dialog').screenshot({path:'tmp/resolver/local-mobile.png'});
 await page.goto(base+'?resolve=choose&lang=es');await page.locator('#resolver-dialog[open]').waitFor();
 await page.locator('#resolver-symptom').selectOption('memory');await page.locator('#resolver-symptom-detail').selectOption('training');
 await page.locator('#resolver-dialog').evaluate(x=>x.scrollTop=0);
 await page.locator('#resolver-dialog').screenshot({path:'tmp/resolver/symptoms-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('Resolver local browser PASS: symptom questions and 6 checks × 4 languages, 31 tool/deep/demo links, local-only computation, proposal, reports, validation and mobile.');
}finally{await browser.close();}
