---
name: ✅ Verified analysis
about: Confirm a TAF analysis with independent measurement
title: '[Verified] '
labels: verified
---

## Hash of analysis being verified

`#__________`  ← paste the hash from the original issue's title

## Original issue

Link: #__

## My setup

- Hardware: __ (e.g. 1× A100 80GB on Modal)
- Software: __ (e.g. vLLM 0.6.0, transformers 4.45)
- Framework version: __

## My measurement

- Verdict observed: __ (e.g. NIAH retrieval at L=32K)
- Numerical result: __ (e.g. 0.87 retrieval accuracy)
- Method: __ (e.g. RULER benchmark, 100 needles)

## Reproducibility

```bash
# Command(s) to reproduce my measurement
```

Output / log:
```
(paste relevant snippet)
```

## Conclusion

- [ ] My measurement matches the TAF prediction within tolerance
- [ ] My measurement matches but with caveats (note below)
- [ ] My measurement does NOT match — I'll open a separate refutation

Notes:
