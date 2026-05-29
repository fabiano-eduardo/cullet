import { describe, expect, it } from "vitest";

import { Outcome } from "./outcome";

describe("Outcome", () => {
  describe("of()", () => {
    it("creates an outcome with status and data", () => {
      const outcome = Outcome.of("CUSTOM", { id: 1 });

      expect(outcome.status).toBe("CUSTOM");
      expect(outcome.data).toEqual({ id: 1 });
    });

    it("stores reason when provided", () => {
      const outcome = Outcome.of("CUSTOM", undefined, "reason for the outcome");

      expect(outcome.reason).toBe("reason for the outcome");
    });

    it("has undefined reason when not provided", () => {
      const outcome = Outcome.of("CUSTOM", undefined);

      expect(outcome.reason).toBeUndefined();
    });

    it("stores metadata when provided", () => {
      const outcome = Outcome.of("CUSTOM", undefined, undefined, {
        source: "job",
        retries: 3,
      });

      expect(outcome.metadata).toEqual({ source: "job", retries: 3 });
    });

    it("has empty metadata when not provided", () => {
      const outcome = Outcome.of("CUSTOM", undefined);

      expect(outcome.metadata).toEqual({});
    });

    it("creates an immutable (frozen) instance", () => {
      const outcome = Outcome.of("CUSTOM", undefined);

      expect(Object.isFrozen(outcome)).toBe(true);
    });

    it("freezes metadata", () => {
      const outcome = Outcome.of("CUSTOM", undefined, undefined, {
        key: "value",
      });

      expect(Object.isFrozen(outcome.metadata)).toBe(true);
    });
  });

  describe("approved()", () => {
    it("creates an outcome with status APPROVED", () => {
      const outcome = Outcome.approved({ userId: "u1" });

      expect(outcome.status).toBe("APPROVED");
      expect(outcome.data).toEqual({ userId: "u1" });
    });

    it("stores reason when provided", () => {
      const outcome = Outcome.approved(undefined, "credit available");

      expect(outcome.reason).toBe("credit available");
    });

    it("has undefined reason when omitted", () => {
      const outcome = Outcome.approved(undefined);

      expect(outcome.reason).toBeUndefined();
    });
  });

  describe("rejected()", () => {
    it("creates an outcome with status REJECTED and a required reason", () => {
      const outcome = Outcome.rejected(
        { violations: ["field x"] },
        "invalid data",
      );

      expect(outcome.status).toBe("REJECTED");
      expect(outcome.reason).toBe("invalid data");
      expect(outcome.data).toEqual({ violations: ["field x"] });
    });
  });

  describe("noOp()", () => {
    it("creates an outcome with status NO_OP", () => {
      const outcome = Outcome.noOp(undefined);

      expect(outcome.status).toBe("NO_OP");
    });

    it("stores reason when provided", () => {
      const outcome = Outcome.noOp(undefined, "no action required");

      expect(outcome.reason).toBe("no action required");
    });
  });

  describe("deferred()", () => {
    it("creates an outcome with status DEFERRED", () => {
      const outcome = Outcome.deferred(undefined, "awaiting manual approval");

      expect(outcome.status).toBe("DEFERRED");
      expect(outcome.reason).toBe("awaiting manual approval");
    });
  });

  describe("requiresReview()", () => {
    it("creates an outcome with status REQUIRES_REVIEW", () => {
      const outcome = Outcome.requiresReview(undefined, "risk review required");

      expect(outcome.status).toBe("REQUIRES_REVIEW");
      expect(outcome.reason).toBe("risk review required");
    });
  });

  describe("is()", () => {
    it("returns true when the status matches", () => {
      const outcome = Outcome.approved(undefined);

      expect(outcome.is("APPROVED")).toBe(true);
    });

    it("returns false when the status does not match", () => {
      const outcome = Outcome.of<"APPROVED" | "REJECTED">(
        "REJECTED",
        undefined,
        "reason",
      );

      expect(outcome.is("APPROVED")).toBe(false);
    });
  });

  describe("match()", () => {
    it("calls the handler matching the status", () => {
      const outcome = Outcome.approved({ id: 42 });
      const result = outcome.match({
        APPROVED: (o) => `approved: ${o.data?.id}`,
        REJECTED: () => "rejected",
      });

      expect(result).toBe("approved: 42");
    });

    it("returns the correct value for status REJECTED", () => {
      const outcome = Outcome.rejected(undefined, "no balance");
      const result = outcome.match({
        APPROVED: () => "ok",
        REJECTED: (o) => `failed: ${o.reason}`,
      });

      expect(result).toBe("failed: no balance");
    });
  });

  describe("withMetadata()", () => {
    it("returns a new outcome with merged metadata", () => {
      const original = Outcome.of("STATUS", undefined, undefined, {
        source: "api",
      });
      const updated = original.withMetadata({ traceId: "abc-123" });

      expect(updated.metadata).toEqual({
        source: "api",
        traceId: "abc-123",
      });
    });

    it("does not mutate the original outcome", () => {
      const original = Outcome.of("STATUS", undefined, undefined, {
        key: "value",
      });
      original.withMetadata({ added: true });

      expect(original.metadata).toEqual({ key: "value" });
    });

    it("preserves the original status, data, and reason", () => {
      const original = Outcome.approved({ x: 1 }, "reason");
      const updated = original.withMetadata({ extra: true });

      expect(updated.status).toBe("APPROVED");
      expect(updated.data).toEqual({ x: 1 });
      expect(updated.reason).toBe("reason");
    });

    it("returns frozen metadata", () => {
      const outcome = Outcome.of("S", undefined).withMetadata({ a: 1 });

      expect(Object.isFrozen(outcome.metadata)).toBe(true);
    });
  });

  describe("withReason()", () => {
    it("returns a new outcome with a new reason", () => {
      const original = Outcome.approved(undefined, "old reason");
      const updated = original.withReason("new reason");

      expect(updated.reason).toBe("new reason");
    });

    it("does not mutate the original outcome", () => {
      const original = Outcome.approved(undefined, "original");
      original.withReason("new");

      expect(original.reason).toBe("original");
    });

    it("preserves the original status, data, and metadata", () => {
      const original = Outcome.of("STATUS", 42, undefined, { k: "v" });
      const updated = original.withReason("updated reason");

      expect(updated.status).toBe("STATUS");
      expect(updated.data).toBe(42);
      expect(updated.metadata).toEqual({ k: "v" });
    });
  });

  describe("toString()", () => {
    it("includes only the status when there is no reason", () => {
      const outcome = Outcome.approved(undefined);

      expect(outcome.toString()).toBe("Outcome(APPROVED)");
    });

    it("includes status and reason when reason is present", () => {
      const outcome = Outcome.rejected(undefined, "insufficient balance");

      expect(outcome.toString()).toBe(
        'Outcome(REJECTED, reason="insufficient balance")',
      );
    });
  });
});
