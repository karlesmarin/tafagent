import {modeTopics, topics, metrics, modelInputs, modeNames, local, topicText, explanation, readContext, tafLink} from './guide_bridge.js';

const snapshots = new Map();
let language = () => 'en';
function element(tag,text) { const e=document.createElement(tag); if(text) e.textContent=text; return e; }
function currentModel(mode) { return document.getElementById(modelInputs[mode])?.value.trim() || ''; }

function renderPanel(panel) {
  const mode=panel.dataset.guideMode, lang=language();
  const previous=panel.querySelector('select')?.value;
  const hadMetrics=panel.dataset.hasMetrics==='true';
  const opened=panel.open;
  panel.replaceChildren(); panel.open=opened;
  const summary=element('summary',`📖 ${local('title',lang)}`);
  const label=element('label',local('choose',lang)), select=element('select');
  select.id=`${panel.id}-topic`; label.htmlFor=select.id;
  const snapshot=snapshots.get(mode);
  for(const [metric,value] of Object.entries(snapshot?.values || {})) {
    if(!Object.hasOwn(metrics,metric) || typeof value!=='number' || !Number.isFinite(value)) continue;
    const option=element('option',`${metrics[metric].label} = ${value.toLocaleString(lang,{maximumSignificantDigits:6})}`);
    option.value=`metric:${metric}`; select.append(option);
  }
  for(const topic of modeTopics[mode]) {
    const option=element('option',topicText(topic,'label',lang)); option.value=topic; select.append(option);
  }
  const hasMetrics=[...select.options].some(o=>o.value.startsWith('metric:'));
  panel.dataset.hasMetrics=String(hasMetrics);
  if((hadMetrics || !hasMetrics) && [...select.options].some(o=>o.value===previous)) select.value=previous;
  const body=element('div'), next=element('a');
  const update=()=>{
    const metric=select.value.startsWith('metric:')?select.value.slice(7):null;
    const topic=metric?metrics[metric].topic:select.value;
    const context={mode,model:snapshot ? (snapshot.metricModels?.[metric] ?? snapshot.model) : currentModel(mode),metric,value:metric?snapshot.values[metric]:null,
      app:location.hostname==='karlexmarin-taf-agent.static.hf.space'?'hf':'github'};
    explanation(body,topic,context,lang);
    if(snapshot?.mismatch) body.append(element('p',local('mismatch',lang)));
    next.textContent=`${local('next',lang)} → ${modeNames[topics[topic].next]}`;
    next.href=tafLink({mode:topics[topic].next,model:context.model,lang},location.href);
  };
  select.addEventListener('change',update);
  panel.append(summary,label,select,body,next); update();
}

export function refreshGuidePanels() {
  for (const a of document.querySelectorAll('[data-guide-selector-link]')) {
    a.href = `https://karlesmarin.github.io/transformers-guide/${language()==='es'?'es':'en'}/chapters/R5-tafagent.html#taf-routes`;
  }
  document.querySelectorAll('[data-guide-mode]').forEach(renderPanel);
  const title=document.getElementById('guide-help-title'),body=document.getElementById('guide-help-body');
  if(title) title.textContent=local('title',language());
  if(body) body.textContent=local('help',language());
  const demo=document.getElementById('guide-help-demo');
  if(demo) {
    demo.textContent=`🎬 ${local('demo',language())}: TAF ↔ ${local('guide',language())}`;
    demo.href=tafLink({mode:'profile',demo:true,lang:language()},location.href).replace('demo=profile','demo=guide');
  }
  document.querySelectorAll('[data-explain-metric]').forEach(button=>button.setAttribute('aria-label',`${local('title',language())}: ${metrics[button.dataset.explainMetric].label}`));
}

export function attachMetricExplanations() {
  const rows=document.querySelectorAll('#profile-box .num-row');
  const keys=['gamma_pade','gamma_decomposed','d_horizon','L_NIAH_ceiling','chi_susceptibility','kv_memory_per_request_GB'];
  rows.forEach((row,index)=>{
    if(!keys[index] || row.querySelector('[data-explain-metric]')) return;
    const button=element('button','📖'); button.type='button'; button.className='guide-metric-button';
    button.dataset.explainMetric=keys[index];
    button.setAttribute('aria-label',`${local('title',language())}: ${metrics[keys[index]].label}`);
    button.addEventListener('click',()=>{
      const panel=document.getElementById('guide-for-profile-output'); panel.open=true;
      const select=panel.querySelector('select'); select.value=`metric:${keys[index]}`;
      select.dispatchEvent(new Event('change')); panel.scrollIntoView({block:'nearest'}); select.focus({preventScroll:true});
    });
    row.append(button);
  });
}

export function recordGuideResult(mode,values,{model='',mismatch=false,metricModels={}}={}) {
  snapshots.set(mode,{values,model,mismatch,metricModels});
  document.querySelectorAll(`[data-guide-mode="${mode}"]`).forEach(renderPanel);
}

export function initGuidePanels(getLanguage) {
  language=getLanguage;
  for(const mode of Object.keys(modeTopics)) {
    // Profile/Compare results live outside the input section, so also accompany those results.
    const hosts=[document.getElementById(`${mode}-section`)];
    if(['profile','compare'].includes(mode)) hosts.push(document.getElementById(`${mode}-output`));
    for(const host of hosts.filter(Boolean)) {
      const panel=element('details'); panel.className='taf-guide-panel';
      panel.id=`guide-for-${host.id}`; panel.dataset.guideMode=mode;
      host.append(panel); renderPanel(panel);
    }
    const input=document.getElementById(modelInputs[mode]);
    input?.addEventListener('input',()=>{
      // An edited ID does not turn the previous result into a measurement of the new model.
      document.querySelectorAll(`[data-guide-mode="${mode}"]`).forEach(renderPanel);
    });
  }
  refreshGuidePanels();
}

export function applyGuideDeepLink(getLanguage,setLanguage) {
  const ctx=readContext(location.search);
  if(ctx.lang && ctx.lang!==getLanguage()) setLanguage(ctx.lang);
  if(!ctx.mode) return;
  const button=[...document.querySelectorAll('.mode-btn')].find(b=>b.dataset.mode===ctx.mode);
  button?.click();
  const input=document.getElementById(modelInputs[ctx.mode]);
  // Do not dispatch input/change: autocomplete and fetch handlers must not run on navigation.
  if(input && ctx.model) input.value=ctx.model;
}
