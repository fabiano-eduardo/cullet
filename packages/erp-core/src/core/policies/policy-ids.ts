import { ValidationCode } from "../exceptions/validation-code";
import { InvalidValueException } from "../exceptions/validation-exception";
import { ValidationField } from "../exceptions/validation-field";

type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type PolicyDefinitionId = Brand<string, "PolicyDefinitionId">;
export type PolicyDecisionId = Brand<string, "PolicyDecisionId">;
export type TenantId = Brand<string, "TenantId">;
export type SchoolId = Brand<string, "SchoolId">;

const POLICY_DEFINITION_ID_FIELD = ValidationField.of("policyDefinitionId");
const POLICY_DECISION_ID_FIELD = ValidationField.of("policyDecisionId");
const TENANT_ID_FIELD = ValidationField.of("tenantId");
const SCHOOL_ID_FIELD = ValidationField.of("schoolId");

function assertIdString(value: unknown, field: ValidationField): string {
  if (typeof value !== "string") {
    throw new InvalidValueException(
      field,
      ValidationCode.INVALID_FORMAT,
      `${field.value} must be a string, got ${typeof value}`,
    );
  }

  if (value.trim().length === 0) {
    throw new InvalidValueException(
      field,
      ValidationCode.BLANK,
      `${field.value} must be a non-empty string`,
    );
  }

  return value;
}

function brandId<TBrand extends string>(
  value: unknown,
  field: ValidationField,
): Brand<string, TBrand> {
  return assertIdString(value, field) as Brand<string, TBrand>;
}

export function asPolicyDefinitionId(value: string): PolicyDefinitionId {
  return brandId<"PolicyDefinitionId">(value, POLICY_DEFINITION_ID_FIELD);
}

export function asPolicyDecisionId(value: string): PolicyDecisionId {
  return brandId<"PolicyDecisionId">(value, POLICY_DECISION_ID_FIELD);
}

export function asTenantId(value: string): TenantId {
  return brandId<"TenantId">(value, TENANT_ID_FIELD);
}

export function asSchoolId(value: string): SchoolId {
  return brandId<"SchoolId">(value, SCHOOL_ID_FIELD);
}
