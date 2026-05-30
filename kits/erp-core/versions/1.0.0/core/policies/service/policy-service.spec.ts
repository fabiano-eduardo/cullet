import { describe, expect, it, vi } from "vitest";

import { PolicyCatalog, PolicyCatalogEntry, PolicyKey } from "../catalog";
import { ContextResolverRegistry, PolicyContextBuilder } from "../context";
import { InMemoryPolicyDefinitionRepository, PolicyDefinition } from "../defs";
import {
  asPolicyDecisionId,
  asPolicyDefinitionId,
  asSchoolId,
  asTenantId,
} from "../policy-ids";
import {
  ComputeRegistry,
  GateEngineRegistry,
  GatePayloadParsers,
  type ComputeEvaluator,
  type ComputeEvaluatorRegistration,
  type ComputePayloadParser,
  type ComputeOutcome,
  type GateOutcome,
  type VersionedGateEngine,
} from "../engines";
import { PolicyResolver } from "../resolver";
import type { PolicyReporter } from "../../config/policy-reporter";
import { Outcome } from "../../result/outcome";
import { Result } from "../../result/result";

import { type PolicyServiceOptions, PolicyService } from "./policy-service";

GatePayloadParsers.register(2, (payload) =>
  GatePayloadParsers.parse(1, payload),
);

const passthroughComputePayloadParser: ComputePayloadParser = () =>
  Result.ok({
    type: "params",
    data: {
      selectedPsp: "premium",
    },
  });

function makeSeed(
  fields: Record<string, unknown>,
  params?: {
    readonly tenantId?: string;
    readonly schoolId?: string;
  },
) {
  return {
    tenantId: asTenantId(params?.tenantId ?? "tenant-1"),
    schoolId: asSchoolId(params?.schoolId ?? "school-1"),
    fields,
  };
}

function makeGateDefinition(
  gateEngineVersion: number,
): PolicyDefinition<"financial.charges.charge_eligibility"> {
  return PolicyDefinition.gate({
    id: asPolicyDefinitionId(`gate-definition-v${gateEngineVersion}`),
    policyKey: "financial.charges.charge_eligibility",
    policyVersion: `${gateEngineVersion}.0.0`,
    gateEngineVersion,
    payloadSchemaVersion: 1,
    contextVersionMin: 1,
    contextVersionMax: 99,
    status: "PUBLISHED",
    scope: { level: "GLOBAL", tenantId: null, schoolId: null },
    effectiveFrom: new Date("2024-01-01T00:00:00Z"),
    effectiveTo: null,
    priority: 10,
    payloadJson: {
      condition: {
        field: "contractStatus",
        op: "eq",
        value: "ACTIVE",
      },
    },
    payloadHash: `hash-v${gateEngineVersion}`,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    publishedAt: new Date("2024-01-01T00:00:00Z"),
  });
}

function makeGateEngine(
  version: number,
  status: GateOutcome["status"],
): VersionedGateEngine & {
  readonly evaluate: ReturnType<typeof vi.fn<VersionedGateEngine["evaluate"]>>;
} {
  const evaluate = vi.fn<VersionedGateEngine["evaluate"]>(() => {
    if (status === "ALLOW") {
      return Result.ok(Outcome.of("ALLOW", { violations: [] }));
    }

    return Result.ok(
      Outcome.of("DENY", {
        violations: [
          {
            code: `DENIED_BY_V${version}`,
            message: `Denied by gate engine v${version}`,
          },
        ],
      }),
    );
  });

  return {
    version,
    evaluate,
  };
}

function buildService(
  definition: PolicyDefinition,
  gateEngines: GateEngineRegistry,
  options: PolicyServiceOptions = {},
): PolicyService {
  const policyKey = PolicyKey.parse(
    "financial.charges.charge_eligibility",
  ).getOrNull()!;

  return new PolicyService({
    catalog: new PolicyCatalog([
      PolicyCatalogEntry.from({
        key: policyKey,
        kind: "GATE",
        gateEngineVersion: definition.isGate()
          ? definition.gateEngineVersion
          : undefined,
        payloadSchemaVersion: definition.payloadSchemaVersion,
        owner: "PLATFORM_OWNER",
        allowedScopes: ["GLOBAL"],
        asOfSource: "NOW",
        contextRequirements: [],
        description: "Eligibility gate used in PolicyService tests",
      }),
    ]),
    contextBuilder: new PolicyContextBuilder(new ContextResolverRegistry()),
    defRepo: new InMemoryPolicyDefinitionRepository([definition]),
    resolver: new PolicyResolver(),
    gateEngines,
    computeRegistry: new ComputeRegistry(),
    options,
  });
}

