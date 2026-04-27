// phase_diagram.js — γ × θ scatter for the paper's empirical panel.
// Pure canvas (no Chart.js dependency) so it works offline in Pyodide context.
// Data shipped at data/master_gamma_results.json (23 models).

const PHASE_DATA_URL = "data/master_gamma_results.json";

let phaseDataCache = null;

async function loadPhaseData() {
  if (phaseDataCache) return phaseDataCache;
  try {
    const r = await fetch(PHASE_DATA_URL);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    phaseDataCache = await r.json();
    return phaseDataCache;
  } catch (e) {
    console.error("phase_diagram: cannot load", PHASE_DATA_URL, e);
    return null;
  }
}

function gammaPade(theta, T) {
  return (2 * theta - T * Math.SQRT2) / (2 * theta + T * Math.SQRT2);
}

function colorForPhase(phase) {
  if (!phase) return "#888";
  if (phase.startsWith("A")) return "#3a8eef";    // blue: deconfined / Phase A
  if (phase.startsWith("B")) return "#e25555";    // red: confined / Phase B
  if (phase.indexOf("Hage") >= 0) return "#f0a020"; // amber: Hagedorn
  return "#888";
}

function modelShortName(s) {
  if (!s) return "?";
  // strip org prefix
  const slash = s.indexOf("/");
  return slash >= 0 ? s.substring(slash + 1) : s;
}

let phaseChartState = {
  points: [],     // {x_log_theta, y_gamma, model, theta, gamma, phase, R2, corpus}
  hoverIdx: -1,
  margin: { l: 60, r: 20, t: 20, b: 50 },
};

