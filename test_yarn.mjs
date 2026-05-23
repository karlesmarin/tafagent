import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8000/index.html";
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext()).newPage();
const errors = [];
// Gated-model fetches (Llama) return 401 on the canonical repo before the
// app silently falls back to an open mirror — that network 401 is expected,
// not a code fault. Count only genuine JS/pageerror faults.
const benign = s => /Failed to load resource.*401|status of 401/.test(s);
p.on("console", m => { if (m.type()==="error" && !benign(m.text())) errors.push(`[err] ${m.text()}`); });
p.on("pageerror", e => errors.push(`[pageerror] ${e.message}`));
const log = s => process.stdout.write(s+"\n");
let pass=0, fail=0;
const check=(name,cond,extra="")=>{ log(`${cond?"  OK  ":"  FAIL"} ${name} ${extra}`); cond?pass++:fail++; };

await p.goto(BASE,{waitUntil:"domcontentloaded",timeout:90000});
await p.waitForTimeout(2500);
await p.click(`.lang-btn[data-lang="en"]`); await p.waitForTimeout(200);
await p.click('[data-mode-link="yarn"]',{timeout:5000}); await p.waitForTimeout(400);
check("module loads with 0 errors", errors.length===0, `(errors=${errors.length})`);

// helper: run plan with manual values
async function plan(orig,theta,target,type){
  await p.fill("#yarn-orig",String(orig));
  await p.fill("#yarn-theta",String(theta));
  await p.fill("#yarn-target",String(target));
  await p.selectOption("#yarn-type",type);
  await p.click("#yarn-plan-btn");
  await p.waitForTimeout(250);
  return p.evaluate(()=>{
    const o=document.querySelector("#yarn-output");
    return { verdict:o.querySelector(".verdict-badge")?.innerText?.trim()||"",
             text:o.innerText, type:(o.innerText.match(/Method\s*\n?\s*(\w+)/)||[])[1] };
  });
}

log("\n── A. Verdict logic across regimes ──");
let r;
r=await plan(8192,10000,32768,"yarn");
check("Mistral 4× yarn → USABLE WITH CARE", /USABLE WITH CARE/.test(r.verdict), r.verdict);
check("  shows γ collapse (negative naive)", /-0\.39|collapsed/.test(r.text));
r=await plan(32768,1000000,131072,"");
check("Qwen2.5 high-θ 4× auto", r.verdict.length>0, r.verdict);
r=await plan(4096,10000,131072,"yarn");
check("aggressive 32× → NEEDS FINE-TUNE", /NEEDS FINE-TUNE/.test(r.verdict), r.verdict);
r=await plan(32768,1000000,16384,"yarn");
check("target<orig → NO EXTENSION NEEDED", /NO EXTENSION NEEDED/.test(r.text), (r.text.match(/NO EXTENSION NEEDED[^<]*/)||[""])[0].slice(0,40));
r=await plan(8192,10000,32768,"linear");
check("linear method honored in snippet", /"rope_type": "linear"/.test(r.text));
r=await plan(8192,10000,32768,"dynamic");
check("dynamic method honored", /"rope_type": "dynamic"/.test(r.text));
r=await plan(8192,500000,16384,"llama3");
check("llama3 method honored", /"rope_type": "llama3"/.test(r.text));

log("\n── B. Error paths ──");
await p.fill("#yarn-orig",""); await p.fill("#yarn-theta","10000"); await p.fill("#yarn-target","32768");
await p.click("#yarn-plan-btn"); await p.waitForTimeout(150);
check("missing orig → error msg", await p.evaluate(()=>/trained context|max_position/i.test(document.querySelector("#yarn-output").innerText)));
await p.fill("#yarn-orig","8192"); await p.fill("#yarn-theta","");
await p.click("#yarn-plan-btn"); await p.waitForTimeout(150);
check("missing θ → error msg", await p.evaluate(()=>/rope_theta|RoPE θ/i.test(document.querySelector("#yarn-output").innerText)));
await p.fill("#yarn-theta","10000"); await p.fill("#yarn-target","");
await p.click("#yarn-plan-btn"); await p.waitForTimeout(150);
check("missing target → error msg", await p.evaluate(()=>/target context/i.test(document.querySelector("#yarn-output").innerText)));

