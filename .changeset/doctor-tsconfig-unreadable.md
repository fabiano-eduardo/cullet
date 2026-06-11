---
"cullet": patch
---

fix(doctor): reportar um `tsconfig.json` ilegível como finding dedicado.

Quando o projeto tem um `tsconfig.json` presente mas com sintaxe inválida, o
`cullet doctor` deixava a exceção de leitura subir e abortar o comando. Agora
ele captura a falha e registra um finding de erro `tsconfig-unreadable`, com uma
dica para corrigir a sintaxe, seguindo auditando o restante do projeto.
