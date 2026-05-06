// Lean+Mathlib provenance — loads `data/lean_status.json`, exposes per-theorem
// badge HTML + a grouped table renderer for the Verification accordion.
// Pure browser-only: just fetches a static JSON manifest.

let _manifest = null;
let _byName = null;

export async function loadLeanManifest(url = "data/lean_status.json") {
  if (_manifest) return _manifest;
  const res = await fetch(url, { cache: "default" });
  if (!res.ok) throw new Error(`lean manifest fetch failed: ${res.status}`);
  _manifest = await res.json();
  _byName = {};
  for (const g of _manifest.groups) {
    for (const t of g.theorems) {
      t._group = g.id;
      t._url = sourceUrl(_manifest, t);
      _byName[t.name] = t;
    }
  }
  return _manifest;
}

export function getManifest() { return _manifest; }
export function getTheorem(name) { return _byName ? _byName[name] : null; }

export function sourceUrl(manifest, theorem) {
  const repo = manifest.lean_repo;
  return `${repo.url}/blob/${repo.default_branch}/${theorem.file}#L${theorem.line}`;
}

const escapeHtml = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const escapeAttr = (s) => String(s ?? "").replace(/"/g, "&quot;");

export function badgeHtml(theoremName, label = "✓ Lean ↗") {
  const t = getTheorem(theoremName);
  if (!t) return "";
  return `<a href="${escapeAttr(t._url)}" target="_blank" rel="noopener" class="lean-badge" title="Lean theorem: ${escapeAttr(t.name)} — ${escapeAttr(t.claim)} (tactic: ${escapeAttr(t.tactic || "")})">${escapeHtml(label)}</a>`;
}

export function badgesForUiBinding(bindingKey) {
  // Returns concatenated badges for a UI binding (single string or array of names).
  const manifest = getManifest();
  if (!manifest || !manifest.ui_bindings) return "";
  const binding = manifest.ui_bindings[bindingKey];
  if (!binding) return "";
  const names = Array.isArray(binding) ? binding : [binding];
  return names.map(n => badgeHtml(n, "✓ Lean")).filter(Boolean).join(" ");
}

export function renderTheoremTable() {
  const manifest = getManifest();
  if (!manifest) return "<div class='subtle'>Lean manifest not loaded.</div>";

  const repo = manifest.lean_repo;
  const headerHtml = `
    <div class="lean-meta">
      <div><strong data-i18n="lean.meta.repo">Repo</strong>: <a href="${escapeAttr(repo.url)}" target="_blank">${escapeHtml(repo.name)}</a> @ <code>${escapeHtml(repo.commit_short)}</code></div>
      <div class="subtle"><strong data-i18n="lean.meta.build">Build</strong>: ${repo.build_jobs} jobs · ${escapeHtml(repo.lean_toolchain)} · ${repo.compile_time_seconds}s compile (warm)</div>
      <div class="subtle"><strong data-i18n="lean.meta.theorems">Theorems</strong>: ${manifest.summary.theorems_total} <span data-i18n="lean.meta.verified">verified</span> · ${manifest.summary.lean_rejected} <span data-i18n="lean.meta.rejected">rejected</span> · ${manifest.summary.skipped_sorry} <span data-i18n="lean.meta.sorry">sorry</span> · ${manifest.summary.substantive_findings} <span data-i18n="lean.meta.findings">substantive findings</span></div>
    </div>`;

  const findingsHtml = (manifest.findings && manifest.findings.length)
    ? `<details class="lean-findings" open>
        <summary><strong data-i18n="lean.findings.title">🔎 Substantive findings</strong> (${manifest.findings.length})</summary>
        ${manifest.findings.map(f => `
          <div class="lean-finding">
            <div><strong>${escapeHtml(f.id)} — ${escapeHtml(f.title)}</strong>
              <span class="lean-pill ${f.severity === "substantive" ? "v-deg" : ""}">${escapeHtml(f.severity)}</span></div>
            <div class="subtle" style="margin-top:0.3em;">${escapeHtml(f.summary)}</div>
            <div style="margin-top:0.3em;">
              <span class="subtle"><span data-i18n="lean.findings.detected_by">Detected by</span>:</span> ${badgeHtml(f.detected_by, f.detected_by + " ↗")}
              ${f.fixed_by && f.fixed_by.length ? ` · <span class="subtle"><span data-i18n="lean.findings.fixed_by">Fixed by</span>:</span> ${f.fixed_by.map(n => badgeHtml(n, n + " ↗")).join(" ")}` : ""}
            </div>
            <div class="subtle" style="margin-top:0.3em;"><strong data-i18n="lean.findings.recommendation">Recommendation</strong>: ${escapeHtml(f.recommendation)}</div>
          </div>
        `).join("")}
      </details>`
    : "";

  const groupsHtml = manifest.groups.map(g => `
    <details class="lean-group">
      <summary><strong>${escapeHtml(g.title)}</strong> <span class="subtle">(${g.theorems.length})</span></summary>
      <div class="lean-table-wrap">
        <table class="lean-table">
          <thead>
            <tr>
              <th data-i18n="lean.table.theorem">Theorem</th>
              <th data-i18n="lean.table.claim">Claim</th>
              <th data-i18n="lean.table.tactic">Tactic</th>
              <th data-i18n="lean.table.source">Source</th>
              <th data-i18n="lean.table.lean">Lean</th>
            </tr>
          </thead>
          <tbody>
            ${g.theorems.map(t => `
              <tr>
                <td><code>${escapeHtml(t.name)}</code></td>
                <td>${escapeHtml(t.claim)}</td>
                <td><code class="subtle">${escapeHtml(t.tactic || "")}</code></td>
                <td class="subtle">${t.source ? renderSource(t.source) : "—"}</td>
                <td>${badgeHtml(t.name, "L" + t.line + " ↗")}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </details>`).join("");

  return `${headerHtml}${findingsHtml}<div class="lean-groups">${groupsHtml}</div>`;
}

function renderSource(src) {
  const parts = [];
  if (src.doc) parts.push(`<code>${escapeHtml(src.doc)}</code>`);
  if (src.section) parts.push(escapeHtml(src.section));
  if (src.line) parts.push(`L${src.line}`);
  if (src.label) parts.push(`<em>${escapeHtml(src.label)}</em>`);
  return parts.join(" · ");
}
