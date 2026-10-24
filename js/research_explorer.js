import { getLang, t } from "./i18n.js";
import { TOPICS, PUBLICATION_STATUSES, validateResearchCatalog, filterResearchStudies,
  researchGuideUrl, exportResearchSelection } from "./research_studies.js";

const $ = id => document.getElementById(id);
let catalog = null, pending = null, bound = false, failed = false;
const openCards = new Set();
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
function filters() {
  return { query: $("research-search").value, topic: $("research-topic").value, status: $("research-publication").value };
}
function externalLink(label, url) {
  const node = el("a", label);
  node.href = url; node.target = "_blank"; node.rel = "noopener noreferrer";
  return node;
}
function populateOptions(id, values, key) {
  const select = $(id), selected = select.value;
  select.replaceChildren();
  for (const value of ["all", ...values]) {
    const option = el("option", t(value === "all" ? "research.all" : `${key}.${value}`));
    option.value = value; select.appendChild(option);
  }
  select.value = ["all", ...values].includes(selected) ? selected : "all";
}

export function refreshResearchExplorer() {
  if (!bound) return;
  populateOptions("research-topic", TOPICS, "research.topic");
  populateOptions("research-publication", PUBLICATION_STATUSES, "research.status");
  const output = $("research-output"), status = $("research-status");
  $("research-export").disabled = true;
  $("research-retry").hidden = !failed;
  if (!catalog) {
    status.textContent = t(failed ? "research.error" : "research.loading");
    return;
  }
  $("research-reviewed").textContent = `${t("research.reviewed")} ${catalog.reviewed_on}`;
  const matches = filterResearchStudies(catalog, filters());
  status.textContent = t("research.count").replace("{shown}", matches.length).replace("{total}", catalog.papers.length);
  output.replaceChildren();
  $("research-export").disabled = !matches.length;
  if (!matches.length) {
    output.appendChild(el("p", t("research.empty"), "research-empty"));
    return;
  }
  const lang = getLang();
  $("research-section").lang = lang;
  for (const paper of matches) {
    const card = el("article", undefined, "research-card");
    card.dataset.paper = paper.id;
    const meta = el("div", undefined, "research-meta");
    meta.append(el("span", t(`research.status.${paper.status}`), `research-badge research-${paper.status}`),
      el("span", `${paper.venue} · ${paper.date}`));
    const heading = el("h3", paper.title); heading.lang = "en";
    const tags = el("p", paper.topics.map(topic => t(`research.topic.${topic}`)).join(" · "), "subtle");
    card.append(meta, heading, tags, el("p", paper.text[lang].summary));
    const details = el("details");
    details.open = openCards.has(paper.id);
    details.appendChild(el("summary", t("research.details")));
    const description = el("dl");
    description.append(el("dt", t("research.limit")), el("dd", paper.text[lang].limit),
      el("dt", t("research.experiment")), el("dd", paper.text[lang].experiment));
    details.appendChild(description);
    details.addEventListener("toggle", () => {
      // Removed DOM nodes can emit queued toggle events during a language refresh.
      if (!details.isConnected) return;
      if (details.open) openCards.add(paper.id); else openCards.delete(paper.id);
    });
    const links = el("div", undefined, "research-links");
    links.append(externalLink(t("research.paper"), paper.url), externalLink(t("research.guide"), researchGuideUrl(paper, lang)));
    card.append(details, links);
    if (paper.modes.length) {
      const modes = el("div", undefined, "research-tools");
      modes.appendChild(el("p", t("research.tools"), "subtle"));
      for (const mode of paper.modes) {
        const button = el("button", t(`modes.${mode}`), "secondary");
        button.type = "button"; button.dataset.modeLink = mode;
        modes.appendChild(button);
      }
      card.appendChild(modes);
    }
    output.appendChild(card);
  }
}

export function initResearchExplorer() {
  if (!$("research-section")) return Promise.resolve();
  if (!bound) {
    bound = true;
    $("research-search").addEventListener("input", refreshResearchExplorer);
    for (const id of ["research-topic", "research-publication"]) $(id).addEventListener("change", refreshResearchExplorer);
    $("research-clear").addEventListener("click", () => {
      $("research-search").value = "";
      $("research-topic").value = "all"; $("research-publication").value = "all";
      refreshResearchExplorer();
    });
    $("research-retry").addEventListener("click", () => initResearchExplorer());
    $("research-export").addEventListener("click", () => {
      if (!catalog) return;
      try {
        const data = exportResearchSelection(catalog, filters(), getLang());
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = el("a"); a.href = url; a.download = `taf-studies-${catalog.reviewed_on}-${getLang()}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch {
        $("research-status").textContent = t("research.export_error");
      }
    });
  }
  if (catalog) { refreshResearchExplorer(); return Promise.resolve(); }
  if (pending) return pending;
  failed = false;
  refreshResearchExplorer();
  pending = (async () => {
    try {
      const response = await fetch(new URL("../data/research_studies.json", import.meta.url));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      catalog = validateResearchCatalog(await response.json());
    } catch {
      failed = true;
    } finally {
      pending = null;
      refreshResearchExplorer();
    }
  })();
  return pending;
}
