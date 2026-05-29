import { describe, expect, it, vi } from "vitest";

import { Result } from "../../result/result";
import { asSchoolId, asTenantId } from "../policy-ids";

import { PolicyContextBuilder } from "./context-builder";
import { ContextResolverRegistry } from "./context-registry";
import type { ContextValueResolver } from "./context-resolver";
import type { ContextSeed } from "./context-seed";

const seed: ContextSeed = {
  tenantId: asTenantId("tenant-1"),
  schoolId: asSchoolId("school-1"),
  fields: {},
};

describe("PolicyContextBuilder", () => {
  it("fails immediately when a required resolver is missing", async () => {
    const registry = new ContextResolverRegistry();
    const shouldNotRun = vi.fn(async () => Result.ok("value"));

    registry.register({
      path: "existing.path",
      resolve: shouldNotRun,
    });

    const builder = new PolicyContextBuilder(registry);
    const result = await builder.build(["missing.path", "existing.path"], seed);

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toBe(
      'Missing resolver for path "missing.path"',
    );
    expect(shouldNotRun).not.toHaveBeenCalled();
  });

  it("fails immediately when a resolver returns an error", async () => {
    const registry = new ContextResolverRegistry();
    const shouldNotRun = vi.fn(async () => Result.ok("value"));
    const failingResolver: ContextValueResolver = {
      path: "student.status",
      async resolve() {
        return Result.err("upstream failed");
      },
    };

    registry.register(failingResolver);
    registry.register({
      path: "existing.path",
      resolve: shouldNotRun,
    });

    const builder = new PolicyContextBuilder(registry);
    const result = await builder.build(
      ["student.status", "existing.path"],
      seed,
    );

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toBe(
      'Resolver error for path "student.status": upstream failed',
    );
    expect(shouldNotRun).not.toHaveBeenCalled();
  });

  it("builds the context when every resolver returns success", async () => {
    const registry = new ContextResolverRegistry();

    registry.register({
      path: "student.status",
      async resolve() {
        return Result.ok("ACTIVE");
      },
    });
    registry.register({
      path: "student.balanceCents",
      async resolve() {
        return Result.ok(1500);
      },
    });

    const builder = new PolicyContextBuilder(registry);
    const result = await builder.build(
      ["student.status", "student.balanceCents"],
      seed,
    );

    expect(result.isOk()).toBe(true);
    expect(result.getOrNull()).toEqual({
      student: {
        status: "ACTIVE",
        balanceCents: 1500,
      },
    });
  });

  it("accepts null as the resolved value, but fails for undefined", async () => {
    const registry = new ContextResolverRegistry();

    registry.register({
      path: "student.canceledAt",
      async resolve() {
        return Result.ok(null);
      },
    });
    registry.register({
      path: "student.status",
      async resolve() {
        return Result.ok(undefined);
      },
    });

    const builder = new PolicyContextBuilder(registry);
    const result = await builder.build(
      ["student.canceledAt", "student.status"],
      seed,
    );

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toBe(
      "Context missing required paths after resolution: student.status",
    );
  });

  it("retries transient resolver failures before succeeding", async () => {
    const registry = new ContextResolverRegistry();
    const resolve = vi
      .fn<ContextValueResolver["resolve"]>()
      .mockResolvedValueOnce(Result.err("upstream failed"))
      .mockResolvedValueOnce(Result.err("upstream failed"))
      .mockResolvedValueOnce(Result.ok("ACTIVE"));

    registry.register({
      path: "student.status",
      resilience: {
        retry: {
          maxAttempts: 3,
          initialDelayMs: 0,
          maxDelayMs: 0,
        },
      },
      resolve,
    });

    const builder = new PolicyContextBuilder(registry);
    const result = await builder.build(["student.status"], seed);

    expect(resolve).toHaveBeenCalledTimes(3);
    expect(result.isOk()).toBe(true);
    expect(result.getOrNull()).toEqual({
      student: {
        status: "ACTIVE",
      },
    });
  });

  it("fails when a resolver exceeds its timeout budget", async () => {
    vi.useFakeTimers();

    try {
      const registry = new ContextResolverRegistry();
      const resolve = vi.fn<ContextValueResolver["resolve"]>(() => {
        return new Promise(() => {
          // never resolves
        });
      });

      registry.register({
        path: "student.status",
        resilience: {
          timeoutMs: 50,
        },
        resolve,
      });

      const builder = new PolicyContextBuilder(registry);
      const buildPromise = builder.build(["student.status"], seed);

      await vi.advanceTimersByTimeAsync(50);

      const result = await buildPromise;

      expect(resolve).toHaveBeenCalledTimes(1);
      expect(result.isErr()).toBe(true);
      expect(result.errorOrNull()).toBe(
        'Resolver error for path "student.status": timed out after 50ms',
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens a circuit breaker after repeated resolver failures", async () => {
    let nowMs = 1_000;
    const registry = new ContextResolverRegistry();
    const resolve = vi
      .fn<ContextValueResolver["resolve"]>()
      .mockResolvedValue(Result.err("upstream failed"));

    registry.register({
      path: "student.status",
      resilience: {
        circuitBreaker: {
          failureThreshold: 2,
          cooldownMs: 100,
        },
      },
      resolve,
    });

    const builder = new PolicyContextBuilder(registry, {
      now: () => nowMs,
    });

    const first = await builder.build(["student.status"], seed);
    const second = await builder.build(["student.status"], seed);
    const third = await builder.build(["student.status"], seed);

    expect(first.isErr()).toBe(true);
    expect(second.isErr()).toBe(true);
    expect(third.isErr()).toBe(true);
    expect(third.errorOrNull()).toBe(
      'Resolver error for path "student.status": circuit breaker is open',
    );
    expect(resolve).toHaveBeenCalledTimes(2);

    nowMs += 101;

    await builder.build(["student.status"], seed);

    expect(resolve).toHaveBeenCalledTimes(3);
  });
});
