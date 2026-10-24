import { RESOLVER_TRANSLATIONS } from './resolver_i18n.js';
import { guideLink, guideLanguage, topics, local } from './guide_bridge.js';
import { chapterTitles } from './guide_chapters.js';
import { CASES } from './resolver.js';

// Summarize recorded inputs and estimates only; never infer a cause from pasted text.
export function buildResolverSummary({route,bundle,initial,inputs,result,app='github'},language='en') {
  const lang=Object.hasOwn(RESOLVER_TRANSLATIONS,language)?language:'en';
  const tr=k=>RESOLVER_TRANSLATIONS[lang]['resolver.'+k];
  const n=v=>v.toLocaleString(lang,{maximumFractionDigits:2});
  const fill=(key,values)=>tr(key).replace(/\{(\w+)\}/g,(_,k)=>values[k]??'');
  const first=initial||{inputs,result};
  let problem=tr(route)+(bundle.model?' · '+bundle.model:''),finding=tr(result.status),change=null;
  let topic=CASES[route].topic,index=0,section='',why='architecture';
  if(route==='memory') {
    problem=fill('summary_memory',{model:bundle.model,stage:tr(first.inputs.stage).toLocaleLowerCase(lang),tokens:n(first.inputs.context),precision:first.inputs.precision,vram:n(first.inputs.vram)});
    if(first.result.fit && first.inputs.stage==='generate')finding=fill('summary_budget',{total:n(first.result.fit.totalGB),vram:n(first.inputs.vram)})+' '+tr(first.result.status);
    if(result.fit && first.result.fit && (inputs.context!==first.inputs.context || inputs.precision!==first.inputs.precision)) {
      change=fill('summary_adjust',{beforeTokens:n(first.inputs.context),afterTokens:n(inputs.context),beforePrecision:first.inputs.precision,afterPrecision:inputs.precision,before:n(first.result.fit.totalGB),after:n(result.fit.totalGB)})+' '+tr(result.status);
    }
    if(result.status==='limited'){topic='architecture';why='architecture';}
    else if(first.result.status==='weights_bound' || inputs.precision!==first.inputs.precision){topic='quant';why='quant';}
    else if(first.inputs.stage==='load' || first.result.status!=='kv_bound'){topic='memory';index=1;why='serving';}
    else {topic='memory';why='kv';}
  } else if(route==='template'){topic='setup';index=1;why='template';}
  else if(CASES[route].source==='local') {
    finding=fill(result.summaryKey,Object.fromEntries(Object.entries(result.summaryParams).map(([k,v])=>[k,typeof v==='number'?v.toLocaleString(lang,{maximumFractionDigits:4}):v])));
    why='local';index=route==='pvr'||route==='cache'?1:0;
  }
  const guideLang=guideLanguage(lang);
  const anchors={
    kv:{es:'el-problema',en:'the-problem'},
    quant:{es:'cuantización-menos-bits-por-peso',en:'quantization-fewer-bits-per-weight'},
    serving:{es:'el-marco-de-decisión-honesto',en:'the-decision-framework-honest'},
    template:{es:'sec-evaluacion-contexto',en:'sec-evaluacion-contexto'},
    architecture:{es:'las-familias',en:'the-families'},
  };
  section=anchors[why]?.[guideLang]||'';
  const url=new URL(guideLink(topic,index,{lang,model:bundle.origin==='demo'?'':bundle.model,mode:CASES[route].mode,resolve:route,app}));url.hash=section;
  const next=tr(result.nextKey || (route==='template'?(result.status==='present'?'template_next':'template_missing_next'):route==='compatibility'||result.status==='limited'?'compatibility_next':'memory_next'));
  return {problem,finding,change,next,guide:{url:url.href,title:chapterTitles[topics[topic].chapters[index]][guideLang],why:tr('summary_why_'+why),language:guideLang,note:lang==='fr'||lang==='zh'?local('fallback',lang):null},demo:bundle.origin==='demo'};
}