function buildServiceWithCatalogEntries(
  definition: PolicyDefinition,
  gateEngines: GateEngineRegistry,
  entries: readonly PolicyCatalogEntry[],
  options: PolicyServiceOptions = {},
): PolicyService {
  return new PolicyService({
    catalog: new PolicyCatalog(entries),
    contextBuilder: new PolicyContextBuilder(new ContextResolverRegistry()),
    defRepo: new InMemoryPolicyDefinitionRepository([definition]),
    resolver: new PolicyResolver(),
    gateEngines,
    computeRegistry: new ComputeRegistry(),
    options,
  });
}

function makeComputeDefinition(params?: {
  readonly id?: string;
  readonly payloadSchemaVersion?: number;
  readonly priority?: number;
  readonly publishedAt?: Date;
}): PolicyDefinition<"financial.billing.psp_selection"> {
  const id = params?.id ?? "compute-definition-v1";

  return PolicyDefinition.compute({
    id: asPolicyDefinitionId(id),
    policyKey: "financial.billing.psp_selection",
    policyVersion: "1.0.0",
    computeEngineVersion: 1,
    payloadSchemaVersion: params?.payloadSchemaVersion ?? 1,
    contextVersionMin: 1,
    contextVersionMax: 99,
    status: "PUBLISHED",
    scope: { level: "GLOBAL", tenantId: null, schoolId: null },
    effectiveFrom: new Date("2024-01-01T00:00:00Z"),
    effectiveTo: null,
    priority: params?.priority ?? 10,
    payloadJson: {
      type: "params",
      data: {
        selectedPsp: "premium",
      },
    },
    payloadHash: `${id}-hash`,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    publishedAt: params?.publishedAt ?? new Date("2024-01-01T00:00:00Z"),
  });
}

