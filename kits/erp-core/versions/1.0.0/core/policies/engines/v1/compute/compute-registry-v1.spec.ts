import { describe, expect, it, vi } from "vitest";

import {
  CoreConfig,
  type PolicyEvent,
  type PolicyReporter,
} from "../../../../config";
import { Outcome } from "../../../../result/outcome";
import { Result } from "../../../../result/result";

import { ComputeRegistry } from "../../compute-registry";
import { ComputeEngineV1 } from "./compute-engine-v1";
import type {
  ComputeEvaluator,
  ComputeEvaluatorRegistration,
  ComputeOutcome,
} from "../../compute-types";

class ComputeEngineV2 extends ComputeEngineV1 {
  // @ts-expect-error - intentional version override to test multi-version dispatch
  readonly version = 2;
}

function makeEvaluator(
  policyKey: string,
  version: number,
): ComputeEvaluatorRegistration & {
  readonly evaluator: ComputeEvaluator & {
    readonly evaluate: ReturnType<typeof vi.fn>;
  };
} {
  const evaluator: ComputeEvaluator & {
    readonly evaluate: ReturnType<typeof vi.fn>;
  } = {
    evaluate: vi.fn((resolvedValue: unknown) => {
      return Result.ok(
        Outcome.of<
          ComputeOutcome["status"],
          { values: unknown; violations: [] }
        >("OK", {
          values: {
            version,
            resolvedValue,
          },
          violations: [],
        }),
      );
    }),
  };

  return {
    policyKey,
    version,
    evaluator,
  };
}

function makeReporter(): PolicyReporter & { report: ReturnType<typeof vi.fn> } {
  return { report: vi.fn<(event: PolicyEvent) => void>() };
}

function makeCoreConfig(reporter: PolicyReporter): CoreConfig {
  return new CoreConfig({
    observability: {
      reporter,
    },
  });
}

