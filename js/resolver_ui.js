import {readAdapterConfigFile,ADAPTER_FILE_LIMIT} from './adapter_config_file.js';
import {readAttentionReport,ATTENTION_FILE_LIMIT} from './attention_report_file.js';
import {compareMemoryMeasurements} from './memory_comparison.js';
import {readMemoryMeasurement,reviewMemoryMeasurement,publicMemoryInputs,MEASUREMENT_LIMIT} from './memory_measurement.js';
import {saveCase,readSavedCase,CASE_FILE_LIMIT} from './resolver_session.js';
import { CASES, suggestCases, validResolverModel, solveCase, fetchResolverBundle, resolverLink } from './resolver.js';
import { t, getLang } from './i18n.js';
import { tafLink, guideLink, HF_BASE } from './guide_bridge.js';
import { buildResolverSummary } from './resolver_summary.js';
import { buildResolverReview } from './resolver_review.js';
import { PROTOCOL_GROUPS, PROTOCOL_PATHS } from './resolver_protocol.js';
import { CHECK_DEMOS,checkDemo } from './resolver_checks.js';
import { PROGRESS_STATES,progressReport,markProgress,demoProgress } from './resolver_progress.js';
import {observationChoices,observationReport,recordObservation} from './resolver_observations.js';
import { createResolverVideo } from './resolver_video.js';
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
let progressMarks=null;
let observationHistory=[];
let videoUI=null;
let pendingCase=null,fileRequest=0;
let adapterFileRequest=0;
function clearAdapterPreview(){
 adapterFileRequest++;
 const box=$('adapter-import');if(!box)return;
 $('adapter-preview').replaceChildren();$('adapter-file-status').textContent='';$('adapter-file').value='';
}
let attentionRequest=0;
function clearAttentionPreviews(except=null){
 attentionRequest++;
 for(const box of document.querySelectorAll('[data-attention-import]')){if(box===except)continue;box.querySelector('[data-attention-preview]').replaceChildren();box.querySelector('[role="status"]').textContent='';box.querySelector('input[type="file"]').value='';}
}
let memoryMeasurement=null,measurementAfter=null,comparisonSame=false,measurementRequest=0;
function clearMemoryComparison(){measurementAfter=null;comparisonSame=false;measurementRequest++;}
const isLocal=()=>CASES[route]?.source==='local';
function button(text,fn,id) { const b=node('button',text);b.type='button';if(id)b.id='resolver-'+id;b.addEventListener('click',fn);return b; }
function cancel() { request++;controller?.abort();controller=null;$('run').disabled=false;$('demo').disabled=false; }
function invalidate(clearBundle=false) {
  measurementRequest++;clearAttentionPreviews();clearAdapterPreview();
  cancel(); if(clearBundle)bundle=null;result=null;feedback='';lastInputs=null;initial=null;progressMarks=null;observationHistory=[];
  $('dialog').querySelector('#__taf_demo_explain')?.remove();
  $('result').replaceChildren();$('followup').replaceChildren();$('status').textContent='';$('share-value').hidden=true;
}
function clearMemoryPeak(){
 memoryMeasurement=null;clearMemoryComparison();measurementRequest++;
 $('peak').value='';$('peakUnit').value='GiB';$('peakMetric').value='unknown';$('peakSame').checked=false;$('peakIsolated').checked=false;
}
function choose(id) {
  if(!Object.hasOwn(CASES,id))return;
  invalidate(true);clearMemoryPeak();route=id;$('form').hidden=false;
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
  if(route==='pvr'&&f.type==='textarea')host.append(createAttentionImport(f.id));
  if(route==='adapter'&&f.id==='text')host.append(createAdapterImport());
 }
}
function createAdapterImport(){
 const box=node('details');box.id='resolver-adapter-import';
 box.append(node('summary',tr('adapter_file_open')),node('p',tr('adapter_file_help')));
 const label=node('label',tr('adapter_file_label'));label.htmlFor='resolver-adapter-file';
 const file=node('input');file.type='file';file.accept='.json,application/json';file.id=label.htmlFor;file.dataset.adapterFile='';
 const status=node('p');status.id='resolver-adapter-file-status';status.setAttribute('role','status');
 const preview=node('section');preview.id='resolver-adapter-preview';preview.setAttribute('aria-live','polite');
 file.addEventListener('change',async()=>{
  const selected=file.files?.[0];clearAdapterPreview();const ticket=adapterFileRequest;if(!selected)return;
  try{
   if(selected.size>ADAPTER_FILE_LIMIT)throw new Error('adapter_file_large');
   const text=await selected.text();if(ticket!==adapterFileRequest||!box.isConnected)return;
   const report=readAdapterConfigFile(text);
   preview.append(node('h4',tr('adapter_file_preview')),node('p',tr('adapter_file_unverified')));
   const dl=node('dl');
   for(const [key,value] of Object.entries(report.preview))if(value!==null)dl.append(node('dt',tr('adapter_file_'+key)),node('dd',String(value)));
   preview.append(dl,node('p',tr('adapter_file_base_kept')));
   const actions=node('div');actions.className='resolver-actions';actions.append(button(tr('adapter_file_apply'),()=>{
    if(ticket!==adapterFileRequest||!box.isConnected||route!=='adapter')return;
    $('local-text').value=report.text;invalidate();$('status').textContent=tr('adapter_file_applied');$('local-text').focus();
   },'adapter-file-apply'),button(tr('adapter_file_cancel'),clearAdapterPreview,'adapter-file-cancel'));preview.append(actions);
  }catch(error){if(ticket===adapterFileRequest&&box.isConnected)status.textContent=tr(error.message==='adapter_file_large'?'adapter_file_large':'adapter_file_invalid');}
 });
 const guide=node('a',tr('adapter_file_guide'));const url=new URL(guideLink('adaptation',1,{mode:'adapter',resolve:'adapter',lang:getLang(),app:location.origin===new URL(HF_BASE).origin?'hf':'github'}));url.pathname=url.pathname.replace(/\/chapters\/[^/]+$/,'/chapters/R5-tafagent.html');url.hash='sec-resolver-adapter-import';guide.href=url.href;guide.target='_blank';guide.rel='noopener';
 box.append(label,file,status,preview,guide);return box;
}
function createAttentionImport(field){
 const box=node('details');box.dataset.attentionImport=field;box.id='resolver-attention-import-'+field;
 box.append(node('summary',tr(field==='text'?'attention_file_primary':'attention_file_reference')),node('p',tr('attention_file_help')));
 const label=node('label',tr('attention_file_label'));label.htmlFor='resolver-attention-file-'+field;
 const fileInput=node('input');fileInput.type='file';fileInput.accept='.json,application/json';fileInput.id=label.htmlFor;fileInput.dataset.attentionFile=field;
 const status=node('p');status.id='resolver-attention-status-'+field;status.setAttribute('role','status');
 const preview=node('section');preview.dataset.attentionPreview=field;preview.id='resolver-attention-preview-'+field;preview.setAttribute('aria-live','polite');
 fileInput.addEventListener('change',async()=>{
  const file=fileInput.files?.[0];clearAttentionPreviews(box);const ticket=attentionRequest;
  preview.replaceChildren();status.textContent='';if(!file)return;
  try{
   if(file.size>ATTENTION_FILE_LIMIT)throw new Error('attention_file_large');
   const text=await file.text();if(ticket!==attentionRequest||!box.isConnected)return;
   const report=readAttentionReport(text),p=report.preview;
   preview.append(node('h4',tr('attention_file_preview')),node('p',tr('attention_file_unverified')));
   const dl=node('dl');dl.append(node('dt',tr('attention_file_gamma_label')),node('dd',p.gamma.toLocaleString(getLang(),{maximumFractionDigits:6})));
   for(const [key,value] of [['model',p.model],['revision',p.revision],['source',p.source]])if(value!==null)dl.append(node('dt',tr('attention_file_'+key)),node('dd',value));
   dl.append(node('dt',tr('attention_file_context')),node('dd',tr('attention_context_'+p.context)),node('dt',tr('missing_fields')),node('dd',String(p.missing)));preview.append(dl);
   preview.append(button(tr('attention_file_apply'),()=>{
    if(ticket!==attentionRequest||!box.isConnected||route!=='pvr')return;
    $('local-'+field).value=report.text;invalidate();$('status').textContent=tr('attention_file_applied');$('local-'+field).focus();
   },'attention-apply-'+field),button(tr('attention_file_cancel'),()=>clearAttentionPreviews(),'attention-cancel-'+field));
  }catch(error){if(ticket===attentionRequest&&box.isConnected)status.textContent=tr(['attention_file_large','attention_file_gamma'].includes(error.message)?error.message:'attention_file_invalid');}
 });
 const guide=node('a',tr('attention_file_guide'));const url=new URL(guideLink('gamma',1,{mode:'pvr',resolve:'pvr',lang:getLang(),app:location.origin===new URL(HF_BASE).origin?'hf':'github'}));url.pathname=url.pathname.replace(/\/chapters\/[^/]+$/,'/chapters/R5-tafagent.html');url.hash='sec-resolver-attention-import';guide.href=url.href;guide.target='_blank';guide.rel='noopener';
 box.append(label,fileInput,status,preview,guide);return box;
}
function inputs() {
 if(isLocal())return Object.fromEntries(LOCAL_CASES[route].fields.map(f=>{const el=$('local-'+f.id);return [f.id,f.type==='checkbox'?el.checked:f.type==='number'?(el.value===''?NaN:Number(el.value)):el.value];}));
 return {vram:Number($('vram').value),context:Number($('context').value),precision:$('precision').value,stage:$('stage').value,peak:$('peak').value===''?null:Number($('peak').value),peakUnit:$('peakUnit').value,peakMetric:$('peakMetric').value,peakSame:$('peakSame').checked,peakIsolated:$('peakIsolated').checked,...(memoryMeasurement?{measurement:memoryMeasurement}:{}),...(measurementAfter?{measurementAfter,comparisonSame}:{})};
}
function renderFeedback() {
  $('followup').replaceChildren();
  if(feedback)$('followup').append(node('p',tr(feedback==='worked'?'solved':'followup')));
  if(feedback==='failed') {
    const observation=observationData()?.current;
    if(observation)$('followup').append(node('strong',tr('observation_next')),node('p',observation.next),node('p',observation.step_instruction));
    else $('followup').append(node('p',summaryData().next));
    $('followup').append(button(tr('observation_title'),openObservations));
    if(progressMarks){const p=progressData();$('followup').append(node('p',tr('progress_next_'+p.next_kind)),button(tr('progress_title'),openProgress));}
    if(summaryData().checks)$('followup').append(node('p',summaryData().checks.instructions[2]),button(tr('checks_open'),openChecks));
    $('followup').append(button(tr('suggest'),()=>{$('description').focus();$('description').scrollIntoView({block:'nearest'});}));
  }
}
function resultState() {return {route,bundle,initial,inputs:lastInputs,result,app:location.origin===new URL(HF_BASE).origin?'hf':'github'};}
function summaryData() {return buildResolverSummary(resultState(),getLang());}
function reviewData() {return buildResolverReview(resultState(),getLang());}
function progressData(){
 const report=progressReport(resultState(),progressMarks);if(!report)return null;
 return {...report,steps:report.steps.map(s=>({...s,instruction:tr(s.key),label:tr('progress_'+s.status)})),next_instruction:tr('progress_next_'+report.next_kind)};
}
function observationData(){
 const report=observationReport(resultState(),observationHistory);if(!report)return null;
 const entries=report.entries.map(e=>({...e,label:tr(e.label_key),next:tr(e.next_key),step_instruction:tr(e.step_key)}));
 return {...report,entries,current:entries.at(-1)||null};
}
function openObservations(){
 if(!$('observations'))return;
 $('observations').open=true;$('observation-choice').focus();$('observations').scrollIntoView({block:'nearest'});
}
function updateObservationView(){
 const report=observationData(),host=$('observation-result');if(!host||!report)return;
 host.replaceChildren();
 if(report.current){
  host.append(node('h4',tr('observation_next')),node('p',report.current.next),node('p',report.current.step_instruction));
  if(report.current.tool)host.append(button(tr('observation_tool'),()=>catalogUI.show(report.current.tool),'observation-tool'));
  const list=node('ol');list.start=1;
  for(const entry of report.entries)list.append(node('li',tr('progress_step')+' '+(entry.step+1)+': '+entry.label));
  const history=node('details');history.append(node('summary',tr('observation_history')),list);host.append(history);
 }
 $('observation-clear').hidden=!report.entries.length;
}
function createObservations(){
 const box=node('details');box.id='resolver-observations';
 box.append(node('summary',tr('observation_title')),node('p',tr(bundle.origin==='demo'?'demo_note':'observation_note')));
 const stepLabel=node('label',tr('observation_step'));stepLabel.htmlFor='resolver-observation-step';
 const step=node('select');step.id=stepLabel.htmlFor;
 const plan=progressData();
 for(const [i,item] of plan.steps.entries())step.append(new Option(tr('progress_step')+' '+(i+1)+': '+item.instruction,String(i)));
 step.value=String(plan.next_index??0);
 const label=node('label',tr('observation_question'));label.htmlFor='resolver-observation-choice';
 const choice=node('select');choice.id=label.htmlFor;choice.append(new Option(tr('observation_choose'),''));
 for(const code of observationChoices(route))choice.append(new Option(tr(code==='unavailable'?'observation_unavailable':'observation_'+route+'_'+code),code));
 const status=node('p');status.id='resolver-observation-status';status.setAttribute('role','status');
 const save=button(tr('observation_save'),()=>{
  try{
   observationHistory=recordObservation(resultState(),observationHistory,Number(step.value),choice.value);
   status.textContent='';updateObservationView();renderFeedback();
   $('observation-result').focus();$('observation-result').scrollIntoView({block:'nearest'});
  }catch{status.textContent=tr('observation_invalid');choice.focus();}
 },'observation-save');
 const clear=button(tr('observation_clear'),()=>{observationHistory=[];status.textContent='';choice.value='';updateObservationView();renderFeedback();},'observation-clear');
 const actions=node('div');actions.className='resolver-actions';actions.append(save,clear);
 const resultBox=node('section');resultBox.id='resolver-observation-result';resultBox.tabIndex=-1;resultBox.setAttribute('aria-live','polite');
 const guide=node('a',summaryData().guide.title);guide.href=summaryData().guide.url;guide.target='_blank';guide.rel='noopener';
 box.append(stepLabel,step,label,choice,actions,status,resultBox,guide);return box;
}
export function simulateResolverObservation(){
 if(bundle?.origin!=='demo')throw new Error('demo');
 observationHistory=recordObservation(resultState(),observationHistory,1,route==='memory'?'short_only':'unavailable');
 openObservations();$('observation-step').value='1';$('observation-choice').value=route==='memory'?'short_only':'unavailable';updateObservationView();renderFeedback();
}