function makeComputeEvaluatorRegistration(
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
          values: { selectedPsp: resolvedValue },
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

function buildComputeService(params: {
  readonly definitions: readonly PolicyDefinition[];
  readonly entries: readonly PolicyCatalogEntry[];
  readonly computeRegistry: ComputeRegistry;
}): PolicyService {
  return new PolicyService({
    catalog: new PolicyCatalog(params.entries),
    contextBuilder: new PolicyContextBuilder(new ContextResolverRegistry()),
    defRepo: new InMemoryPolicyDefinitionRepository(params.definitions),
    resolver: new PolicyResolver(),
    gateEngines: new GateEngineRegistry(),
    computeRegistry: params.computeRegistry,
  });
}

function makeThrowingReporter(error: Error): PolicyReporter & {
  readonly report: ReturnType<typeof vi.fn<PolicyReporter["report"]>>;
} {
  return {
    report: vi.fn<PolicyReporter["report"]>(() => {
      throw error;
    }),
  };
}

type PolicyCatalogVersionParams = Parameters<PolicyCatalog["getVersioned"]>[0];

class TrackingPolicyCatalog extends PolicyCatalog {
  public getVersionedCalls = 0;

  override getVersioned(params: PolicyCatalogVersionParams) {
    this.getVersionedCalls += 1;
    return super.getVersioned(params);
  }
}

describe("PolicyService", () => {
  it("exposes ComputePayloadParser in the public engines barrel", () => {
    const result = passthroughComputePayloadParser({
      type: "params",
      data: {
        selectedPsp: "premium",
      },
    });

    expect(result.isOk()).toBe(true);
  });

  it("dispatches the gate definition to the declared engine version", async () => {
    const gateEngines = new GateEngineRegistry();
    const gateEngineV1 = makeGateEngine(1, "DENY");
    const gateEngineV2 = makeGateEngine(2, "ALLOW");

    gateEngines.register(gateEngineV1);
    gateEngines.register(gateEngineV2);

    const service = buildService(makeGateDefinition(2), gateEngines);
    const result = await service.evaluate({
      decisionId: asPolicyDecisionId("decision-1"),
      policyKey: "financial.charges.charge_eligibility",
      scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
      contextVersion: 1,
      seed: makeSeed({
        charge: {
          amountCents: 250000,
        },
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    });

    expect(result.isOk()).toBe(true);
    expect(result.getOrNull()!.decision.status).toBe("ALLOW");
    expect(result.getOrNull()!.ref.gateEngineVersion).toBe(2);
    expect(gateEngineV1.evaluate).not.toHaveBeenCalled();
    expect(gateEngineV2.evaluate).toHaveBeenCalledOnce();
  });

  it("returns the successful evaluation even when the reporter throws", async () => {
    const gateEngines = new GateEngineRegistry();
    gateEngines.register(makeGateEngine(1, "ALLOW"));
    const reporter = makeThrowingReporter(new Error("reporter exploded"));

    const service = buildService(makeGateDefinition(1), gateEngines, {
      reporter,
    });
    const result = await service.evaluate({
      decisionId: asPolicyDecisionId("decision-report-success"),
      policyKey: "financial.charges.charge_eligibility",
      scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
      contextVersion: 1,
      seed: makeSeed({
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    });

    expect(result.isOk()).toBe(true);
    expect(result.getOrNull()!.decision.status).toBe("ALLOW");
    expect(reporter.report).toHaveBeenCalledTimes(2);
  });

  it("returns an error when no gate engine is registered for the definition version", async () => {
    const gateEngines = new GateEngineRegistry();
    gateEngines.register(makeGateEngine(1, "ALLOW"));

    const service = buildService(makeGateDefinition(2), gateEngines);
    const result = await service.evaluate({
      decisionId: asPolicyDecisionId("decision-2"),
      policyKey: "financial.charges.charge_eligibility",
      scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
      contextVersion: 1,
      seed: makeSeed({
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    });

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toMatchObject({
      kind: "ENGINE_FAILURE",
      policyKey: "financial.charges.charge_eligibility",
      engine: "GATE",
      engineVersion: 2,
      cause: 'No gate engine registered for version "2"',
    });
  });

  it("returns ENGINE_FAILURE when the gate engine fails because null is not allowed", async () => {
    const gateEngines = new GateEngineRegistry();
    const failingEngine: VersionedGateEngine & {
      readonly evaluate: ReturnType<
        typeof vi.fn<VersionedGateEngine["evaluate"]>
      >;
    } = {
      version: 1,
      evaluate: vi.fn<VersionedGateEngine["evaluate"]>(() => {
        return Result.err(
          'NULLISH_NUMERIC_OPERAND_NOT_ALLOWED: "amount" resolved to null for numeric operator "gte"',
        );
      }),
    };

    gateEngines.register(failingEngine);

    const service = buildService(makeGateDefinition(1), gateEngines);
    const result = await service.evaluate({
      decisionId: asPolicyDecisionId("decision-null-error"),
      policyKey: "financial.charges.charge_eligibility",
      scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
      contextVersion: 1,
      seed: makeSeed({}),
    });

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toMatchObject({
      kind: "ENGINE_FAILURE",
      policyKey: "financial.charges.charge_eligibility",
      engine: "GATE",
      engineVersion: 1,
      message: "Policy engine evaluation failed",
      cause:
        'NULLISH_NUMERIC_OPERAND_NOT_ALLOWED: "amount" resolved to null for numeric operator "gte"',
    });
  });

  it("returns an error when the seed has an empty tenantId", async () => {
    const gateEngines = new GateEngineRegistry();
    gateEngines.register(makeGateEngine(1, "ALLOW"));

    const service = buildService(makeGateDefinition(1), gateEngines);
    const result = await service.evaluate({
      decisionId: asPolicyDecisionId("decision-3"),
      policyKey: "financial.charges.charge_eligibility",
      scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
      contextVersion: 1,
      seed: makeSeed({}, { tenantId: "   " }),
    });

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toMatchObject({
      kind: "INVALID_CONTEXT",
      stage: "SEED_VALIDATION",
      policyKey: "financial.charges.charge_eligibility",
      cause: "ContextSeed tenantId must be a non-empty string",
    });
  });

  it("returns an error when seed.fields.now is not a valid Date", async () => {
    const gateEngines = new GateEngineRegistry();
    gateEngines.register(makeGateEngine(1, "ALLOW"));
    const reporter = makeThrowingReporter(new Error("reporter exploded"));

    const service = buildService(makeGateDefinition(1), gateEngines, {
      reporter,
    });
    const result = await service.evaluate({
      decisionId: asPolicyDecisionId("decision-invalid-now"),
      policyKey: "financial.charges.charge_eligibility",
      scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
      contextVersion: 1,
      seed: makeSeed({
        now: "2026-01-01",
      }),
    });

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toMatchObject({
      kind: "INVALID_CONTEXT",
      stage: "AS_OF_DERIVATION",
      policyKey: "financial.charges.charge_eligibility",
      cause: "seed.fields.now must be a valid Date when provided",
    });
    expect(reporter.report).toHaveBeenCalledOnce();
  });

  it("allows configuring the future asOf window on PolicyService", async () => {
    const gateEngines = new GateEngineRegistry();
    gateEngines.register(makeGateEngine(1, "ALLOW"));

    const policyKey = PolicyKey.parse(
      "financial.charges.charge_eligibility",
    ).getOrNull()!;
    const definition = makeGateDefinition(1);
    const service = buildServiceWithCatalogEntries(
      definition,
      gateEngines,
      [
        PolicyCatalogEntry.from({
          key: policyKey,
          kind: "GATE",
          gateEngineVersion: 1,
          payloadSchemaVersion: 1,
          owner: "PLATFORM_OWNER",
          allowedScopes: ["GLOBAL"],
          asOfSource: "CALLER_PROVIDED",
          contextRequirements: [],
          description: "Eligibility gate with caller-provided asOf for tests",
        }),
      ],
      {
        asOf: {
          maxFutureYears: 20,
        },
      },
    );

    const result = await service.evaluate({
      decisionId: asPolicyDecisionId("decision-custom-asof-window"),
      policyKey: "financial.charges.charge_eligibility",
      scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
      contextVersion: 1,
      seed: makeSeed({
        now: new Date("2026-01-01T00:00:00Z"),
        asOf: new Date("2041-01-01T00:00:00Z"),
      }),
    });

    expect(result.isOk()).toBe(true);
    expect(result.getOrNull()!.asOf.toISOString()).toBe(
      "2041-01-01T00:00:00.000Z",
    );
  });

  it("returns a discriminated error when the policy does not exist in the catalog", async () => {
    const gateEngines = new GateEngineRegistry();
    gateEngines.register(makeGateEngine(1, "ALLOW"));

    const service = buildService(makeGateDefinition(1), gateEngines);
    const result = await service.evaluate({
      decisionId: asPolicyDecisionId("decision-unknown-policy"),
      policyKey: "financial.charges.missing_policy",
      scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
      contextVersion: 1,
      seed: makeSeed({
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    });

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toMatchObject({
      kind: "POLICY_NOT_FOUND",
      policyKey: "financial.charges.missing_policy",
    });
  });

  it("uses the contextRequirements of the selected variant, not the union across versions", async () => {
    const gateEngines = new GateEngineRegistry();
    gateEngines.register(makeGateEngine(1, "ALLOW"));

    const definition = makeGateDefinition(1);
    const policyKey = PolicyKey.parse(
      "financial.charges.charge_eligibility",
    ).getOrNull()!;
    const service = buildServiceWithCatalogEntries(definition, gateEngines, [
      PolicyCatalogEntry.from({
        key: policyKey,
        kind: "GATE",
        gateEngineVersion: 1,
        payloadSchemaVersion: 1,
        owner: "PLATFORM_OWNER",
        allowedScopes: ["GLOBAL"],
        asOfSource: "NOW",
        contextRequirements: [],
        description: "Eligibility gate used in PolicyService tests",
      }),
      PolicyCatalogEntry.from({
        key: policyKey,
        kind: "GATE",
        gateEngineVersion: 2,
        payloadSchemaVersion: 1,
        owner: "PLATFORM_OWNER",
        allowedScopes: ["GLOBAL"],
        asOfSource: "NOW",
        contextRequirements: ["missing.version.two.only"],
        description: "Eligibility gate used in PolicyService tests",
      }),
    ]);

    const result = await service.evaluate({
      decisionId: asPolicyDecisionId("decision-4"),
      policyKey: "financial.charges.charge_eligibility",
      scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
      contextVersion: 1,
      seed: makeSeed({
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    });

    expect(result.isOk()).toBe(true);
    expect(result.getOrNull()!.decision.status).toBe("ALLOW");
  });

  it("resolves the versioned variant only once for the selected definition", async () => {
    const gateEngines = new GateEngineRegistry();
    gateEngines.register(makeGateEngine(1, "ALLOW"));

    const definition = makeGateDefinition(1);
    const policyKey = PolicyKey.parse(
      "financial.charges.charge_eligibility",
    ).getOrNull()!;
    const trackingCatalog = new TrackingPolicyCatalog([
      PolicyCatalogEntry.from({
        key: policyKey,
        kind: "GATE",
        gateEngineVersion: 1,
        payloadSchemaVersion: 1,
        owner: "PLATFORM_OWNER",
        allowedScopes: ["GLOBAL"],
        asOfSource: "NOW",
        contextRequirements: [],
        description: "Eligibility gate used in PolicyService tests",
      }),
    ]);
    const service = new PolicyService({
      catalog: trackingCatalog,
      contextBuilder: new PolicyContextBuilder(new ContextResolverRegistry()),
      defRepo: new InMemoryPolicyDefinitionRepository([definition]),
      resolver: new PolicyResolver(),
      gateEngines,
      computeRegistry: new ComputeRegistry(),
    });

    const result = await service.evaluate({
      decisionId: asPolicyDecisionId("decision-single-versioned-lookup"),
      policyKey: "financial.charges.charge_eligibility",
      scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
      contextVersion: 1,
      seed: makeSeed({
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    });

    expect(result.isOk()).toBe(true);
    expect(trackingCatalog.getVersionedCalls).toBe(1);
  });

  it("discards compute definitions with no compatible variant in the catalog before the resolver", async () => {
    const policyKey = PolicyKey.parse(
      "financial.billing.psp_selection",
    ).getOrNull()!;
    const unsupportedDefinition = makeComputeDefinition({
      id: "compute-definition-schema-v2",
      payloadSchemaVersion: 2,
      priority: 100,
      publishedAt: new Date("2024-02-01T00:00:00Z"),
    });
    const supportedDefinition = makeComputeDefinition({
      id: "compute-definition-schema-v1",
      payloadSchemaVersion: 1,
      priority: 10,
      publishedAt: new Date("2024-01-01T00:00:00Z"),
    });
    const computeRegistry = new ComputeRegistry({});
    const evaluator = makeComputeEvaluatorRegistration(
      "financial.billing.psp_selection",
      1,
    );

    computeRegistry.register(evaluator);

    const service = buildComputeService({
      definitions: [unsupportedDefinition, supportedDefinition],
      entries: [
        PolicyCatalogEntry.from({
          key: policyKey,
          kind: "COMPUTE",
          computeEngineVersion: 1,
          payloadSchemaVersion: 1,
          owner: "PLATFORM_OWNER",
          allowedScopes: ["GLOBAL"],
          asOfSource: "NOW",
          contextRequirements: [],
          description:
            "PSP selection compute policy used in PolicyService tests",
        }),
      ],
      computeRegistry,
    });

    const result = await service.evaluate({
      decisionId: asPolicyDecisionId("decision-compute-1"),
      policyKey: "financial.billing.psp_selection",
      scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
      contextVersion: 1,
      seed: makeSeed({
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    });

    expect(result.isOk()).toBe(true);
    const evaluation = result.getOrNull()!;

    expect(evaluation.ref.definitionId).toBe("compute-definition-schema-v1");
    expect(evaluation.ref.computeEngineVersion).toBe(1);
    expect(evaluation.decision.status).toBe("OK");
    expect("values" in evaluation.decision.data).toBe(true);
    expect(
      "values" in evaluation.decision.data
        ? evaluation.decision.data.values
        : null,
    ).toEqual({
      selectedPsp: {
        selectedPsp: "premium",
      },
    });
    expect(evaluator.evaluator.evaluate).toHaveBeenCalledOnce();
  });

  it("returns POLICY_VARIANT_NOT_FOUND when only definitions with an uncatalogued variant are eligible", async () => {
    const policyKey = PolicyKey.parse(
      "financial.billing.psp_selection",
    ).getOrNull()!;
    const unsupportedDefinition = makeComputeDefinition({
      id: "compute-definition-schema-v2-only",
      payloadSchemaVersion: 2,
      priority: 100,
      publishedAt: new Date("2024-02-01T00:00:00Z"),
    });
    const computeRegistry = new ComputeRegistry();

    const service = buildComputeService({
      definitions: [unsupportedDefinition],
      entries: [
        PolicyCatalogEntry.from({
          key: policyKey,
          kind: "COMPUTE",
          computeEngineVersion: 1,
          payloadSchemaVersion: 1,
          owner: "PLATFORM_OWNER",
          allowedScopes: ["GLOBAL"],
          asOfSource: "NOW",
          contextRequirements: [],
          description:
            "PSP selection compute policy used in PolicyService tests",
        }),
      ],
      computeRegistry,
    });

    const result = await service.evaluate({
      decisionId: asPolicyDecisionId("decision-compute-variant-mismatch"),
      policyKey: "financial.billing.psp_selection",
      scopeChain: [{ level: "GLOBAL", tenantId: null, schoolId: null }],
      contextVersion: 1,
      seed: makeSeed({
        now: new Date("2026-01-01T00:00:00Z"),
      }),
    });

    expect(result.isErr()).toBe(true);
    expect(result.errorOrNull()).toMatchObject({
      kind: "POLICY_VARIANT_NOT_FOUND",
      policyKey: "financial.billing.psp_selection",
      policyKind: "COMPUTE",
      computeEngineVersion: 1,
      payloadSchemaVersion: 2,
      cause:
        'Policy variant not found in catalog: "financial.billing.psp_selection" (COMPUTE, computeEngineVersion=1, payloadSchemaVersion=2)',
    });
  });
});
