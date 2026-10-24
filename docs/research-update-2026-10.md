# Literature integration · reviewed 2026-10-24

TAF Research contains 15 manually curated studies. Eight additions connect existing
chapters rather than renumbering the guide. Publication is not evidence of universal
validity, and none of these entries claims a TAF replication.

| Study | Primary source | Guide destination |
|---|---|---|
| Softmax / Cross-Entropy | https://arxiv.org/abs/2610.31642v1 | Grokking: numerical precision |
| Competing Learning | https://arxiv.org/abs/2610.26830v1 | Architectures: training competition |
| KronLSTM | https://arxiv.org/abs/2610.26834v1 | Efficient attention: matrix memory |
| SPIN | https://arxiv.org/abs/2610.09025v2 | Serving: sparse indexer inputs |
| Octopus | https://aclanthology.org/2026.acl-long.1631/ | KV cache: learned retention |
| Engram | https://arxiv.org/abs/2601.07372v2 | Architectures: conditional memory |
| mHC | https://proceedings.mlr.press/v306/xie26aa.html | Residual connections: constrained mixing |
| SympFormer | https://arxiv.org/abs/2610.31600v1 | Thermodynamics: conditional geometric models |

Read methods and limitations, not just abstracts: Competing Learning's main KDA
hybrids disable RoPE (Appendix C); KronLSTM's scalar recognition constraint differs
from vector retrieval (A3.4.7); SPIN prunes indexer inputs, not KV storage; Octopus
requires learned adaptation. SympFormer's geometric setup omits causal masking and
assumes symmetric interactions (§2); it does not establish TAF's γ law.

## Optional demonstrations

Open `?mode=research&study=softmax-fix` or `?mode=research&study=mhc`, then expand
the mechanism demo. The guide embeds the same modules in ES/EN. TAF also has FR/ZH.
All controls are native, keyboard-operable inputs. SVG uses the guide's Okabe–Ito
colours, no WebGL dependency, and no autoplay or background animation. Numeric
readouts accompany the rotatable 3D projection. Without JavaScript, the guide
retains equations, limitations and primary-source links.

The Float32 example explicitly rounds elementary operations; it is **not** a fused
kernel emulator. `python scripts/check_softmax_roundoff.py` separately records a
real PyTorch CPU microcheck with version, loss and gradient. Neither reproduces
training or the paper's distillation tests.

The residual example uses `P=(1−α)I+αC`, not learned mHC weights or Sinkhorn.
It illustrates transport contraction and centroid preservation. Full blocks also
write nonlinear updates, so neither property is asserted for the full model.
The optional 1.1 gain is a synthetic comparison. Plot scaling is reported.

No entropy correction, universal ν adjustment, inference backend or telemetry is
added. Proposed experiments remain `proposed_not_run` in every exported record;
demonstrations carry a separate `pedagogical_not_replication` label.

## Maintenance

Update `data/research_studies.json` in all four languages, verify source versions
and guide anchors, and sync shared modules before rendering both Quarto editions.
Use `npm test`, `node tests/research_browser.mjs` and
`node tests/research_labs_browser.mjs`; the latter accepts `GUIDE_URL` for round trips.
The app help and both READMEs describe the new studies and demonstrations.
