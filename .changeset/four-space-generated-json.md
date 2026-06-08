---
---

chore: alinhar a indentação dos JSON gerados por ferramentas em 4 espaços.

Os scripts `sync-kit-version`, `sync-kit-deps` e `new-kit` passam a serializar
`packages/cli/registry/index.json` e os `package.json` dos kits com 4 espaços
(`JSON.stringify(…, 4)`), em vez de 2. Isso elimina o ping-pong de formatação
com o Prettier (`tabWidth: 4`), que reformatava esses arquivos a cada
`npm run format` só para o release regenerá-los em 2 espaços. Mudança apenas
cosmética — o conteúdo do registry e dos manifestos é idêntico —, então não há
bump de versão.
