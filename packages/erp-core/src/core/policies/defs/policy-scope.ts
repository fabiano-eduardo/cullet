import type { PolicyScopeLevel } from "../catalog";
import type { SchoolId, TenantId } from "../policy-ids";

/**
 * Scope attached to a PolicyDefinition — defines where it applies.
 */
export interface PolicyScope {
  readonly level: PolicyScopeLevel;
  readonly tenantId: TenantId | null;
  readonly schoolId: SchoolId | null;
}

/**
 * Ordered list of scopes from most-specific to least-specific.
 * Used by the resolver to match definitions.
 *
 * Example:
 * ```
 * [
 *   { level: 'SCHOOL',  tenantId: 't1', schoolId: 's1' },
 *   { level: 'TENANT',  tenantId: 't1', schoolId: null },
 *   { level: 'GLOBAL',  tenantId: null, schoolId: null },
 * ]
 * ```
 */
export type ScopeChain = readonly PolicyScope[];

/**
 * Numeric weight for scope specificity (higher = more specific).
 */
const SCOPE_WEIGHT: Record<PolicyScopeLevel, number> = {
  SCHOOL: 3,
  TENANT: 2,
  GLOBAL: 1,
};

export class PolicyScopeMatcher {
  static weight(level: PolicyScopeLevel): number {
    return SCOPE_WEIGHT[level];
  }

  static matchesChain(defScope: PolicyScope, chain: ScopeChain): boolean {
    return chain.some((scope) => PolicyScopeMatcher.equals(defScope, scope));
  }

  static equals(a: PolicyScope, b: PolicyScope): boolean {
    return (
      a.level === b.level &&
      a.tenantId === b.tenantId &&
      a.schoolId === b.schoolId
    );
  }
}
