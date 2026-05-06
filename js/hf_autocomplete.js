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

  const {
    pipeline = "text-generation",
    limit = 15,
    debounceMs = 300,
    minChars = 2,
    onSelect = null,
  } = options;

  // Floating dropdown attached to body so it never gets clipped by parents.
  const dropdown = document.createElement("div");
  dropdown.className = "hf-autocomplete-dropdown";
  dropdown.style.display = "none";
  document.body.appendChild(dropdown);

  let timeoutId = null;
  let activeIndex = -1;
  let results = [];
  let lastQuery = "";

  function positionDropdown() {
    const rect = inputEl.getBoundingClientRect();
    dropdown.style.position = "fixed";
    dropdown.style.left = rect.left + "px";
    dropdown.style.top = (rect.bottom + 2) + "px";
    dropdown.style.width = Math.max(rect.width, 280) + "px";
    dropdown.style.zIndex = "10000";
  }

  function render(notice = null) {
    if (!results.length && !notice) { dropdown.style.display = "none"; return; }
    const rows = results.map((r, i) => `
      <div class="hf-result ${i === activeIndex ? "active" : ""}" data-id="${escapeHtml(r.id)}">
        <span class="hf-result-id">${escapeHtml(r.id)}</span>
        <span class="hf-result-meta">⬇ ${formatDownloads(r.downloads)} · ❤ ${formatDownloads(r.likes)}${r.library_name ? " · " + escapeHtml(r.library_name) : ""}</span>
      </div>
    `).join("");
    const noticeHtml = notice ? `<div class="hf-notice">${escapeHtml(notice)}</div>` : "";
    // Privacy footer (always visible when dropdown is showing).
    const t = (window.__taf_t || (k => null));
    const privacyText = t("hf_auto.privacy") || "🔒 Queries sent to huggingface.co/api · cached locally 5 min";
    const privacyHtml = `<div class="hf-privacy">${escapeHtml(privacyText)}</div>`;
    dropdown.innerHTML = rows + noticeHtml + privacyHtml;
    positionDropdown();
    dropdown.style.display = "block";
  }

  function close() {
    dropdown.style.display = "none";
    activeIndex = -1;
  }

  function pick(id) {
    inputEl.value = id;
    close();
    if (onSelect) onSelect(id);
    inputEl.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function search(q) {
    // Empty q is allowed: returns top-N most-downloaded models so a focused-but-empty
    // input still shows a useful initial dropdown ("desplegable" UX), not just
    // search-as-you-type. Below minChars but non-empty → wait for more chars.
    if (q && q.length < minChars) { results = []; render(); return; }
    const cacheKey = q || "__top__";
    if (cacheKey === lastQuery) return; // dedupe rapid typing
    lastQuery = cacheKey;

    // Cache hit → skip network entirely
    const cached = cacheGet(cacheKey);
    if (cached) { results = cached; activeIndex = -1; render(); return; }

    const params = new URLSearchParams({
      limit: String(limit),
      sort: "downloads",
      direction: "-1",
    });
    if (q) params.set("search", q);
    if (pipeline) params.set("filter", pipeline);
    try {
      const resp = await fetch(`https://huggingface.co/api/models?${params}`);
      if (resp.status === 429) {
        const t = (window.__taf_t || (k => null));
        results = [];
        render(t("hf_auto.rate_limited") || "⚠ HuggingFace rate limit — try again in a moment");
        return;
      }
      if (!resp.ok) { results = []; render(); return; }
      const data = await resp.json();
      results = (Array.isArray(data) ? data : [])
        .filter(r => r.id && typeof r.id === "string")
        .slice(0, limit);
      cacheSet(cacheKey, results);
      activeIndex = -1;
      render();
    } catch (e) {
      // Network failure → silent; user can still type the id manually.
      results = []; render();
    }
  }

  inputEl.addEventListener("input", (e) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => search(e.target.value.trim()), debounceMs);
  });

  inputEl.addEventListener("focus", (e) => {
    // Always show dropdown on focus: either filtered (if user already typed)
    // or the global top-most-downloaded models (empty query).
    const v = e.target.value.trim();
    search(v);
  });

  // Click on a result picks it. Use mousedown to fire before input loses focus.
  dropdown.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const item = e.target.closest(".hf-result");
    if (item) pick(item.dataset.id);
  });

  // Keyboard nav
  inputEl.addEventListener("keydown", (e) => {
    if (dropdown.style.display === "none" || !results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, results.length - 1);
      render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, -1);
      render();
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pick(results[activeIndex].id);
    } else if (e.key === "Escape") {
      close();
    }
  });

  // Click outside or blur → close (small delay so click on dropdown still fires)
  inputEl.addEventListener("blur", () => setTimeout(close, 150));

  // Reposition on scroll/resize when dropdown is open
  window.addEventListener("scroll", () => {
    if (dropdown.style.display === "block") positionDropdown();
  }, true);
  window.addEventListener("resize", () => {
    if (dropdown.style.display === "block") positionDropdown();
  });
}

// Convenience: attach to all 5 known HF-id inputs in TAF Agent.
export function attachAllHfAutocompletes() {
  const ids = ["hf-id", "profile-hf-id", "unmask-id", "template-id", "quant-id"];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) attachHfAutocomplete(el);
  }
}
