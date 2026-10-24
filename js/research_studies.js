// A curated literature index. No inference, performance estimates or TAF validation claims.
export const TOPICS = ["context", "compression", "sinks", "quantization", "memory", "evaluation", "architecture", "training", "numerics"];
export const PUBLICATION_STATUSES = ["published", "accepted", "preprint"];
const LANGS = ["en", "es", "fr", "zh"];
const MODES = ["niah", "longscore", "recipe", "quant", "profile", "depth", "fitcheck", "yarn", "drift", "memreal", "speculative"];
const SOURCE_HOSTS = ["arxiv.org", "proceedings.mlr.press", "aclanthology.org"];
const normalize = value => String(value).normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

export function validateResearchCatalog(catalog) {
  if (catalog?.schema_version !== 1 || catalog.update_policy !== "curated_manual"
      || !/^\d{4}-\d{2}-\d{2}$/.test(catalog.reviewed_on) || !Array.isArray(catalog.papers)) {
    throw new Error("Invalid research catalog");
  }
  const ids = new Set();
  for (const p of catalog.papers) {
    if (!/^[a-z0-9-]+$/.test(p.id) || ids.has(p.id)) throw new Error("Invalid or duplicate paper id");
    ids.add(p.id);
    const source = new URL(p.url);
    if (source.protocol !== "https:" || !SOURCE_HOSTS.includes(source.hostname) || source.username || source.password) {
      throw new Error("Invalid primary-source URL");
    }
    if (!p.title || !p.venue || !/^\d{4}-\d{2}(-\d{2})?$/.test(p.date)
        || p.date > catalog.reviewed_on || !PUBLICATION_STATUSES.includes(p.status)
        || (p.demo !== undefined && !["mhc", "softmax-fix"].includes(p.demo))
        || p.taf_validation !== "not_established" || p.experiment_status !== "proposed_not_run"
        || !Array.isArray(p.topics) || !p.topics.length || p.topics.some(x => !TOPICS.includes(x))
        || !Array.isArray(p.modes) || p.modes.some(x => !MODES.includes(x))
        || !/^\d{2}-[a-z0-9-]+$/.test(p.guide?.chapter) || !/^sec-[a-z0-9-]+$/.test(p.guide?.anchor)) {
      throw new Error(`Invalid paper metadata: ${p.id}`);
    }
    for (const lang of LANGS) {
      for (const field of ["summary", "limit", "experiment"]) {
        if (typeof p.text?.[lang]?.[field] !== "string" || !p.text[lang][field].trim()) {
          throw new Error(`Missing ${lang}/${field}: ${p.id}`);
        }
      }
    }
  }
  return catalog;
}

export function filterResearchStudies(catalog, { query = "", topic = "all", status = "all" } = {}) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return catalog.papers.filter(p => {
    if (topic !== "all" && !p.topics.includes(topic)) return false;
    if (status !== "all" && p.status !== status) return false;
    const haystack = normalize([p.id, p.title, p.venue, p.url, ...p.topics,
      ...Object.values(p.text).flatMap(x => Object.values(x))].join(" "));
    return terms.every(term => haystack.includes(term));
  }).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export function researchGuideUrl(paper, lang) {
  const edition = lang === "es" ? "es" : "en";
  return `https://karlesmarin.github.io/transformers-guide/${edition}/chapters/${paper.guide.chapter}.html#${paper.guide.anchor}`;
}

export function exportResearchSelection(catalog, filters, lang) {
  const language = LANGS.includes(lang) ? lang : "en";
  return {
    schema_version: 1, kind: "taf_research_reading_list",
    reviewed_on: catalog.reviewed_on, update_policy: catalog.update_policy,
    language, filters: { ...filters },
    papers: filterResearchStudies(catalog, filters).map(p => ({
      id: p.id, title: p.title, date: p.date, publication_status: p.status,
      venue: p.venue, source: p.url, guide: researchGuideUrl(p, language),
      topics: [...p.topics], related_modes: [...p.modes],
      ...(p.demo ? { demonstration: { id: p.demo, kind: "pedagogical_not_replication" } } : {}),
      taf_validation: p.taf_validation, experiment_status: p.experiment_status,
      ...p.text[language],
    })),
  };
}
