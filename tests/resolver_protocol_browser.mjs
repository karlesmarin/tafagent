import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {existsSync,readFileSync,mkdirSync} from 'node:fs';
import {RESOLVER_TRANSLATIONS} from '../js/resolver_i18n.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const base=process.env.TAF_URL||'http://127.0.0.1:8877/';
const browser=await chromium.launch({headless:true,timeout:20000});
try{
 const context=await browser.newContext(),page=await context.newPage(),errors=[];let hf=0;
 page.on('pageerror',e=>errors.push(e.message));
 await context.route(base+'**',async r=>{
  const suffix=new URL(r.request().url()).pathname.slice(new URL(base).pathname.length),path=resolve(root,decodeURIComponent(suffix)||'index.html');
  if(!path.startsWith(root.endsWith(sep)?root:root+sep)||!existsSync(path))return r.fulfill({status:404,body:''});
  await r.fulfill({path});
 });
 await context.route('**/pyodide.js',r=>r.fulfill({contentType:'text/javascript',body:'window.loadPyodide=()=>new Promise(()=>{});'}));
 await context.route('https://huggingface.co/**',r=>{hf++;return r.abort();});
 const a={model:'SECRET_MODEL',revision:'SECRET_REV',corpus:'SECRET_CORPUS',theta:10000,gamma:0,distance:[1,2,3],protocol:{id:'SECRET_ID',length:4,queries:[3],sink_tokens:0,samples:2,pooling:'mean',fit:'OLS',layer:0,head:0,backend:'numpy',dtype:'float64',quantization:'none',seed:0,tokenizer_revision:'not_used'}};
 const b={...a,protocol:{...a.protocol,seed:1}};
 for(const lang of ['en','es','fr','zh']){
  const tr=k=>RESOLVER_TRANSLATIONS[lang]['resolver.'+k];
  await page.goto(base+'?resolve=pvr&lang='+lang);await page.locator('#resolver-dialog[open]').waitFor();
  for(const [first,second,priority] of [[a,null,'repeat'],[{...a,protocol:{...a.protocol,backend:null}},null,'document'],[a,b,'align'],[{...a,T_eval:8},b,'context'],[a,{...b,T_eval:8},'reference_context']]){
   await page.locator('#resolver-local-text').fill(JSON.stringify(first));
   assert.equal(await page.locator('#resolver-review').count(),0);
   await page.locator('#resolver-local-text2').fill(second?JSON.stringify(second):'');
   await page.locator('#resolver-run').click();await page.locator('#resolver-export').waitFor();
   assert.ok((await page.locator('#resolver-case-summary').innerText()).includes(tr('protocol_first_'+priority)));
   await page.locator('#resolver-show-protocol').click();
   assert.equal(await page.locator('#resolver-review').evaluate(e=>e.open),true);
   assert.equal(await page.locator('#resolver-protocol').evaluate(e=>e.open),true);
   assert.equal(await page.locator('#resolver-protocol li').count(),19);
   const text=await page.locator('#resolver-protocol').innerText();assert.ok(!text.includes('undefined')&&!text.includes('SECRET'));
   assert.ok(text.includes(tr('protocol_sampling')));
   if(priority==='align')assert.ok(text.includes(tr('protocol_pair_different')));
   await page.locator('#resolver-failed').click();
   assert.ok((await page.locator('#resolver-followup').innerText()).includes(tr('protocol_first_'+priority)));
  }
  await page.locator('#resolver-local-text').fill(JSON.stringify({...a,protocol:{...a.protocol,SECRET_CUSTOM:null}}));
  await page.locator('#resolver-local-text2').fill('');await page.locator('#resolver-run').click();await page.locator('#resolver-export').waitFor();
  const pending=page.waitForEvent('download');await page.locator('#resolver-export').click();const reportText=readFileSync(await (await pending).path(),'utf8'),report=JSON.parse(reportText);
  assert.ok(!reportText.includes('SECRET'));
  assert.equal(report.review.protocol.additional_fields.missing_in_first,1);
  assert.equal(report.review.protocol.priority,'document');
 }
 await page.locator('#resolver-demo').click();await page.locator('#resolver-export').waitFor();
 assert.ok((await page.locator('#resolver-case-summary').innerText()).includes(RESOLVER_TRANSLATIONS.zh['resolver.protocol_first_document']));
 await page.setViewportSize({width:390,height:844});await page.locator('#resolver-show-protocol').click();
 assert.ok(await page.locator('#resolver-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 mkdirSync('tmp/resolver',{recursive:true});await page.screenshot({path:'tmp/resolver/protocol-mobile.png'});
 assert.equal(hf,0);assert.deepEqual(errors,[]);
 console.log('Resolver protocol browser PASS: five priorities × four languages, field details, follow-up, stale-state clearing, private exports and mobile.');
}finally{await browser.close();}
