// Deterministic problem routes. No LLM guesses, inference, posting or telemetry.
import { inspectModel, textConfig } from './model_compatibility.js';
import { checkFit, FIT_PRECISIONS } from './fit_check.js';
import { sniffChatTemplate } from './chat_template_sniffer.js';
import { classifyMemory } from './memory_reality.js';

export const CASES = {
  memory: { mode:'fitcheck', topic:'memory', fields:['vram','context','precision','stage'] },
  template: { mode:'template', topic:'setup', fields:[] },
  compatibility: { mode:'memreal', topic:'architecture', fields:[] },
};
export function suggestCases(text='') {
  const s=String(text).normalize('NFKC').toLowerCase();
  return Object.entries({
    memory:/out.of.memory|\boom\b|vram|cuda.*memory|memoria|mémoire|memory|显存|内存/,
    template:/template|plantilla|gabarit|模板|chat.*format|format.*chat/,
    compatibility:/config|compatib|architecture|arquitectura|架构|配置|兼容|model.type|rope|moe/,
  }).filter(([,pattern])=>pattern.test(s)).map(([key])=>key);
}
export function validResolverModel(id) {
  return typeof id==='string' && id.length<=200 && /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) && !id.includes('..');
}
export function templateInspection(tokenizer={}, standalone=null) {
  const raw=standalone ?? tokenizer.chat_template;
  let template=raw, names=[];
  if (Array.isArray(raw)) {
    names=raw.filter(x=>x && typeof x.name==='string' && typeof x.template==='string').map(x=>x.name);
    template=raw.find(x=>x?.name==='default')?.template;
    if (!template && names.length===1) template=raw.find(x=>x?.name===names[0])?.template;
  } else if (raw && typeof raw==='object') {
    names=Object.keys(raw).filter(x=>typeof raw[x]==='string');
    template=raw.default ?? (names.length===1 ? raw[names[0]] : null);
  }
  if (names.length>1 && typeof template!=='string') return {status:'multiple',names};
  const found=typeof template==='string' && !!template.trim();
  const scan=sniffChatTemplate(found?{chat_template:template}:{});
  return {status:found?'present':'missing', names, family:scan.detectedFamily, length:found?template.length:0};
}
export function solveCase(caseId, bundle, inputs={}) {
  if (!Object.hasOwn(CASES,caseId)) throw new Error('case');
  if (caseId==='template') return {caseId, ...templateInspection(bundle.tokenizer,bundle.template)};
  const inspection=inspectModel(bundle.config);
  const reasons=[...inspection.reasons];
  if (!(inspection.parameterEstimate>0)) reasons.push('parameters');
  if (caseId==='compatibility') return {caseId,status:reasons.length?'limited':'geometry',reasons,inspection,memory:classifyMemory(bundle.config)};
  const {vram,context,precision,stage}=inputs;
  if (!(Number.isFinite(vram)&&vram>0&&vram<=100000) || !Number.isInteger(context) || context<1 || context>1e7 ||
      !Object.hasOwn(FIT_PRECISIONS,precision) || !['load','generate'].includes(stage)) throw new Error('inputs');
  if (reasons.length) return {caseId,status:'limited',reasons,inspection};
  const c=textConfig(bundle.config), g=inspection.geometry;
  const geometry={nParams:inspection.parameterEstimate,nLayers:g.n_layers,nKvHeads:g.n_kv_heads,headDim:g.d_head,hidden:c.hidden_size,
    ropeTheta:g.theta,ctxTrain:inspection.configuredContext};
  const fit=checkFit(geometry,{precision,vramGB:vram,targetCtx:context,cacheType:'fp16'});
  if (!fit.ok) throw new Error('inputs');
  const status=stage==='load' ? (fit.weightsGB+0.4>vram?'weights_bound':'load_other') : fit.verdictCode;
  // Suggestions stay inside formats supported by the selected format family.
  const choices=['FP32','BF16','FP16','INT8','NF4'].includes(precision) ? ['INT8','NF4'] : ['Q8_0','Q4_K_M'];
  const alternatives=choices.filter(p=>FIT_PRECISIONS[p].bpw<FIT_PRECISIONS[precision].bpw)
    .map(p=>({precision:p,fit:checkFit(geometry,{precision:p,vramGB:vram,targetCtx:context,cacheType:'fp16'})}))
    .filter(x=>x.fit.ok&&x.fit.fits);
  const smallerContext=stage==='generate' && status==='kv_bound' && fit.maxCtx>1
    ? Math.max(1,Math.min(context-1,Math.floor(fit.maxCtx*0.9),inspection.configuredContext)) : null;
  return {caseId,status,fit,smallerContext,alternatives,inspection};
}

export async function fetchResolverBundle(model, caseId, {signal, fetcher=fetch}={}) {
  if (!validResolverModel(model) || !Object.hasOwn(CASES,caseId)) throw new Error('model');
  const sources=[];
  async function read(url,optional=false,json=true) {
    const r=await fetcher(url,{signal});
    if (optional && r.status===404) { sources.push({url,status:404}); return null; }
    if (!r.ok) throw new Error([401,403].includes(r.status)?'restricted':`HTTP ${r.status}`);
    const body=await r.text(); if(body.length>2e6) throw new Error('size');
    sources.push({url,status:r.status}); return json?JSON.parse(body):body;
  }
  const info=await read(`https://huggingface.co/api/models/${model}`);
  if (!/^[a-f0-9]{40}$/.test(info.sha||'')) throw new Error('revision');
  const base=`https://huggingface.co/${model}/resolve/${info.sha}/`;
  const bundle={model,revision:info.sha,sources,origin:'hf',checkedAt:new Date().toISOString()};
  if (caseId==='template') {
    bundle.tokenizer=await read(base+'tokenizer_config.json',true) || {};
    // A standalone template overrides embedded metadata in current Transformers.
    bundle.template=await read(base+'chat_template.jinja',true,false);
  } else bundle.config=await read(base+'config.json');
  return bundle;
}

export function resolverLink(caseId,model,base,lang='en') {
  const u=new URL(base); u.search=''; u.hash='';
  u.searchParams.set('resolve',Object.hasOwn(CASES,caseId)?caseId:'choose');
  if(validResolverModel(model)) u.searchParams.set('model',model);
  if(['en','es','fr','zh'].includes(lang)) u.searchParams.set('lang',lang);
  return u.href; // Never serialize questions, errors, hardware or case results.
}
