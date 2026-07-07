// Language regression test: a Spanish-browser user (locale es-ES, NOTHING in
// localStorage) must see demos AND recipe results in Spanish.
// Born from the 2026-07-07 bug: dt() re-read localStorage (empty for
// navigator-detected languages) and every demo fell back to English.
// Run: node test_lang.mjs   (server on :8000, e.g. python serve.py)
import { chromium } from "playwright";

const BASE = process.env.TAF_URL || "http://127.0.0.1:8000/index.html";
let failures = 0;
const ok = (cond, msg) => { console.log(cond ? "  PASS" : "  FAIL", msg); if (!cond) failures++; };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ locale: "es-ES" });   // Spanish browser, clean storage
const page = await ctx.newPage();

// ── [1] Demo chrome + banners + final card in Spanish (fitcheck demo) ────────
console.log("[1] Demo de Fit Check con navegador en español (sin localStorage)");
await page.goto(BASE + "?demo=fitcheck", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForTimeout(3000);

const btnTip = await page.evaluate(() =>
  document.querySelector("#fitcheck-section .taf-demo-btn")?.title || "");
ok(/simulación guiada/i.test(btnTip), `tooltip del botón demo en ES ("${btnTip}")`);

// capture a mid-run banner
await page.waitForSelector("#__taf_demo_banner", { timeout: 30000 });
await page.waitForTimeout(1200);
const banner = await page.evaluate(() =>
  document.getElementById("__taf_demo_banner")?.innerText || "");
ok(/Paso|Abre|pega|modelo/i.test(banner) && !/Open .*Fit Check|paste your model/i.test(banner),
   `banner de pasos en ES ("${banner.slice(0, 70)}")`);

// wait for the demo to finish (final explain panel)
await page.waitForSelector("#__taf_demo_explain", { timeout: 120000 });
const card = await page.evaluate(() =>
  document.getElementById("__taf_demo_explain")?.innerText || "");
ok(/Lo que acabas de aprender/i.test(card), "tarjeta final: título en ES");
ok(/la mitad|caché KV|presupuesto/i.test(card), "tarjeta final: líneas en ES");
ok(!/What you just learned|half the story/i.test(card), "tarjeta final: sin inglés residual");

// the fitcheck RESULT itself must be Spanish too
const result = await page.evaluate(() =>
  document.getElementById("fitcheck-output")?.innerText || "");
ok(/CABE|NO CABE/i.test(result), `veredicto Fit Check en ES ("${result.slice(0, 60)}")`);

// ── [2] Recipe X-2 (Python) result in Spanish via Profile ───────────────────
console.log("[2] Profile → receta X-2 con resultados de Python en español");
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
await page.click(`[data-mode-link="profile"]`);
// wait for Pyodide to be ready (status bar reports it)
await page.waitForFunction(
  () => /listo|ready|✅/i.test(document.getElementById("status-bar")?.innerText || ""),
  { timeout: 180000 });
await page.fill("#profile-hf-id", "meta-llama/Meta-Llama-3-8B");
await page.click("#profile-fetch-btn");
await page.waitForTimeout(5000);
await page.click("#profile-btn");
await page.waitForFunction(
  () => /d_horizon|γ/i.test(document.getElementById("profile-box")?.innerText || ""),
  { timeout: 120000 });
// open every accordion so innerText sees the whole card (chains included)
await page.evaluate(() =>
  document.querySelectorAll("#profile-box details").forEach(d => { d.open = true; }));
await page.waitForTimeout(400);
const profileText = await page.evaluate(() =>
  document.getElementById("profile-box")?.innerText || "");
ok(/dentro de d_horizon|No hace falta nada|supera el techo|entre el horizonte|entre d_horizon|colapso geométrico/i.test(profileText),
   "razones/mitigaciones X-2 en ES");
ok(!/inside d_horizon|exceeds NIAH ceiling|None required\./i.test(profileText),
   "sin frases inglesas de X-2 residuales");
ok(/Fase A|Fase B/i.test(profileText), "etiquetas de fase en ES (cadena)");

// X-1 (custom vs API): con los defaults del Profile sale NO (API)
ok(/demasiado lento|break-even en .* meses/i.test(profileText), "razón X-1 en ES");
ok(/Usa la API de/i.test(profileText), "mitigación X-1 en ES");
ok(!/too slow|cheaper for your volume/i.test(profileText), "sin frases inglesas de X-1");

// X-3 (pre-flight $5K): Llama-3-8B sale MEMORY-LIMITED
ok(/no cabe en una sola|El presupuesto solo da|Nivel de capacidad/i.test(profileText),
   "razón X-3 en ES");
ok(/Usa ZeRO-3 en varias GPUs|fine-tuning LoRA|receta Chinchilla-óptima/i.test(profileText),
   "mitigación X-3 en ES");
ok(!/doesn't fit one|Budget supports only|Capability tier/i.test(profileText),
   "sin frases inglesas de X-3");

// X-5 (hardware para servir): sale YES
ok(/Mejor GPU:|Ninguna GPU individual/i.test(profileText), "razón X-5 en ES");
ok(/Aprovisiona|paralelismo tensorial/i.test(profileText), "mitigación X-5 en ES");
ok(!/Best GPU:|your daily target|No single GPU has/i.test(profileText),
   "sin frases inglesas de X-5");

// X-19 (compresión KV): Llama-3-8B sale USE SOFT DECAY (caveat)
ok(/Solo decay suave|zona de compresión|El truncado duro|fuera de la Fase A|Limita el contexto/i.test(profileText),
   "razón X-19 en ES");
ok(/no uses la ventana D_f|bias aditivo|Fija cache_max_len|heurísticas de la literatura|sin extensión/i.test(profileText),
   "mitigación X-19 en ES");
ok(!/Soft decay only\.|compression zone|Our formulas don't apply|Cap context at/i.test(profileText),
   "sin frases inglesas de X-19");
// (las interpretaciones de cadena no se renderizan en el profile-box — solo
// reason/action por tile; las cadenas se cubren en el modo Recipes.)

// ── [3] dt() resolves per browser locale in all 4 languages ─────────────────
console.log("[3] Resolución de idioma de las demos por locale del navegador");
const EXPECT = {
  "en-US": /guided simulation/i,
  "fr-FR": /simulation guidée/i,
  "zh-CN": /引导式演示/,
};
for (const [locale, re] of Object.entries(EXPECT)) {
  const c2 = await browser.newContext({ locale });
  const p2 = await c2.newPage();
  await p2.goto(BASE, { waitUntil: "domcontentloaded", timeout: 90000 });
  await p2.click(`[data-mode-link="profile"]`);
  await p2.waitForTimeout(1500);
  const tip = await p2.evaluate(() =>
    document.querySelector("#profile-section .taf-demo-btn")?.title || "");
  ok(re.test(tip), `${locale}: tooltip demo localizado ("${tip.slice(0, 50)}")`);
  await c2.close();
}

await browser.close();
console.log(`\n==== test_lang: ${failures ? failures + " FALLO(S)" : "cada demo en su idioma"} ====`);
process.exit(failures ? 1 : 0);
