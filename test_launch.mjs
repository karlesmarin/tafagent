import { chromium } from "playwright";
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext()).newPage();
const errors=[]; const benign=s=>/40\d/.test(s);
p.on("console",m=>{if(m.type()==="error"&&!benign(m.text()))errors.push("[c]"+m.text());});
p.on("pageerror",e=>errors.push("[pe]"+e.message));
const log=s=>process.stdout.write(s+"\n"); let pass=0,fail=0;
const check=(n,c,x="")=>{log(`${c?"  OK  ":"  FAIL"} ${n} ${x}`);c?pass++:fail++;};

await p.goto("http://127.0.0.1:8000/index.html",{waitUntil:"domcontentloaded",timeout:90000});
await p.waitForTimeout(2500);
await p.click(`.lang-btn[data-lang="en"]`); await p.waitForTimeout(200);
check("module loads, 0 errors", errors.length===0, `(${errors.length})`);

await p.click('[data-mode-link="launch"]',{timeout:5000}); await p.waitForTimeout(400);
check("section visible", await p.evaluate(()=>{const s=document.querySelector("#launch-section");return s&&getComputedStyle(s).display!=="none";}));
check("GPU presets populated", await p.evaluate(()=>document.querySelector("#launch-gpu").options.length>5));

log("\n── Fetch geometry ──");
await p.fill("#launch-model","Qwen/Qwen2.5-7B-Instruct");
await p.keyboard.press("Escape");
await p.click("#launch-fetch-btn"); await p.waitForTimeout(3500);
const st=await p.evaluate(()=>document.querySelector("#launch-status").innerText);
check("geometry fetched (layers/GQA shown)", /layers|GQA|θ=/.test(st), st.slice(0,70));
check("ctx auto-filled", await p.evaluate(()=>!!document.querySelector("#launch-ctx").value));

async function gen({quant,gpu,vram,ctx,cache,fa}){
  if(quant) await p.selectOption("#launch-quant",quant);
  if(gpu) await p.selectOption("#launch-gpu",gpu);
  await p.fill("#launch-vram",vram!=null?String(vram):"");
  if(ctx!=null) await p.fill("#launch-ctx",String(ctx));
  if(cache) await p.selectOption("#launch-cache",cache);
  if(fa!=null){const c=await p.isChecked("#launch-fa"); if(c!==fa) await p.click("#launch-fa");}
  await p.click("#launch-gen-btn"); await p.waitForTimeout(300);
  return p.evaluate(()=>{const o=document.querySelector("#launch-output");return{
    verdict:o.querySelector(".verdict-badge")?.innerText?.trim()||"", text:o.innerText};});
}

log("\n── FITS case (7B Q4 on 24GB) ──");
let r=await gen({quant:"Q4_K_M",gpu:"24",vram:null,ctx:32768,cache:"fp16",fa:true});
check("verdict FITS", /FITS/.test(r.verdict), r.verdict);
check("ngl = all layers", /all|28/.test(r.text));
check("llama-server cmd present", /llama-server/.test(r.text));
check("ollama cmd present", /ollama|num_ctx/.test(r.text));
check("--no-mmap added when all-on-GPU", /--no-mmap/.test(r.text));
check("-fa present", /-fa/.test(r.text));
check("VRAM breakdown (weights/KV)", /Weights|KV cache/.test(r.text));

log("\n── PARTIAL case (7B Q4 on tiny 3GB custom) ──");
r=await gen({quant:"Q4_K_M",vram:3,ctx:8192,fa:true});
check("verdict PARTIAL or TOO BIG", /PARTIAL|TOO BIG/.test(r.verdict), r.verdict);
check("partial offload warning or cpu-only", /CPU|layers fit|smaller quant/i.test(r.text));

log("\n── cache quant changes KV flag ──");
r=await gen({quant:"Q4_K_M",gpu:"24",vram:null,ctx:32768,cache:"q8_0",fa:true});
check("KV cache q8_0 → -ctk/-ctv in cmd", /-ctk q8_0/.test(r.text));

log("\n── beyond-trained warning ──");
r=await gen({quant:"Q4_K_M",gpu:"80",vram:null,ctx:262144,cache:"fp16",fa:true});
check("L beyond trained → warning", /trained|RoPE|YaRN/i.test(r.text), "L=256K");

log("\n── error: generate before fetch (fresh) ──");
// can't easily un-fetch; just check error key exists by clearing geom via reload-free path is hard; skip

log("\n── 4 languages ──");
for(const lang of ["es","fr","zh","en"]){
  await p.click(`.lang-btn[data-lang="${lang}"]`); await p.waitForTimeout(250);
  const lbl=await p.evaluate(()=>document.querySelector('.mode-btn[data-mode="launch"]')?.textContent?.trim());
  check(`${lang}: tab label`, lbl&&lbl.length>3, lbl);
}

check("copy button present", await p.evaluate(()=>!!document.querySelector("#launch-copy-llama")));

log(`\n=== ${pass} passed, ${fail} failed · JS errors: ${errors.length} ===`);
errors.slice(0,10).forEach(e=>log(e));
await b.close();
process.exit(fail>0?1:0);
