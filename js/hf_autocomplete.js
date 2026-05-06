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

  function render() {
    if (!results.length) { dropdown.style.display = "none"; return; }
    dropdown.innerHTML = results.map((r, i) => `
      <div class="hf-result ${i === activeIndex ? "active" : ""}" data-id="${escapeHtml(r.id)}">
        <span class="hf-result-id">${escapeHtml(r.id)}</span>
        <span class="hf-result-meta">⬇ ${formatDownloads(r.downloads)} · ❤ ${formatDownloads(r.likes)}${r.library_name ? " · " + escapeHtml(r.library_name) : ""}</span>
      </div>
    `).join("");
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
    if (q.length < minChars) { results = []; render(); return; }
    if (q === lastQuery) return; // dedupe rapid typing
    lastQuery = q;
    const params = new URLSearchParams({
      search: q,
      limit: String(limit),
      sort: "downloads",
      direction: "-1",
    });
    if (pipeline) params.set("filter", pipeline);
    try {
      const resp = await fetch(`https://huggingface.co/api/models?${params}`);
      if (!resp.ok) { results = []; render(); return; }
      const data = await resp.json();
      // Filter out odd entries (gated/private won't appear publicly anyway)
      results = (Array.isArray(data) ? data : [])
        .filter(r => r.id && typeof r.id === "string")
        .slice(0, limit);
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
    const v = e.target.value.trim();
    if (v.length >= minChars) search(v);
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
