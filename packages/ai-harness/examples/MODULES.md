# MODULES.md

Catálogo dos módulos existentes e seus contratos públicos.
Consulte antes de implementar um módulo que dependa de outro.

---

## src/modules/products

**Status**: implementado

Use cases disponíveis:

- `createProduct(input: CreateProductInput): Promise<Product>`
- `findProductById(id: string, orgId: string): Promise<Product>`
- `listProducts(orgId: string, filters: ProductFilters): Promise<Product[]>`
- `updateProduct(id: string, input: UpdateProductInput): Promise<Product>`
- `deleteProduct(id: string, orgId: string): Promise<void>`

Tipos em `src/modules/products/types.ts`.

## src/modules/users

**Status**: parcialmente implementado

Use cases disponíveis:

- `findUserById(id: string): Promise<User>`

Faltando (tasks pendentes):

- `createUser`, `updateUser`, `deleteUser`, `listUsers`

## src/errors/index.ts

Classes de erro disponíveis:

- `AppError(message, statusCode)` — base
- `NotFoundError(resource, id)` — HTTP 404
- `UnauthorizedError(reason?)` — HTTP 401
- `ForbiddenError(reason?)` — HTTP 403
- `ValidationError(details)` — HTTP 422
- `ConflictError(message)` — HTTP 409

## src/repositories

Repositories disponíveis:

- `ProductRepository` — CRUD completo
- `UserRepository` — findById apenas (outros pendentes)
- `OrganizationRepository` — findById, findBySlug

## test/helpers.ts

Helpers de teste disponíveis:

- `createTestApp()` — cria instância Express com middlewares para testes
- `createTestUser(overrides?)` — cria usuário com dados padrão
- `createTestOrg(overrides?)` — cria organização com dados padrão
- `generateTestToken(userId, orgId)` — gera JWT válido para testes
