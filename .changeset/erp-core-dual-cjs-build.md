---
"@cullet/erp-core": patch
---

Ship a dual ESM/CJS build so CommonJS consumers can import the subpaths.

`tsdown` now emits both formats (`format: ["esm", "cjs"]`), and `package.json`
adds a `require` condition — resolving to the `.cjs` output with `.d.cts`
types — next to the existing `import` condition for every subpath, plus
`main`/`module`/`typesVersions`. The package was previously ESM-only, so
importing a subpath such as `@cullet/erp-core/errors` from a CommonJS project
(`moduleResolution: node16`/`nodenext`) failed type-checking with TS1479 and
would throw `ERR_REQUIRE_ESM` at runtime.
