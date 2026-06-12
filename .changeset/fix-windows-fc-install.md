---
"cullet": patch
---

fix(cli): permitir o auto-install do `fc` no Windows (CVE-2024-27980)

`installPackage` fazia spawn de `npm.cmd`/`pnpm.cmd`/`yarn.cmd` via `execFile`
sem `shell: true`, o que lança `EINVAL` no Node >= 18.20.2/20.12.2 (correcao da
CVE-2024-27980) e quebrava `cullet fc <kit>` com auto-install no Windows. O
spawn passa a habilitar o shell apenas no Windows (espelhando `npm-registry.ts`),
com uma allow-list que rejeita specs de instalacao com metacaracteres de shell
antes de spawnar.