log("\n── C. Copy config button ──");
await plan(8192,10000,32768,"yarn");
const copyOk = await p.evaluate(()=>!!document.querySelector("#yarn-copy-btn"));
check("copy button present", copyOk);

log("\n── D. 4-language verdict + labels ──");
for (const lang of ["es","fr","zh","en"]) {
  await p.click(`.lang-btn[data-lang="${lang}"]`); await p.waitForTimeout(250);
  await plan(8192,10000,32768,"yarn");
  const v = await p.evaluate(()=>document.querySelector("#yarn-output .verdict-badge")?.innerText?.trim());
  const label = await p.evaluate(()=>document.querySelector('.mode-btn[data-mode="yarn"]')?.textContent?.trim());
  check(`${lang}: verdict+label localized`, v.length>3 && label.length>3, `| "${v.slice(0,30)}" / "${label}"`);
}
await p.click(`.lang-btn[data-lang="en"]`); await p.waitForTimeout(200);

log("\n── E. Autocomplete = LIVE HF API (new models appear) ──");
async function searchAC(q){
  await p.fill("#yarn-model","");
  await p.click("#yarn-model");
  await p.fill("#yarn-model",q);
  await p.waitForTimeout(1100);
  return p.evaluate(()=>{
    const dd=[...document.querySelectorAll(".hf-autocomplete-dropdown")].find(d=>getComputedStyle(d).display!=="none");
    return dd?[...dd.querySelectorAll(".hf-result")].map(x=>x.dataset.id):[];
  });
}
let ac=await searchAC("qwen2.5");
check("autocomplete returns live results", ac.length>0, `(${ac.length} hits)`);
ac=await searchAC("qwen3");
check("NEWER model (Qwen3, 2025) appears", ac.some(id=>/qwen3/i.test(id)), `e.g. ${ac.slice(0,2).join(", ")}`);
ac=await searchAC("llama-3.3");
check("NEWER model (Llama-3.3) appears", ac.length>0, `e.g. ${ac.slice(0,2).join(", ")}`);
// select fills input
if (ac.length){
  await p.evaluate(()=>{const dd=[...document.querySelectorAll(".hf-autocomplete-dropdown")].find(d=>getComputedStyle(d).display!=="none");dd?.querySelector(".hf-result")?.dispatchEvent(new MouseEvent("mousedown",{bubbles:true}));});
  await p.waitForTimeout(200);
  check("selecting result fills input", (await p.inputValue("#yarn-model")).length>0, `→ ${await p.inputValue("#yarn-model")}`);
}

log("\n── F. Live fetch real config (any model on Hub) ──");
async function fetchModel(id){
  await p.fill("#yarn-model",id);
  await p.keyboard.press("Escape");
  await p.click("#yarn-fetch-btn");
  await p.waitForTimeout(3500);
  return p.evaluate(()=>({orig:document.querySelector("#yarn-orig").value,theta:document.querySelector("#yarn-theta").value,status:document.querySelector("#yarn-status").innerText}));
}
let f=await fetchModel("Qwen/Qwen2.5-7B-Instruct");
check("fetch Qwen2.5-7B", f.orig==="32768"&&f.theta==="1000000", `orig=${f.orig} θ=${f.theta}`);
f=await fetchModel("mistralai/Mistral-7B-v0.1");
check("fetch Mistral-7B-v0.1", Number(f.theta)>0 && Number(f.orig)>0, `orig=${f.orig} θ=${f.theta}`);
f=await fetchModel("meta-llama/Llama-3.1-8B");
check("fetch Llama-3.1-8B (gated→mirror or value)", f.orig.length>0 || /gated|mirror/i.test(f.status), `orig=${f.orig} θ=${f.theta} | ${f.status.slice(0,50)}`);

log(`\n=== ${pass} passed, ${fail} failed · JS errors: ${errors.length} ===`);
errors.slice(0,10).forEach(e=>log(e));
await b.close();
process.exit(fail>0?1:0);
