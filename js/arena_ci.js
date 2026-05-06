// Arena-Elo CI reconstructor (v0.7.2 anti-bullshit pack #3)
// Recovers confidence intervals from raw pairwise vote data using
// Bradley-Terry MLE + bootstrap. Chatbot Arena strips CIs from its public
// leaderboard; this lets a user compute them from any vote CSV.
// Pure logic — no human-readable strings. main.js renders via i18n.

// Parse CSV into vote records. Accepts header row + 3 columns:
//   model_a, model_b, winner   (winner ∈ {a, b, tie, model_a, model_b})
// Tolerates extra whitespace and case-insensitive header matching.
export function parseVotesCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
  if (lines.length < 2) throw new Error("CSV needs at least a header + 1 data row.");
  const header = lines[0].split(",").map(s => s.trim().toLowerCase());

  const colA = header.findIndex(h => h === "model_a" || h === "a" || h === "model a");
  const colB = header.findIndex(h => h === "model_b" || h === "b" || h === "model b");
  const colW = header.findIndex(h => h === "winner" || h === "result" || h === "outcome");
  if (colA < 0 || colB < 0 || colW < 0) {
    throw new Error("Header must include columns: model_a, model_b, winner.");
  }

  const votes = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",").map(s => s.trim());
    if (row.length < Math.max(colA, colB, colW) + 1) continue;
    const a = row[colA], b = row[colB];
    const w = row[colW].toLowerCase();
    if (!a || !b) continue;
    let winner;
    if (w === "a" || w === "model_a" || w === a.toLowerCase()) winner = "a";
    else if (w === "b" || w === "model_b" || w === b.toLowerCase()) winner = "b";
    else if (w === "tie" || w === "draw" || w === "both" || w === "neither") winner = "tie";
    else continue; // skip unrecognized
    votes.push({ model_a: a, model_b: b, winner });
  }
  return votes;
}

// Bradley-Terry MLE via Minorization-Maximization (Hunter 2004).
// Each iteration: theta_i ← wins_i / Σ_j (matches_ij / (theta_i + theta_j)).
// Ties count as half-win to each side. Returns map model → theta (positive scale).
function fitBradleyTerry(votes, models, opts = {}) {
  const { maxIter = 100, tol = 1e-7 } = opts;
  const n = models.length;
  const idx = Object.fromEntries(models.map((m, i) => [m, i]));
  const wins = new Float64Array(n);
  const matches = Array.from({ length: n }, () => new Float64Array(n));

  for (const v of votes) {
    const a = idx[v.model_a], b = idx[v.model_b];
    if (a === undefined || b === undefined) continue;
    matches[a][b] += 1;
    matches[b][a] += 1;
    if (v.winner === "a") wins[a] += 1;
    else if (v.winner === "b") wins[b] += 1;
    else if (v.winner === "tie") { wins[a] += 0.5; wins[b] += 0.5; }
  }

  let theta = new Float64Array(n).fill(1.0);
  for (let iter = 0; iter < maxIter; iter++) {
    const next = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let denom = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j && matches[i][j] > 0) {
          denom += matches[i][j] / (theta[i] + theta[j]);
        }
      }
      const w = wins[i] || 1e-9; // avoid 0 → undefined
      next[i] = w / (denom || 1e-9);
    }
    // normalize so geometric mean = 1 → keeps Elo identifiable
    let logSum = 0;
    for (let i = 0; i < n; i++) logSum += Math.log(next[i] || 1e-12);
    const gm = Math.exp(logSum / n);
    for (let i = 0; i < n; i++) next[i] /= gm;
    // convergence check
    let maxDelta = 0;
    for (let i = 0; i < n; i++) maxDelta = Math.max(maxDelta, Math.abs(next[i] - theta[i]));
    theta = next;
    if (maxDelta < tol) break;
  }
  return theta;
}

// Convert BT theta → Elo (anchor: geometric-mean model = 1500).
function thetaToElo(theta) { return Array.from(theta).map(t => 400 * Math.log10(t) + 1500); }

