import { describe, expect, it } from "vitest";

import { DomainException } from "./domain-exception";
import { EntityNotFoundException } from "./entity-not-found-exception";

describe("EntityNotFoundException", () => {
  describe("constructor", () => {
    it("composes the message with entityName and identifier", () => {
      const exception = new EntityNotFoundException("Customer", "cust-123");

      expect(exception.message).toBe(
        "Customer with identifier cust-123 was not found.",
      );
    });

    it("composes correctly with different names and identifiers", () => {
      const exception = new EntityNotFoundException("Order", "order-uuid-999");

      expect(exception.message).toBe(
        "Order with identifier order-uuid-999 was not found.",
      );
    });

    it("accepts numeric identifiers as strings", () => {
      const exception = new EntityNotFoundException("Product", "42");

      expect(exception.message).toBe(
        "Product with identifier 42 was not found.",
      );
    });

    it("accepts empty strings", () => {
      const exception = new EntityNotFoundException("", "");

      expect(exception.message).toBe(" with identifier  was not found.");
    });
  });

  describe("inheritance", () => {
    it("is an instance of DomainException", () => {
      const exception = new EntityNotFoundException("X", "y");

      expect(exception).toBeInstanceOf(DomainException);
    });

    it("is an instance of EntityNotFoundException", () => {
      const exception = new EntityNotFoundException("X", "y");

      expect(exception).toBeInstanceOf(EntityNotFoundException);
    });
  });
});
