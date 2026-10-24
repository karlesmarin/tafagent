// HF Hub autocomplete — wraps any text input with a search-as-you-type
// dropdown that hits https://huggingface.co/api/models. Browser-only, no auth.
//
// Usage:
//   import { attachHfAutocomplete } from "./hf_autocomplete.js";
//   attachHfAutocomplete(document.getElementById("my-id-input"), {
//     pipeline: "text-generation",   // filter (or null for all)
//     onSelect: (id) => { ... },
//   });
//
// Idempotent: calling twice on same input is a no-op.

const ATTACHED = new WeakSet();
let nextDropdownId = 0;

// LRU-ish cache: same query within 5 min → no extra fetch. Reduces HF API
// pressure by ~50% for users who delete/retype, and shields us from rate limits.
const CACHE = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 50;

function cacheGet(q) {
  const e = CACHE.get(q);
  if (!e) return null;
  if (Date.now() - e.t > CACHE_TTL_MS) { CACHE.delete(q); return null; }
  CACHE.delete(q); CACHE.set(q, e); // re-insert = LRU bump
  return e.r;
}
function cacheSet(q, r) {
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(q, { r, t: Date.now() });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function formatDownloads(n) {
  if (n === null || n === undefined) return "?";
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

export function attachHfAutocomplete(inputEl, options = {}) {
  if (!inputEl || ATTACHED.has(inputEl)) return;
  ATTACHED.add(inputEl);
  inputEl.setAttribute("data-hf-ac", "1"); // visible marker: this input has the autocomplete dropdown

  const {
    pipeline = "text-generation",
    limit = 15,
    debounceMs = 300,
    minChars = 2,
    onSelect = null,
    messages = null,
    dropdownClass = "",
  } = options;

  // Floating dropdown attached to body so it never gets clipped by parents.
  const dropdown = document.createElement("div");
  dropdown.className = "hf-autocomplete-dropdown";
  if (dropdownClass) dropdown.classList.add(dropdownClass);
  dropdown.id = `hf-model-options-${++nextDropdownId}`;
  dropdown.setAttribute("role", "listbox");
  inputEl.setAttribute("role", "combobox");
  inputEl.setAttribute("aria-autocomplete", "list");
  inputEl.setAttribute("aria-controls", dropdown.id);
  inputEl.setAttribute("aria-expanded", "false");
  inputEl.autocomplete = "off";
  dropdown.style.display = "none";
  document.body.appendChild(dropdown);

  let timeoutId = null;
  let activeIndex = -1;
  let results = [];
  let lastQuery = "";
  let generation = 0;

  function positionDropdown() {
    const rect = inputEl.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom - 8;
    const above = below < 160 && rect.top > below;
    const height = Math.max(40, Math.min(320, above ? rect.top - 8 : below));
    dropdown.style.position = "fixed";
    dropdown.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) + "px";
    dropdown.style.width = width + "px";
    dropdown.style.maxHeight = height + "px";
    dropdown.style.top = (above ? Math.max(8, rect.top - Math.min(dropdown.scrollHeight, height) - 2) : rect.bottom + 2) + "px";
    dropdown.style.zIndex = "10000";
  }

  function render(notice = null) {
    if (!results.length && !notice) { close(); return; }
    inputEl.setAttribute("aria-expanded", "true");
    if (activeIndex >= 0) inputEl.setAttribute("aria-activedescendant", `${dropdown.id}-${activeIndex}`);
    else inputEl.removeAttribute("aria-activedescendant");
    const rows = results.map((r, i) => `
      <div class="hf-result ${i === activeIndex ? "active" : ""}" id="${dropdown.id}-${i}" role="option" aria-selected="${i === activeIndex}" data-id="${escapeHtml(r.id)}">
        <span class="hf-result-id">${escapeHtml(r.id)}</span>
        <span class="hf-result-meta">⬇ ${formatDownloads(r.downloads)} · ❤ ${formatDownloads(r.likes)}${r.library_name ? " · " + escapeHtml(r.library_name) : ""}</span>
      </div>
    `).join("");
    const noticeHtml = notice ? `<div class="hf-notice" role="status">${escapeHtml(notice)}</div>` : "";
    // Privacy footer (always visible when dropdown is showing).
    const t = (window.__taf_t || (k => null));
    const privacyText = messages?.privacy || t("hf_auto.privacy") || "🔒 Queries sent to huggingface.co/api · cached locally 5 min";
    const privacyHtml = `<div class="hf-privacy">${escapeHtml(privacyText)}</div>`;
    dropdown.innerHTML = rows + noticeHtml + privacyHtml;
    dropdown.style.display = "block";
    positionDropdown();
  }

  function close() {
    dropdown.style.display = "none";
    activeIndex = -1;
    inputEl.setAttribute("aria-expanded", "false");
    inputEl.removeAttribute("aria-activedescendant");
  }

  function pick(id) {
    generation++;
    inputEl.value = id;
    close();
    if (onSelect) onSelect(id);
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function search(q) {
    if (inputEl.disabled || document.activeElement !== inputEl) return;
    // Empty q is allowed: returns top-N most-downloaded models so a focused-but-empty
    // input still shows a useful initial dropdown ("desplegable" UX), not just
    // search-as-you-type. Below minChars but non-empty → wait for more chars.
    if (q && q.length < minChars) { results = []; render(); return; }
    const cacheKey = JSON.stringify([q, pipeline, limit]);
    if (cacheKey === lastQuery) return; // dedupe rapid typing
    lastQuery = cacheKey;
    const request = ++generation;
    const current = () => request === generation && !inputEl.disabled && document.activeElement === inputEl;

    // Cache hit → skip network entirely
    const cached = cacheGet(cacheKey);
    if (cached) { results = cached; activeIndex = -1; render(results.length ? null : messages?.empty); return; }

    const params = new URLSearchParams({
      limit: String(limit),
      sort: "downloads",
      direction: "-1",
    });
    if (q) params.set("search", q);
    if (pipeline) params.set("filter", pipeline);
    results = []; activeIndex = -1;
    render(messages?.loading);
    try {
      const resp = await fetch(`https://huggingface.co/api/models?${params}`);
      if (!current()) return;
      if (resp.status === 429) {
        const t = (window.__taf_t || (k => null));
        results = [];
        lastQuery = "";
        render(messages?.rateLimited || t("hf_auto.rate_limited") || "⚠ HuggingFace rate limit — try again in a moment");
        return;
      }
      if (!resp.ok) { results = []; lastQuery = ""; render(messages?.error); return; }
      const data = await resp.json();
      if (!current()) return;
      results = (Array.isArray(data) ? data : [])
        .filter(r => r.id && typeof r.id === "string")
        .slice(0, limit);
      cacheSet(cacheKey, results);
      activeIndex = -1;
      render(results.length ? null : messages?.empty);
    } catch (e) {
      if (!current()) return;
      results = []; lastQuery = ""; render(messages?.error);
    }
  }

  inputEl.addEventListener("input", (e) => {
    generation++; lastQuery = ""; results = []; close();
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => search(e.target.value.trim()), debounceMs);
  });

  // (Re)open the dropdown on focus AND on click. Two real causes of "only opens once":
  //  (1) clicking an already-focused input fires no `focus` event → handle `click` too;
  //  (2) the dedup guard in search() blocks re-opening with an unchanged value → reset lastQuery.
  // Also cancel any pending blur-close so a quick re-click isn't shut by a stale timeout.
  let blurTimeout = null;
  const reopen = () => {
    clearTimeout(blurTimeout);
    lastQuery = null;
    search(inputEl.value.trim());
  };
  inputEl.addEventListener("focus", reopen);
  inputEl.addEventListener("click", reopen);

  // Click on a result picks it. Use mousedown to fire before input loses focus.
  dropdown.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const item = e.target.closest(".hf-result");
    if (item) pick(item.dataset.id);
  });

  // Keyboard nav
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { generation++; clearTimeout(timeoutId); close(); return; }
    if (dropdown.style.display === "none" || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, results.length - 1);
      render();
      dropdown.querySelector('[aria-selected="true"]')?.scrollIntoView({block:"nearest"});
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, -1);
      render();
      dropdown.querySelector('[aria-selected="true"]')?.scrollIntoView({block:"nearest"});
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pick(results[activeIndex].id);
    } else if (e.key === "Escape") {
      generation++; close();
    }
  });

  // Click outside or blur → close (small delay so click on dropdown still fires).
  // Store the timeout so a re-focus/re-click (reopen) can cancel it.
  inputEl.addEventListener("blur", () => { generation++; clearTimeout(timeoutId); blurTimeout = setTimeout(close, 150); });
  new MutationObserver(() => { if (inputEl.disabled) { generation++; close(); } }).observe(inputEl, {attributes:true, attributeFilter:["disabled"]});

  // Reposition on scroll/resize when dropdown is open
  window.addEventListener("scroll", () => {
    if (dropdown.style.display === "block") positionDropdown();
  }, true);
  window.addEventListener("resize", () => {
    if (dropdown.style.display === "block") positionDropdown();
  });
}

// Convenience: attach to all known HF-id inputs in TAF Agent.
// NIAH was added in v0.7.6, LongScore in v0.8.8 — keep this list in sync when adding new modes.
export function attachAllHfAutocompletes() {
  const ids = [
    "hf-id", "profile-hf-id", "unmask-id", "memreal-id", "pvr-id", "template-id", "quant-id", "niah-id",
    "spec-target-id", "spec-draft-id", "longscore-input", "yarn-model", "diag-model",
    "adapter-id", "adapter-base",
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) attachHfAutocomplete(el);
  }
  // Compare mode uses class-based inputs (3 model slots), not ids → bind by class.
  for (const el of document.querySelectorAll(".compare-hf-id")) {
    attachHfAutocomplete(el);
  }
  // NOTE: #gguf-repo is attached in main.js initGguf() instead — it needs both
  // the `gguf` tag filter AND an onSelect that auto-lists the repo's quant files.
}
