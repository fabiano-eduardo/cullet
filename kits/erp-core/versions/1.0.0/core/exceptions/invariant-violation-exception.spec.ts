import { describe, expect, it } from "vitest";

import { DomainException } from "./domain-exception";
import { InvariantViolationException } from "./invariant-violation-exception";

describe("InvariantViolationException", () => {
  describe("constructor", () => {
    it("stores the provided message", () => {
      const exception = new InvariantViolationException("invariant violated");

      expect(exception.message).toBe("invariant violated");
    });

    it("accepts an empty message", () => {
      const exception = new InvariantViolationException("");

      expect(exception.message).toBe("");
    });
  });

  describe("inheritance", () => {
    it("is an instance of DomainException", () => {
      const exception = new InvariantViolationException("msg");

      expect(exception).toBeInstanceOf(DomainException);
    });

    it("is an instance of InvariantViolationException", () => {
      const exception = new InvariantViolationException("msg");

      expect(exception).toBeInstanceOf(InvariantViolationException);
    });
  });
});
