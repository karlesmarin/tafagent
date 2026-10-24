import { CASES, suggestCases, validResolverModel, solveCase, fetchResolverBundle, resolverLink } from './resolver.js';
import { t, getLang } from './i18n.js';
import { guideLink, tafLink } from './guide_bridge.js';
import { attachHfAutocomplete } from './hf_autocomplete.js';
const $=id=>document.getElementById('resolver-'+id);
const node=(tag,text)=>{const el=document.createElement(tag); if(text!=null)el.textContent=text;return el;};
const tr=key=>t('resolver.'+key);
let route='',bundle=null,result=null,feedback='',controller=null,request=0,lastInputs=null;
function button(text,fn,id) { const b=node('button',text);b.type='button';if(id)b.id='resolver-'+id;b.addEventListener('click',fn);return b; }
function cancel() { request++;controller?.abort();controller=null;$('run').disabled=false;$('demo').disabled=false; }
function invalidate(clearBundle=false) {
  cancel(); if(clearBundle)bundle=null;result=null;feedback='';lastInputs=null;
  $('result').replaceChildren();$('followup').replaceChildren();$('status').textContent='';$('share-value').hidden=true;
}
function choose(id) {
  if(!Object.hasOwn(CASES,id))return;
  invalidate(true);route=id;$('form').hidden=false;
  $('memory-fields').disabled=id!=='memory';$('memory-fields').hidden=id!=='memory';
  for(const b of document.querySelectorAll('[data-resolver-case]'))b.setAttribute('aria-pressed',String(b.dataset.resolverCase===id));
  $('route-title').textContent=tr(id);
}
function inputs() {return {vram:Number($('vram').value),context:Number($('context').value),precision:$('precision').value,stage:$('stage').value};}
function renderFeedback() {
  $('followup').replaceChildren();
  if(feedback)$('followup').append(node('p',tr(feedback==='worked'?'solved':'followup')));
  if(feedback==='failed') {
    $('followup').append(node('p',tr(route==='template'?'template_next':route==='memory'?'memory_next':'compatibility_next')));
    $('followup').append(button(tr('suggest'),()=>{$('description').focus();$('description').scrollIntoView({block:'nearest'});}));
  }
}
function renderResult() {
  const out=$('result');out.replaceChildren();if(!result)return;
  out.append(node('h3',tr('result')));
  if(bundle.origin==='demo')out.append(node('p',tr('demo_note')));
  out.append(node('p',bundle.model||'—'),node('p',tr(result.status)));
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
  out.append(node('h4',tr('next')),node('p',tr(route==='memory'?'memory_next':route==='template'&&result.status!=='present'?'template_missing_next':route==='template'?'template_next':'compatibility_next')));
  const links=node('p');
  for(const [label,url] of [[tr('guide'),guideLink(CASES[route].topic,0,{lang:getLang(),model:bundle.origin==='demo'?'':bundle.model,mode:CASES[route].mode})],
    [tr('module'),tafLink({mode:CASES[route].mode,model:bundle.origin==='demo'?'':bundle.model,lang:getLang()},location.href)]]) {
    const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener';links.append(a,node('br'));
  }out.append(links);
  const sources=node('details');sources.append(node('summary',tr('source')),node('p',bundle.revision||'—'));
  for(const source of bundle.sources||[]) {const p=node('p'),a=node('a',source.url);a.href=source.url;a.target='_blank';a.rel='noopener';p.append(a,node('span',' · '+source.status));sources.append(p);}out.append(sources);
  const actions=node('div');actions.className='resolver-actions';
  actions.append(button(tr('worked'),()=>{feedback='worked';renderFeedback();},'worked'),button(tr('failed'),()=>{feedback='failed';renderFeedback();},'failed'),button(tr('export'),download,'export'));
  out.append(actions,node('p',tr('report_note')));renderFeedback();
}
function download() {
  if(!result)return;
  const report={schema_version:1,route,origin:bundle.origin,model:bundle.model,revision:bundle.revision||null,checked_at:bundle.checkedAt||null,
    sources:bundle.sources,inputs:lastInputs,result,user_feedback:feedback||null,scope:'Configuration inspection / estimate, not an executed model or independently verified fix'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const a=node('a');a.href=url;a.download='taf-case-'+route+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function run(demo=false) {
  if(!route)return;
  if(!demo && (!validResolverModel($('model').value.trim()) || !$('form').reportValidity())) {$('status').textContent=tr('invalid');return;}
  cancel();const ticket=request;const activeController=new AbortController();controller=activeController;const timer=setTimeout(()=>activeController.abort(),20000);
  const id=$('model').value.trim();result=null;feedback='';$('result').replaceChildren();$('followup').replaceChildren();
  $('status').textContent=tr('loading');$('run').disabled=true;$('demo').disabled=true;
  try {
    let next=bundle;
    if(demo) {
      const catalog=await (await fetch('data/model_catalog.json',{signal:controller.signal})).json();
      const entry=catalog.models.find(x=>x.id===(route==='compatibility'?'Qwen/Qwen3.8-2.4T-A95B':'Qwen/Qwen3-8B'));
      next={model:route==='template'?'Synthetic ChatML example':entry.id,config:entry.config,revision:route==='template'?null:entry.revision,origin:'demo',
        tokenizer:{chat_template:"{% for message in messages %}<|im_start|>{{ message['role'] }}\n{{ message['content'] }}<|im_end|>{% endfor %}"},
        sources:route==='template'?[]:[{url:entry.source,status:200}]};
    } else if(!next || next.model!==id || next.origin!=='hf')next=await fetchResolverBundle(id,route,{signal:controller.signal});
    if(ticket!==request)return;
    if(demo){$('model').value=route==='template'?'':next.model;$('vram').value='24';$('context').value='131072';$('precision').value='BF16';$('stage').value='generate';}
    lastInputs=route==='memory'?inputs():{};
    const answer=solveCase(route,next,lastInputs);
    bundle=next;result=answer;$('status').textContent='';renderResult();
    $('result').focus();
  } catch(error) {if(ticket===request){bundle=null;$('status').textContent=tr(error.message==='inputs'||error.message==='model'?'invalid':'error');}}
  finally {clearTimeout(timer);if(ticket===request){$('run').disabled=false;$('demo').disabled=false;controller=null;}}
}
export function refreshResolver() {
  if(!$('dialog'))return;
  if(route)$('route-title').textContent=tr(route);
  renderResult();renderFeedback();
  if(!$('share-value').hidden)$('share-value').value=resolverLink(route,$('model').value.trim(),location.href,getLang());
}
export function initResolver() {
  const dialog=node('dialog');dialog.id='resolver-dialog';dialog.setAttribute('aria-labelledby','resolver-title');
  const label=(id,key,input)=>`<label for="resolver-${id}" data-i18n="resolver.${key}"></label>${input}`;
  dialog.innerHTML=`<button type="button" id="resolver-close" data-i18n="resolver.close"></button>
    <h2 id="resolver-title" data-i18n="resolver.title"></h2><p data-i18n="resolver.intro"></p>
    <h3 data-i18n="resolver.problem"></h3>
    ${label('description','error_text','<textarea id="resolver-description" rows="2" maxlength="8000"></textarea>')}
    <button type="button" id="resolver-suggest" data-i18n="resolver.suggest"></button><div id="resolver-suggestions" role="status"></div>
    <div class="resolver-actions">${Object.keys(CASES).map(k=>`<button type="button" data-resolver-case="${k}" aria-pressed="false" data-i18n="resolver.${k}"></button>`).join('')}</div>
    <form id="resolver-form" hidden><h3 data-i18n="resolver.details"></h3><p id="resolver-route-title"></p>
      ${label('model','model','<input id="resolver-model" type="text" required maxlength="200" placeholder="Qwen/Qwen3-8B" autocomplete="off">')}
      <p class="subtle" data-i18n="resolver.privacy"></p>
      <fieldset id="resolver-memory-fields" disabled hidden><legend data-i18n="resolver.memory"></legend><p data-i18n="resolver.scope"></p>
        ${label('vram','vram','<input id="resolver-vram" type="number" required min="0.1" max="100000" step="any">')}
        ${label('context','context','<input id="resolver-context" type="number" required min="1" max="10000000" step="1">')}
        ${label('precision','precision','<select id="resolver-precision">'+['BF16','FP16','FP32','INT8','NF4','F16','Q8_0','Q4_K_M'].map(p=>`<option>${p}</option>`).join('')+'</select>')}
        ${label('stage','stage','<select id="resolver-stage"><option value="generate" data-i18n="resolver.generate"></option><option value="load" data-i18n="resolver.load"></option></select>')}
      </fieldset><div class="resolver-actions"><button id="resolver-run" type="submit" data-i18n="resolver.run"></button><button id="resolver-demo" type="button" data-i18n="resolver.demo"></button></div>
    </form><p id="resolver-status" role="status"></p><section id="resolver-result" tabindex="-1" aria-live="polite"></section><section id="resolver-followup" aria-live="polite"></section>
    <button id="resolver-share" type="button" data-i18n="resolver.share"></button><p data-i18n="resolver.share_note"></p>
    <input id="resolver-share-value" type="text" readonly hidden aria-label="URL">`;
  document.body.append(dialog);
  const open=fromAsk=>{
    if(!dialog.open)dialog.showModal();
    if(fromAsk){$('description').value=document.getElementById('question')?.value||'';suggest();}
    $('description').focus();
  };
  function suggest(){
    const matches=suggestCases($('description').value), host=$('suggestions');host.replaceChildren();
    if(!matches.length)host.append(node('p',tr('no_match')));
    for(const id of matches)host.append(button(tr(id),()=>{choose(id);$('model').focus();}));
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
  $('share').addEventListener('click',()=>{const field=$('share-value');field.value=resolverLink(route,$('model').value.trim(),location.href,getLang());field.hidden=false;field.focus();field.select();});
  window.__taf_applyTranslations?.();
  const params=new URLSearchParams(location.search), entry=params.get('resolve');
  if(entry){if(Object.hasOwn(CASES,entry))choose(entry);if(validResolverModel(params.get('model')))$('model').value=params.get('model');open(false);}
}
