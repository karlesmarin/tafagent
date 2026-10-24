import { CASES, suggestCases, validResolverModel, solveCase, fetchResolverBundle, resolverLink } from './resolver.js';
import { t, getLang } from './i18n.js';
import { tafLink } from './guide_bridge.js';
import { buildResolverSummary } from './resolver_summary.js';
import { buildResolverReview } from './resolver_review.js';
import { attachHfAutocomplete } from './hf_autocomplete.js';
import { LOCAL_CASES,LOCAL_DEMOS,publicLocalInputs } from './resolver_local.js';
import { TOOL_CATALOG } from './resolver_catalog.js';
import { mountResolverCatalog } from './resolver_catalog_ui.js';
import { mountResolverTriage } from './resolver_triage_ui.js';
const $=id=>document.getElementById('resolver-'+id);
const node=(tag,text)=>{const el=document.createElement(tag); if(text!=null)el.textContent=text;return el;};
const tr=key=>t('resolver.'+key);
let route='',bundle=null,result=null,feedback='',controller=null,request=0,lastInputs=null,initial=null;
let catalogUI=null;
let triageUI=null;
const isLocal=()=>CASES[route]?.source==='local';
function button(text,fn,id) { const b=node('button',text);b.type='button';if(id)b.id='resolver-'+id;b.addEventListener('click',fn);return b; }
function cancel() { request++;controller?.abort();controller=null;$('run').disabled=false;$('demo').disabled=false; }
function invalidate(clearBundle=false) {
  cancel(); if(clearBundle)bundle=null;result=null;feedback='';lastInputs=null;initial=null;
  $('dialog').querySelector('#__taf_demo_explain')?.remove();
  $('result').replaceChildren();$('followup').replaceChildren();$('status').textContent='';$('share-value').hidden=true;
}
function choose(id) {
  if(!Object.hasOwn(CASES,id))return;
  invalidate(true);route=id;$('form').hidden=false;
  $('share-area').hidden=false;
  $('memory-fields').disabled=id!=='memory';$('memory-fields').hidden=id!=='memory';
  $('hf-fields').disabled=isLocal();$('hf-fields').hidden=isLocal();
  renderLocalFields();
  for(const b of document.querySelectorAll('[data-resolver-case]'))b.setAttribute('aria-pressed',String(b.dataset.resolverCase===id));
  $('route-title').textContent=tr(id);
  $('route-title').tabIndex=-1;$('route-title').focus({preventScroll:true});$('form').scrollIntoView({block:'nearest'});
}
function renderLocalFields(values={}) {
 const host=$('local-fields');host.replaceChildren();host.hidden=!isLocal();host.disabled=!isLocal();if(!isLocal())return;
 host.append(node('legend',tr(route)),node('p',tr('local_note')));
 for(const f of LOCAL_CASES[route].fields){
  const label=node('label',tr(f.label));label.htmlFor='resolver-local-'+f.id;label.dataset.i18n='resolver.'+f.label;
  const input=node(f.type==='textarea'?'textarea':f.type==='select'?'select':'input');input.id=label.htmlFor;
  if(!['textarea','select'].includes(f.type))input.type=f.type;
  if(f.type==='textarea'){input.rows=6;input.maxLength=50000;input.spellcheck=false;}
  if(f.type==='text')input.maxLength=50000;
  for(const key of ['min','max','step'])if(f[key]!=null)input[key]=f[key];
  input.required=!!f.required;
  for(const [value,text] of f.options||[]){const o=new Option(text.startsWith('@')?t(text.slice(1)):text,value);if(text.startsWith('@'))o.dataset.i18n=text.slice(1);input.append(o);}
  if(values[f.id]!=null){if(f.type==='checkbox')input.checked=values[f.id];else input.value=values[f.id];}
  host.append(label,input);
 }
}
function inputs() {
 if(isLocal())return Object.fromEntries(LOCAL_CASES[route].fields.map(f=>{const el=$('local-'+f.id);return [f.id,f.type==='checkbox'?el.checked:f.type==='number'?(el.value===''?NaN:Number(el.value)):el.value];}));
 return {vram:Number($('vram').value),context:Number($('context').value),precision:$('precision').value,stage:$('stage').value};
}
function renderFeedback() {
  $('followup').replaceChildren();
  if(feedback)$('followup').append(node('p',tr(feedback==='worked'?'solved':'followup')));
  if(feedback==='failed') {
    $('followup').append(node('p',tr(result?.nextKey||(route==='template'?'template_next':route==='memory'?'memory_next':'compatibility_next'))));
    $('followup').append(button(tr('suggest'),()=>{$('description').focus();$('description').scrollIntoView({block:'nearest'});}));
  }
}
function summaryData() {return buildResolverSummary({route,bundle,initial,inputs:lastInputs,result},getLang());}
function reviewData() {return buildResolverReview({route,bundle,initial,inputs:lastInputs,result},getLang());}
function createResolverReview() {
 const review=reviewData(),box=node('details');box.id='resolver-review';
 box.append(node('summary',tr('review_title')),node('p',review.provenance));
 for(const [label,value] of [['review_basis',review.basis],['review_limit',review.limitation],['review_test',review.next_check]]) {
  const p=node('p');p.append(node('strong',tr(label)+': '),node('span',value));box.append(p);
 }
 if(review.missing_protocol_fields!=null)box.append(node('p',tr('missing_fields')+': '+review.missing_protocol_fields));
 if(review.observations.length){const ul=node('ul');for(const text of review.observations)ul.append(node('li',text));box.append(ul);}
 const a=node('a',review.guide.title);a.href=review.guide.url;a.target='_blank';a.rel='noopener';box.append(a);
 if(review.guide.note)box.append(node('p',review.guide.note));
 return box;
}
export function createResolverSummary(id='resolver-case-summary') {
  const summary=summaryData(),box=node('section');box.id=id;box.className='resolver-demo-card';
  box.append(node('h4',tr('summary_title')));
  if(summary.demo)box.append(node('p',tr('demo_note')));
  for(const [label,value] of [['summary_problem',summary.problem],['summary_check',summary.finding],['summary_change',summary.change],['summary_next',summary.next]]) {
    if(!value)continue;
    const p=node('p');p.append(node('strong',tr(label)+': '),node('span',value));box.append(p);
  }
  box.append(node('h4',tr('summary_guide')),node('p',summary.guide.why));
  const a=node('a',summary.guide.title);a.className='resolver-summary-guide';a.href=summary.guide.url;a.target='_blank';a.rel='noopener';box.append(a);
  if(summary.guide.note)box.append(node('p',summary.guide.note));
  return box;
}
function renderResult() {
  const out=$('result');out.replaceChildren();if(!result)return;
  $('dialog').querySelector('#__taf_demo_explain')?.remove();
  out.append(node('h3',tr('result')));
  if(bundle.origin==='demo')out.append(node('p',tr('demo_note')));
  if(bundle.origin==='demo' && route==='memory') {
    out.append(button(tr('demo_own'),()=>{
      choose('memory');for(const id of ['model','vram','context'])$(id).value='';$('model').focus();
    },'own-case'));
  }
  if(bundle.model)out.append(node('p',bundle.model));out.append(node('p',tr(result.status)));
  if(isLocal()) {
    const dl=node('dl');for(const {key,value} of result.facts)dl.append(node('dt',tr(key)),node('dd',typeof value==='number'?value.toLocaleString(getLang(),{maximumFractionDigits:4}):String(value)));out.append(dl);
    const ul=node('ul');for(const notice of result.notices)ul.append(node('li',tr(notice.key)+(notice.line?' · #'+notice.line:'')));out.append(ul);
    if(result.suggestion){
      const details=node('details');details.append(node('summary',tr('proposal')),node('pre',result.suggestion));
      details.append(button(tr('try_proposal'),()=>{const proposal=result.suggestion;$('local-text').value=proposal;run();},'try-proposal'));out.append(details);
    }
  }
  if(result.reasons) {
    const ul=node('ul');for(const reason of result.reasons)ul.append(node('li',t('models.reason.'+reason)));out.append(ul);
  }
  if(result.memory)out.append(node('p',t('memreal.class.'+result.memory.keySuffix)));
  if(route==='compatibility' && result.inspection) {
    const dl=node('dl');
    for(const [label,value] of [['models.context',result.inspection.configuredContext],['param.n_attention_heads',result.inspection.geometry.n_attention_heads],['param.n_kv_heads',result.inspection.geometry.n_kv_heads],['param.d_head',result.inspection.geometry.d_head]])dl.append(node('dt',t(label)),node('dd',value??'—'));
    out.append(dl,node('p',t('models.import_note')));
  }
  if(result.fit) {
    const dl=node('dl');
    for(const [label,value] of [['resolver.weights',result.fit.weightsGB],['resolver.kv',result.fit.kvGB],['resolver.overhead',result.fit.overheadGB],['resolver.total',result.fit.totalGB]]) {
      dl.append(node('dt',t(label)),node('dd',value.toLocaleString(getLang(),{maximumFractionDigits:2})+' GiB'));
    }out.append(dl,node('p',tr('memory_note')));
    const controls=node('div');controls.className='resolver-actions';
    const change=(key,value)=>{ $(key).value=value;lastInputs=inputs();result=solveCase(route,bundle,lastInputs);feedback='';renderResult();renderFeedback();};
    if(result.smallerContext)controls.append(button(`${tr('reduce')} · ${result.smallerContext}`,()=>change('context',result.smallerContext),'reduce'));
    for(const alt of result.alternatives)controls.append(button(`${tr('quant')} · ${alt.precision}`,()=>change('precision',alt.precision)));
    out.append(controls,node('p',tr('change_note')));
  }
  if(result.family)out.append(node('p',`Chat-template: ${result.family} · ${result.length}`));
  if(result.names?.length)out.append(node('p',result.names.join(', ')));
  out.append(createResolverSummary(),createResolverReview());
  const links=node('p');
  for(const [label,url] of [[tr('module'),tafLink({mode:CASES[route].mode,model:bundle.origin==='demo'?'':bundle.model,lang:getLang()},location.href)]]) {
    const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener';links.append(a,node('br'));
  }out.append(links);
  const sources=node('details');sources.append(node('summary',tr('source')),node('p',bundle.revision||'—'));
  for(const source of bundle.sources||[]) {const p=node('p'),a=node('a',source.url);a.href=source.url;a.target='_blank';a.rel='noopener';p.append(a,node('span',' · '+source.status));sources.append(p);}if(!isLocal())out.append(sources);
  const actions=node('div');actions.className='resolver-actions';
  actions.append(button(tr('worked'),()=>{feedback='worked';renderFeedback();},'worked'),button(tr('failed'),()=>{feedback='failed';renderFeedback();},'failed'),button(tr('export'),download,'export'));
  out.append(actions,node('p',tr(isLocal()?'local_note':'report_note')));renderFeedback();
}
function download() {
  if(!result)return;
  const {suggestion,...publicResult}=result;
  const report={schema_version:3,review:reviewData(),route,origin:bundle.origin,model:bundle.model,revision:bundle.revision||null,checked_at:bundle.checkedAt||null,
    sources:bundle.sources,inputs:isLocal()?publicLocalInputs(route,lastInputs):lastInputs,initial_inputs:isLocal()?publicLocalInputs(route,initial.inputs):initial.inputs,summary:summaryData(),result:publicResult,user_feedback:feedback||null,scope:'Static inspection / estimate / imported measurements, not an executed model or independently verified fix'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const a=node('a');a.href=url;a.download='taf-case-'+route+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function run(demo=false) {
  if(!route)return;
  if(!demo && ((!isLocal()&&!validResolverModel($('model').value.trim())) || !$('form').reportValidity())) {$('status').textContent=tr(isLocal()?'local_invalid':'invalid');return;}
  cancel();const ticket=request;const activeController=new AbortController();controller=activeController;const timer=setTimeout(()=>activeController.abort(),20000);
  const id=$('model').value.trim();result=null;feedback='';$('result').replaceChildren();$('followup').replaceChildren();
  $('status').textContent=tr('loading');$('run').disabled=true;$('demo').disabled=true;
  try {
    let next=bundle;
    if(isLocal()) {
      if(demo)renderLocalFields(LOCAL_DEMOS[route]);
      next={origin:demo?'demo':'local',model:null,sources:[],checkedAt:new Date().toISOString()};
    } else if(demo) {
      const catalog=await (await fetch('data/model_catalog.json',{signal:controller.signal})).json();
      const entry=catalog.models.find(x=>x.id===(route==='compatibility'?'Qwen/Qwen3.8-2.4T-A95B':'Qwen/Qwen3-8B'));
      next={model:route==='template'?'Synthetic ChatML example':entry.id,config:entry.config,revision:route==='template'?null:entry.revision,origin:'demo',
        tokenizer:{chat_template:"{% for message in messages %}<|im_start|>{{ message['role'] }}\n{{ message['content'] }}<|im_end|>{% endfor %}"},
        sources:route==='template'?[]:[{url:entry.source,status:200}]};
    } else if(!next || next.model!==id || next.origin!=='hf')next=await fetchResolverBundle(id,route,{signal:controller.signal});
    if(ticket!==request)return;
    if(demo&&!isLocal()){$('model').value=route==='template'?'':next.model;$('vram').value='24';$('context').value='131072';$('precision').value='BF16';$('stage').value='generate';}
    lastInputs=route==='memory'||isLocal()?inputs():{};
    const answer=solveCase(route,next,lastInputs);
    bundle=next;result=answer;initial={inputs:{...lastInputs},result:answer};$('status').textContent='';renderResult();
    $('result').focus();
  } catch(error) {if(ticket===request){bundle=null;$('status').textContent=tr(isLocal()?'local_invalid':error.message==='inputs'||error.message==='model'?'invalid':'error');}}
  finally {clearTimeout(timer);if(ticket===request){$('run').disabled=false;$('demo').disabled=false;controller=null;}}
}
export function refreshResolver() {
  if(!$('dialog'))return;
  if(route)$('route-title').textContent=tr(route);
  if(isLocal())renderLocalFields(inputs());
  catalogUI?.refresh();
  triageUI?.refresh();
  renderResult();renderFeedback();
  if(!$('share-value').hidden)$('share-value').value=resolverLink(route,isLocal()?'':$('model').value.trim(),location.href,getLang());
}
export function openResolverForDemo() {
  invalidate(true);route='';$('form').hidden=true;$('description').value='';
  $('share-area').hidden=true;
  triageUI?.reset();
  $('direct').open=false;$('catalog').querySelector('details').open=false;
  $('catalog-search').value='';$('catalog-select').value='';catalogUI?.refresh();
  document.querySelectorAll('[data-resolver-case]').forEach(b=>b.setAttribute('aria-pressed','false'));
  if(!$('dialog').open)$('dialog').showModal();
}
export async function loadResolverExample() {
  await run(true);
  if(!result || bundle?.origin!=='demo')throw new Error('Resolver example unavailable');
}
export function initResolver(onDemo) {
  const dialog=node('dialog');dialog.id='resolver-dialog';dialog.setAttribute('aria-labelledby','resolver-title');
  const label=(id,key,input)=>`<label for="resolver-${id}" data-i18n="resolver.${key}"></label>${input}`;
  dialog.innerHTML=`<div class="resolver-toolbar"><button type="button" id="resolver-close" data-i18n="resolver.close"></button></div>
    <h2 id="resolver-title"><span data-i18n="resolver.title"></span></h2><p data-i18n="resolver.intro"></p>
    <h3 data-i18n="resolver.problem"></h3>
    <div id="resolver-triage"></div>
    <details id="resolver-direct"><summary data-i18n="resolver.triage_direct"></summary><div class="resolver-actions">${Object.keys(CASES).map(k=>`<button type="button" data-resolver-case="${k}" aria-pressed="false" data-i18n="resolver.${k}"></button>`).join('')}</div></details>
    ${label('description','error_text','<textarea id="resolver-description" rows="2" maxlength="8000"></textarea>')}
    <button type="button" id="resolver-suggest" data-i18n="resolver.suggest"></button><div id="resolver-suggestions" role="status"></div>
    <div id="resolver-catalog"></div>
    <form id="resolver-form" hidden><h3 data-i18n="resolver.details"></h3><p id="resolver-route-title"></p>
      <fieldset id="resolver-hf-fields"><legend data-i18n="resolver.model"></legend>
      ${label('model','model','<input id="resolver-model" type="text" required maxlength="200" placeholder="Qwen/Qwen3-8B" autocomplete="off">')}
      <p class="subtle" data-i18n="resolver.privacy"></p></fieldset>
      <fieldset id="resolver-local-fields" hidden disabled></fieldset>
      <fieldset id="resolver-memory-fields" disabled hidden><legend data-i18n="resolver.memory"></legend><p data-i18n="resolver.scope"></p>
        ${label('vram','vram','<input id="resolver-vram" type="number" required min="0.1" max="100000" step="any">')}
        ${label('context','context','<input id="resolver-context" type="number" required min="1" max="10000000" step="1">')}
        ${label('precision','precision','<select id="resolver-precision">'+['BF16','FP16','FP32','INT8','NF4','F16','Q8_0','Q4_K_M'].map(p=>`<option>${p}</option>`).join('')+'</select>')}
        ${label('stage','stage','<select id="resolver-stage"><option value="generate" data-i18n="resolver.generate"></option><option value="load" data-i18n="resolver.load"></option></select>')}
      </fieldset><div class="resolver-actions"><button id="resolver-run" type="submit" data-i18n="resolver.run"></button><button id="resolver-demo" type="button" data-i18n="resolver.demo"></button></div>
    </form><p id="resolver-status" role="status"></p><section id="resolver-result" tabindex="-1" aria-live="polite"></section><section id="resolver-followup" aria-live="polite"></section>
    <div id="resolver-share-area" hidden><button id="resolver-share" type="button" data-i18n="resolver.share"></button><p data-i18n="resolver.share_note"></p>
    <input id="resolver-share-value" type="text" readonly hidden aria-label="URL"></div>`;
  document.body.append(dialog);
  catalogUI=mountResolverCatalog($('catalog'),{choose,getModel:()=>validResolverModel($('model').value.trim())?$('model').value.trim():''});
  triageUI=mountResolverTriage($('triage'),{
    choose:(id,key)=>{choose(id);if(id==='memory')$('stage').value=key==='load'?'load':'generate';},
    showTool:mode=>catalogUI.show(mode),
    clear:()=>{invalidate(true);route='';$('form').hidden=true;$('share-area').hidden=true;document.querySelectorAll('[data-resolver-case]').forEach(b=>b.setAttribute('aria-pressed','false'));},
  });
  const open=fromAsk=>{
    if(!dialog.open)dialog.showModal();
    if(fromAsk){$('description').value=document.getElementById('question')?.value||'';suggest();}
    (fromAsk?$('description'):route?$('route-title'):$('symptom')).focus();
  };
  function suggest(){
    const matches=suggestCases($('description').value), host=$('suggestions');host.replaceChildren();
    const tools=TOOL_CATALOG.filter(x=>!x.direct&&x.pattern?.test($('description').value));
    if(!matches.length&&!tools.length)host.append(node('p',tr('no_match')));
    for(const id of matches)host.append(button(tr(id),()=>{choose(id);(isLocal()?$('local-fields').querySelector('input,textarea,select'):$('model')).focus();}));
    for(const entry of tools)host.append(button(t('modes.'+entry.mode),()=>catalogUI.show(entry.mode)));
  }
  document.querySelectorAll('[data-resolver-open]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.resolverOpen==='ask')));
  $('close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>cancel());
  $('suggest').addEventListener('click',suggest);
  document.querySelectorAll('[data-resolver-case]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.resolverCase)));
  $('form').addEventListener('submit',e=>{e.preventDefault();run();});
  $('form').addEventListener('input',e=>invalidate(e.target.id==='resolver-model'));
  $('model').addEventListener('change',()=>invalidate(true));
  attachHfAutocomplete($('model'));
  $('demo').addEventListener('click',()=>run(true));
  document.querySelectorAll('[data-resolver-demo-open]').forEach(b=>b.addEventListener('click',()=>onDemo()));
  $('share').addEventListener('click',()=>{const field=$('share-value');field.value=resolverLink(route,isLocal()?'':$('model').value.trim(),location.href,getLang());field.hidden=false;field.focus();field.select();});
  window.__taf_applyTranslations?.();
  const params=new URLSearchParams(location.search), entry=params.get('resolve');
  if(entry){if(Object.hasOwn(CASES,entry))choose(entry);if(validResolverModel(params.get('model')))$('model').value=params.get('model');open(false);}
}
