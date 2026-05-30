import { describe, expect, it, vi } from "vitest";

import { Err, Ok, Result } from "./result";

describe("Result", () => {
  describe("happy path", () => {
    it("creates an Ok result through the factory and exposes matching type guards", () => {
      const result = Result.ok("value");

      expect(result).toBeInstanceOf(Ok);
      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
      expect(result.match({ ok: (value) => value, err: () => "error" })).toBe(
        "value",
      );
    });

    it("creates an Err result through the factory and exposes matching type guards", () => {
      const result = Result.err("failure");

      expect(result).toBeInstanceOf(Err);
      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
      expect(result.match({ ok: () => "value", err: (error) => error })).toBe(
        "failure",
      );
    });

    it("returns value and null helpers for an Ok result", () => {
      const result = Result.ok({ id: "user-1" });

      expect(result.getOrNull()).toEqual({ id: "user-1" });
      expect(result.errorOrNull()).toBeNull();
      expect(result.getOrThrow()).toEqual({ id: "user-1" });
    });

    it("returns the error helper for an Err result", () => {
      const result = Result.err({ code: "INVALID" });

      expect(result.getOrNull()).toBeNull();
      expect(result.errorOrNull()).toEqual({ code: "INVALID" });
    });

    it("maps the value when the result is Ok", () => {
      const result = Result.ok(21);
      const mapped = result.map((value) => value * 2);

      expect(mapped.isOk()).toBe(true);
      expect(mapped.getOrNull()).toBe(42);
    });

    it("maps the error when the result is Err", () => {
      const result = Result.err("invalid_state");
      const mapped = result.mapError((error) => error.toUpperCase());

      expect(mapped.isErr()).toBe(true);
      expect(mapped.errorOrNull()).toBe("INVALID_STATE");
    });

    it("chains another result when flatMap receives an Ok result", () => {
      const result = Result.ok(5);
      const mapped = result.flatMap((value) => Result.ok(value + 3));

      expect(mapped.isOk()).toBe(true);
      expect(mapped.getOrNull()).toBe(8);
    });

    it("allows flatMap to switch from Ok to Err", () => {
      const result = Result.ok("token").mapError(() => "unused");
      const mapped = result.flatMap((value) => Result.err(`${value}_expired`));

      expect(mapped.isErr()).toBe(true);
      expect(mapped.errorOrNull()).toBe("token_expired");
    });
  });

  describe("error cases", () => {
    it("throws the original Error when getOrThrow is called on an Err result with Error", () => {
      const originalError = new Error("boom");
      const result = Result.err(originalError);

      expect(() => result.getOrThrow()).toThrow("boom");
    });

    it("wraps non-Error payloads into Error when getOrThrow is called on an Err result", () => {
      const result = Result.err("domain_failure");

      expect(() => result.getOrThrow()).toThrowError(
        new Error("domain_failure"),
      );
    });
  });

  describe("edge cases", () => {
    it("preserves undefined values inside an Ok result", () => {
      const result = Result.ok<string | undefined>(undefined);

      expect(result.getOrNull()).toBeUndefined();
      expect(
        result.match({ ok: (value) => value, err: () => "fallback" }),
      ).toBe(undefined);
    });

    it("preserves falsy mapped values", () => {
      const result = Result.ok("filled");
      const mapped = result.map(() => "");

      expect(mapped.getOrNull()).toBe("");
    });

    it("does not call map transform when the result is Err", () => {
      const transform = vi.fn((value: number) => value * 2);
      const originalError = { code: "FORBIDDEN" };
      const result = Result.err(originalError);
      const mapped = result.map(transform);

      expect(transform).not.toHaveBeenCalled();
      expect(mapped.isErr()).toBe(true);
      expect(mapped.errorOrNull()).toBe(originalError);
    });

    it("does not call mapError transform when the result is Ok", () => {
      const transform = vi.fn((error: string) => error.toUpperCase());
      const result = Result.ok("safe");
      const mapped = result.mapError(transform);

      expect(transform).not.toHaveBeenCalled();
      expect(mapped.isOk()).toBe(true);
      expect(mapped.getOrNull()).toBe("safe");
    });

    it("does not call flatMap transform when the result is Err", () => {
      const transform = vi.fn((value: number) => Result.ok(value * 2));
      const result = Result.err("not_allowed");
      const mapped = result.flatMap(transform);

      expect(transform).not.toHaveBeenCalled();
      expect(mapped.isErr()).toBe(true);
      expect(mapped.errorOrNull()).toBe("not_allowed");
    });

    it("freezes Ok and Err instances", () => {
      const ok = Result.ok({ id: 1 });
      const err = Result.err({ code: "FAIL" });

      expect(Object.isFrozen(ok)).toBe(true);
      expect(Object.isFrozen(err)).toBe(true);
    });
  });
});
