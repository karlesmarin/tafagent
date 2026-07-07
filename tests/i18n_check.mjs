// i18n integrity lint for the TAF Agent.
// Fails (exit 1) if any of these is true — each shows raw "key.names" or wrong
// language to community users:
//   1. Language key-sets diverge (a key in `en` missing from es/fr/zh, or orphan).
//   2. A duplicate key inside one language block (silent last-wins overwrite).
//   3. A key referenced in code (t / tFmt / data-i18n) that is absent from `en`.
// Run:  node tests/i18n_check.mjs
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TRANSLATIONS } from "../js/i18n.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const JS_DIR = join(HERE, "..", "js");
const ROOT = join(HERE, "..");
let problems = 0;
const fail = (msg) => { console.log("  ✗", msg); problems++; };

const langs = Object.keys(TRANSLATIONS);
const enKeys = new Set(Object.keys(TRANSLATIONS.en));

// ── 1. Parity ──────────────────────────────────────────────────────────────
console.log("\n[1] Language parity (reference = en, %d keys)", enKeys.size);
for (const lang of langs) {
  if (lang === "en") continue;
  const keys = new Set(Object.keys(TRANSLATIONS[lang]));
  const missing = [...enKeys].filter(k => !keys.has(k));
  const orphan = [...keys].filter(k => !enKeys.has(k));
  if (missing.length) fail(`${lang}: ${missing.length} key(s) MISSING (in en, not ${lang}): ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? " …" : ""}`);
  if (orphan.length) fail(`${lang}: ${orphan.length} ORPHAN key(s) (in ${lang}, not en): ${orphan.slice(0, 8).join(", ")}${orphan.length > 8 ? " …" : ""}`);
  if (!missing.length && !orphan.length) console.log(`  ✓ ${lang}: ${keys.size} keys, full parity`);
}

