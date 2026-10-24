import { TOOL_CATALOG } from './resolver_catalog.js';
import { t,getLang } from './i18n.js';
import { tafLink,guideLink,modeTopics,guideLanguage,local } from './guide_bridge.js';
import { chapterTitles } from './guide_chapters.js';
import { topics } from './guide_bridge.js';
const tr=k=>t('resolver.'+k);
const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
export function mountResolverCatalog(host,{choose,getModel}) {
 const details=el('details'),summary=el('summary');summary.dataset.i18n='resolver.catalog';details.append(summary);
 const label=el('label');label.htmlFor='resolver-catalog-search';label.dataset.i18n='resolver.catalog_search';
 const search=el('input');search.id='resolver-catalog-search';search.type='search';search.maxLength=100;
 const selectLabel=el('label');selectLabel.htmlFor='resolver-catalog-select';selectLabel.dataset.i18n='resolver.catalog_choose';
 const select=el('select');select.id='resolver-catalog-select';
 const card=el('section');card.id='resolver-catalog-card';card.setAttribute('aria-live','polite');
 details.append(label,search,selectLabel,select,card);host.append(details);
 const name=mode=>t('modes.'+mode);
 const desc=entry=>entry.description[Math.max(0,['en','es','fr','zh'].indexOf(getLang()))];
 const link=(label,url)=>{const a=el('a',label);a.href=url;a.target='_blank';a.rel='noopener';return a;};
 function render(){
  card.replaceChildren();const entry=TOOL_CATALOG.find(x=>x.mode===select.value);if(!entry)return;
  card.append(el('h4',name(entry.mode)),el('strong',tr('catalog_scope')),el('p',desc(entry)));
  if(entry.direct){const b=el('button',tr('catalog_direct'));b.type='button';b.addEventListener('click',()=>choose(entry.direct));card.append(b);}
  const links=el('p'),model=getModel();
  links.append(link(tr('module'),tafLink({mode:entry.mode,model,lang:getLang()},location.href)),el('br'),link(tr('catalog_demo'),tafLink({mode:entry.mode,demo:true,lang:getLang()},location.href)));
  const topic=modeTopics[entry.mode][0],index=entry.mode==='pvr'?1:0,chapter=topics[topic].chapters[index];
  links.append(el('br'),link(chapterTitles[chapter][guideLanguage(getLang())],guideLink(topic,index,{lang:getLang(),model,mode:entry.mode})));
  card.append(links,el('p',tr('catalog_note')));
  if(['fr','zh'].includes(getLang()))card.append(el('p',local('fallback',getLang())));
 }
 function refresh(){
  const previous=select.value,q=search.value.trim().toLocaleLowerCase();select.replaceChildren();
  const matches=TOOL_CATALOG.filter(x=>!q||(name(x.mode)+' '+desc(x)+' '+x.mode).toLocaleLowerCase().includes(q));
  select.append(new Option(matches.length?tr('catalog_choose'):tr('catalog_empty'),''));
  for(const entry of matches)select.append(new Option(name(entry.mode),entry.mode));
  if(matches.some(x=>x.mode===previous))select.value=previous;else if(matches.length===1)select.value=matches[0].mode;
  render();
 }
 search.addEventListener('input',refresh);select.addEventListener('change',render);details.addEventListener('toggle',()=>{if(details.open)render();});refresh();
 return {refresh,show(mode){details.open=true;search.value='';refresh();select.value=mode;render();card.scrollIntoView({block:'nearest'});}};
}
