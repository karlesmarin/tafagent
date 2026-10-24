# Public sitemaps

- [TAF on GitHub Pages](https://karlesmarin.github.io/tafagent/sitemap.xml)
- [TAF on Hugging Face](https://karlexmarin-taf-agent.static.hf.space/sitemap-hf.xml)
- [Guide ES/EN](https://karlesmarin.github.io/transformers-guide/sitemap.xml)

TAF is a single-page application: its sitemap contains the homepage. Modes,
language selectors, demos, model IDs and case links are application state, not
additional published pages. The Hugging Face map uses that deployment's host;
use `sitemap-hf.xml` there, since both hosts receive the same repository files.

The guide map includes its language selector, two book homepages and rendered
chapters. ES/EN alternatives are reciprocal and include themselves; the language
selector is the homepages' `x-default`. Assets and temporary HTML are excluded.
Optional `lastmod` is omitted rather than assigning an unverified date to every
page. Sitemap availability does not guarantee indexing or submit a site to a
search engine account. No root-domain robots policy is changed.

## Maintenance

From the TAF repository, using Python's standard library:

```sh
python scripts/build_sitemaps.py --taf-root .
python scripts/build_sitemaps.py --guide-root /path/to/rendered/guide
python scripts/build_sitemaps.py --taf-root . --check
python tests/test_sitemaps.py
```

After rendering and assembling both guide languages, regenerate its sitemap.
The guide source also carries `tools/build_sitemaps.py`: run
`python tools/build_sitemaps.py --guide-root site` from its source directory.
Publish the resulting XML with the HTML. TAF CI checks the checked-in maps and
tests the generator's public-page boundaries, language links and drift detection.
