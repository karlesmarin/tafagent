---
name: 💡 Propose new recipe
about: Suggest a new X-NN recipe for the TAF Agent
title: '[Proposal] X-NN — '
labels: recipe-proposed
---

## Recipe number suggestion

X-__ (next free number — see existing recipes in
[taf_browser.py RECIPES dict](https://github.com/karlesmarin/tafagent/blob/main/python/taf_browser.py))

## What practical question does this answer

In one sentence: "Should/can/will I __ ?"

## Formula chain

Which sections of the paper does it use?
- §17.X
- §19.X
- §26.X

Step-by-step formula chain (in pseudocode):

```
1. Compute X using §X.Y
2. Compute Y using §X.Z
3. If X > threshold → ...
4. Decide based on (X, Y) → verdict
```

## Inputs needed

- input_1: __ (from where? config.json field? user-provided?)
- input_2: __

## Output verdict types

What discrete verdicts can the recipe produce?
- YES / NO / DEGRADED
- Or specific labels like "USE SOFT DECAY" / "USE HARD CUTOFF"

## Example use case

Walk through one realistic scenario where a technician would use this.

## Existing literature

Are there papers / blog posts that motivate this recipe? Link them.
