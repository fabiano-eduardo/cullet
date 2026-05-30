import { describe, expect, it } from "vitest";

import { PolicyContextPath } from "./path";

describe("setPath", () => {
  it("creates intermediate objects when the path does not yet exist", () => {
    const context = {};

    const result = PolicyContextPath.set(
      context,
      "student.flags.financialHold",
      true,
    );

    expect(result.isOk()).toBe(true);
    expect(context).toEqual({
      student: {
        flags: {
          financialHold: true,
        },
      },
    });
  });

  it("fails when an intermediate segment already contains a non-plain object", () => {
    const dueDate = new Date("2026-01-01T14:00:00.000Z");
    const context = {
      installment: {
        dueDate,
      },
    };

    const result = PolicyContextPath.set(
      context,
      "installment.dueDate.hour",
      14,
    );

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toBe(
      'Cannot create nested path "installment.dueDate.hour" because "installment.dueDate" already contains a non-plain object',
    );
    expect(context.installment.dueDate).toBe(dueDate);
  });

  it("rejects forbidden path segments and does not pollute Object.prototype", () => {
    const context = {};

    const result = PolicyContextPath.set(context, "__proto__.x", true);

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toBe(
      'Path "__proto__.x" contains forbidden segment "__proto__"',
    );
    expect(Object.prototype).not.toHaveProperty("x");
    expect(context).toEqual({});
  });

  it("reports presence for existing paths, even when the value is undefined", () => {
    const context = {
      student: {
        balanceCents: null,
        status: undefined,
      },
    };

    expect(PolicyContextPath.has(context, "student.balanceCents")).toBe(true);
    expect(PolicyContextPath.has(context, "student.status")).toBe(true);
    expect(PolicyContextPath.has(context, "student.missing")).toBe(false);
  });

  it("returns undefined when the field exists and err when the field is missing", () => {
    const context = {
      student: {
        status: undefined,
      },
    };

    const presentResult = PolicyContextPath.getOrAbsent(
      context,
      "student.status",
    );
    const absentResult = PolicyContextPath.getOrAbsent(
      context,
      "student.missing",
    );

    expect(presentResult.isOk()).toBe(true);
    expect(presentResult.getOrNull()).toBeUndefined();
    expect(absentResult.isErr()).toBe(true);
    expect(absentResult.errorOrNull()).toBe("absent");
  });
});
