type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type PolicyDefinitionId = Brand<string, "PolicyDefinitionId">;
export type PolicyDecisionId = Brand<string, "PolicyDecisionId">;
export type TenantId = Brand<string, "TenantId">;
export type SchoolId = Brand<string, "SchoolId">;

export function asPolicyDefinitionId(value: string): PolicyDefinitionId {
  return value as PolicyDefinitionId;
}

export function asPolicyDecisionId(value: string): PolicyDecisionId {
  return value as PolicyDecisionId;
}

export function asTenantId(value: string): TenantId {
  return value as TenantId;
}

export function asSchoolId(value: string): SchoolId {
  return value as SchoolId;
}
