import { describe, expect, it } from "vitest";

import { BusinessRuleViolationException } from "./business-rule-violation-exception";
import { DomainException } from "./domain-exception";

describe("BusinessRuleViolationException", () => {
  describe("constructor", () => {
    it("stores the provided rule and message", () => {
      const exception = new BusinessRuleViolationException(
        "INSUFFICIENT_BALANCE",
        "The available balance is insufficient for this operation",
      );

      expect(exception.rule).toBe("INSUFFICIENT_BALANCE");
      expect(exception.message).toBe(
        "The available balance is insufficient for this operation",
      );
    });

    it("accepts empty strings for rule and message", () => {
      const exception = new BusinessRuleViolationException("", "");

      expect(exception.rule).toBe("");
      expect(exception.message).toBe("");
    });

    it("accepts rules with special characters", () => {
      const rule = "MODULE.SUBDOMAIN.COMPLEX_RULE_123";
      const exception = new BusinessRuleViolationException(rule, "msg");

      expect(exception.rule).toBe(rule);
    });
  });

  describe("inheritance", () => {
    it("is an instance of DomainException", () => {
      const exception = new BusinessRuleViolationException("RULE", "msg");

      expect(exception).toBeInstanceOf(DomainException);
    });

    it("is an instance of BusinessRuleViolationException", () => {
      const exception = new BusinessRuleViolationException("RULE", "msg");

      expect(exception).toBeInstanceOf(BusinessRuleViolationException);
    });
  });
});
