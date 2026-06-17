# ARCHITECTURE.md

Decisões arquiteturais deste projeto. Leia antes de implementar qualquer
módulo que envolva camadas ou padrões estruturais.

---

## Camadas da aplicação

```
HTTP (Express routes)
  └── Controllers        ← validação de input com Zod, chama use cases
        └── Use Cases    ← lógica de negócio, orquestra repositories
              └── Repositories  ← acesso ao banco via Prisma
```

Cada camada só conhece a camada imediatamente abaixo. Um use case não
importa nada de Express. Um repository não conhece Zod nem use cases.

## Por que essa separação existe

Controllers são fáceis de trocar (Express → Fastify, REST → GraphQL)
porque não têm lógica de negócio. Use cases são fáceis de testar porque
não têm dependência de HTTP nem de banco de dados real. Repositories
centralizam todas as queries — quando o Prisma schema muda, só os
repositories mudam.

## Tratamento de erros

Todas as rotas Express estão envolvidas por um handler global em
`src/middleware/error-handler.ts`. Ele captura qualquer instância de
`AppError` e retorna o status HTTP correspondente. Erros não mapeados
retornam 500. Nunca faça try/catch nos controllers — deixe o erro
propagar para o handler global.

## Autenticação

JWT com dois tokens: access token (15 min) e refresh token (7 dias).
O middleware `authenticate` em `src/middleware/auth.ts` injeta o usuário
decodificado em `req.user`. Rotas públicas não usam esse middleware.

## Multi-tenancy

Cada usuário pertence a uma `Organization`. Todos os recursos têm
`organizationId`. O middleware `authenticate` também injeta
`req.organizationId`. Qualquer query que liste recursos deve filtrar por
`organizationId` — nunca retorne dados de outra organização.

## Decisões que não devem ser mudadas sem discussão

- Prisma como único ponto de acesso ao banco (sem queries raw exceto em
  migrations)
- Zod como única biblioteca de validação de schema
- Todos os erros de domínio herdam de `AppError`
- Refresh tokens armazenados no banco (não em memória) para permitir revogação
