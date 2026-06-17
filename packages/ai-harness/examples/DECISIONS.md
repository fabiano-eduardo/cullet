# DECISIONS.md

Registro de decisões técnicas (Architecture Decision Records simplificados).
Leia quando estiver implementando algo que envolva uma decisão já tomada.

---

## 2024-01 — Prisma em vez de TypeORM

**Contexto**: precisávamos escolher um ORM para PostgreSQL em TypeScript.

**Decisão**: Prisma.

**Motivo**: o Prisma gera tipos TypeScript automaticamente a partir do schema,
eliminando uma classe inteira de bugs de runtime. O TypeORM requer decorators
e tem tipos menos precisos. A tradeoff é que o Prisma é mais opinionado e
migrations são gerenciadas por ele, não manualmente.

**Consequência**: nunca escreva SQL raw diretamente no código da aplicação.
Use `prisma.$queryRaw` apenas em migrations quando necessário.

---

## 2024-03 — Zod em vez de Joi ou class-validator

**Contexto**: validação de inputs de API.

**Decisão**: Zod.

**Motivo**: Zod infere tipos TypeScript automaticamente dos schemas, então
você define o schema uma vez e tem tanto validação em runtime quanto tipo
estático. Com Joi ou class-validator você precisaria manter os dois
sincronizados manualmente.

**Consequência**: todo input de controller usa `schema.parse(req.body)`.
O `ValidationError` do Zod é capturado pelo error handler global.

---

## 2024-06 — Refresh tokens no banco em vez de Redis

**Contexto**: estratégia de armazenamento de refresh tokens para permitir
revogação.

**Decisão**: tabela `RefreshToken` no PostgreSQL.

**Motivo**: simplifica a infra — não precisamos de Redis em produção por
enquanto. A desvantagem é que cada refresh de token faz uma query no banco,
mas o volume atual não justifica a complexidade adicional.

**Consequência**: nunca assuma que um refresh token é válido apenas pela
assinatura JWT — sempre verifique na tabela `RefreshToken`.

---

## 2025-01 — Yarn em vez de npm

**Contexto**: gerenciador de pacotes.

**Decisão**: Yarn com PnP desabilitado (node-modules clássico).

**Motivo**: o projeto iniciou com Yarn e mudar causaria inconsistências no
lockfile. PnP foi desabilitado por incompatibilidade com algumas ferramentas
de build.

**Consequência**: sempre use `yarn add` e nunca `npm install`. O arquivo
`yarn.lock` é commitado e não deve ser editado manualmente.
