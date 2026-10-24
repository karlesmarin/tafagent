import {TRIAGE,triageNoteKey} from './resolver_triage.js';
import {t,getLang} from './i18n.js';
import {guideLink,guideLanguage,topics,local} from './guide_bridge.js';
import {chapterTitles} from './guide_chapters.js';
const tr=k=>t('resolver.'+k);
const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
export function mountResolverTriage(host,{choose,showTool,clear}){
 const label=el('label');label.htmlFor='resolver-symptom';label.dataset.i18n='resolver.triage_category';
 const category=el('select');category.id=label.htmlFor;
 const sub=el('div');sub.hidden=true;
 const question=el('label');question.htmlFor='resolver-symptom-detail';question.dataset.i18n='resolver.triage_question';
 const options=el('select');options.id=question.htmlFor;sub.append(question,options);
 const output=el('div');output.id='resolver-triage-answer';output.setAttribute('aria-live','polite');
 host.append(label,category,sub,output);
 const link=(text,url)=>{const a=el('a',text);a.href=url;a.target='_blank';a.rel='noopener';return a;};
 function render(){
  output.replaceChildren();const choice=TRIAGE[category.value]?.find(x=>x[0]===options.value);if(!choice)return;
  const [key,route,mode,topic,official]=choice;
  output.append(el('p',tr(triageNoteKey(choice))),el('p',tr('triage_note')));
  if(route||mode){const b=el('button',tr('triage_continue'));b.type='button';b.id='resolver-triage-continue';b.addEventListener('click',()=>route?choose(route,key):showTool(mode));output.append(b);}
  const index=key==='training'?1:0,chapter=topics[topic].chapters[index];
  const p=el('p');p.append(link(chapterTitles[chapter][guideLanguage(getLang())],guideLink(topic,index,{lang:getLang(),mode:mode||undefined})));output.append(p);
  if(official)output.append(link(tr('triage_official'),official));
  if(['fr','zh'].includes(getLang()))output.append(el('p',local('fallback',getLang())));
 }
 function updateOptions(previous=''){
  sub.hidden=!TRIAGE[category.value];options.replaceChildren(new Option(tr('triage_select'),''));
  for(const [key] of TRIAGE[category.value]||[])options.append(new Option(tr('triage_'+key),key));
  if([...options.options].some(x=>x.value===previous))options.value=previous;render();
 }
 function refresh(){const a=category.value,b=options.value;category.replaceChildren(new Option(tr('triage_select'),''));for(const key of Object.keys(TRIAGE))category.append(new Option(tr('triage_'+key),key));category.value=a;updateOptions(b);}
 category.addEventListener('change',()=>{clear();updateOptions();});options.addEventListener('change',()=>{clear();render();});refresh();
 return {refresh,reset(){category.value='';updateOptions();}};
}
