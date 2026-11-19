import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEMO_STRINGS } from "../js/demo_i18n.js";
import { TRANSLATIONS } from "../js/i18n.js";

const languages = ["en", "es", "fr", "zh"];
const demoKeys = [
  "paper.scope", "profile.s4", "profile.x.gammaLow", "profile.x.gammaHigh",
  "profile.x.gammaFallback", "profile.x.phasePost", "profile.x.diag",
  "profile.x.verif", "diagnose.x.l1", "diagnose.x.l2", "pvr.s2",
  "pvr.x.l1", "pvr.x.l2", "pvr.x.l4", "yarn.x.l2", "yarn.x.l4",
  "inspector.x.l2", "inspector.x.l4", "recipe.x.l1", "recipe.x.l4",
];
const helpKeys = [
  "paper.scope",
  "help.v06.gamma_check.body", "help.v06.gamma_check.validity_gate.body",
  "help.v09.yarn.body", "help.recipe.x19.example", "mode_desc.depth",
  "depth.out.axes_body",
];
for (const language of languages) {
  for (const key of demoKeys) assert.ok(DEMO_STRINGS[language][key]?.trim(), `${language}: ${key}`);
  for (const key of helpKeys) assert.ok(TRANSLATIONS[language][key]?.trim(), `${language}: ${key}`);
}
assert.match(readFileSync(new URL("../js/main.js", import.meta.url), "utf8"), /\.\.\.info\.lines, dt\("paper\.scope"\)/);
assert.doesNotMatch(DEMO_STRINGS.en["inspector.x.l4"], /regime-bounded/);
assert.doesNotMatch(DEMO_STRINGS.en["yarn.x.l2"], /quality actually/);
assert.doesNotMatch(TRANSLATIONS.en["help.v09.yarn.body"], /HEALTHY|NEEDS-FINETUNE/);
console.log("Paper I demo/help scope: 31 shared demo panels and EN/ES/FR/ZH wording PASS");
