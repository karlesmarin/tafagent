#!/usr/bin/env python3
"""Cross-check tafagent's lean_status.json against the lean-taf source repo.

Detects three kinds of drift:
  1. Theorem named in manifest but missing from source file.
  2. Line number in manifest no longer matches the source declaration.
  3. Theorem present in source `theorem <name>` but absent from manifest.

Usage:
    python scripts/check_lean_manifest.py
    python scripts/check_lean_manifest.py --lean-taf-path /path/to/lean-taf
    python scripts/check_lean_manifest.py --regenerate    # rewrite line numbers in-place

By default looks for `../lean-taf` and `../NeurIPS/lean_taf/taf` (developer layout).
Set LEAN_TAF_PATH to override. Exit 0 = clean, 1 = drift detected (CI gate).
"""
from __future__ import annotations
import argparse
import json
import os
import re
import sys
import subprocess
from pathlib import Path

THEOREM_RE = re.compile(r"^\s*theorem\s+([A-Za-z_][A-Za-z0-9_]*)\b")

REPO_ROOT = Path(__file__).resolve().parent.parent
MANIFEST = REPO_ROOT / "data" / "lean_status.json"
LEAN_TAF_CANDIDATES = [
    REPO_ROOT.parent / "lean-taf",
    REPO_ROOT.parent / "NeurIPS" / "lean_taf" / "taf",
]


def find_lean_taf(arg_path: str | None) -> Path:
    if arg_path:
        p = Path(arg_path).expanduser().resolve()
        if (p / "Taf.lean").exists():
            return p
        sys.exit(f"error: {p} does not contain Taf.lean — wrong path?")
    env = os.environ.get("LEAN_TAF_PATH")
    if env:
        return find_lean_taf(env)
    for c in LEAN_TAF_CANDIDATES:
        if (c / "Taf.lean").exists():
            return c.resolve()
    sys.exit("error: lean-taf repo not found. Set LEAN_TAF_PATH or pass --lean-taf-path.")


def grep_theorems(lean_root: Path) -> dict[str, tuple[str, int]]:
    """Return {theorem_name: (relative_file, line_number)} from Taf/*.lean."""
    out: dict[str, tuple[str, int]] = {}
    for lean_file in (lean_root / "Taf").glob("*.lean"):
        rel = f"Taf/{lean_file.name}"
        with lean_file.open(encoding="utf-8") as f:
            for lineno, line in enumerate(f, start=1):
                m = THEOREM_RE.match(line)
                if m:
                    name = m.group(1)
                    if name in out:
                        # Duplicate theorem name across files (Lean would also reject) — flag.
                        print(f"warn: duplicate theorem name {name!r} at {rel}:{lineno} "
                              f"and {out[name][0]}:{out[name][1]}", file=sys.stderr)
                    out[name] = (rel, lineno)
    return out