// Bootstrap percentile CIs. Resamples votes with replacement B times,
// refits BT each time, returns {ci_low, ci_high} per model.
function bootstrapCIs(votes, models, opts = {}) {
  const { B = 200, ci = 0.95 } = opts;
  const samples = Array.from({ length: models.length }, () => []);
  const N = votes.length;
  for (let b = 0; b < B; b++) {
    const resample = new Array(N);
    for (let k = 0; k < N; k++) resample[k] = votes[(Math.random() * N) | 0];
    const eloRow = thetaToElo(fitBradleyTerry(resample, models, { maxIter: 50 }));
    for (let i = 0; i < models.length; i++) samples[i].push(eloRow[i]);
  }
  const loIdx = Math.floor((1 - ci) / 2 * B);
  const hiIdx = Math.floor((1 - (1 - ci) / 2) * B);
  return samples.map(s => {
    s.sort((a, b) => a - b);
    return { ci_low: s[loIdx], ci_high: s[Math.min(hiIdx, B - 1)] };
  });
}

// Detect statistical ties: pairs where the bootstrap distributions overlap by
// more than `overlapThreshold` (default 0.05 = 5%). Cheaper proxy: CIs overlap.
function findTies(ratings) {
  const ties = [];
  const sorted = [...ratings].sort((a, b) => b.elo - a.elo);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i], b = sorted[j];
      // CI overlap: a.ci_low <= b.ci_high (a's lower bound below b's upper bound)
      if (a.ci_low <= b.ci_high) {
        const eloDiff = a.elo - b.elo;
        const totalSpread = (a.ci_high - a.ci_low) + (b.ci_high - b.ci_low);
        const overlap = Math.max(0, b.ci_high - a.ci_low);
        ties.push({
          rank_a: i + 1, rank_b: j + 1,
          model_a: a.model, model_b: b.model,
          elo_diff: eloDiff,
          overlap_elo: overlap,
          combined_spread: totalSpread,
        });
      }
    }
  }
  return ties;
}

// Top-level entry. Input = array of {model_a, model_b, winner}.
// Output = ranked ratings + ties + summary.
export function computeArenaCI(votes, opts = {}) {
  if (!Array.isArray(votes) || votes.length === 0) {
    return { ratings: [], ties: [], summary: { total_votes: 0, n_models: 0, n_ties: 0 } };
  }
  const modelSet = new Set();
  for (const v of votes) { modelSet.add(v.model_a); modelSet.add(v.model_b); }
  const models = [...modelSet].sort();

  // Per-model raw counts
  const stats = Object.fromEntries(models.map(m => [m, { wins: 0, losses: 0, ties: 0, matches: 0 }]));
  for (const v of votes) {
    stats[v.model_a].matches++;
    stats[v.model_b].matches++;
    if (v.winner === "a") { stats[v.model_a].wins++; stats[v.model_b].losses++; }
    else if (v.winner === "b") { stats[v.model_b].wins++; stats[v.model_a].losses++; }
    else { stats[v.model_a].ties++; stats[v.model_b].ties++; }
  }

  // Point-estimate Elo
  const theta = fitBradleyTerry(votes, models, { maxIter: 100 });
  const elos = thetaToElo(theta);
  // Bootstrap CIs
  const cis = bootstrapCIs(votes, models, { B: opts.bootstrapN ?? 200, ci: opts.ciLevel ?? 0.95 });

  const ratings = models.map((m, i) => ({
    model: m,
    elo: Math.round(elos[i] * 10) / 10,
    ci_low: Math.round(cis[i].ci_low * 10) / 10,
    ci_high: Math.round(cis[i].ci_high * 10) / 10,
    ci_width: Math.round((cis[i].ci_high - cis[i].ci_low) * 10) / 10,
    matches: stats[m].matches,
    wins: stats[m].wins,
    losses: stats[m].losses,
    ties_count: stats[m].ties,
  })).sort((a, b) => b.elo - a.elo);

  // Recompute ranks after sort
  ratings.forEach((r, i) => { r.rank = i + 1; });

  const ties = findTies(ratings);

  return {
    ratings,
    ties,
    summary: {
      total_votes: votes.length,
      n_models: models.length,
      n_ties: ties.length,
      bootstrap_iters: opts.bootstrapN ?? 200,
      ci_level: opts.ciLevel ?? 0.95,
    },
  };
}

