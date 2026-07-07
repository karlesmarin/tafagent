import { chromium } from "playwright";

const BASE = process.env.TAF_URL || "http://127.0.0.1:8000/index.html";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const errors = [];
page.on("console", m => { if (m.type() === "error") errors.push(`[console.error] ${m.text()}`); });
page.on("pageerror", e => errors.push(`[pageerror] ${e.message}`));

const log = s => process.stdout.write(s + "\n");

log(`=== SWEEP: ${BASE} ===`);
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(2500);

// Landing shows tiles; reveal #mode-section by clicking a tile entry link.
await page.click(`[data-mode-link="profile"]`, { timeout: 8000 });
await page.waitForTimeout(500);
const sectionVisible = await page.evaluate(() => {
  const s = document.querySelector("#mode-section");
  if (!s) return "missing";
  return getComputedStyle(s).display !== "none" ? "visible" : "hidden";
});
log(`#mode-section after tile click: ${sectionVisible}`);

const modes = await page.$$eval(".mode-btn[data-mode]", els => els.map(e => e.getAttribute("data-mode")));
log(`Modes found: ${modes.length}`);

log("\n--- Mode sweep (JS-dispatched click; verify active tab + pane render) ---");
for (const mode of modes) {
  const before = errors.length;
  const r = await page.evaluate((m) => {
    const btn = document.querySelector(`.mode-btn[data-mode="${m}"]`);
    if (!btn) return { ok:false, why:"btn-missing" };
    btn.scrollIntoView({ block: "center" });
    btn.click();
    return { clicked:true };
  }, mode);
  await page.waitForTimeout(400);
  const state = await page.evaluate((m) => {
    const active = document.querySelector(".mode-btn.active");
    const sec = document.querySelector(`#${m}-section`);
    const vis = sec ? getComputedStyle(sec).display !== "none" : null;
    const txt = sec ? (sec.innerText || "").trim().length : -1;
    return { active: active ? active.getAttribute("data-mode") : null, secExists: !!sec, vis, txt };
  }, mode);
  const newErr = errors.length - before;
  const ok = r.clicked && state.active === mode && state.secExists && state.vis && state.txt > 0 && newErr === 0;
  log(`${ok ? "OK  " : "FAIL"} ${mode.padEnd(14)} active=${state.active} sec=${state.secExists?(state.vis?"vis":"HIDDEN"):"MISSING"} errs:+${newErr} text:${state.txt}b ${r.why||""}`);
}

log("\n--- Language sweep ---");
for (const lang of ["es", "fr", "zh", "en"]) {
  const before = errors.length;
  try {
    await page.click(`.lang-btn[data-lang="${lang}"]`, { timeout: 5000 });
    await page.waitForTimeout(350);
    log(`${lang}: +${errors.length - before} errs`);
  } catch (e) {
    log(`${lang}: EXC ${e.message.split("\n")[0].slice(0,60)}`);
  }
}

log(`\n=== TOTAL JS ERRORS: ${errors.length} ===`);
errors.slice(0, 50).forEach(e => log(e));
await browser.close();
