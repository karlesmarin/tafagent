"""Overnight batch diagnose — runs diagnose_model.py on a series of models.

Validates v0.5.3 fixes empirically: each model's γ is measured, then run
through the corrected D_f / partition_Z / free_energy_F. JSON output per
model in ./diagnose_results/.

Sequential to avoid GPU OOM on the 14GB RTX 5060 Ti.
"""
import json
import subprocess
import sys
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

MODELS = [
    # Light → heavier
    "EleutherAI/pythia-70m",
    "EleutherAI/pythia-160m",
    "EleutherAI/pythia-410m",
    "EleutherAI/pythia-1b",
    "EleutherAI/pythia-1.4b",
]

LOG = Path("./diagnose_results/overnight_log.txt")
LOG.parent.mkdir(parents=True, exist_ok=True)
ROOT = Path(__file__).resolve().parent.parent


def run_model(model_id: str) -> dict:
    """Run diagnose on one model, return summary dict."""
    print(f"\n{'='*70}")
    print(f"  {model_id}")
    print(f"{'='*70}")
    t0 = time.time()
    cmd = [
        sys.executable,
        str(ROOT / "cli" / "diagnose_model.py"),
        "--model", model_id,
        "--fast",
        "--N", "2000",
        "--cpu",  # CUDA fp16 default produces NaN attentions; CPU fp32 reliable
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
        elapsed = time.time() - t0
        out_summary = {
            "model": model_id,
            "elapsed_seconds": elapsed,
            "return_code": proc.returncode,
            "stdout_tail": proc.stdout[-2000:],
            "stderr_tail": proc.stderr[-1500:],
        }
        # Try to read the JSON it just saved
        json_path = ROOT / "cli" / "diagnose_results" / f"{model_id.replace('/', '--')}.json"
        if json_path.exists():
            try:
                out_summary["result"] = json.loads(json_path.read_text(encoding="utf-8"))
            except Exception:
                pass
        return out_summary
    except subprocess.TimeoutExpired:
        return {"model": model_id, "elapsed_seconds": 3600, "error": "timeout"}
    except Exception as e:
        return {"model": model_id, "error": str(e)}


def main():
    results = []
    for m in MODELS:
        try:
            r = run_model(m)
            results.append(r)
            with LOG.open("a", encoding="utf-8") as f:
                f.write(f"\n{r.get('model', '?')}: rc={r.get('return_code', '?')} "
                        f"({r.get('elapsed_seconds', 0):.0f}s)\n")
                if "result" in r:
                    res = r["result"]
                    f.write(f"  γ={res.get('gamma'):.4f}, R²={res.get('fit_power_law',{}).get('R2','?')}\n")
                    f.write(f"  D_90={res.get('D90')}, dH_90={res.get('delta_H_90'):.3f}\n")
                    f.write(f"  γ_pred(Padé)={res.get('gamma_pred'):.4f}, "
                            f"Δγ={res.get('delta_gamma'):.4f}\n")
        except KeyboardInterrupt:
            print("\n[interrupted]")
            break

    # Summary table
    print("\n" + "="*70)
    print("SYNTHESIS")
    print("="*70)
    print(f"{'model':<32s} {'γ':>8s} {'R²':>8s} {'D_90':>6s} {'dH_90':>8s}")
    for r in results:
        if "result" in r:
            res = r["result"]
            g = res.get("gamma", float("nan"))
            r2 = res.get("fit_power_law", {}).get("R2", float("nan"))
            d90 = res.get("D90", -1)
            dH = res.get("delta_H_90", float("nan"))
            print(f"{r['model']:<32s} {g:>8.4f} {r2:>8.4f} {d90:>6d} {dH:>8.4f}")
        else:
            print(f"{r.get('model', '?'):<32s}  ERROR: {r.get('error', '')}")

    # Write final summary JSON
    out = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "n_models": len(MODELS),
        "n_completed": sum(1 for r in results if "result" in r),
        "results": results,
    }
    final = LOG.parent / "overnight_summary.json"
    final.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
    print(f"\nSaved → {final}")


if __name__ == "__main__":
    main()