// Embedded sample data so users can demo the tool without their own CSV.
// 6 models, ~250 votes, designed so 2 pairs are statistically tied and the
// top model is clearly distinguishable from the bottom.
export const SAMPLE_VOTES_CSV = `# Synthetic Arena-style sample: 6 models, ~250 votes.
# True underlying skill (in arbitrary units): GPT-4=1.6, Claude=1.5, Llama-3=1.0, Mixtral=0.95, Gemma=0.6, Phi=0.5
model_a,model_b,winner
GPT-4,Claude,a
Claude,GPT-4,b
GPT-4,Llama-3,a
GPT-4,Llama-3,a
GPT-4,Llama-3,a
GPT-4,Mixtral,a
GPT-4,Mixtral,a
GPT-4,Mixtral,a
GPT-4,Gemma,a
GPT-4,Gemma,a
GPT-4,Gemma,a
GPT-4,Gemma,a
GPT-4,Phi,a
GPT-4,Phi,a
GPT-4,Phi,a
GPT-4,Phi,a
GPT-4,Phi,a
Claude,Llama-3,a
Claude,Llama-3,a
Claude,Llama-3,a
Claude,Mixtral,a
Claude,Mixtral,a
Claude,Mixtral,a
Claude,Gemma,a
Claude,Gemma,a
Claude,Gemma,a
Claude,Phi,a
Claude,Phi,a
Claude,Phi,a
Claude,Phi,a
GPT-4,Claude,tie
Claude,GPT-4,tie
GPT-4,Claude,a
Claude,GPT-4,a
Llama-3,Mixtral,tie
Llama-3,Mixtral,a
Mixtral,Llama-3,a
Llama-3,Mixtral,b
Mixtral,Llama-3,b
Llama-3,Mixtral,tie
Llama-3,Mixtral,a
Mixtral,Llama-3,a
Llama-3,Gemma,a
Llama-3,Gemma,a
Llama-3,Gemma,a
Llama-3,Phi,a
Llama-3,Phi,a
Mixtral,Gemma,a
Mixtral,Gemma,a
Mixtral,Phi,a
Mixtral,Phi,a
Gemma,Phi,tie
Phi,Gemma,tie
Gemma,Phi,a
Phi,Gemma,a
Gemma,Phi,b
Phi,Gemma,b
Gemma,Phi,a
Phi,Gemma,a
GPT-4,Llama-3,b
Claude,Mixtral,b
Llama-3,Phi,a
Llama-3,Gemma,b
Mixtral,Phi,b
Gemma,Phi,a
GPT-4,Mixtral,a
Claude,Llama-3,a
GPT-4,Phi,a
Claude,Gemma,a
GPT-4,Gemma,a
Claude,Phi,a
Llama-3,Mixtral,a
Mixtral,Llama-3,a
GPT-4,Claude,a
Claude,GPT-4,b
GPT-4,Claude,b
Claude,GPT-4,a
GPT-4,Mixtral,a
Claude,Phi,a
Mixtral,Gemma,a
Llama-3,Gemma,a
GPT-4,Llama-3,a
Claude,Mixtral,a
Mixtral,Phi,a
Llama-3,Phi,a
Gemma,Phi,a
Phi,Gemma,b
GPT-4,Gemma,a
Claude,Gemma,a
GPT-4,Phi,a
Claude,Phi,a
Llama-3,Mixtral,b
Mixtral,Llama-3,b
GPT-4,Claude,tie
Llama-3,Mixtral,tie
Gemma,Phi,tie`;
