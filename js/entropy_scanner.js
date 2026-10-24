// Experimental measurement utilities. No model loader, network or UI side effects.
// Inputs must be actual post-softmax attention rows, never logits or placeholders.
// Entropy is a diagnostic; it does not identify or correct the distance exponent γ.
export function uniformAttentionEntropy(supportSize) {
  if (!Number.isSafeInteger(supportSize) || supportSize < 1) throw new RangeError("supportSize must be a positive integer");
  return Math.log2(supportSize);
}

export function attentionRowEntropy(probabilities, { allowedKeys, sumTolerance = 1e-5 } = {}) {
  const p = Array.from(probabilities || []);
  if (!p.length || !p.every(v => typeof v === "number" && Number.isFinite(v) && v >= 0)) {
    throw new TypeError("Attention must contain finite nonnegative probabilities");
  }
  if (!Number.isFinite(sumTolerance) || sumTolerance < 0 || sumTolerance > 0.01) throw new RangeError("Invalid sum tolerance");
  const mask = allowedKeys == null ? p.map(() => true) : Array.from(allowedKeys);
  if (mask.length !== p.length || !mask.every(v => typeof v === "boolean") || !mask.some(Boolean)) {
    throw new TypeError("allowedKeys must be a boolean mask with nonempty support");
  }
  if (p.some((v, i) => !mask[i] && v !== 0)) throw new RangeError("Attention on masked keys is not zero");
  const mass = p.reduce((a, b) => a + b, 0);
  if (mass <= 0 || Math.abs(mass - 1) > sumTolerance) throw new RangeError("Attention row must sum to one");
  // Correct numerical rounding only after validation; do not normalize arbitrary scores.
  const entropy = -p.reduce((sum, v) => v > 0 ? sum + (v / mass) * Math.log2(v / mass) : sum, 0);
  const support = mask.filter(Boolean).length;
  const maximum = uniformAttentionEntropy(support);
  return {
    entropy_bits: entropy === 0 ? 0 : entropy,
    uniform_entropy_bits: maximum,
    normalized_entropy: maximum > 0 ? Math.min(1, entropy / maximum) : null,
    kl_to_uniform_bits: Math.max(0, maximum - entropy),
    allowed_keys: support,
    original_row_sum: mass,
  };
}

export function estimateAttentionEntropy(rows, { allowedKeysByRow, sumTolerance = 1e-5, protocol = {} } = {}) {
  if (!Array.isArray(rows) || !rows.length) throw new TypeError("At least one measured attention row is required");
  if (allowedKeysByRow != null && (!Array.isArray(allowedKeysByRow) || allowedKeysByRow.length !== rows.length)) {
    throw new TypeError("One allowed-key mask is required per row");
  }
  const measurements = rows.map((row, i) => attentionRowEntropy(row, { allowedKeys: allowedKeysByRow?.[i], sumTolerance }));
  const mean = key => measurements.reduce((sum, r) => sum + r[key], 0) / measurements.length;
  const normalized = measurements.filter(r => r.normalized_entropy != null);
  return {
    schema_version: 1,
    status: "measured", unit: "bits", rows: measurements,
    mean_entropy_bits: mean("entropy_bits"),
    mean_uniform_entropy_bits: mean("uniform_entropy_bits"),
    mean_normalized_entropy: normalized.length ? normalized.reduce((sum, r) => sum + r.normalized_entropy, 0) / normalized.length : null,
    mean_kl_to_uniform_bits: mean("kl_to_uniform_bits"),
    gamma_correction: { applied: false, reason: "entropy_does_not_identify_distance_decay" },
    protocol: { ...protocol, statistic: "mean_of_row_entropies", logarithm: "base_2",
      row_count: rows.length, sum_tolerance: sumTolerance, rounding: "rescale_validated_rows_only" },
  };
}
