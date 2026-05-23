import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8000/index.html";
const b = await chromium.launch({ headless: true });
const p = await (await b.newContext()).newPage();
const errors = [];
const benign = s => /Failed to load resource.*40\d|status of 40\d/.test(s);
p.on("console", m => { if (m.type()==="error" && !benign(m.text())) errors.push(`[err] ${m.text()}`); });
p.on("pageerror", e => errors.push(`[pageerror] ${e.message}`));
const log = s => process.stdout.write(s+"\n");
let pass=0, fail=0;
const check=(n,c,x="")=>{ log(`${c?"  OK  ":"  FAIL"} ${n} ${x}`); c?pass++:fail++; };

await p.goto(BASE,{waitUntil:"domcontentloaded",timeout:90000});
await p.waitForTimeout(2500);
await p.click(`.lang-btn[data-lang="en"]`); await p.waitForTimeout(200);
check("module loads, 0 errors", errors.length===0, `(errors=${errors.length})`);

await p.click('[data-mode-link="gguf"]',{timeout:5000}); await p.waitForTimeout(500);
const secVis = await p.evaluate(()=>{const s=document.querySelector("#gguf-section");return s&&getComputedStyle(s).display!=="none";});
check("gguf-section visible after tile click", secVis);

log("\n── List quant files (real repo) ──");
await p.fill("#gguf-repo","Qwen/Qwen2.5-0.5B-Instruct-GGUF");
await p.click("#gguf-list-btn");
await p.waitForTimeout(4000);
const listed = await p.evaluate(()=>{
  const sel=document.querySelector("#gguf-file");
  return { count:sel.options.length, selected:sel.value, disabled:sel.disabled,
           analyzeEnabled:!document.querySelector("#gguf-analyze-btn").disabled,
           status:document.querySelector("#gguf-status").innerText.slice(0,60) };
});
check("files listed in dropdown", listed.count>0, `(${listed.count} files)`);
check("Q4_K_M auto-selected", /q4_k_m/i.test(listed.selected), listed.selected);
check("analyze button enabled", listed.analyzeEnabled);

log("\n── Analyze GGUF (parse header + verdict) ──");
await p.click("#gguf-analyze-btn");
await p.waitForTimeout(8000); // range fetch + parse
const r = await p.evaluate(()=>{
  const o=document.querySelector("#gguf-output");
  return { vis:getComputedStyle(o).display!=="none",
           verdict:o.querySelector(".verdict-badge")?.innerText?.trim()||"",
           text:o.innerText,
           status:document.querySelector("#gguf-status").innerText };
});
check("output rendered", r.vis && r.text.length>50);
check("verdict present", r.verdict.length>3, r.verdict);
check("shows architecture qwen2", /qwen2/.test(r.text));
check("shows trained context 32K", /32K|32768/.test(r.text), (r.text.match(/Trained context[^\n]*\n?\s*[\w.]+/)||[""])[0].slice(0,40));
check("shows quant Q4_K_M", /Q4_K_M/i.test(r.text));
check("shows γ-shift from quant", /γ-shift|shift/i.test(r.text));
check("shows ΔPPL", /ΔPPL|PPL/.test(r.text));
check("header parsed status (MB)", /MB header|parsed|analizada|analysé|已解析/i.test(r.status), r.status.slice(0,50));

log("\n── Target L override ──");
await p.fill("#gguf-target","131072");
await p.click("#gguf-analyze-btn");
await p.waitForTimeout(7000);
const r2 = await p.evaluate(()=>document.querySelector("#gguf-output .verdict-badge")?.innerText?.trim());
check("re-analyze with L=131072", r2.length>3, r2);

log("\n── Compare all quants (one header parse → full table) ──");
await p.click("#gguf-all-btn");
await p.waitForTimeout(7000);
const cmp = await p.evaluate(()=>{
  const o=document.querySelector("#gguf-output");
  const rows=[...o.querySelectorAll("table tr")];
  const dataRows=rows.slice(1); // minus header
  return { title:o.querySelector("h3")?.innerText,
           rowCount:dataRows.length,
           quants:dataRows.map(r=>r.querySelector("code")?.innerText).filter(Boolean),
           hasShift:/−0\.|—/.test(o.innerText),
           hasVerdictCol:rows[0]?.innerText?.includes("Verdict") };
});
check("comparison table rendered", cmp.rowCount>=3, `(${cmp.rowCount} rows)`);
check("lists multiple quant labels", cmp.quants.length>=3, cmp.quants.join(", "));
check("has verdict column", cmp.hasVerdictCol, cmp.title);
check("rows sorted best→worst (Q8 before Q2)", (()=>{
  const i8=cmp.quants.findIndex(q=>/Q8/.test(q)), i2=cmp.quants.findIndex(q=>/Q2/.test(q));
  return i8<0||i2<0||i8<i2;})(), cmp.quants.join(" > "));
// Verdicts must vary across quants (regression guard: a hard d_horizon gate
// once forced every row to DEGRADES even when γ@L was healthy).
const verdicts = await p.evaluate(()=>[...document.querySelectorAll("#gguf-output table tr")].slice(1).map(r=>r.lastElementChild?.innerText?.trim()));
check("verdicts vary across quants (not all identical)", new Set(verdicts).size>=2, verdicts.join(" | "));
// γ@L must DECREASE for worse quants (Q8 γ@L > Q2 γ@L).
const gammas = await p.evaluate(()=>[...document.querySelectorAll("#gguf-output table tr")].slice(1).map(r=>parseFloat(r.children[2]?.innerText)));
check("γ@L decreases for worse quant", gammas[0] > gammas[gammas.length-1], `${gammas[0]} → ${gammas[gammas.length-1]}`);

log("\n── 4-language verdict ──");
for (const lang of ["es","fr","zh","en"]) {
  await p.click(`.lang-btn[data-lang="${lang}"]`); await p.waitForTimeout(300);
  const label = await p.evaluate(()=>document.querySelector('.mode-btn[data-mode="gguf"]')?.textContent?.trim());
  check(`${lang}: tab label localized`, label && label.length>3, label);
}

log("\n── Error path: bad repo ──");
await p.click(`.lang-btn[data-lang="en"]`); await p.waitForTimeout(200);
await p.fill("#gguf-repo","this/definitely-not-a-real-repo-xyz123");
await p.click("#gguf-list-btn");
await p.waitForTimeout(3000);
const errStatus = await p.evaluate(()=>document.querySelector("#gguf-status").innerText);
check("bad repo → error message", /❌|not found|HTTP/i.test(errStatus), errStatus.slice(0,50));

log(`\n=== ${pass} passed, ${fail} failed · JS errors: ${errors.length} ===`);
errors.slice(0,10).forEach(e=>log(e));
await b.close();
process.exit(fail>0?1:0);
