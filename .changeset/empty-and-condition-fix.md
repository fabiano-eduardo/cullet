---
"@cullet/erp-core": patch
---

fix(erp-core): return an error when an AND node has no child conditions

`ConditionEvaluatorV1` now rejects empty `and` arrays the same way it already
rejects empty `or` arrays, returning a tagged `EMPTY_AND_CONDITION` error
instead of silently evaluating to `true`.
