# October 2026 updates — TAF Agent and companion guide

## 25 October: review the evidence behind a result

Attention follow-up: **Show protocol details** lists 19 known conditions across
four groups, marks missing documentation and reference differences, and chooses
the next check from five explicit priorities. Custom field names and protocol
values are not exported. The attention example, four-language help and guide
R4/R5 explain the workflow. Browser tests cover all priorities, follow-up,
private exports, invalidated results and mobile layout.

Navigation follow-up: guide links from a resolver summary or review now return
to the same problem form, language and original TAF host (GitHub or Hugging Face).
Return links never run a check or restore pasted inputs. The original tab retains
the full result. Unknown or mismatched route identifiers are ignored. Browser
tests exercise real return-link clicks in all four languages on both hostnames.

All nine direct **Solve my problem** checks now offer **Review this result**:

- Where the evidence comes from and what was actually calculated or inspected.
- What remains unverified, including existing attention-protocol notices.
- A concrete next check and a contextual guide link.

The panel is optional, runs no additional inference and assigns no probability
of failure. Imported measurements remain unverified; demos remain examples.
It updates after recalculation and is cleared when inputs change. The six-step
narrated resolver demo opens it before showing follow-up checks.

Downloaded case reports now use `schema_version: 3`, adding `review` (version 1)
with an explicit `independently_verified: false`. Existing result/summary fields
remain available. Local pasted source text and JSON proposals remain excluded.
No signed ledger, automated discussion replies or telemetry were added.

Manual, feature overview, README, resolver documentation and guide chapter R5
describe this behavior. UI/demo translations cover EN/ES/FR/ZH; guide source and
rendered pages cover ES/EN. FR/ZH links explicitly identify English reading.
TAF is published to GitHub Pages and the Hugging Face Space; the guide to its
GitHub Pages site.

Validation: `npm test` and `npm run test:resolver`, including all nine routes,
four languages, protocol conflicts, private-data exclusion, animated playback,
mobile layout and schema-3 exports. Guide rendering checked 103 HTML pages with
no broken internal links. Public demo checks exercise GitHub and Hugging Face.

[Watch the demo](https://karlesmarin.github.io/tafagent/?demo=resolver&lang=en) ·
[Hugging Face demo](https://karlexmarin-taf-agent.static.hf.space/?demo=resolver&lang=en) ·
[Guide explanation](https://karlesmarin.github.io/transformers-guide/en/chapters/R5-tafagent.html)

## 24 October: symptom-led automatic help

The resolver starts with seven symptom families and twenty situations, providing
nine direct checks and a selector linking all 31 modes to their forms, demos and
guide explanations. Direct checks cover memory, templates, architecture, JSON,
PEFT code, prompt prefixes, evaluation drift, attention reports and adapters.
Access permissions and distributed training receive explicit boundaries.

The [module audit](resolver-module-audit.md) documents actual operations;
the [public discussion sample](resolver-community.md) explains the questions.
This sample is qualitative, not a frequency ranking or continuous monitoring.

Related October work is documented in [research updates](research-update-2026-10.md),
[model review](model-review.md), [entropy measurement](entropy-correction.md), and
[guide integration](guide-integration.md). See [current limitations](LIMITATIONS.md)
for the distinctions between estimates, imported measurements and validated claims.

Older version notes describe their original release snapshots. Their mode counts
and implementation descriptions should not be read as the current inventory.
