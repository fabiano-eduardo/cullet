import { describe, expect, it } from "vitest";

import { ValidationCode } from "../exceptions/validation-code";
import { InvalidValueException } from "../exceptions/validation-exception";
import {
  asPolicyDecisionId,
  asPolicyDefinitionId,
  asSchoolId,
  asTenantId,
} from "./policy-ids";

const idConstructors = [
  {
    build: asPolicyDefinitionId,
    fieldName: "policyDefinitionId",
    validValue: "definition-1",
  },
  {
    build: asPolicyDecisionId,
    fieldName: "policyDecisionId",
    validValue: "decision-1",
  },
  {
    build: asTenantId,
    fieldName: "tenantId",
    validValue: "tenant-1",
  },
  {
    build: asSchoolId,
    fieldName: "schoolId",
    validValue: "school-1",
  },
] as const;

describe("policy-ids constructors", () => {
  it.each(idConstructors)(
    "returns the original value for a valid $fieldName",
    ({ build, validValue }) => {
      expect(build(validValue)).toBe(validValue);
    },
  );

  it.each(idConstructors)(
    "rejects blank $fieldName values",
    ({ build, fieldName }) => {
      try {
        build("   ");
        throw new Error("expected constructor to reject blank value");
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidValueException);

        const exception = error as InvalidValueException;
        expect(exception.field.value).toBe(fieldName);
        expect(exception.code).toBe(ValidationCode.BLANK);
        expect(exception.message).toBe(
          `${fieldName} must be a non-empty string`,
        );
      }
    },
  );

  it("rejects non-string tenant ids at runtime", () => {
    try {
      asTenantId(123 as unknown as string);
      throw new Error("expected constructor to reject non-string value");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidValueException);

      const exception = error as InvalidValueException;
      expect(exception.field.value).toBe("tenantId");
      expect(exception.code).toBe(ValidationCode.INVALID_FORMAT);
      expect(exception.message).toBe("tenantId must be a string, got number");
    }
  });
});