function openProgress(){ $('progress').open=true;$('progress').querySelector('summary').focus();$('progress').scrollIntoView({block:'start'}); }
function updateProgressView(){
 const report=progressData();if(!report||!$('progress-next'))return;
 $('progress-count').textContent=tr('progress_count')+': '+report.checked_count+' / '+report.steps.length;
 $('progress-next').textContent=report.next_instruction;
 $('progress-go').hidden=report.next_index===null;
 for(const [i,step] of report.steps.entries())$('progress-step-'+i).value=step.status;
 renderFeedback();
}
export function simulateResolverProgress(){
 progressMarks=demoProgress(resultState());openProgress();updateProgressView();
 $('progress-next').scrollIntoView({block:'nearest'});
}
function createProgress(){
 const report=progressData();if(!report)return null;
 const box=node('details');box.id='resolver-progress';box.append(node('summary',tr('progress_title')),node('p',tr(bundle.origin==='demo'?'progress_demo_note':'progress_note')));
 const list=node('ol');
 for(const [i,step] of report.steps.entries()){
  const li=node('li'),label=node('label',tr('progress_step')+' '+(i+1)+': '+step.instruction),select=node('select');
  select.id='resolver-progress-step-'+i;label.htmlFor=select.id;
  for(const status of PROGRESS_STATES)select.append(new Option(tr('progress_'+status),status));select.value=step.status;
  select.addEventListener('change',()=>{progressMarks=markProgress(resultState(),progressMarks,i,select.value);updateProgressView();});
  li.append(label,select);list.append(li);
 }
 const count=node('p',tr('progress_count')+': '+report.checked_count+' / '+report.steps.length);count.id='resolver-progress-count';
 const next=node('p',report.next_instruction);next.id='resolver-progress-next';next.setAttribute('role','status');
 const go=button(tr('progress_open'),()=>{const i=progressData().next_index;if(i!==null){$('progress-step-'+i).focus();$('progress-step-'+i).scrollIntoView({block:'center'});}},'progress-go');go.hidden=report.next_index===null;
 const actions=node('div');actions.className='resolver-actions';actions.append(go,button(tr('progress_clear'),()=>{progressMarks=null;updateProgressView();},'progress-clear'));
 if(bundle.origin==='demo')actions.append(button(tr('progress_demo'),simulateResolverProgress,'progress-demo'));
 const a=node('a',summaryData().guide.title);a.href=summaryData().guide.url;a.target='_blank';a.rel='noopener';
 box.append(list,count,next,actions,a);return box;
}
function openChecks(){ $('review').open=true;$('checks').focus({preventScroll:true});$('checks').scrollIntoView({block:'start'}); }
function changeExample(scenario){
 progressMarks=null;observationHistory=[];memoryMeasurement=null;measurementRequest++;
 const example=checkDemo(route,scenario,bundle);bundle={...example.bundle,demoScenario:scenario};
 if(isLocal())renderLocalFields(example.inputs);
 else if(route==='compatibility')$('model').value='';
 else if(route==='memory'){clearMemoryPeak();for(const [key,value] of Object.entries(example.inputs)){if(typeof value==='boolean')$(key).checked=value;else $(key).value=value;}}
 lastInputs=example.inputs;result=solveCase(route,bundle,lastInputs);initial={inputs:{...lastInputs},result};feedback='';
 renderResult();openChecks();
}
function createResolverReview() {
 const review=reviewData(),box=node('details');box.id='resolver-review';
 box.append(node('summary',tr('review_title')),node('p',review.provenance));
 for(const [label,value] of [['review_basis',review.basis],['review_limit',review.limitation],[review.protocol?'protocol_title':'review_test',review.next_check]]) {
  const p=node('p');p.append(node('strong',tr(label)+': '),node('span',value));box.append(p);
 }
 if(review.missing_protocol_fields!=null)box.append(node('p',tr('missing_fields')+': '+review.missing_protocol_fields));
 if(review.observations.length){const ul=node('ul');for(const text of review.observations)ul.append(node('li',text));box.append(ul);}
 if(review.protocol){
  const details=node('details');details.id='resolver-protocol';details.append(node('summary',tr('protocol_details')),node('p',tr('protocol_legend')),node('p',tr('protocol_scope')));
  for(const [group,keys] of Object.entries(PROTOCOL_GROUPS)){
   details.append(node('h5',tr('protocol_'+group)));const ul=node('ul');
   for(const key of keys){const field=review.protocol.fields.find(f=>f.key===key);const li=node('li');
    li.append(node('code',PROTOCOL_PATHS[key]),node('br'),node('span',tr(field.documented?'protocol_documented':'protocol_absent')));
    if(field.comparison)li.append(node('span',' · '+tr('protocol_pair_'+field.comparison)));ul.append(li);
   }details.append(ul);
  }
  for(const [key,label] of [['missing_in_first','missing'],['different','different'],['unknown','unknown']]){
   const count=review.protocol.additional_fields[key];if(count)details.append(node('p',tr('protocol_extra_'+label)+': '+count));
  }
  box.append(details);
 }
 if(review.checks){
  const section=node('section');section.id='resolver-checks';section.tabIndex=-1;
  section.append(node('h4',tr('checks_title')+' · '+review.checks.title),node('p',tr('checks_note')));
  const ol=node('ol');for(const instruction of review.checks.instructions)ol.append(node('li',instruction));section.append(ol,node('p',tr('checks_tools')));
  const tools=node('div');tools.className='resolver-actions';for(const mode of review.checks.tools){const b=button(t('modes.'+mode),()=>catalogUI.show(mode));b.dataset.checkTool=mode;tools.append(b);}section.append(tools);box.append(section);
 }
 const a=node('a',review.guide.title);a.href=review.guide.url;a.target='_blank';a.rel='noopener';box.append(a);
 if(review.guide.note)box.append(node('p',review.guide.note));
 return box;
}
export function createResolverSummary(id='resolver-case-summary') {
  const summary=summaryData(),box=node('section');box.id=id;box.className='resolver-demo-card';
  box.append(node('h4',tr('summary_title')));
  if(summary.demo)box.append(node('p',tr('demo_note')));
  for(const [label,value] of [['summary_problem',summary.problem],['summary_check',summary.finding],['summary_change',summary.change],[result.protocolReview?'protocol_title':'summary_next',summary.next]]) {
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
  if(bundle.restoredFromFile)out.append(node('p',tr('case_restored')));
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
    if(result.protocolReview)out.append(button(tr('protocol_details'),()=>{
      $('review').open=true;$('protocol').open=true;$('protocol').querySelector('summary').focus();$('protocol').scrollIntoView({block:'start'});
    },'show-protocol'));
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
    for(const [label,value] of (lastInputs.stage==='load'?[['resolver.weights',result.fit.weightsGB]]:[['resolver.weights',result.fit.weightsGB],['resolver.kv',result.fit.kvGB],['resolver.overhead',result.fit.overheadGB],['resolver.total',result.fit.totalGB]])) {
      dl.append(node('dt',t(label)),node('dd',value.toLocaleString(getLang(),{maximumFractionDigits:2})+' GiB'));
    }out.append(dl,node('p',tr('memory_note')));
    const controls=node('div');controls.className='resolver-actions';
    const change=(key,value)=>{ clearMemoryPeak();progressMarks=null;observationHistory=[];$(key).value=value;lastInputs=inputs();result=solveCase(route,bundle,lastInputs);feedback='';renderResult();renderFeedback();};
    if(result.smallerContext)controls.append(button(`${tr('reduce')} · ${result.smallerContext}`,()=>change('context',result.smallerContext),'reduce'));
    for(const alt of result.alternatives)controls.append(button(`${tr('quant')} · ${alt.precision}`,()=>change('precision',alt.precision)));
    out.append(controls,node('p',tr('change_note')));
  }
  if(route==='memory'){
    const box=node('section');box.id='resolver-memory-phase';
    box.append(node('h4',tr(lastInputs.stage)),node('p',tr('peak_phase_'+lastInputs.stage)));
    const peak=result.memoryPeak;
    if(peak){
      const n=x=>x.toLocaleString(getLang(),{maximumFractionDigits:3})+' GiB';
      const report=node('section');report.id='resolver-peak-result';
      report.append(node('h4',tr('peak_title')),node('p',tr(peak.source==='illustrative'?'demo_note':'peak_provenance')));
      const dl=node('dl');dl.append(node('dt',tr('peak_'+peak.metric)),node('dd',n(peak.reported_GiB)));
      if(peak.status==='baseline_comparison'){
        dl.append(node('dt',tr('peak_'+peak.baseline_kind)),node('dd',n(peak.baseline_GiB)),node('dt',tr('peak_difference')),node('dd',n(peak.difference_GiB)));
      }
      report.append(dl,node('p',tr('peak_boundary')));
      for(const reason of peak.blockers)report.append(node('p',tr('peak_block_'+reason)));
      if(peak.exceeds_entered_budget)report.append(node('p',tr('peak_over_budget')));
      if(peak.measurement)report.append(measurementReviewView(peak.measurement));
      box.append(report);
    }
    out.append(box);
    if(bundle.origin!=='demo'){out.append(createMeasurementImport());if(memoryMeasurement)out.append(createMemoryComparison());}
  }
  if(result.family)out.append(node('p',`Chat-template: ${result.family} · ${result.length}`));
  if(result.names?.length)out.append(node('p',result.names.join(', ')));
  out.append(createResolverSummary());
  if(summaryData().checks)out.append(button(tr('checks_open'),openChecks,'show-checks'));
  out.append(createResolverReview());
  const progress=createProgress();if(progress)out.append(progress);
  out.append(createObservations());updateObservationView();
  if(bundle.origin==='demo'&&CHECK_DEMOS[route]){
   const examples=node('details');examples.id='resolver-check-examples';examples.append(node('summary',tr('checks_examples')));
   const actions=node('div');actions.className='resolver-actions';
   for(const key of CHECK_DEMOS[route]){const b=button(tr('checks_'+route+'_'+key),()=>changeExample(key));b.dataset.checkExample=key;actions.append(b);}examples.append(actions);out.append(examples);
  }
  const links=node('p');
  for(const [label,url] of [[tr('module'),tafLink({mode:CASES[route].mode,model:bundle.origin==='demo'?'':bundle.model,lang:getLang()},location.href)]]) {
    const a=node('a',label);a.href=url;a.target='_blank';a.rel='noopener';links.append(a,node('br'));
  }out.append(links);
  const sources=node('details');sources.append(node('summary',tr('source')),node('p',bundle.revision||'—'));
  for(const source of bundle.sources||[]) {const p=node('p'),a=node('a',source.url);a.href=source.url;a.target='_blank';a.rel='noopener';p.append(a,node('span',' · '+source.status));sources.append(p);}if(!isLocal())out.append(sources);
  const actions=node('div');actions.className='resolver-actions';
  actions.append(button(tr('worked'),()=>{feedback='worked';renderFeedback();},'worked'),button(tr('failed'),()=>{feedback='failed';renderFeedback();openObservations();},'failed'),button(tr('export'),download,'export'));
  out.append(actions,node('p',tr(isLocal()?'local_note':'report_note')));
  const saveBox=node('details');saveBox.id='resolver-save-case';
  saveBox.append(node('summary',tr('case_save')),node('p',tr('case_save_note')),button(tr('case_save'),downloadPrivateCase,'save-case-button'));
  out.append(saveBox);renderFeedback();
}
function download() {
  if(!result)return;
  const {suggestion,...publicResult}=result;
  const report={schema_version:3,review:reviewData(),progress:progressData(),observations:observationData(),demo_scenario:bundle.demoScenario||null,route,origin:bundle.origin,model:bundle.model,revision:bundle.revision||null,checked_at:bundle.checkedAt||null,
    sources:bundle.sources,inputs:isLocal()?publicLocalInputs(route,lastInputs):route==='memory'?publicMemoryInputs(lastInputs):lastInputs,initial_inputs:isLocal()?publicLocalInputs(route,initial.inputs):route==='memory'?publicMemoryInputs(initial.inputs):initial.inputs,summary:summaryData(),result:publicResult,user_feedback:feedback||null,restored_from_file:!!bundle.restoredFromFile,scope:'Static inspection / estimate / imported measurements, not an executed model or independently verified fix'};
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const a=node('a');a.href=url;a.download='taf-case-'+route+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function measurementReviewView(review){
 const box=node('section');box.className='resolver-measurement-review';
 box.append(node('h4',tr('measurement_checks')),node('p',tr('measurement_unverified')));
 if(review.kind==='example')box.append(node('p',tr('measurement_example')));
 const list=node('ul');
 for(const check of review.checks)list.append(node('li',tr('measurement_field_'+check.field)+': '+tr('measurement_'+check.status)));
 box.append(list);return box;
}
function createMeasurementImport(){
 const box=node('details');box.id='resolver-measurement-import';
 box.append(node('summary',tr('measurement_title')),node('p',tr('measurement_help')));
 const label=node('label',tr('measurement_file'));label.htmlFor='resolver-measurement-file';
 const input=node('input');input.type='file';input.accept='.json,application/json';input.id=label.htmlFor;
 const status=node('p');status.id='resolver-measurement-status';status.setAttribute('role','status');
 const preview=node('div');preview.id='resolver-measurement-preview';
 const guide=node('a',tr('measurement_guide'));const url=new URL(summaryData().guide.url);url.pathname=url.pathname.replace(/\/chapters\/[^/]+$/,'/chapters/R5-tafagent.html');url.hash='sec-resolver-memory-import';guide.href=url.href;guide.target='_blank';guide.rel='noopener';
 input.addEventListener('change',async()=>{
  const ticket=++measurementRequest,file=input.files?.[0];preview.replaceChildren();status.textContent='';if(!file)return;
  try{
   if(file.size>MEASUREMENT_LIMIT)throw new Error('measurement_large');
   const text=await file.text();if(ticket!==measurementRequest||!box.isConnected)return;
   const record=readMemoryMeasurement(text),candidate={...lastInputs,peak:record.peak.value,peakUnit:record.peak.unit,peakMetric:record.peak.metric};
   const review=reviewMemoryMeasurement(record,candidate,bundle);
   preview.append(node('p',tr('measurement_peak')+': '+record.peak.value+' '+record.peak.unit),measurementReviewView(review));
   preview.append(button(tr('measurement_apply'),()=>{
    if(ticket!==measurementRequest||!result||route!=='memory')return;
    cancel();clearMemoryComparison();memoryMeasurement=record;
    $('peak').value=record.peak.value;$('peakUnit').value=record.peak.unit;$('peakMetric').value=record.peak.metric;
    $('peakSame').checked=false;$('peakIsolated').checked=false;
    progressMarks=null;observationHistory=[];feedback='';lastInputs=inputs();result=solveCase(route,bundle,lastInputs);
    measurementRequest++;renderResult();$('peak-fields').open=true;$('peakSame').focus();$('status').textContent=tr('measurement_confirm');
   },'measurement-apply'));
  }catch(error){if(ticket===measurementRequest)status.textContent=tr(error.message==='measurement_large'?'measurement_large':'measurement_invalid');}
 });
 box.append(label,input,status,preview,guide);return box;
}
function comparisonView(report){
 const box=node('section');box.id='resolver-comparison-result';box.tabIndex=-1;
 box.append(node('h4',tr('comparison_title')),node('p',tr('comparison_limit')));
 const n=x=>x.toLocaleString(getLang(),{maximumFractionDigits:3});
 const dl=node('dl');dl.append(node('dt',tr('comparison_before')),node('dd',n(report.before_GiB)+' GiB'),node('dt',tr('comparison_after')),node('dd',n(report.after_GiB)+' GiB'));
 if(report.status==='declared_comparison'){
  dl.append(node('dt',tr('comparison_delta')),node('dd',n(report.delta_GiB)+' GiB'),node('dt',tr('comparison_percent')),node('dd',report.delta_percent===null?tr(report.percent_unavailable==='range'?'comparison_range':'comparison_zero'):n(report.delta_percent)+' %'));
  box.append(node('p',tr('comparison_'+report.direction)));
 }
 box.append(dl);
 for(const reason of report.blockers)box.append(node('p',tr('comparison_block_'+reason)));
 const list=node('ul');for(const check of report.checks)list.append(node('li',tr('comparison_field_'+check.field)+': '+tr('measurement_'+check.status)));box.append(list);
 const conditions=node('details');conditions.append(node('summary',tr('comparison_conditions')),node('h5',tr('comparison_before')),measurementReviewView(report.before),node('h5',tr('comparison_after')),measurementReviewView(report.after));box.append(conditions);return box;
}
function updateMemoryComparison(){
 cancel();measurementRequest++;progressMarks=null;observationHistory=[];feedback='';
 lastInputs=inputs();result=solveCase(route,bundle,lastInputs);renderResult();
 $('comparison').open=true;$('comparison-result')?.focus();
}
function createMemoryComparison(){
 const box=node('details');box.id='resolver-comparison';box.append(node('summary',tr('comparison_title')),node('p',tr('comparison_help')));
 const label=node('label',tr('comparison_file'));label.htmlFor='resolver-comparison-file';
 const input=node('input');input.id=label.htmlFor;input.type='file';input.accept='.json,application/json';
 const status=node('p');status.id='resolver-comparison-status';status.setAttribute('role','status');
 const preview=node('div');preview.id='resolver-comparison-preview';
 input.addEventListener('change',async()=>{
  const ticket=++measurementRequest,file=input.files?.[0];preview.replaceChildren();status.textContent='';if(!file)return;
  try{
   if(file.size>MEASUREMENT_LIMIT)throw new Error('measurement_large');
   const text=await file.text();if(ticket!==measurementRequest||!box.isConnected)return;
   const after=readMemoryMeasurement(text),review=compareMemoryMeasurements(memoryMeasurement,after,{...lastInputs,comparisonSame:false},bundle,result.fit);
   preview.append(node('p',tr('comparison_after')+': '+after.peak.value+' '+after.peak.unit),measurementReviewView(review.after));
   const list=node('ul');for(const check of review.checks)list.append(node('li',tr('comparison_field_'+check.field)+': '+tr('measurement_'+check.status)));preview.append(list);
   preview.append(button(tr('comparison_apply'),()=>{
    if(ticket!==measurementRequest||!result||route!=='memory')return;
    measurementAfter=after;comparisonSame=false;updateMemoryComparison();
   },'comparison-apply'));
  }catch(error){if(ticket===measurementRequest)status.textContent=tr(error.message==='measurement_large'?'measurement_large':'measurement_invalid');}
 });
 box.append(label,input,status,preview);
 if(measurementAfter){
  const confirm=node('input');confirm.type='checkbox';confirm.id='resolver-comparison-confirm';confirm.checked=comparisonSame;
  const confirmLabel=node('label',tr('comparison_confirm'));confirmLabel.htmlFor=confirm.id;
  confirm.addEventListener('change',()=>{comparisonSame=confirm.checked;updateMemoryComparison();$('comparison-confirm').focus();});
  box.append(confirmLabel,confirm,comparisonView(result.memoryPeak.comparison),button(tr('comparison_clear'),()=>{clearMemoryComparison();updateMemoryComparison();$('comparison-file').focus();},'comparison-clear'));
 }
 const guide=node('a',tr('comparison_guide'));const url=new URL(summaryData().guide.url);url.pathname=url.pathname.replace(/\/chapters\/[^/]+$/,'/chapters/R5-tafagent.html');url.hash='sec-resolver-memory-comparison';guide.href=url.href;guide.target='_blank';guide.rel='noopener';box.append(guide);return box;
}
function downloadPrivateCase(){
 try{
  const text=saveCase(resultState(),progressMarks,observationHistory,feedback);
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const a=node('a');a.href=url;a.download='taf-private-case-'+route+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('status').textContent='';
 }catch{$('status').textContent=tr('case_save_error');}
}
function clearCasePreview(){
 fileRequest++;pendingCase=null;$('case-file').value='';$('case-preview').replaceChildren();$('case-file-status').textContent='';
}
function renderCasePreview(){
 const host=$('case-preview');host.replaceChildren();if(!pendingCase)return;
 const c=pendingCase;
 host.append(node('p',tr('case_ready')+': '+tr(c.route)),node('p',tr('case_saved_at')+': '+new Date(c.savedAt).toLocaleString(getLang())),node('p',tr('case_private_note')));
 if(c.bundle.origin==='demo')host.append(node('p',tr('demo_note')));
 if(c.planChanged)host.append(node('p',tr('case_plan_changed')));
 host.append(button(tr('case_apply'),()=>{
  const saved=pendingCase;if(!saved)return;
  choose(saved.route);bundle=saved.bundle;result=saved.result;lastInputs=saved.inputs;initial=saved.initial;
  progressMarks=saved.progressMarks;observationHistory=saved.observations;feedback=saved.feedback;
  if(isLocal())renderLocalFields(lastInputs);
  else{
   $('model').value=validResolverModel(bundle.model)?bundle.model:'';
   if(route==='memory'){memoryMeasurement=lastInputs.measurement??null;measurementAfter=lastInputs.measurementAfter??null;comparisonSame=lastInputs.comparisonSame===true;for(const [key,value] of Object.entries(lastInputs)){if(['measurement','measurementAfter','comparisonSame'].includes(key))continue;if(typeof value==='boolean')$(key).checked=value;else $(key).value=value??'';}}
  }
  // Imported files never restore an unrelated error, suggestions or share link.
  $('description').value='';$('suggestions').replaceChildren();triageUI?.reset();
  clearCasePreview();$('case-open').open=false;
  renderResult();$('status').textContent=saved.planChanged?tr('case_plan_changed'):'';$('result').focus();
 },'case-apply'),button(tr('case_cancel'),clearCasePreview,'case-cancel'));
}
async function previewCaseFile(){
 const ticket=++fileRequest,file=$('case-file').files?.[0];pendingCase=null;renderCasePreview();$('case-file-status').textContent='';
 if(!file)return;
 try{
  if(file.size>CASE_FILE_LIMIT)throw new Error('case_file_large');
  const text=await file.text();if(ticket!==fileRequest)return;
  pendingCase=readSavedCase(text);renderCasePreview();
 }catch(error){if(ticket===fileRequest)$('case-file-status').textContent=tr(['case_file_large','case_file_report'].includes(error.message)?error.message:'case_file_invalid');}
}
async function run(demo=false) {
  if(!route)return;
  if(!demo && ((!isLocal()&&!validResolverModel($('model').value.trim())) || !$('form').reportValidity())) {$('status').textContent=tr(isLocal()?'local_invalid':'invalid');return;}
  measurementRequest++;clearAttentionPreviews();clearAdapterPreview();cancel();const ticket=request;const activeController=new AbortController();controller=activeController;const timer=setTimeout(()=>activeController.abort(),20000);
  const id=$('model').value.trim();result=null;feedback='';progressMarks=null;observationHistory=[];$('result').replaceChildren();$('followup').replaceChildren();
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
    } else if(!next || next.model!==id || next.origin!=='hf'||next.restoredFromFile)next=await fetchResolverBundle(id,route,{signal:controller.signal});
    if(ticket!==request)return;
    if(demo&&CHECK_DEMOS[route])next.demoScenario=CHECK_DEMOS[route][0];
    if(demo&&!isLocal()){clearMemoryPeak();$('model').value=route==='template'?'':next.model;$('vram').value='24';$('context').value='131072';$('precision').value='BF16';$('stage').value='generate';}
    lastInputs=route==='memory'||isLocal()?inputs():{};
    const answer=solveCase(route,next,lastInputs);
    bundle=next;result=answer;initial={inputs:{...lastInputs},result:answer};$('status').textContent='';renderResult();
    $('result').focus();
  } catch(error) {if(ticket===request){bundle=null;$('status').textContent=tr(isLocal()?'local_invalid':error.message==='inputs'||error.message==='model'?'invalid':'error');}}
  finally {clearTimeout(timer);if(ticket===request){$('run').disabled=false;$('demo').disabled=false;controller=null;}}
}
export function refreshResolver() {
  if(!$('dialog'))return;
  videoUI?.refresh();renderCasePreview();
  if(route)$('route-title').textContent=tr(route);
  if(isLocal())renderLocalFields(inputs());
  catalogUI?.refresh();
  triageUI?.refresh();
  renderResult();renderFeedback();
  if(!$('share-value').hidden)$('share-value').value=resolverLink(route,isLocal()?'':$('model').value.trim(),location.href,getLang());
}
export function openResolverForDemo() {
  videoUI?.collapse();
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
    <details id="resolver-case-open"><summary data-i18n="resolver.case_open"></summary><p data-i18n="resolver.case_open_note"></p>
    <label for="resolver-case-file" data-i18n="resolver.case_file"></label><input id="resolver-case-file" type="file" accept=".json,application/json">
    <p id="resolver-case-file-status" role="status"></p><div id="resolver-case-preview" aria-live="polite"></div></details>
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
        ${label('stage','stage','<select id="resolver-stage"><option value="generate" data-i18n="resolver.generate"></option><option value="load" data-i18n="resolver.load"></option><option value="prefill" data-i18n="resolver.prefill"></option><option value="decode" data-i18n="resolver.decode"></option></select>')}
        <details id="resolver-peak-fields"><summary data-i18n="resolver.peak_title"></summary><p data-i18n="resolver.peak_help"></p>
        ${label('peak','peak_value','<input id="resolver-peak" type="number" min="0" max="1000000000" step="any">')}
        ${label('peakUnit','peak_unit','<select id="resolver-peakUnit"><option>GiB</option><option>GB</option><option>MiB</option></select>')}
        ${label('peakMetric','peak_metric','<select id="resolver-peakMetric">'+['unknown','allocated','reserved','device'].map(k=>`<option value="${k}" data-i18n="resolver.peak_${k}"></option>`).join('')+'</select>')}
        ${label('peakSame','peak_same','<input id="resolver-peakSame" type="checkbox">')}
        ${label('peakIsolated','peak_isolated','<input id="resolver-peakIsolated" type="checkbox">')}
        <p data-i18n="resolver.peak_reset"></p></details>
      </fieldset><div class="resolver-actions"><button id="resolver-run" type="submit" data-i18n="resolver.run"></button><button id="resolver-demo" type="button" data-i18n="resolver.demo"></button></div>
    </form><p id="resolver-status" role="status"></p><section id="resolver-result" tabindex="-1" aria-live="polite"></section><section id="resolver-followup" aria-live="polite"></section>
    <div id="resolver-share-area" hidden><button id="resolver-share" type="button" data-i18n="resolver.share"></button><p data-i18n="resolver.share_note"></p>
    <input id="resolver-share-value" type="text" readonly hidden aria-label="URL"></div>`;
  document.body.append(dialog);
  videoUI=createResolverVideo();$('title').nextElementSibling.after(videoUI.element);
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
  $('close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{cancel();videoUI?.pause();});
  $('suggest').addEventListener('click',suggest);
  $('case-file').addEventListener('change',previewCaseFile);
  document.querySelectorAll('[data-resolver-case]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.resolverCase)));
  $('form').addEventListener('submit',e=>{e.preventDefault();run();});
  $('form').addEventListener('input',e=>{if(e.target.matches('[data-attention-file],[data-adapter-file]'))return;if(['peak','peakUnit','peakMetric'].some(id=>e.target.id==='resolver-'+id)){memoryMeasurement=null;clearMemoryComparison();}if(['model','vram','context','precision','stage'].some(id=>e.target.id==='resolver-'+id))clearMemoryPeak();invalidate(e.target.id==='resolver-model');});
  $('model').addEventListener('change',()=>{clearMemoryPeak();invalidate(true);});
  attachHfAutocomplete($('model'));
  $('demo').addEventListener('click',()=>run(true));
  document.querySelectorAll('[data-resolver-demo-open]').forEach(b=>b.addEventListener('click',()=>onDemo()));
  $('share').addEventListener('click',()=>{const field=$('share-value');field.value=resolverLink(route,isLocal()?'':$('model').value.trim(),location.href,getLang());field.hidden=false;field.focus();field.select();});
  window.__taf_applyTranslations?.();
  const params=new URLSearchParams(location.search), entry=params.get('resolve');
  if(entry){if(Object.hasOwn(CASES,entry))choose(entry);if(validResolverModel(params.get('model')))$('model').value=params.get('model');open(false);}
}