describe("ComputeRegistry", () => {
  it("dispatches the evaluator by key and engine version", () => {
    const policyKey = "financial.charges.late_charge_computation";
    const registry = new ComputeRegistry();
    const evaluatorV1 = makeEvaluator(policyKey, 1);
    const evaluatorV2 = makeEvaluator(policyKey, 2);

    registry.registerEngine(new ComputeEngineV2());
    registry.register(evaluatorV1);
    registry.register(evaluatorV2);

    const result = registry.evaluate(
      policyKey,
      2,
      1,
      { type: "params", data: { fineRate: 0.02 } },
      {},
    );

    expect(result.isOk()).toBe(true);
    expect(evaluatorV1.evaluator.evaluate).not.toHaveBeenCalled();
    expect(evaluatorV2.evaluator.evaluate).toHaveBeenCalledOnce();
    expect(result.getOrNull()!.data.values).toEqual({
      version: 2,
      resolvedValue: { fineRate: 0.02 },
    });
  });

  it("returns an error when the requested version is not registered", () => {
    const policyKey = "financial.charges.late_charge_computation";
    const registry = new ComputeRegistry();

    registry.register(makeEvaluator(policyKey, 1));

    const result = registry.evaluate(policyKey, 2, 1, { type: "params" }, {});

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toBe(
      'No compute engine registered for version "2"',
    );
  });

  it("returns an error when the payload fails the versioned parser", () => {
    const policyKey = "financial.charges.late_charge_computation";
    const registry = new ComputeRegistry();
    const evaluator = makeEvaluator(policyKey, 1);

    registry.register(evaluator);

    const result = registry.evaluate(policyKey, 1, 1, { type: "params" }, {});

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toContain("Invalid compute payload:");
    expect(evaluator.evaluator.evaluate).not.toHaveBeenCalled();
  });

  it("resolves decision tables before calling the evaluator", () => {
    const policyKey = "financial.billing.psp_selection";
    const registry = new ComputeRegistry();
    const evaluator = makeEvaluator(policyKey, 1);

    registry.register(evaluator);

    const result = registry.evaluate(
      policyKey,
      1,
      1,
      {
        type: "decision-table",
        rules: [
          {
            conditions: {
              field: "charge.amountCents",
              op: "gte",
              value: 300000,
            },
            result: "premium",
          },
          {
            conditions: {
              field: "charge.amountCents",
              op: "gte",
              value: 100000,
            },
            result: "standard",
          },
        ],
        default: "basic",
      },
      {
        charge: {
          amountCents: 150000,
        },
      },
    );

    expect(result.isOk()).toBe(true);
    expect(evaluator.evaluator.evaluate).toHaveBeenCalledWith("standard", {
      charge: {
        amountCents: 150000,
      },
    });
  });

  it("resolves a decision-table comparing Date against an ISO UTC string", () => {
    const policyKey = "financial.billing.cutoff";
    const registry = new ComputeRegistry();
    const evaluator = makeEvaluator(policyKey, 1);

    registry.register(evaluator);

    const result = registry.evaluate(
      policyKey,
      1,
      1,
      {
        type: "decision-table",
        rules: [
          {
            conditions: {
              field: "charge.dueDate",
              op: "lt",
              value: "2026-02-01T00:00:00.000Z",
            },
            result: "before-cutoff",
          },
        ],
        default: "after-cutoff",
      },
      {
        charge: {
          dueDate: new Date("2026-01-15T00:00:00.000Z"),
        },
      },
    );

    expect(result.isOk()).toBe(true);
    expect(evaluator.evaluator.evaluate).toHaveBeenCalledWith("before-cutoff", {
      charge: {
        dueDate: new Date("2026-01-15T00:00:00.000Z"),
      },
    });
  });

  it("reports a technical evaluation failure via the optional reporter", () => {
    const policyKey = "financial.billing.psp_selection";
    const reporter = makeReporter();
    const registry = new ComputeRegistry({
      coreConfig: makeCoreConfig(reporter),
    });
    const evaluator = makeEvaluator(policyKey, 1);

    registry.register(evaluator);

    const result = registry.evaluate(
      policyKey,
      1,
      1,
      {
        type: "decision-table",
        rules: [
          {
            conditions: {
              field: "charge.amountCents",
              op: "gte",
              value: 300000,
            },
            result: "premium",
          },
        ],
        default: "basic",
      },
      {
        charge: {
          get amountCents(): number {
            throw new RangeError("context exploded");
          },
        },
      },
    );

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toContain("COMPUTE_CONDITION_EVAL_FAILED");
    expect(result.errorOrNull()).toContain("CONDITION_EVAL_THREW");
    expect(reporter.report).toHaveBeenCalledOnce();
    expect(reporter.report).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "condition-eval",
        level: "error",
        tag: "CONDITION_EVAL_THREW",
        engineVersion: 1,
      }),
    );
    expect(evaluator.evaluator.evaluate).not.toHaveBeenCalled();
  });

  it("returns an error when a decision-table receives null in a numeric operator without allowNull", () => {
    const policyKey = "financial.billing.psp_selection";
    const reporter = makeReporter();
    const registry = new ComputeRegistry({
      coreConfig: makeCoreConfig(reporter),
    });
    const evaluator = makeEvaluator(policyKey, 1);

    registry.register(evaluator);

    const result = registry.evaluate(
      policyKey,
      1,
      1,
      {
        type: "decision-table",
        rules: [
          {
            conditions: {
              field: "charge.amountCents",
              op: "gte",
              value: 300000,
            },
            result: "premium",
          },
        ],
        default: "basic",
      },
      {
        charge: {
          amountCents: null,
        },
      },
    );

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toContain("COMPUTE_CONDITION_EVAL_FAILED");
    expect(result.errorOrNull()).toContain(
      "NULLISH_NUMERIC_OPERAND_NOT_ALLOWED",
    );
    expect(reporter.report).toHaveBeenCalledOnce();
    expect(reporter.report).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "condition-eval",
        level: "error",
        tag: "NULLISH_NUMERIC_OPERAND_NOT_ALLOWED",
        engineVersion: 1,
      }),
    );
    expect(evaluator.evaluator.evaluate).not.toHaveBeenCalled();
  });

  it("returns an error when a decision-table receives an invalid ISO operand in a date comparison", () => {
    const policyKey = "financial.billing.cutoff";
    const reporter = makeReporter();
    const registry = new ComputeRegistry({
      coreConfig: makeCoreConfig(reporter),
    });
    const evaluator = makeEvaluator(policyKey, 1);

    registry.register(evaluator);

    const result = registry.evaluate(
      policyKey,
      1,
      1,
      {
        type: "decision-table",
        rules: [
          {
            conditions: {
              field: "charge.dueDate",
              op: "lt",
              value: "2026-13-01T00:00:00.000Z",
            },
            result: "before-cutoff",
          },
        ],
        default: "after-cutoff",
      },
      {
        charge: {
          dueDate: new Date("2026-01-15T00:00:00.000Z"),
        },
      },
    );

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toContain("COMPUTE_CONDITION_EVAL_FAILED");
    expect(result.errorOrNull()).toContain("INVALID_DATE_OPERAND");
    expect(reporter.report).toHaveBeenCalledOnce();
    expect(reporter.report).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "condition-eval",
        level: "error",
        tag: "INVALID_DATE_OPERAND",
        engineVersion: 1,
      }),
    );
    expect(evaluator.evaluator.evaluate).not.toHaveBeenCalled();
  });
});
