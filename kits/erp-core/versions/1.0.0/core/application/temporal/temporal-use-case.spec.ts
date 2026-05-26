import { describe, expect, it } from "vitest";

import type { ContextSeed } from "../../policies";
import { Result } from "../../result/result";

import {
  createTemporalContext,
  type TemporalContext,
} from "./temporal-context";
import {
  type TemporalUseCaseInput,
  TemporalUseCase,
} from "./temporal-use-case";

interface InspectTemporalInput extends TemporalUseCaseInput {
  readonly tenantId: string;
  readonly schoolId: string;
}

interface InspectTemporalOutput {
  readonly temporalContext: TemporalContext;
  readonly seed: ContextSeed;
}

class InspectTemporalUseCase extends TemporalUseCase<
  InspectTemporalInput,
  Result<InspectTemporalOutput, never>
> {
  protected execute(
    input: InspectTemporalInput,
  ): Result<InspectTemporalOutput, never> {
    const temporalContext = this.resolveTemporalContext(input);
    const seed = this.buildPolicySeed(
      {
        tenantId: input.tenantId,
        schoolId: input.schoolId,
        fields: {},
      },
      temporalContext,
    );

    return Result.ok({
      temporalContext,
      seed,
    });
  }

  public inspectSeed(seed: ContextSeed, temporalContext: TemporalContext) {
    return this.buildPolicySeed(seed, temporalContext);
  }
}

describe("temporal-use-case", () => {
  it("resolves a default temporal context when none is provided", async () => {
    const useCase = new InspectTemporalUseCase();
    const output = await useCase.run({
      tenantId: "tenant-001",
      schoolId: "school-001",
    });
    const value = output.getOrThrow();

    expect(value.temporalContext.asOf).toBeInstanceOf(Date);
    expect(value.temporalContext.requestedAt).toBeInstanceOf(Date);
    expect((value.seed.fields["now"] as Date).toISOString()).toBe(
      value.temporalContext.requestedAt.toISOString(),
    );
  });

  it("honors the temporal context provided in the input", async () => {
    const useCase = new InspectTemporalUseCase();
    const temporalContext = createTemporalContext({
      asOf: new Date("2026-03-01T00:00:00.000Z"),
      requestedAt: new Date("2026-04-24T13:00:00.000Z"),
    });
    const output = await useCase.run({
      tenantId: "tenant-001",
      schoolId: "school-001",
      temporalContext,
    });
    const value = output.getOrThrow();

    expect(value.temporalContext.asOf.toISOString()).toBe(
      "2026-03-01T00:00:00.000Z",
    );
    expect(value.temporalContext.requestedAt.toISOString()).toBe(
      "2026-04-24T13:00:00.000Z",
    );
  });

  it('builds a policy seed with "now" aligned to requestedAt', () => {
    const useCase = new InspectTemporalUseCase();
    const temporalContext = createTemporalContext({
      requestedAt: new Date("2026-04-24T14:00:00.000Z"),
    });
    const originalNow = new Date("2026-04-01T00:00:00.000Z");
    const seed = useCase.inspectSeed(
      {
        tenantId: "tenant-001",
        schoolId: "school-001",
        fields: { now: originalNow },
      },
      temporalContext,
    );

    expect(Object.isFrozen(seed)).toBe(true);
    expect(seed.fields["now"]).not.toBe(originalNow);
    expect((seed.fields["now"] as Date).toISOString()).toBe(
      "2026-04-24T14:00:00.000Z",
    );
    expect(seed.tenantId).toBe("tenant-001");
    expect(seed.schoolId).toBe("school-001");
  });
});
