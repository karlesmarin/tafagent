import { softmaxRoundoff, residualMix } from './research_lab_math.js';
import { LAB_TEXT } from './research_lab_i18n.js';
const states = new Map();
const node = (tag,text) => { const n=document.createElement(tag); if(text!==undefined)n.textContent=text; return n; };
const fmt = x => x === 0 ? '0' : x.toExponential(5);
export function mountResearchLab(host, kind, lang='en') {
  if (!['mhc','softmax-fix'].includes(kind)) return;
  const t=LAB_TEXT[lang]||LAB_TEXT.en, mix=kind==='mhc';
  const s=states.get(kind)||{margin:18,alpha:.3,steps:4,angle:35,gain:false}; states.set(kind,s);
  host.replaceChildren(); host.classList.add('research-lab'); host.lang=LAB_TEXT[lang]?lang:'en';
  host.append(node('h4',t[mix?'mhc':'softmax']),node('p',t[mix?'introMix':'introSoft']));
  const controls=node('div'); controls.className='research-lab-controls'; host.append(controls);
  const inputs=[];
  function slider(key,min,max,step) {
    const label=node('label'), caption=node('span'), input=node('input');
    input.type='range'; input.min=min;input.max=max;input.step=step;input.value=s[key]; input.setAttribute('aria-label',t[key]);
    const update=()=>{caption.textContent=`${t[key]}: ${s[key]}`;}; update();
    input.addEventListener('input',()=>{s[key]=Number(input.value);update();render();});
    label.append(caption,input); controls.append(label); inputs.push(()=>{input.value=s[key];update();});
  }
  if(mix){slider('alpha',0,1,.05);slider('steps',0,30,1);slider('angle',-180,180,5);
    const label=node('label'),check=node('input');check.type='checkbox';check.checked=s.gain;
    check.addEventListener('change',()=>{s.gain=check.checked;render();}); label.append(check,document.createTextNode(t.gain));controls.append(label);
    inputs.push(()=>{check.checked=s.gain;});
  }else slider('margin',0,40,.5);
  const reset=node('button',t.reset);reset.type='button';reset.addEventListener('click',()=>{
    Object.assign(s,{margin:18,alpha:.3,steps:4,angle:35,gain:false});inputs.forEach(f=>f());render();
  });controls.append(reset);
  const output=node('div');output.className='research-lab-output';output.setAttribute('aria-live','polite');host.append(output);
  host.append(node('p',t[mix?'nextMix':'nextSoft']),node('p',t[mix?'limitMix':'limitSoft']));
  function pair(dl,key,value){dl.append(node('dt',key),node('dd',value));}
  function render(){
    output.replaceChildren();const dl=node('dl');
    if(!mix){const r=softmaxRoundoff(s.margin);
      pair(dl,t.ordinary,fmt(r.ordinary));pair(dl,t.stable,fmt(r.stable));pair(dl,t.reference,fmt(r.reference));
      pair(dl,`${t.sum} · q − 1`,fmt(r.sumOrdinary));pair(dl,`${t.sum} · ${t.stable}`,fmt(r.sumStable));
    }else{
      const r=residualMix(s.alpha,s.steps,s.gain?1.1:1);
      const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
      svg.setAttribute('viewBox','0 0 420 250');svg.setAttribute('role','img');svg.setAttribute('aria-label',t.chart);
      // Fixed axes. Auto-scale is explicitly reported to avoid hiding amplification.
      const scale=Math.max(1,...r.points.flat().map(Math.abs)),a=s.angle*Math.PI/180;
      const project=([x,y,z])=>[210+100*(Math.cos(a)*x-Math.sin(a)*y)/scale,190-100*(z+.4*(Math.sin(a)*x+Math.cos(a)*y))/scale];
      const origin=project([0,0,0]);
      function line(p,color,label,labelOffset=0){const end=project(p),l=document.createElementNS(ns,'line');
        for(const [k,v] of Object.entries({x1:origin[0],y1:origin[1],x2:end[0],y2:end[1],stroke:color,'stroke-width':3})) l.setAttribute(k,v);
        const c=document.createElementNS(ns,'circle');c.setAttribute('cx',end[0]);c.setAttribute('cy',end[1]);c.setAttribute('r',5);c.setAttribute('fill',color);
        const text=document.createElementNS(ns,'text');text.setAttribute('x',end[0]+7);text.setAttribute('y',end[1]-7-labelOffset);text.setAttribute('fill','currentColor');text.textContent=label;svg.append(l,c,text);}
      [[scale,0,0],[0,scale,0],[0,0,scale]].forEach((p,i)=>line(p,'#888',['x','y','z'][i]));
      r.points.forEach((p,i)=>line(p,['#0072B2','#D55E00','#009E73'][i],String(i+1),i*14));
      output.append(svg);pair(dl,t.matrix,r.matrix.map(row=>row.map(v=>v.toFixed(3)).join('  ')).join('\n'));
      pair(dl,t.norm,(r.norm/r.initialNorm).toFixed(6));pair(dl,t.center,r.centroid.map(x=>x.toFixed(5)).join(', '));
      pair(dl,t.vectors,r.points.map((p,i)=>`${i+1}: (${p.map(x=>x.toFixed(5)).join(', ')})`).join('\n'));
      pair(dl,'x, y, z',`0 … ${scale.toFixed(3)}`);
    }
    output.append(dl);
  }render();
}

export function initGuideResearchLabs(){
  const lang=document.documentElement.lang.slice(0,2);
  document.querySelectorAll('[data-research-lab]').forEach(host=>{
    const details=host.closest('details');
    const mount=()=>{if(!host.dataset.mounted){mountResearchLab(host,host.dataset.researchLab,lang);host.dataset.mounted='true';}};
    if(!details||details.open)mount();
    details?.addEventListener('toggle',()=>{if(details.open)mount();});
  });
}
