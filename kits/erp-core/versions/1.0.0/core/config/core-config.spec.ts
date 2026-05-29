import { describe, expect, it, vi } from "vitest";

import type { PolicyEvent, PolicyReporter } from ".";
import { GateEngineV1 } from "../policies/engines/v1/gate";

import { CoreConfig } from "./core-config";

function makeMockReporter(): PolicyReporter & {
  report: ReturnType<typeof vi.fn>;
} {
  return { report: vi.fn<(event: PolicyEvent) => void>() };
}

describe("CoreConfig", () => {
  it("shares a configured reporter with core engines", () => {
    const reporter = makeMockReporter();
    const config = new CoreConfig({
      observability: {
        reporter,
      },
    });
    const engine = new GateEngineV1({ coreConfig: config });

    const result = engine.evaluate(
      {
        condition: {
          field: "student.flags.financialHold",
          op: "eq",
          value: true,
        },
      },
      {},
    );

    expect(result.isErr()).toBe(true);
    const calls = reporter.report.mock.calls as Array<[PolicyEvent]>;
    const warnCalls = calls.filter(([e]) => e.level === "warn");
    const errorCalls = calls.filter(([e]) => e.level === "error");
    expect(warnCalls).toHaveLength(1);
    expect(warnCalls[0][0]).toMatchObject({
      kind: "condition-eval",
      level: "warn",
    });
    expect(errorCalls).toHaveLength(0);
  });

  it("allows reconfiguring the same instance without recreating the engine", () => {
    const reporter = makeMockReporter();
    const config = new CoreConfig();
    const engine = new GateEngineV1({ coreConfig: config });

    config.configure({
      observability: {
        reporter,
      },
    });

    const result = engine.evaluate(
      {
        allowIf: {
          field: "student.flags.financialHold",
          op: "eq",
          value: true,
        },
        defaultOutcome: "DENY",
      },
      {},
    );

    expect(result.isErr()).toBe(true);
    const calls = reporter.report.mock.calls as Array<[PolicyEvent]>;
    const warnCalls = calls.filter(([e]) => e.level === "warn");
    const errorCalls = calls.filter(([e]) => e.level === "error");
    expect(warnCalls).toHaveLength(1);
    expect(warnCalls[0][0]).toMatchObject({
      kind: "condition-eval",
      level: "warn",
    });
    expect(errorCalls).toHaveLength(0);
  });

  it("reset() restores the instance to its initial reporter", () => {
    const initialReporter = makeMockReporter();
    const config = new CoreConfig({
      observability: { reporter: initialReporter },
    });
    const engine = new GateEngineV1({ coreConfig: config });

    const temporaryReporter = makeMockReporter();
    config.configure({ observability: { reporter: temporaryReporter } });
    config.reset();

    engine.evaluate(
      {
        condition: {
          field: "missing.field",
          op: "eq",
          value: true,
        },
      },
      {},
    );

    expect(temporaryReporter.report).not.toHaveBeenCalled();
    expect(initialReporter.report).toHaveBeenCalledOnce();
  });
});
