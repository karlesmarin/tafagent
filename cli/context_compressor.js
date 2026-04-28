/**
 * @id: mod_thermo_compression_v2
 * @version: 2.0.0
 * @description: Padé-based context compression for runtime token budgeting.
 *               Implements the closed-form D_f window from
 *               Marin 2026, "Predicting How Transformers Attend" §sec:kvcache (Eq. 24).
 * @license: Apache-2.0
 *
 * Drop into a Node/browser pipeline before any LLM API call to truncate
 * non-critical context analytically (no profiling, no fine-tuning).
 *
 * Usage:
 *   import { ContextCompressor } from "./context_compressor.js";
 *   const cc = new ContextCompressor({ theta: 10000, T_train: 2048 });
 *   const { kept, dropped, Df, gamma } = cc.compress(tokens, { f: 0.9 });
 */

export class ContextCompressor {
  /**
   * @param {Object} cfg
   * @param {number} cfg.theta    RoPE base from model.config.rope_theta
   * @param {number} cfg.T_train  training context length
   * @param {number} [cfg.T_eval] evaluation length (default = T_train)
   */
  constructor({ theta, T_train, T_eval = null }) {
    if (typeof theta !== "number" || theta <= 0) {
      throw new Error(`theta must be a positive number, got ${theta}`);
    }
    if (typeof T_train !== "number" || T_train <= 0) {
      throw new Error(`T_train must be a positive number, got ${T_train}`);
    }
    this.theta = theta;
    this.T_train = T_train;
    this.T_eval = T_eval ?? T_train;
    this.gamma = this._gammaPade();
  }

  /** Padé closed-form γ predictor (paper §sec:gamma_pade). */
  _gammaPade() {
    const T = this.T_eval;
    const num = 2 * this.theta - T * Math.SQRT2;
    const den = 2 * this.theta + T * Math.SQRT2;
    return num / den;
  }

  /** Validity zone for D_f truncation (paper L11, EXP-B2 extended). */
  _isValidPhase() {
    return this.gamma >= 0.67 && this.gamma <= 0.85;
  }

  /**
   * Closed-form D_f window: minimum context that retains fraction f
   * of total attention mass. Eq. 24 in the paper.
   *
   * @param {number} N  total context length (tokens)
   * @param {number} f  retention fraction in (0, 1), default 0.9
   * @returns {number}  D_f in tokens, or N if Phase B / Hagedorn
   */
  computeDf(N, f = 0.9) {
    if (this.gamma >= 1.0) {
      // Hagedorn / Phase B: limiting form D_f ≈ N^f
      return Math.max(64, Math.round(Math.pow(N, f)));
    }
    const inner = (1 - f) + f * Math.pow(N, 1 - this.gamma);
    return Math.max(64, Math.round(Math.pow(inner, 1 / (1 - this.gamma))));
  }

  /**
   * Compress a token array by retaining the last D_f tokens.
   * Tokens are dropped from the head (oldest first), preserving recency.
   *
   * @param {Array<*>} tokens   array of tokens (any opaque type)
   * @param {Object}  [opts]
   * @param {number}  [opts.f=0.9]      attention retention fraction
   * @param {boolean} [opts.force=false] override the validity guard
   * @returns {{kept:Array, dropped:Array, Df:number, gamma:number, phase:string}}
   */
  compress(tokens, { f = 0.9, force = false } = {}) {
    const N = tokens.length;
    const Df = this.computeDf(N, f);
    const phase = this.gamma < 1 ? "A" : this.gamma > 1 ? "B" : "Hagedorn";

    // Validity guard: outside [0.67, 0.85] the D_f formula has been
    // empirically observed to over- or under-compress (paper L11).
    if (!force && !this._isValidPhase()) {
      return {
        kept: tokens,
        dropped: [],
        Df: N,
        gamma: this.gamma,
        phase,
        warning: `gamma=${this.gamma.toFixed(3)} outside validity zone [0.67,0.85]; passthrough`,
      };
    }

    if (Df >= N) {
      return { kept: tokens, dropped: [], Df, gamma: this.gamma, phase };
    }

    const dropped = tokens.slice(0, N - Df);
    const kept = tokens.slice(N - Df);
    return { kept, dropped, Df, gamma: this.gamma, phase };
  }
}

/**
 * Bus-style integration (matches the user's mod pattern).
 * Listens for { action: "OPTIMIZE_TOKENS", tokens, theta, T_train, f } events
 * and emits VFS_NOTIFY / LOG / SENTRY_ERR results.
 */
export const init = (bus) => {
  bus.emit?.("LOG", { level: "info", msg: "thermo_compression v2 loaded" });

  bus.on?.("GOV", (payload) => {
    if (payload?.action !== "OPTIMIZE_TOKENS") return;
    try {
      const cc = new ContextCompressor({
        theta: payload.theta ?? 10000,
        T_train: payload.T_train ?? 2048,
      });
      const { kept, dropped, Df, gamma, phase, warning } = cc.compress(
        payload.tokens,
        { f: payload.f ?? 0.9 }
      );
      bus.emit?.("VFS_NOTIFY", {
        status: "success",
        savedTokens: dropped.length,
        compressionRatio: dropped.length / payload.tokens.length,
        Df, gamma, phase,
        data: kept,
        ...(warning ? { warning } : {}),
      });
      bus.emit?.("LOG", {
        level: warning ? "warn" : "info",
        msg: `compressed ${payload.tokens.length} → ${kept.length} (γ=${gamma.toFixed(3)}, phase=${phase})`,
      });
    } catch (err) {
      bus.emit?.("SENTRY_ERR", {
        impact: "medium",
        error: err.message,
        context: "mod_thermo_compression_v2",
      });
    }
  });
};
