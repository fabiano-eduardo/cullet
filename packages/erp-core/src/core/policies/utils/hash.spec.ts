import { describe, expect, it } from "vitest";

import { PolicyHashing } from "./hash";

describe("PolicyHashing.canonicalJson", () => {
  it("normalizes object key order recursively", () => {
    const left = {
      policyKey: "financial.charges.charge_eligibility",
      payload: {
        meta: {
          zebra: true,
          alpha: false,
        },
        condition: {
          value: "ACTIVE",
          op: "eq",
          field: "student.contractStatus",
        },
      },
    };
    const right = {
      payload: {
        condition: {
          field: "student.contractStatus",
          op: "eq",
          value: "ACTIVE",
        },
        meta: {
          alpha: false,
          zebra: true,
        },
      },
      policyKey: "financial.charges.charge_eligibility",
    };

    expect(PolicyHashing.canonicalJson(left)).toBe(
      PolicyHashing.canonicalJson(right),
    );
  });

  it("preserves array order to distinguish ordered payloads", () => {
    const firstPayload = {
      rules: [
        { when: "LOW_RISK", result: "allow" },
        { when: "HIGH_RISK", result: "deny" },
      ],
    };
    const secondPayload = {
      rules: [
        { when: "HIGH_RISK", result: "deny" },
        { when: "LOW_RISK", result: "allow" },
      ],
    };

    expect(PolicyHashing.canonicalJson(firstPayload)).not.toBe(
      PolicyHashing.canonicalJson(secondPayload),
    );
    expect(
      PolicyHashing.computePayloadHash(
        firstPayload,
        "financial.charges.charge_eligibility",
        "1.0.0",
      ),
    ).not.toBe(
      PolicyHashing.computePayloadHash(
        secondPayload,
        "financial.charges.charge_eligibility",
        "1.0.0",
      ),
    );
  });

  it("rejects undefined, NaN, Infinity, bigint, symbol, and function", () => {
    expect(() => PolicyHashing.canonicalJson({ a: undefined })).toThrow(
      /undefined/,
    );
    expect(() => PolicyHashing.canonicalJson({ a: Number.NaN })).toThrow(
      /non-finite/,
    );
    expect(() =>
      PolicyHashing.canonicalJson({ a: Number.POSITIVE_INFINITY }),
    ).toThrow(/non-finite/);
    expect(() => PolicyHashing.canonicalJson({ a: BigInt(1) })).toThrow(
      /bigint/,
    );
    expect(() => PolicyHashing.canonicalJson({ a: Symbol("x") })).toThrow(
      /symbol/,
    );
    expect(() => PolicyHashing.canonicalJson({ a: () => undefined })).toThrow(
      /function/,
    );
    expect(() =>
      PolicyHashing.canonicalJson({ at: new Date("invalid") }),
    ).toThrow(/Invalid Date/);
  });

  it("normalizes keys of objects inside arrays without reordering items", () => {
    const left = {
      rules: [
        { result: "allow", when: "LOW_RISK" },
        { meta: { zebra: true, alpha: false } },
      ],
    };
    const right = {
      rules: [
        { when: "LOW_RISK", result: "allow" },
        { meta: { alpha: false, zebra: true } },
      ],
    };

    expect(PolicyHashing.canonicalJson(left)).toBe(
      PolicyHashing.canonicalJson(right),
    );
  });
});
