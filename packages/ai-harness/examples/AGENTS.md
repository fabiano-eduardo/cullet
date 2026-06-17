# AGENTS.md

Contexto e regras para agentes de IA que trabalham neste repositório.
Leia este arquivo inteiro antes de escrever qualquer código.

---

## O que é este projeto

Backend de uma aplicação SaaS em Node.js. Expõe uma API REST e GraphQL
para um frontend React. Gerencia usuários, autenticação, cobranças e
relatórios.

## Stack obrigatória

- **Runtime**: Node.js 22, TypeScript 5 com strict mode
- **HTTP**: Express 4
- **Validação**: Zod (sempre usar nos inputs de controllers e use cases)
- **ORM**: Prisma com PostgreSQL
- **Testes**: Vitest com Testing Library para testes de integração HTTP
- **Gerenciador de pacotes**: Yarn (nunca npm install)

## Estrutura de módulos

Cada domínio em `src/modules/<nome>/` com a seguinte estrutura:

```
src/modules/users/
  create.ts          ← use case
  create.test.ts     ← testes (não modificar)
  findById.ts
  findById.test.ts
  update.ts
  update.test.ts
  index.ts           ← re-exporta tudo do módulo
src/repositories/
  user.repository.ts
  user.repository.test.ts
src/middleware/
  auth.ts
  auth.test.ts
src/errors/
  index.ts           ← todas as classes de erro customizadas
```

## Convenções de código

### Tipos e interfaces

- Sempre declare o tipo de retorno de funções assíncronas: `Promise<User>`
- Prefira `interface` para contratos de objetos, `type` para unions e aliases
- Nunca use `any` explícito — use `unknown` e faça a guarda de tipo

### Erros

- Todos os erros customizados herdam de `AppError` em `src/errors/index.ts`
- Lance `NotFoundError` para recursos inexistentes
- Lance `UnauthorizedError` para problemas de autenticação/autorização
- Lance `ValidationError` para inputs inválidos (Zod já faz isso automaticamente)

### Imports

- Imports relativos dentro do mesmo módulo: `import { User } from './types'`
- Imports de outros módulos via alias: `import { UserRepository } from '@/repositories/user.repository'`
- Nunca importe diretamente do Prisma client fora dos repositories

### Testes

- Mocks com `vi.mock()` — nunca chame banco de dados em testes unitários
- Para testes de integração HTTP, use o helper `createTestApp()` de `test/helpers.ts`
- Cada `describe` testa uma função ou endpoint específico
- Nomes dos `it()` em português descrevendo o comportamento esperado

## O que você PODE fazer

- Criar e editar qualquer arquivo em `src/`
- Criar e editar arquivos de migração em `prisma/migrations/`
- Editar `prisma/schema.prisma` quando a task envolver mudanças de schema

## O que você NÃO deve fazer

- Modificar arquivos `.test.ts` ou `.spec.ts`
- Alterar `tsconfig.json`, `.eslintrc.json`, `.prettierrc`
- Instalar dependências sem listar explicitamente no plano
- Usar `as any` ou `@ts-ignore`
- Fazer chamadas de rede reais em testes (use mocks)
- Commitar arquivos `.env` ou credenciais

## Padrão de referência

Antes de implementar um módulo novo, leia `src/modules/products/create.ts`
e `src/modules/products/create.test.ts` como referência de padrão.
