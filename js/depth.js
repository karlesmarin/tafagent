// TAF Agent — Depth mode (Part III): config-derived depth-axis landmarks.
// NO inference. From (theta, T, d_head, N_layers) it computes the two independent
// geometric axes — distance (gamma_geom, Padé) and depth (L_crit, the attention-regime
// transition layer) — the three RoPE scales, and, for models in the shipped gamma atlas,
// the trained displacement  delta = gamma_obs - gamma_geom  as an *exploratory* band-position
// lead (Part III H16). Every MEASURED claim of Part III (transport/writing/commitment, the
// J-lens advantage band, Type A/B) needs running the model and is NOT computed here — the
// mode says so, honestly (see caveat.depth_*). Localized via t(); strings in i18n.js.
import { t } from "./i18n.js";
import { attachHfAutocomplete } from "./hf_autocomplete.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TWO_PI = 2 * Math.PI;

// γ_geom = Padé baseline  (2 − z)/(2 + z),  z = T·√2/θ  (identical to the profile whatif).
function gammaGeom(theta, T) {
  const z = T * Math.SQRT2 / theta;
  return (2 - z) / (2 + z);
}
// L_crit / N = log_θ(T/2π) · (d_head/64)^(1/√12)  — attention-regime transition depth (Part I).
function lcritFrac(theta, T, dhead) {
  if (theta <= 1 || T <= 0) return NaN;
  return (Math.log(T / TWO_PI) / Math.log(theta)) * Math.pow(dhead / 64, 1 / Math.sqrt(12));
}

let _atlas = null;
async function loadAtlas() {
  if (_atlas) return _atlas;
  try { _atlas = await (await fetch("data/master_gamma_results.json")).json(); }
  catch (e) { _atlas = []; }
  return _atlas;
}
function atlasGamma(atlas, modelId) {
  if (!Array.isArray(atlas) || !modelId) return null;
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9.]/g, "");
  const want = norm(modelId.split("/").pop());
  const hits = atlas.filter(m => m.model && (norm(m.model).includes(want) || want.includes(norm(m.model))));
  if (!hits.length) return null;
  const txt = hits.find(h => /text|real/i.test(h.corpus || "")) || hits[0];
  return typeof txt.gamma_obs === "number" ? { gamma_obs: txt.gamma_obs, model: txt.model } : null;
}

const num = (id, dflt) => { const v = parseFloat(($(id) || {}).value); return isFinite(v) ? v : dflt; };
const card = (inner) => `<div style="border:1px solid var(--border,#30363d);border-radius:6px;padding:0.7rem 0.9rem;margin:0.6rem 0;background:var(--card-bg,rgba(127,127,127,0.04));">${inner}</div>`;
const row = (label, value) => `<div class="num-row"><span class="num-label">${label}</span><span class="num-value">${value}</span></div>`;

