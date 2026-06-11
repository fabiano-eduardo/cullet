---
"cullet": patch
---

fix(cli): resolver `npm`/`pnpm`/`yarn` como `.cmd` no Windows ao instalar kits

`installPackage` usava `execFile` com o nome puro do gerenciador. Como `execFile`
não passa por shell, no Windows os binários (`npm.cmd` etc.) não eram resolvidos
e o comando falhava com `ENOENT`. Agora o executável é resolvido por plataforma.
