# How to bootstrap the registry repo

Once you create `karlesmarin/tafagent-registry` on GitHub (empty, public, no README),
copy the contents of this `registry-bootstrap/` directory into the new repo.

## Steps

```bash
# 1. Clone the empty registry repo somewhere
git clone https://github.com/karlesmarin/tafagent-registry
cd tafagent-registry

# 2. Copy bootstrap files
cp -r /path/to/tafagent/registry-bootstrap/* .
cp -r /path/to/tafagent/registry-bootstrap/.github .

# 3. Initial commit
git add -A
git commit -m "feat: initial registry bootstrap (README + issue templates)"
git push

# 4. Done — registry is now ready to receive submissions
```

## Or via GitHub web UI (no clone needed)

1. https://github.com/karlesmarin/tafagent-registry → "Add file" → "Upload files"
2. Drag the entire contents of `registry-bootstrap/` (including `.github/` folder)
3. Commit message: "feat: initial registry bootstrap"
4. Submit

## What this gives you

- Public README explaining the registry
- 5 issue templates that auto-appear when contributors click "New issue":
  * ✅ Verified analysis
  * ❌ Refute a prediction
  * 🐛 Bug in TAF Agent
  * 💡 Propose new recipe
  * ➕ Add new model preset
- Labels are NOT auto-created — you'll need to manually add them on first issue
  (verified, refuted, recipe-proposed, preset-proposed, bug, discussion, question,
  frontier)

## Recommended labels to create manually

In repo Settings → Labels:

| Label | Color | Description |
|-------|-------|-------------|
| `verified` | green (#0e8a16) | independently confirmed by user |
| `refuted` | red (#d73a4a) | empirical measurement contradicts TAF |
| `recipe-proposed` | blue (#0075ca) | new recipe request |
| `preset-proposed` | blue (#0075ca) | new model preset request |
| `bug` | red (#d73a4a) | bug in TAF Agent web tool |
| `discussion` | gray (#cfd3d7) | open discussion |
| `question` | purple (#cc317c) | clarification needed |
| `frontier` | yellow (#fbca04) | very recent model under evaluation |

That's it. After this, the **📤 Submit to registry** button in TAF Agent
will work end-to-end.