async function runDepth() {
  const out = $("depth-out"); if (!out) return;
  const theta = num("depth-theta", 1e6), T = num("depth-T", 32768), dhead = num("depth-dhead", 128), NL = Math.round(num("depth-nl", 36));
  const gg = gammaGeom(theta, T), lf = lcritFrac(theta, T, dhead);
  const layer = isFinite(lf) ? Math.max(1, Math.min(NL, Math.round(lf * NL))) : NaN;
  const lam0 = TWO_PI, tcross = TWO_PI * Math.sqrt(theta), tmax = TWO_PI * theta;
  const modelId = (($("depth-hf-id") || {}).value || "").trim();
  const f = (x, d = 2) => isFinite(x) ? x.toFixed(d) : "—";
  const big = (x) => isFinite(x) ? Math.round(x).toLocaleString() : "—";

  // δ — trained-displacement band-position lead (atlas only)
  let deltaHtml = "";
  const ag = atlasGamma(await loadAtlas(), modelId);
  if (ag) {
    const delta = ag.gamma_obs - gg;
    const lead = delta < -0.08 ? t("depth.out.delta_early")
      : delta > 0.08 ? t("depth.out.delta_mid")
        : t("depth.out.delta_absent");
    deltaHtml = row("δ = γ_obs − γ_geom", `${delta >= 0 ? "+" : ""}${f(delta)}`)
      + `<p class="subtle">${esc(t("depth.out.delta_body"))} <b>${esc(lead)}</b> — <span style="color:#d29922">${esc(t("depth.out.delta_flag"))}</span></p>`;
  } else if (modelId) {
    deltaHtml = `<p class="subtle">${esc(t("depth.out.delta_noatlas"))}</p>`;
  }

  const caveats = ["depth_not_knee", "depth_two_transitions", "depth_measured", ...(ag ? ["depth_delta_exploratory"] : [])];

  out.innerHTML =
    card(`<h3>🧭 ${esc(t("depth.out.axes_title"))}</h3><p>${esc(t("depth.out.axes_body"))}</p>`
      + row(`${esc(t("depth.out.axis_dist"))} · γ_geom (Padé)`, f(gg))
      + row(`${esc(t("depth.out.axis_depth"))} · L_crit / N`, f(lf)))
    + card(`<h3>🪜 ${esc(t("depth.out.landmark_title"))}</h3><p>${esc(t("depth.out.landmark_body"))} <b>≈ ${isFinite(layer) ? "L" + layer : "—"} / ${NL}</b> (${esc(t("depth.out.frac"))} ${f(lf)}).</p>`
      + (deltaHtml ? `<h3 style="margin-top:0.8rem;">📐 ${esc(t("depth.out.delta_title"))}</h3>${deltaHtml}` : ""))
    + card(`<h3>📏 ${esc(t("depth.out.scales_title"))}</h3>`
      + row(`λ₀ (${esc(t("depth.out.scale_local"))})`, big(lam0))
      + row("T_cross = 2π√θ", big(tcross))
      + row("T_max = 2πθ", big(tmax)))
    + `<div class="recipe-caveats" style="margin-top:0.6rem;padding:0.5rem 0.7rem;border-left:3px solid #d29922;background:rgba(210,153,34,0.08);font-size:0.85rem;border-radius:4px;"><strong>⚠ ${esc(t("caveat.title") || "Honesty notes")}</strong><ul style="margin:0.4rem 0 0;padding-left:1.1rem;">${caveats.map(k => `<li>${esc(t("caveat." + k) || k)}</li>`).join("")}</ul></div>`
    + `<p class="subtle" style="margin-top:0.6rem;">${t("depth.learnmore")}</p>`;
}

async function fetchDepthConfig() {
  const id = (($("depth-hf-id") || {}).value || "").trim();
  const st = $("depth-hf-status");
  if (!id) { if (st) st.textContent = ""; return; }
  if (st) st.textContent = t("depth.status.fetching") || "⏳ Fetching config.json…";
  try {
    const r = await fetch(`https://huggingface.co/${id}/resolve/main/config.json`);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const c = await r.json();
    const nh = c.num_attention_heads || c.n_head || 32;
    const theta = c.rope_theta || (c.rope_scaling && c.rope_scaling.original_max_position_embeddings ? 10000 : 10000);
    const T = c.max_position_embeddings || c.n_positions || 4096;
    const dh = c.head_dim || (c.hidden_size ? Math.round(c.hidden_size / nh) : 128);
    const nl = c.num_hidden_layers || c.n_layer || 32;
    const set = (id2, v) => { if ($(id2)) $(id2).value = v; };
    set("depth-theta", c.rope_theta || theta); set("depth-T", T); set("depth-dhead", dh); set("depth-nl", nl);
    if (st) st.textContent = `${t("depth.status.ok") || "✓ Loaded"} · θ=${c.rope_theta || theta}, T=${T}, d_head=${dh}, N=${nl}`;
  } catch (e) {
    if (st) st.textContent = `${t("depth.status.err") || "⚠ Could not fetch config.json"} (${e.message})`;
  }
}

function bindDepth() {
  const fb = $("depth-fetch-btn"), rb = $("depth-btn"), inp = $("depth-hf-id");
  if (fb) fb.addEventListener("click", fetchDepthConfig);
  if (rb) rb.addEventListener("click", runDepth);
  // HF model-id autocomplete dropdown (same as every other mode); picking a suggestion auto-fetches.
  if (inp) { try { attachHfAutocomplete(inp, { onSelect: () => { const b = $("depth-fetch-btn"); if (b) b.click(); } }); } catch (e) {} }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindDepth);
else bindDepth();

export { runDepth, fetchDepthConfig };
