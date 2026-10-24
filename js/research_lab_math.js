// Pedagogical calculations, not model inference or reproductions of paper benchmarks.
export function softmaxRoundoff(margin) {
  if (!Number.isFinite(margin) || margin < 0 || margin > 40) throw new RangeError('margin: 0..40');
  // Three logits [margin, 0, 0]. Explicit rounding after each elementary operation.
  const f = Math.fround, e = f(Math.exp(-margin)), tail = f(2 * e), denominator = f(1 + tail);
  const ordinary = f(f(1 / denominator) - 1);
  const stable = f(-f(tail / denominator));
  const other = f(e / denominator);
  const reference = -2 * Math.exp(-margin) / (1 + 2 * Math.exp(-margin));
  return { ordinary, stable, reference, other, sumOrdinary: ordinary + 2 * other,
    sumStable: stable + 2 * other };
}

export function residualMix(alpha, steps, gain = 1) {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1 || !Number.isInteger(steps)
      || steps < 0 || steps > 30 || ![1, 1.1].includes(gain)) throw new RangeError('Invalid mixing controls');
  const matrix = [[1-alpha,alpha,0],[0,1-alpha,alpha],[alpha,0,1-alpha]].map(r=>r.map(x=>x*gain));
  let points = [[1,0,0],[0,1,0],[0,0,1]];
  for (let i=0;i<steps;i++) points=matrix.map(row=>[0,1,2].map(k=>row.reduce((s,w,j)=>s+w*points[j][k],0)));
  const norm = Math.sqrt(points.flat().reduce((s,x)=>s+x*x,0));
  return { matrix, points, norm, initialNorm: Math.sqrt(3),
    centroid: [0,1,2].map(k=>points.reduce((s,p)=>s+p[k],0)/3) };
}