def get_lean_taf_head(lean_root: Path) -> str | None:
    try:
        return subprocess.check_output(
            ["git", "-C", str(lean_root), "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
        ).decode().strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def manifest_theorems(manifest: dict) -> list[dict]:
    out = []
    for group in manifest.get("groups", []):
        for t in group.get("theorems", []):
            out.append(t)
    return out


def check(manifest: dict, lean_root: Path) -> tuple[int, list[dict]]:
    """Return (number_of_drifts, list_of_drift_records)."""
    src = grep_theorems(lean_root)
    drifts: list[dict] = []
    seen_in_manifest: set[str] = set()

    for t in manifest_theorems(manifest):
        name = t["name"]
        seen_in_manifest.add(name)
        if name not in src:
            drifts.append({"kind": "missing_in_source", "name": name,
                           "manifest_file": t.get("file"), "manifest_line": t.get("line")})
            continue
        src_file, src_line = src[name]
        if t.get("file") != src_file:
            drifts.append({"kind": "file_drift", "name": name,
                           "manifest_file": t.get("file"), "source_file": src_file})
        if t.get("line") != src_line:
            drifts.append({"kind": "line_drift", "name": name,
                           "manifest_line": t.get("line"), "source_line": src_line,
                           "file": src_file})

    for name, (src_file, src_line) in src.items():
        if name not in seen_in_manifest:
            drifts.append({"kind": "missing_in_manifest", "name": name,
                           "source_file": src_file, "source_line": src_line})

    # Commit-hash sanity check.
    head = get_lean_taf_head(lean_root)
    declared = manifest.get("lean_repo", {}).get("commit_short")
    if head and declared and head != declared:
        drifts.append({"kind": "commit_drift", "manifest_commit": declared, "head_commit": head})

    return len(drifts), drifts


def regenerate(manifest: dict, lean_root: Path) -> int:
    """Rewrite line numbers (and file paths) in-place. Preserves claims, tactics, etc.
    Returns count of theorems updated."""
    src = grep_theorems(lean_root)
    updated = 0
    for group in manifest.get("groups", []):
        for t in group.get("theorems", []):
            name = t["name"]
            if name in src:
                src_file, src_line = src[name]
                if t.get("file") != src_file or t.get("line") != src_line:
                    t["file"] = src_file
                    t["line"] = src_line
                    updated += 1
    head = get_lean_taf_head(lean_root)
    if head:
        manifest.setdefault("lean_repo", {})["commit_short"] = head
        try:
            full = subprocess.check_output(
                ["git", "-C", str(lean_root), "rev-parse", "HEAD"],
                stderr=subprocess.DEVNULL,
            ).decode().strip()
            manifest["lean_repo"]["commit"] = full
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
    return updated


# Drift kinds split by severity. ERROR kinds break the badges (manifest references
# something the source doesn't have, or points at the wrong line). INFO kinds are
# advisory — new helpers in source, or the manifest predates a doc-only commit.
ERROR_KINDS = {"missing_in_source", "file_drift", "line_drift"}
INFO_KINDS = {"missing_in_manifest", "commit_drift"}


def format_drift(d: dict) -> str:
    k = d["kind"]
    if k == "missing_in_source":
        return f"  [ERR] MISSING in source: {d['name']} (manifest claims {d['manifest_file']}:{d['manifest_line']})"
    if k == "file_drift":
        return f"  [ERR] FILE drift: {d['name']} -- manifest={d['manifest_file']} source={d['source_file']}"
    if k == "line_drift":
        return f"  [ERR] LINE drift: {d['name']} in {d['file']} -- manifest={d['manifest_line']} source={d['source_line']}"
    if k == "missing_in_manifest":
        return f"  [info] new in source: {d['name']} at {d['source_file']}:{d['source_line']} (not in manifest -- helper or unmapped)"
    if k == "commit_drift":
        return f"  [info] commit drift: manifest={d['manifest_commit']} head={d['head_commit']} (regenerate to update)"
    return f"  [?] unknown drift kind: {d}"


def main() -> int:
    # Force UTF-8 stdout so emoji / non-ASCII labels survive Windows cp1252 console.
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--lean-taf-path", help="Path to lean-taf repo (default: env LEAN_TAF_PATH or ../lean-taf or ../NeurIPS/lean_taf/taf)")
    ap.add_argument("--regenerate", action="store_true", help="Rewrite manifest line numbers + commit hash to match source. Backs up to lean_status.json.bak.")
    ap.add_argument("--manifest", default=str(MANIFEST), help="Path to lean_status.json (default: data/lean_status.json)")
    ap.add_argument("--strict", action="store_true", help="Treat info-level drifts (commit, new-in-source) as errors too.")
    args = ap.parse_args()

    lean_root = find_lean_taf(args.lean_taf_path)
    manifest_path = Path(args.manifest)
    with manifest_path.open(encoding="utf-8") as f:
        manifest = json.load(f)

    if args.regenerate:
        backup = manifest_path.with_suffix(".json.bak")
        backup.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
        n = regenerate(manifest, lean_root)
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"regenerated: {n} theorem(s) updated. backup → {backup.name}")
        return 0

    _, drifts = check(manifest, lean_root)
    src_total = len(grep_theorems(lean_root))
    manifest_total = len(manifest_theorems(manifest))
    head = get_lean_taf_head(lean_root) or "?"
    errors = [d for d in drifts if d["kind"] in ERROR_KINDS]
    infos = [d for d in drifts if d["kind"] in INFO_KINDS]
    print(f"manifest: {manifest_total} theorems  source: {src_total} theorems")
    print(f"manifest commit: {manifest.get('lean_repo', {}).get('commit_short', '?')}  head: {head}")
    print(f"lean_taf path: {lean_root}")
    print()
    if errors:
        print(f"ERRORS ({len(errors)}):")
        for d in errors:
            print(format_drift(d))
        print()
    if infos:
        print(f"INFO ({len(infos)}):")
        for d in infos:
            print(format_drift(d))
        print()
    if not errors and not infos:
        print("OK -- no drift.")
        return 0
    if errors or (args.strict and infos):
        print("Fix: re-run with --regenerate, then commit data/lean_status.json.")
        return 1
    print("OK -- only info-level drift; pass --strict to fail on these too.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