// ── 2. Duplicate keys within a single language block (raw-source scan) ───────
console.log("\n[2] Duplicate keys per language block");
const raw = readFileSync(join(JS_DIR, "i18n.js"), "utf8");
// Slice each "  <lang>: {" block up to the next top-level lang or end.
for (let i = 0; i < langs.length; i++) {
  const lang = langs[i];
  const start = raw.search(new RegExp(`\\n  ${lang}:\\s*\\{`));
  if (start < 0) continue;
  const after = raw.slice(start + 1);
  const nextRel = after.search(/\n  (?:en|es|fr|zh):\s*\{/);
  const block = nextRel < 0 ? after : after.slice(0, nextRel);
  const seen = new Map();
  for (const m of block.matchAll(/\n    "([a-zA-Z0-9_.]+)":/g)) {
    seen.set(m[1], (seen.get(m[1]) || 0) + 1);
  }
  const dups = [...seen.entries()].filter(([, c]) => c > 1).map(([k]) => k);
  if (dups.length) fail(`${lang}: ${dups.length} DUPLICATE key(s): ${dups.slice(0, 8).join(", ")}`);
  else console.log(`  ✓ ${lang}: no duplicates`);
}

// ── 3. Code-referenced keys must exist in en ─────────────────────────────────
console.log("\n[3] Code-referenced keys present in en");
const sources = [];
for (const f of readdirSync(JS_DIR)) if (f.endsWith(".js")) sources.push(join(JS_DIR, f));
sources.push(join(ROOT, "index.html"));

const referenced = new Set();
const KEY_RE = /\bt(?:Fmt)?\(\s*["'`]([^"'`$]+)["'`]/g;          // t("..") / tFmt("..") with a plain literal
const ATTR_RE = /data-i18n=["']([^"'$]+)["']/g;                  // data-i18n="..="
for (const file of sources) {
  const txt = readFileSync(file, "utf8");
  for (const m of txt.matchAll(KEY_RE)) referenced.add(m[1]);
  for (const m of txt.matchAll(ATTR_RE)) referenced.add(m[1]);
}

const enKeyArr = [...enKeys];
const isCovered = (k) =>
  enKeys.has(k) ||                                  // exact
  k.endsWith(".") && enKeyArr.some(e => e.startsWith(k)); // dynamic family prefix e.g. "gguf.verdict."
// Real keys are namespaced (contain a dot). Bare single tokens are doc-comment
// examples (e.g. data-i18n="key") or dynamic variables, not real references.
const missingInCode = [...referenced].filter(k => k.includes(".") && !isCovered(k)).sort();
if (missingInCode.length) fail(`${missingInCode.length} referenced key(s) NOT in en: ${missingInCode.slice(0, 15).join(", ")}`);
else console.log(`  ✓ all ${referenced.size} statically-referenced keys resolve in en`);

// ── 4. Demo strings (demo_i18n.js): parity + duplicates + dt() references ────
console.log("\n[4] Demo strings (DEMO_STRINGS) parity + dt() references");
const { DEMO_STRINGS } = await import("../js/demo_i18n.js");
const demoLangs = Object.keys(DEMO_STRINGS);
const demoEnKeys = new Set(Object.keys(DEMO_STRINGS.en));
for (const lang of demoLangs) {
  if (lang === "en") continue;
  const keys = new Set(Object.keys(DEMO_STRINGS[lang]));
  const missing = [...demoEnKeys].filter(k => !keys.has(k));
  const orphan = [...keys].filter(k => !demoEnKeys.has(k));
  if (missing.length) fail(`demo ${lang}: ${missing.length} key(s) MISSING: ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? " …" : ""}`);
  if (orphan.length) fail(`demo ${lang}: ${orphan.length} ORPHAN key(s): ${orphan.slice(0, 8).join(", ")}`);
  if (!missing.length && !orphan.length) console.log(`  ✓ demo ${lang}: ${keys.size} keys, full parity`);
}
// duplicates inside each demo language block (raw scan, same technique as [2])
const demoRaw = readFileSync(join(JS_DIR, "demo_i18n.js"), "utf8");
for (const lang of demoLangs) {
  const start = demoRaw.search(new RegExp(`\\n  ${lang}:\\s*\\{`));
  if (start < 0) continue;
  const after = demoRaw.slice(start + 1);
  const nextRel = after.search(/\n  (?:en|es|fr|zh):\s*\{/);
  const block = nextRel < 0 ? after : after.slice(0, nextRel);
  const seen = new Map();
  for (const m of block.matchAll(/\n    "([a-zA-Z0-9_.]+)":/g)) {
    seen.set(m[1], (seen.get(m[1]) || 0) + 1);
  }
  const dups = [...seen.entries()].filter(([, c]) => c > 1).map(([k]) => k);
  if (dups.length) fail(`demo ${lang}: ${dups.length} DUPLICATE key(s): ${dups.slice(0, 8).join(", ")}`);
  else console.log(`  ✓ demo ${lang}: no duplicates`);
}
// dt("...") references with a plain literal must exist in DEMO_STRINGS.en
const DT_RE = /\bdt\(\s*["'`]([^"'`$]+)["'`]/g;
const demoReferenced = new Set();
for (const file of sources) {
  const txt = readFileSync(file, "utf8");
  for (const m of txt.matchAll(DT_RE)) demoReferenced.add(m[1]);
}
const demoKeyArr = [...demoEnKeys];
const demoCovered = (k) =>
  demoEnKeys.has(k) || (k.endsWith(".") && demoKeyArr.some(e => e.startsWith(k)));
const demoMissing = [...demoReferenced].filter(k => !demoCovered(k)).sort();
if (demoMissing.length) fail(`${demoMissing.length} dt()-referenced key(s) NOT in DEMO_STRINGS.en: ${demoMissing.slice(0, 15).join(", ")}`);
else console.log(`  ✓ all ${demoReferenced.size} dt()-referenced keys resolve in en`);

console.log(`\n==== i18n: ${problems ? problems + " problem(s)" : "all checks passed"} ====`);
process.exit(problems ? 1 : 0);
