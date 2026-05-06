# scripts/

## `check_lean_manifest.py`

Cross-checks `data/lean_status.json` against the actual `lean-taf` Lean source repo. Run before pushing to catch:

- Theorems renamed / deleted in source but still in manifest.
- Line numbers in manifest no longer matching the source declaration (e.g. after a refactor moved theorems).
- New theorems in source not yet captured in manifest.
- Commit-hash drift between manifest and current `lean-taf` HEAD.

### Usage

```bash
# default — auto-detects ../lean-taf or ../NeurIPS/lean_taf/taf
python scripts/check_lean_manifest.py

# explicit path
python scripts/check_lean_manifest.py --lean-taf-path /path/to/lean-taf

# rewrite manifest in-place to match source (backs up to .bak first)
python scripts/check_lean_manifest.py --regenerate
```

Exit 0 = clean, 1 = drift detected. Suitable as a pre-push hook or CI gate once `lean-taf` is checked out alongside.

### Workflow

1. After committing changes in `lean-taf` (renaming a theorem, adding a new one, etc.):
2. In `tafagent/`, run `python scripts/check_lean_manifest.py` to see what drifted.
3. If line numbers shifted but theorem set is unchanged: `python scripts/check_lean_manifest.py --regenerate` rewrites in-place.
4. If new theorems appeared: regenerate captures them with `file`/`line` only — manually fill `claim`, `tactic`, `tags`, etc. before committing.
5. Commit `data/lean_status.json` to `tafagent`.

### What `--regenerate` preserves vs overwrites

- **Overwrites**: `file`, `line`, `lean_repo.commit`, `lean_repo.commit_short`.
- **Preserves**: `claim`, `tactic`, `preconditions`, `status`, `tags`, `source`, `ui_badge`, plus `findings`, `groups[].title/id`, `summary`, `ui_bindings`. The schema is rewritten with the same keys — anything not derivable from source is kept verbatim.