function renderPhaseDiagram() {
  const canvas = document.getElementById("phase-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const m = phaseChartState.margin;
  const plotW = W - m.l - m.r;
  const plotH = H - m.t - m.b;

  ctx.clearRect(0, 0, W, H);

  // axes ranges
  const xMin = 3, xMax = 7.2;     // log10 theta from 1e3 to ~1.6e7
  const yMin = 0, yMax = 1.6;

  const xToPx = (x) => m.l + (x - xMin) / (xMax - xMin) * plotW;
  const yToPx = (y) => m.t + (1 - (y - yMin) / (yMax - yMin)) * plotH;

  // Padé curve at T=2000
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let lt = xMin; lt <= xMax; lt += 0.05) {
    const theta = Math.pow(10, lt);
    const g = gammaPade(theta, 2000);
    const px = xToPx(lt);
    const py = yToPx(g);
    if (lt === xMin) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Hagedorn line γ=1
  ctx.strokeStyle = "#e25555";
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(m.l, yToPx(1));
  ctx.lineTo(m.l + plotW, yToPx(1));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#e25555";
  ctx.font = "11px sans-serif";
  ctx.fillText("Hagedorn γ=1", m.l + plotW - 110, yToPx(1) - 5);

  // axis lines + labels
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(m.l, m.t);
  ctx.lineTo(m.l, m.t + plotH);
  ctx.lineTo(m.l + plotW, m.t + plotH);
  ctx.stroke();

  ctx.fillStyle = "#aaa";
  ctx.font = "11px sans-serif";
  // x ticks (powers of 10)
  for (let lt = 3; lt <= 7; lt++) {
    const px = xToPx(lt);
    ctx.beginPath(); ctx.moveTo(px, m.t + plotH); ctx.lineTo(px, m.t + plotH + 4); ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillText(`10^${lt}`, px, m.t + plotH + 18);
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#ccc";
  ctx.fillText("RoPE θ (log scale)", m.l + plotW / 2, m.t + plotH + 36);

  // y ticks
  for (let g = 0; g <= 1.6; g += 0.2) {
    const py = yToPx(g);
    ctx.beginPath(); ctx.moveTo(m.l - 4, py); ctx.lineTo(m.l, py); ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillStyle = "#aaa";
    ctx.fillText(g.toFixed(1), m.l - 8, py + 3);
  }
  ctx.save();
  ctx.translate(15, m.t + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ccc";
  ctx.fillText("γ (measured)", 0, 0);
  ctx.restore();

  // points
  for (let i = 0; i < phaseChartState.points.length; i++) {
    const p = phaseChartState.points[i];
    const px = xToPx(p.x_log_theta);
    const py = yToPx(p.y_gamma);
    ctx.beginPath();
    ctx.arc(px, py, i === phaseChartState.hoverIdx ? 8 : 5, 0, Math.PI * 2);
    ctx.fillStyle = colorForPhase(p.phase);
    if (p.corpus === "random") {
      ctx.globalAlpha = 0.4;
    } else {
      ctx.globalAlpha = 1.0;
    }
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = i === phaseChartState.hoverIdx ? "#fff" : "#222";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // legend
  const legX = m.l + 10;
  const legY = m.t + 10;
  const items = [
    ["Phase A (γ<1, global)", "#3a8eef"],
    ["Hagedorn (γ≈1)", "#f0a020"],
    ["Phase B (γ>1, local)", "#e25555"],
    ["Padé prediction", "#444"],
  ];
  ctx.font = "11px sans-serif";
  for (let i = 0; i < items.length; i++) {
    const [label, c] = items[i];
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(legX, legY + i * 16, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ddd";
    ctx.textAlign = "left";
    ctx.fillText(label, legX + 10, legY + i * 16 + 4);
  }
}

function setupPhasePoints(data) {
  if (!data) return;
  const pts = [];
  for (const x of data) {
    const theta = x.theta;
    const gamma = x.gamma_obs;
    if (!theta || !gamma) continue;
    pts.push({
      x_log_theta: Math.log10(theta),
      y_gamma: gamma,
      model: x.model || "?",
      theta: theta,
      gamma: gamma,
      phase: x.phase || "",
      R2: x.R2 || 0,
      corpus: x.corpus || "?",
    });
  }
  phaseChartState.points = pts;
}

function findHoverPoint(canvas, mx, my) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = mx * scaleX;
  const py = my * scaleY;
  const m = phaseChartState.margin;
  const plotW = canvas.width - m.l - m.r;
  const plotH = canvas.height - m.t - m.b;
  const xMin = 3, xMax = 7.2;
  const yMin = 0, yMax = 1.6;
  const xToPx = (x) => m.l + (x - xMin) / (xMax - xMin) * plotW;
  const yToPx = (y) => m.t + (1 - (y - yMin) / (yMax - yMin)) * plotH;
  let bestIdx = -1, bestDist = 12; // px tolerance
  for (let i = 0; i < phaseChartState.points.length; i++) {
    const p = phaseChartState.points[i];
    const ppx = xToPx(p.x_log_theta);
    const ppy = yToPx(p.y_gamma);
    const dist = Math.sqrt((px - ppx) ** 2 + (py - ppy) ** 2);
    if (dist < bestDist) { bestDist = dist; bestIdx = i; }
  }
  return bestIdx;
}

function describePoint(p) {
  if (!p) return "";
  const m = modelShortName(p.model);
  return `<strong>${m}</strong> &nbsp; θ=${p.theta.toLocaleString()} &nbsp; γ=${p.gamma.toFixed(3)} &nbsp; R²=${p.R2.toFixed(3)} &nbsp; phase=${p.phase} &nbsp; corpus=${p.corpus}`;
}

export async function initPhaseDiagram() {
  const canvas = document.getElementById("phase-canvas");
  if (!canvas) return;
  const data = await loadPhaseData();
  if (!data) {
    document.getElementById("phase-info").innerHTML =
      "<em>Failed to load data/master_gamma_results.json</em>";
    return;
  }
  setupPhasePoints(data);
  renderPhaseDiagram();

  canvas.addEventListener("mousemove", (e) => {
    const idx = findHoverPoint(canvas, e.offsetX, e.offsetY);
    if (idx !== phaseChartState.hoverIdx) {
      phaseChartState.hoverIdx = idx;
      renderPhaseDiagram();
      const info = document.getElementById("phase-info");
      if (info) {
        info.innerHTML = idx >= 0
          ? describePoint(phaseChartState.points[idx])
          : "<em>Hover a dot for details. Click to load into Recipe form.</em>";
      }
    }
  });

  canvas.addEventListener("click", (e) => {
    const idx = findHoverPoint(canvas, e.offsetX, e.offsetY);
    if (idx < 0) return;
    const p = phaseChartState.points[idx];
    // Populate the diag-model field if available, and recipe-section preset
    const dm = document.getElementById("diag-model");
    if (dm) dm.value = p.model;
    const dt = document.getElementById("diag-theta");
    if (dt) dt.value = p.theta;
    const hf = document.getElementById("hf-id");
    if (hf) hf.value = p.model;
    const info = document.getElementById("phase-info");
    if (info) info.innerHTML = `${describePoint(p)} &nbsp;→ <em>loaded into Diagnose &amp; Recipe forms</em>`;
  });
}
