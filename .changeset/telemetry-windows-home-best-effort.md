---
"cullet": patch
---

fix(cli): blindar a telemetria contra falhas de ambiente e nunca quebrar o comando

Em ambientes sem `HOME` (Windows nativo, onde o Node usa `USERPROFILE`; containers/CI sem
`HOME`), resolver o diretório de telemetria lançava erro e **todo comando** — mesmo com a
telemetria desligada por padrão — terminava com exit 1 logo após imprimir a saída. O
diretório do usuário passa a ser resolvido por `HOME` → `USERPROFILE` → `os.homedir()`.

Além disso, o registro e a exportação do evento agora são estritamente best-effort no
wrapper de comando: qualquer falha de telemetria (escrita local, rede ou resolução de
caminho) é contida e jamais quebra o comando nem mascara o erro real do handler.

Internamente o módulo de telemetria foi fragmentado em arquivos menores e coesos
(`telemetry/{types,errors,paths,endpoint,diagnostics,store,transport}.ts`), sem mudança de
comportamento nem da superfície pública.
