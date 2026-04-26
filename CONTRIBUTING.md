# Contributing to TAF Agent

> Thank you for considering contributing. This is an independent research
> project — every contribution, however small, is genuinely appreciated.

---

## How you can help (no coding required)

### 🌐 Translate
Add a language to the UI. Edit `js/i18n.js`, copy the `en` block, translate
each value. Open a PR. ~1-2h.

### 🧪 Falsify a prediction
Run TAF Agent on a model where you have *real measurements* (NIAH retrieval,
PPL benchmarks, training cost data). If our verdict disagrees with reality,
open a [refutation issue in the registry](https://github.com/karlesmarin/tafagent-registry/issues/new?template=refutation.md).
Refutations are first-class citizens here.

### ➕ Add a model preset
Open an [issue with the model's config](https://github.com/karlesmarin/tafagent-registry/issues/new?template=new-preset.md).
We'll bundle popular ones into the next release.

### 🐛 Report bugs
Use the [bug report template](https://github.com/karlesmarin/tafagent/issues/new?template=bug-report.md).
Browser console output (F12 → Console) helps a lot.

### 💡 Propose new recipes
Suggest new TAF analyses in the [registry recipe template](https://github.com/karlesmarin/tafagent-registry/issues/new?template=new-recipe.md).
The 5 currently shipped (X-1, X-2, X-3, X-5, X-19) are a starting set; the
paper outlines 20 candidate recipes.

---

## How you can help (with code)

### Local development setup

```bash
git clone https://github.com/karlesmarin/tafagent
cd tafagent
python -m http.server 8000
# Open http://localhost:8000 in Chrome/Edge/Firefox 113+
```

No build step, no npm, no transpilation. Edit files, refresh browser.

### Code structure

```
index.html             ← UI shell
style.css              ← dark theme + responsive
js/main.js             ← orchestration (Pyodide + WebLLM + render)
js/i18n.js             ← translations (EN/ES/FR/ZH)
python/taf_browser.py  ← TAF formulas + recipes (runs in Pyodide)
registry-bootstrap/    ← files for the public registry repo
```

### Adding a new recipe (X-N)

1. Add the function to `python/taf_browser.py`:
   ```python
   def run_recipe_xN(theta, T_train, ...):
       chain = []
       # ... build chain step by step using existing TAF formulas
       return _wrap("X-N", "Name", locals(), chain, verdict, reason, mitigation)
   ```
2. Register it in the `RECIPES` dict at the bottom of the file.
3. Add defaults to `getRecipeDefaults()` in `js/main.js`.
4. Test locally; submit PR.

### Adding a new language

1. In `js/i18n.js`, add to `LANGUAGES` array:
   ```javascript
   { code: "de", flag: "🇩🇪", label: "Deutsch" }
   ```
2. Copy the `en` block in `TRANSLATIONS`, translate each value.
3. Add a flag button in `index.html`:
   ```html
   <button class="lang-btn" data-lang="de" data-label="Deutsch" title="Deutsch">🇩🇪</button>
   ```
4. Test, submit PR.

### Adding a new TAF formula

1. Add the pure-Python function to `python/taf_browser.py`.
2. Add a translation key for tooltips in `js/i18n.js`.
3. If it's a closed-form result usable from a recipe, expose via the
   recipe runner.

---

## Pull request process

1. Fork the repo.
2. Branch off `main`: `git checkout -b feat/your-thing`.
3. Make changes, commit with descriptive messages
   (`feat:` / `fix:` / `docs:` / `refactor:`).
4. Push to your fork; open PR against `main`.
5. Describe what changed and why; reference issue if any.
6. Be patient — this is maintained part-time.

We rebase + squash PRs for a clean history.

---

## Code of conduct

- Be technical, specific, kind. Disagreements are about math, not people.
- Citations beat opinions. Measurements beat citations.
- Assume good faith. Most "wrong" PRs are misunderstandings, not bad actors.
- No commercial advertisements, no third-party trackers, no telemetry.

---

## What we won't accept

- Anything that adds tracking / analytics / telemetry to the user
- Closed-source dependencies that lock the tool to a vendor
- Recipes that require API keys for non-academic models
- Changes that break the offline-after-first-load promise
- Submissions that violate model licenses (e.g. uploading gated weights)

---

## Maintainer

Carles Marin · [@karlesmarin](https://github.com/karlesmarin) ·
transformerkmarin@gmail.com (paper-related) ·
karlesmarin@gmail.com (project-related)

---

## License

Apache-2.0. By contributing you agree your contribution is licensed under
the same terms.
