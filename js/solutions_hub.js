// Solutions Hub (v0.8.1)
// tafagent as integrator/curator. Pain → tafagent mode (if shipped) +
// external best-of-breed tools. Pure logic — no human strings; main.js
// renders with i18n.

let _hub = null;

export async function loadHub(url = "./data/solutions_hub.json") {
  if (_hub) return _hub;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hub fetch failed: ${res.status}`);
  _hub = await res.json();
  return _hub;
}

export function getHub() { return _hub; }

export function listCategories() {
  if (!_hub) return [];
  return Object.entries(_hub.categories).map(([key, meta]) => ({
    key, ...meta,
    count: _hub.entries.filter(e => e.category === key).length,
  }));
}

export function listEntries(categoryKey = null) {
  if (!_hub) return [];
  return categoryKey
    ? _hub.entries.filter(e => e.category === categoryKey)
    : _hub.entries;
}

// Search across pain + best_for + tool names. Case-insensitive substring.
export function searchEntries(query) {
  if (!_hub || !query) return [];
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return _hub.entries.filter(e => {
    const haystack = [
      e.pain || "",
      e.best_for || "",
      e.not_for || "",
      e.tafagent_mode || "",
      ...(e.external_tools || []).map(t => t.name || ""),
    ].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}

export function getCategoryMeta(key) {
  return _hub?.categories?.[key] || null;
}

// Stats for the inventory header.
export function hubStats() {
  if (!_hub) return null;
  const entries = _hub.entries;
  const covered = entries.filter(e => e.tafagent_mode).length;
  const planned = entries.filter(e => e.tafagent_planned_mode).length;
  const totalExternal = entries.reduce((acc, e) => acc + (e.external_tools?.length || 0), 0);
  return {
    total: entries.length,
    covered,
    planned,
    externalLinks: totalExternal,
    categories: Object.keys(_hub.categories).length,
    compiled: _hub.compiled,
  };
}
