import { describe, expect, it } from "vitest";

import { GatePayloadSchemaV1 } from "./gate-v1-payload.schema";

describe("GatePayloadSchemaV1.parse", () => {
  it("returns Result.ok for a valid payload", () => {
    const payload = {
      allowIf: {
        and: [
          { field: "status", op: "eq", value: "ACTIVE" },
          {
            field: "amount",
            op: "gte",
            value: 100,
            allowNull: true,
          },
        ],
      },
      defaultOutcome: "DENY",
    };

    const result = GatePayloadSchemaV1.parse(payload);

    expect(result.isOk()).toBe(true);
  });

  it("returns Result.err for an invalid payload without throwing", () => {
    const invalidPayload = {
      allowIf: {
        field: "status",
        op: "equals",
        value: "ACTIVE",
      },
      defaultOutcome: "DENY",
    };

    const result = GatePayloadSchemaV1.parse(invalidPayload);

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toContain("Invalid gate payload");
  });

  it("rejects allowNull false on the leaf", () => {
    const payload = {
      condition: {
        field: "amount",
        op: "gte",
        value: 100,
        allowNull: false,
      },
    };

    const result = GatePayloadSchemaV1.parse(payload);

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toContain("Invalid gate payload");
  });

  it("accepts an ISO UTC string as a date-comparison value", () => {
    const payload = {
      condition: {
        field: "charge.dueDate",
        op: "gte",
        value: "2026-01-01T00:00:00.000Z",
      },
    };

    const result = GatePayloadSchemaV1.parse(payload);

    expect(result.isOk()).toBe(true);
  });
});
