import {t,getLang} from './i18n.js';
import {readLlamaLog,parseLlamaLog,normalizeLlamaLog,LLAMA_LOG_LIMIT} from './llama_memory_log.js';
const tr=k=>t(`resolver.llama_${k}`);
const el=(tag,text)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;return e;};
const button=(key,id,action)=>{const b=el('button',tr(key));b.type='button';b.id='resolver-llama-'+id;b.onclick=action;return b;};
const number=x=>x==null?'—':x.toLocaleString(getLang(),{maximumFractionDigits:3});
function evidence(log){
 const box=el('section');box.className='resolver-llama-evidence';
 box.append(el('p',tr('boundary')));
 const meta=el('dl');
 for(const key of ['build','context','sequences','cells','k','v','offloaded','layers'])meta.append(el('dt',tr('meta_'+key)),el('dd',log.meta[key]??tr('unknown')));
 box.append(meta);
 const wrap=el('div');wrap.className='resolver-llama-table';
 const table=el('table');table.append(el('caption',tr('buffers')));
 const head=el('tr');for(const key of ['line','location','category','mib']){const th=el('th',tr(key));th.scope='col';head.append(th);}table.append(head);
 for(const row of log.rows){const r=el('tr');for(const x of [row.line,row.location==='other'?tr('other'):row.location,tr(row.category),number(row.MiB)])r.append(el('td',x));table.append(r);}
 wrap.append(table);box.append(wrap);
 const totals=el('ul');for(const g of log.groups)totals.append(el('li',(g.location==='other'?tr('other'):g.location)+' · '+tr('subtotal')+': '+number(g.listed_MiB)+' MiB'));box.append(totals);
 for(const issue of log.issues)box.append(el('p',tr('block_'+issue)));
 if(log.comparisons){
  box.append(el('h4',tr('comparison')),el('p',tr('comparison_note')));
  for(const c of log.comparisons){
   const section=el('section');section.dataset.llamaComparison=c.category;section.append(el('h5',tr(c.category)));
   const dl=el('dl');for(const [key,value] of [['estimated',c.estimated_GiB],['reported',c.reported_GiB],['difference',c.difference_GiB]])dl.append(el('dt',tr(key)),el('dd',number(value)+' GiB'));section.append(dl);
   const list=el('ul');for(const b of c.blockers)list.append(el('li',tr('block_'+b)));section.append(list);box.append(section);
  }
 }
 return box;
}
export function createLlamaLogPanel({report,onApply,onSame,onClear,guideURL}){
 const box=el('details');box.id='resolver-llama-import';box.open=!!report;
 box.append(el('summary',tr('title')),el('p',tr('help')));
 const fileLabel=el('label',tr('file'));fileLabel.htmlFor='resolver-llama-file';
 const file=el('input');file.type='file';file.accept='.log,.txt,text/plain';file.id=fileLabel.htmlFor;
 const label=el('label',tr('paste'));label.htmlFor='resolver-llama-text';
 const input=el('textarea');input.id=label.htmlFor;input.rows=5;input.maxLength=LLAMA_LOG_LIMIT;input.spellcheck=false;
 const status=el('p');status.id='resolver-llama-status';status.setAttribute('role','status');
 const preview=el('div');preview.id='resolver-llama-preview';let request=0;
 const clear=()=>{request++;preview.replaceChildren();status.textContent='';};
 function show(text){text=normalizeLlamaLog(text);const parsed=parseLlamaLog(text);preview.replaceChildren(evidence(parsed),button('apply','apply',()=>{if(box.isConnected)onApply(text);}),button('cancel','cancel',clear));}
 const error=e=>{status.textContent=tr(e.message==='llama_large'?'large':'invalid');};
 input.addEventListener('input',clear);
 file.onchange=async()=>{
  clear();const ticket=request,selected=file.files?.[0];if(!selected)return;
  try{if(selected.size>LLAMA_LOG_LIMIT)throw new Error('llama_large');const data=await selected.arrayBuffer();if(ticket!==request||!box.isConnected)return;show(readLlamaLog(data));}
  catch(e){if(ticket===request&&box.isConnected)error(e);}
 };
 box.append(fileLabel,file,label,input,button('preview','preview-button',()=>{clear();try{show(input.value);}catch(e){error(e);}}),status,preview);
 const example=button('example','example',()=>{});
 // Example is preview-only: do not provide an attach action for synthetic values.
 example.onclick=()=>{clear();const sample='load_tensors: CPU_Mapped model buffer size = 512.00 MiB\nload_tensors: CUDA0 model buffer size = 8192.00 MiB\nllama_kv_cache: CUDA0 KV buffer size = 512.00 MiB\nllama_memory_recurrent: CUDA0 RS buffer size = 64.00 MiB\nllama_context: CUDA0 compute buffer size = 128.00 MiB';preview.append(el('p',tr('example_note')),evidence(parseLlamaLog(sample)),button('cancel','cancel',clear));};
 box.append(example);
 if(report){
  const confirmLabel=el('label',tr('same'));confirmLabel.htmlFor='resolver-llama-same';const confirm=el('input');confirm.type='checkbox';confirm.id=confirmLabel.htmlFor;confirm.checked=!report.comparisons.some(c=>c.blockers.includes('identity'));
  confirm.onchange=()=>onSame(confirm.checked);
  box.append(el('h4',tr('attached')),confirmLabel,confirm,evidence(report),button('clear','clear',onClear));
 }
 const guide=el('a',tr('guide'));guide.href=guideURL;guide.target='_blank';guide.rel='noopener';box.append(guide);
 return box;
}
