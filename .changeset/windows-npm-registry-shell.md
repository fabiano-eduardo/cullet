---
"cullet": patch
---

fix(cli): consultar o npm via shell no Windows e blindar `npm view` contra injeção

No Windows o executável é `npm.cmd`; desde o patch de CVE do Node, `.cmd`/`.bat` só
podem ser spawnados com `shell: true`. Sem isso, `fetchPublishedPackageInfo` falhava
silenciosamente no Windows e o recurso de versões publicadas nunca funcionava. Agora o
shell é habilitado apenas no Windows. Como isso reintroduz risco de injeção de comando,
o nome do pacote passa a ser validado contra um allow-list de caracteres válidos de
nome npm antes de qualquer spawn.
