// Barrel for the zod-free RBAC module: the pure domain primitives, the pure
// decisor, the optional policy bridge, and the AuthorizerPort seam (which
// physically lives under application/ports/ but is surfaced here as the RBAC
// public home).

export type { AuthorizerPort } from "../application/ports/authorizer.port.js";

export type { AccessRequest } from "./access-request.js";
export { RbacAuthorizer } from "./authorizer.js";
export { Grant, type GrantProps } from "./domain/grant.js";
export { Permission, type PermissionProps } from "./domain/permission.js";
export {
    definePermissionCatalog,
    type PermissionCatalog,
} from "./domain/permission-catalog.js";
export { PermissionSet } from "./domain/permission-set.js";
export { Role, type RoleProps } from "./domain/role.js";
export { Scope, type ScopeProps } from "./domain/scope.js";
export { rbacContextFields } from "./policy-bridge.js";
