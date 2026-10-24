import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateResearchCatalog, filterResearchStudies, researchGuideUrl, exportResearchSelection } from "../js/research_studies.js";
import { TRANSLATIONS } from "../js/i18n.js";

const catalog = JSON.parse(readFileSync(new URL("../data/research_studies.json", import.meta.url), "utf8"));
validateResearchCatalog(catalog);
const before = JSON.stringify(catalog);
assert.equal(catalog.papers.length, 7);
assert.equal(filterResearchStudies(catalog)[0].id, "lurch");
assert.deepEqual(filterResearchStudies(catalog, {topic: "context"}).map(x => x.id), ["lurch", "cre"]);
assert.equal(filterResearchStudies(catalog, {topic: "compression", status: "published"})[0].id, "shotkv");
assert.equal(filterResearchStudies(catalog, {status: "preprint"}).length, 4);
assert.equal(filterResearchStudies(catalog, {status: "accepted"})[0].id, "sinks");
assert.equal(filterResearchStudies(catalog, {query: "valor medio"}).length, 0); // all search terms must match
assert.equal(filterResearchStudies(catalog, {query: "BLOCK-GTQ cuantizacion"})[0].id, "blockgtq");
assert.equal(filterResearchStudies(catalog, {query: "2609.23314"})[0].id, "valuediff");
assert.equal(filterResearchStudies(catalog, {query: "工具 参数", topic: "memory"})[0].id, "mem2act");
assert.equal(filterResearchStudies(catalog, {query: "definitely-no-match"}).length, 0);
assert.equal(JSON.stringify(catalog), before, "Filtering must not mutate the curated evidence");

for (const lang of ["en", "es", "fr", "zh"]) {
  const result = exportResearchSelection(catalog, {topic: "memory"}, lang);
  assert.equal(result.papers.length, 1);
  assert.equal(result.papers[0].summary, catalog.papers.find(p => p.id === "mem2act").text[lang].summary);
  assert.equal(result.papers[0].experiment_status, "proposed_not_run");
  assert.equal(result.papers[0].taf_validation, "not_established");
  assert.equal(result.update_policy, "curated_manual");
  assert.ok(result.papers[0].guide.includes(`/${lang === "es" ? "es" : "en"}/chapters/`));
  for (const paper of catalog.papers) {
    for (const topic of paper.topics) assert.ok(TRANSLATIONS[lang][`research.topic.${topic}`]);
    for (const mode of paper.modes) assert.ok(TRANSLATIONS[lang][`modes.${mode}`]);
  }
}
assert.ok(researchGuideUrl(catalog.papers[0], "fr").endsWith("19-contexto-largo.html#sec-contexto-evidencia"));
assert.equal(exportResearchSelection(catalog, {query: "no-such-study"}, "es").papers.length, 0);

// Invalid evidence must be rejected rather than displayed as verified findings.
for (const mutate of [
  c => c.papers.push(c.papers[0]),
  c => c.papers[0].url = "javascript:alert(1)",
  c => c.papers[0].url = "https://arxiv.org.example.com/fake",
  c => c.papers[0].guide.chapter = "../../private",
  c => c.papers[0].experiment_status = "validated",
  c => c.papers[0].taf_validation = "proven",
  c => c.papers[0].status = "universal_truth",
  c => c.papers[0].date = "2099-01-01",
  c => delete c.papers[0].text.fr.limit,
]) {
  const broken = structuredClone(catalog); mutate(broken);
  assert.throws(() => validateResearchCatalog(broken));
}
console.log("Research catalog: provenance, filters, multilingual export and invalid-evidence rejection PASS");
