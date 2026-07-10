import { PolicyAsOfResolver, type DeriveAsOfOptions } from "../asof/index.js";
import {
    type PolicyCatalog,
    PolicyCatalogEntry,
    PolicyKey,
} from "../catalog/index.js";
import type { ContextSeed, PolicyContextBuilder } from "../context/index.js";
import { ContextSeedValidator } from "../context/index.js";
import {
    PolicyDefinition,
    type PolicyDefinitionRepository,
    type PolicyScope,
} from "../defs/index.js";
import type { PolicyDecisionId, PolicyDefinitionId } from "../policy-ids.js";
import {
    type ComputeOutcome,
    ComputeRegistry,
    GateEngineRegistry,
    type GateOutcome,
    type PolicyContext,
} from "../engines/index.js";
import { PolicyResolver } from "../resolver/index.js";
import { Result } from "../../result/result.js";
import { isValidDate } from "../../shared/temporal-guards.js";

import { type CoreConfig, coreConfig } from "../../config/index.js";

import {
    PolicyEvaluationErrors,
    type PolicyEvaluationError,
} from "./policy-evaluation-error.js";

// ─── Input ──────────────────────────────────────────────────────────────────

/**
 * Everything a single policy evaluation needs. `policyKey` names the policy,
 * `scopeChain` narrows the search from most-specific to least-specific scope,
 * `contextVersion` pins which context schema applies, and `seed` carries the
 * raw facts the context builder expands. `decisionId` is the caller's
 * idempotency/audit handle, echoed back on the result.
 */
export interface EvaluateInput {
    readonly decisionId: PolicyDecisionId;
    readonly policyKey: string;
    readonly scopeChain: readonly PolicyScope[];
    readonly contextVersion: number;
    readonly seed: ContextSeed;
}

/**
 * Cross-cutting knobs for a {@link PolicyService}: today just how the as-of
 * instant is derived ({@link asOf}). Telemetry is not configured here — it
 * flows through the injected {@link CoreConfig}, the core's single
 * observability seam, so a host wires reporting in one place.
 */
export interface PolicyServiceOptions {
    readonly asOf?: DeriveAsOfOptions;
}

/**
 * The collaborators a {@link PolicyService} is wired with. Each is an injected
 * port so the service stays storage- and engine-agnostic: the catalog defines
 * the universe of policies, `defRepo` supplies their versioned definitions, the
 * `resolver` picks the winning definition, and the engine registries execute it.
 */
export interface PolicyServiceParams {
    readonly catalog: PolicyCatalog;
    readonly contextBuilder: PolicyContextBuilder;
    readonly defRepo: PolicyDefinitionRepository;
    readonly resolver: PolicyResolver;
    readonly gateEngines: GateEngineRegistry;
    readonly computeRegistry: ComputeRegistry;
    /**
     * The observability seam telemetry is emitted through. Defaults to the
     * shared {@link coreConfig} singleton; inject an isolated instance for
     * tests or multi-tenant hosts.
     */
    readonly coreConfig?: CoreConfig;
    readonly options?: PolicyServiceOptions;
}

// ─── Output ─────────────────────────────────────────────────────────────────

/** Union of all possible policy decision Outcomes. */
export type PolicyDecision = GateOutcome | ComputeOutcome;

export type { PolicyEvaluationError } from "./policy-evaluation-error.js";

/**
 * The full record of one successful evaluation. Beyond the business
 * {@link decision}, it pins the exact definition that produced it — id, key,
 * version, payload hash, and engine version — together with the `asOf` instant
 * the policy was selected for and the wall-clock `evaluatedAt`. That provenance
 * is what makes a decision reproducible and auditable after the fact.
 */
export interface PolicyEvaluationResult {
    readonly decisionId: PolicyDecisionId;
    readonly ref: {
        readonly definitionId: PolicyDefinitionId;
        readonly policyKey: string;
        readonly policyVersion: string;
        readonly payloadHash: string;
        readonly gateEngineVersion?: number;
        readonly computeEngineVersion?: number;
    };
    readonly kind: "GATE" | "COMPUTE";
    readonly asOf: Date;
    readonly evaluatedAt: Date;
    readonly contextVersion: number;
    /** Business decision expressed as an Outcome — not a technical Result. */
    readonly decision: PolicyDecision;
}

interface ResolvedPolicyCandidate {
    readonly definition: PolicyDefinition;
    readonly catalogEntry: PolicyCatalogEntry;
}

// ─── Service ────────────────────────────────────────────────────────────────

/**
 * Orchestrates the end-to-end evaluation of a policy: it parses and validates
 * the context seed, derives the as-of instant, resolves the best matching
 * definition for the requested key/scope/version, builds the context the policy
 * needs, and runs it through the right engine (gate or compute).
 *
 * The service never throws for an expected failure: every step returns a
 * {@link Result}, and the failures are folded into a typed
 * {@link PolicyEvaluationError} so callers branch on `isErr()` rather than
 * catching. Telemetry is best-effort — a throwing reporter can never abort an
 * evaluation — which keeps observability strictly side-band.
 */
export class PolicyService {
    readonly #coreConfig: CoreConfig;
    private readonly catalog: PolicyCatalog;
    private readonly contextBuilder: PolicyContextBuilder;
    private readonly defRepo: PolicyDefinitionRepository;
    private readonly resolver: PolicyResolver;
    private readonly gateEngines: GateEngineRegistry;
    private readonly computeRegistry: ComputeRegistry;
    private readonly options: PolicyServiceOptions;

    constructor(params: PolicyServiceParams) {
        this.catalog = params.catalog;
        this.contextBuilder = params.contextBuilder;
        this.defRepo = params.defRepo;
        this.resolver = params.resolver;
        this.gateEngines = params.gateEngines;
        this.computeRegistry = params.computeRegistry;
        this.options = params.options ?? {};
        this.#coreConfig = params.coreConfig ?? coreConfig;
    }

    private resolveEvaluationNow(seed: ContextSeed): Result<Date, string> {
        const candidate = seed.fields["now"];

        if (candidate === undefined) {
            return Result.ok(new Date());
        }

        if (!isValidDate(candidate)) {
            return Result.err(
                "seed.fields.now must be a valid Date when provided",
            );
        }

        return Result.ok(candidate);
    }

    /**
     * Evaluates a policy and returns its decision.
     *
     * This is the single public entry point. It delegates the actual work to the
     * private pipeline and wraps it with telemetry: a completed or failed event
     * is reported either way, but reporting is guarded so it can never change the
     * outcome. The returned {@link Result} is `ok` with a
     * {@link PolicyEvaluationResult} on success, or `err` with a typed
     * {@link PolicyEvaluationError} describing which stage rejected the input —
     * the method itself does not throw for expected failures.
     *
     * @param input - The policy key, scope chain, context version, and seed to
     *   evaluate, plus the caller's `decisionId`.
     * @returns A `Result` carrying the decision or the evaluation error.
     */
    async evaluate(
        input: EvaluateInput,
    ): Promise<Result<PolicyEvaluationResult, PolicyEvaluationError>> {
        const result = await this.#evaluate(input);
        if (result.isErr()) {
            const error = result.errorOrNull()!;
            this.#coreConfig.reportSafely({
                kind: "policy-evaluation-failed",
                level: "error",
                policyKey: "policyKey" in error ? error.policyKey : undefined,
                errorKind: error.kind,
                message: error.message,
                cause: error.cause,
                occurredAt: new Date(),
            });
        } else {
            const ok = result.getOrNull()!;
            this.#coreConfig.reportSafely({
                kind: "policy-evaluation-completed",
                level: "info",
                policyKey: ok.ref.policyKey,
                decisionId: ok.decisionId,
                engineKind: ok.kind,
                occurredAt: ok.evaluatedAt,
            });
        }
        return result;
    }

    async #evaluate(
        input: EvaluateInput,
    ): Promise<Result<PolicyEvaluationResult, PolicyEvaluationError>> {
        const seedResult = ContextSeedValidator.validate(input.seed);
        if (seedResult.isErr()) {
            return Result.err(
                PolicyEvaluationErrors.invalidContext(
                    "SEED_VALIDATION",
                    input.policyKey,
                    seedResult.errorOrNull()!,
                ),
            );
        }
        const seed = seedResult.getOrNull()!;

        const catalogFamilyResult = this.#resolveCatalogFamily(input.policyKey);
        if (catalogFamilyResult.isErr()) {
            return Result.err(catalogFamilyResult.errorOrNull()!);
        }
        const { key: policyKey, family } = catalogFamilyResult.getOrNull()!;
        const familyEntry = family[0]!;

        const nowResult = this.resolveEvaluationNow(seed);
        if (nowResult.isErr()) {
            return Result.err(
                PolicyEvaluationErrors.invalidContext(
                    "AS_OF_DERIVATION",
                    policyKey,
                    nowResult.errorOrNull()!,
                ),
            );
        }
        const now = nowResult.getOrNull()!;

        const asOfResult = PolicyAsOfResolver.derive(
            familyEntry.asOfSource,
            seed,
            now,
            this.options.asOf,
        );
        if (asOfResult.isErr()) {
            return Result.err(
                PolicyEvaluationErrors.invalidContext(
                    "AS_OF_DERIVATION",
                    policyKey,
                    asOfResult.errorOrNull()!,
                ),
            );
        }
        const asOf = asOfResult.getOrNull()!;

        const definitionResult = this.#findCandidates(
            policyKey,
            familyEntry.kind,
            asOf,
            input,
        );
        if (definitionResult.isErr()) {
            return Result.err(definitionResult.errorOrNull()!);
        }
        const {
            definition: policyDefinition,
            catalogEntry: versionedCatalogEntry,
        } = definitionResult.getOrNull()!;

        this.#coreConfig.reportSafely({
            kind: "policy-resolution",
            level: "info",
            policyKey,
            definitionId: policyDefinition.id,
            policyVersion: policyDefinition.policyVersion,
            engineKind: policyDefinition.isGate() ? "GATE" : "COMPUTE",
            engineVersion: policyDefinition.isGate()
                ? policyDefinition.gateEngineVersion!
                : policyDefinition.computeEngineVersion!,
            occurredAt: now,
        });

        const ctxResult = await this.contextBuilder.build(
            versionedCatalogEntry.contextRequirements,
            seed,
        );
        if (ctxResult.isErr()) {
            return Result.err(
                PolicyEvaluationErrors.invalidContext(
                    "CONTEXT_BUILD",
                    policyKey,
                    ctxResult.errorOrNull()!,
                ),
            );
        }
        const context = ctxResult.getOrNull()!;

        const decisionResult = this.#executeEngine(
            policyKey,
            policyDefinition,
            context,
        );
        if (decisionResult.isErr()) {
            return Result.err(decisionResult.errorOrNull()!);
        }
        const decision = decisionResult.getOrNull()!;

        const result: PolicyEvaluationResult = {
            decisionId: input.decisionId,
            ref: {
                definitionId: policyDefinition.id,
                policyKey: policyDefinition.policyKey,
                policyVersion: policyDefinition.policyVersion,
                payloadHash: policyDefinition.payloadHash,
                ...(policyDefinition.isGate()
                    ? {
                          gateEngineVersion: policyDefinition.gateEngineVersion,
                      }
                    : {
                          computeEngineVersion:
                              policyDefinition.computeEngineVersion,
                      }),
            },
            kind: policyDefinition.kind,
            asOf,
            evaluatedAt: now,
            contextVersion: input.contextVersion,
            decision,
        };

        return Result.ok(result);
    }

    #resolveCatalogVariant(
        definition: PolicyDefinition,
    ): Result<PolicyCatalogEntry, string> {
        return this.catalog.getVersioned({
            key: definition.policyKey,
            kind: definition.kind,
            ...(definition.isGate()
                ? { gateEngineVersion: definition.gateEngineVersion }
                : {
                      computeEngineVersion: definition.computeEngineVersion,
                  }),
            payloadSchemaVersion: definition.payloadSchemaVersion,
        });
    }

    #resolveCatalogFamily(
        rawKey: string,
    ): Result<
        { key: string; family: readonly PolicyCatalogEntry[] },
        PolicyEvaluationError
    > {
        const keyResult = PolicyKey.parse(rawKey);
        if (keyResult.isErr()) {
            return Result.err(
                PolicyEvaluationErrors.invalidPolicyKey(
                    rawKey,
                    keyResult.errorOrNull()!,
                ),
            );
        }
        const policyKey = keyResult.getOrNull()!.toString();

        const catalogFamilyResult = this.catalog.getFamily(policyKey);
        if (catalogFamilyResult.isErr()) {
            return Result.err(
                PolicyEvaluationErrors.policyNotFound(
                    policyKey,
                    catalogFamilyResult.errorOrNull()!,
                ),
            );
        }

        return Result.ok({
            key: policyKey,
            family: catalogFamilyResult.getOrNull()!,
        });
    }

    #findCandidates(
        policyKey: string,
        policyKind: PolicyCatalogEntry["kind"],
        asOf: Date,
        input: EvaluateInput,
    ): Result<ResolvedPolicyCandidate, PolicyEvaluationError> {
        const candidates = this.defRepo.findCandidates({
            policyKey: policyKey,
            kind: policyKind,
            asOf,
            contextVersion: input.contextVersion,
            scopeChain: input.scopeChain,
        });

        const compatibleCandidates: ResolvedPolicyCandidate[] = [];
        const compatibleCandidatesByDefinitionId = new Map<
            string,
            ResolvedPolicyCandidate
        >();
        const incompatibleVariantErrorsByDefinitionId = new Map<
            string,
            string
        >();

        for (const candidate of candidates) {
            const compatibilityResult = this.#resolveCatalogVariant(candidate);
            if (compatibilityResult.isErr()) {
                incompatibleVariantErrorsByDefinitionId.set(
                    candidate.id,
                    compatibilityResult.errorOrNull()!,
                );
                continue;
            }

            const resolvedCandidate: ResolvedPolicyCandidate = {
                definition: candidate,
                catalogEntry: compatibilityResult.getOrNull()!,
            };
            compatibleCandidates.push(resolvedCandidate);
            compatibleCandidatesByDefinitionId.set(
                candidate.id,
                resolvedCandidate,
            );
        }

        if (compatibleCandidates.length === 0 && candidates.length > 0) {
            const selectedCandidateResult =
                this.resolver.resolveBest(candidates);
            if (selectedCandidateResult.isOk()) {
                const selectedCandidate = selectedCandidateResult.getOrNull()!;

                return Result.err(
                    PolicyEvaluationErrors.policyVariantNotFound({
                        policyKey: policyKey,
                        policyKind: selectedCandidate.kind,
                        payloadSchemaVersion:
                            selectedCandidate.payloadSchemaVersion,
                        ...(selectedCandidate.isGate()
                            ? {
                                  gateEngineVersion:
                                      selectedCandidate.gateEngineVersion,
                              }
                            : {
                                  computeEngineVersion:
                                      selectedCandidate.computeEngineVersion,
                              }),
                        cause:
                            incompatibleVariantErrorsByDefinitionId.get(
                                selectedCandidate.id,
                            ) ??
                            "No compatible catalog variant matched the selected policy definition",
                    }),
                );
            }
        }

        const bestResult = this.resolver.resolveBest(
            compatibleCandidates.map((candidate) => candidate.definition),
        );
        if (bestResult.isErr()) {
            return Result.err(
                PolicyEvaluationErrors.policyDefinitionNotFound(
                    policyKey,
                    asOf,
                    input.contextVersion,
                    bestResult.errorOrNull()!,
                ),
            );
        }

        const bestDefinition = bestResult.getOrNull()!;
        const resolvedCandidate = compatibleCandidatesByDefinitionId.get(
            bestDefinition.id,
        );
        if (resolvedCandidate === undefined) {
            return Result.err(
                PolicyEvaluationErrors.policyDefinitionNotFound(
                    policyKey,
                    asOf,
                    input.contextVersion,
                    `Resolved definition "${bestDefinition.id}" is not present among compatible catalog variants`,
                ),
            );
        }

        return Result.ok(resolvedCandidate);
    }

    #executeEngine(
        policyKey: string,
        definition: PolicyDefinition,
        context: PolicyContext,
    ): Result<PolicyDecision, PolicyEvaluationError> {
        if (definition.isGate()) {
            const gateResult = this.gateEngines.evaluate(
                definition.gateEngineVersion,
                definition.payloadJson,
                context,
            );
            if (gateResult.isErr()) {
                return Result.err(
                    PolicyEvaluationErrors.engineFailure(
                        policyKey,
                        "GATE",
                        definition.gateEngineVersion,
                        gateResult.errorOrNull()!,
                    ),
                );
            }

            return Result.ok(gateResult.getOrNull()!);
        }

        if (!definition.isCompute()) {
            return Result.err(
                PolicyEvaluationErrors.policyVariantNotFound({
                    policyKey,
                    policyKind: definition.kind,
                    payloadSchemaVersion: definition.payloadSchemaVersion,
                    cause: `Unsupported policy kind "${definition.kind}"`,
                }),
            );
        }

        const computeResult = this.computeRegistry.evaluate(
            policyKey,
            definition.computeEngineVersion,
            definition.payloadSchemaVersion,
            definition.payloadJson,
            context,
        );

        if (computeResult.isErr()) {
            return Result.err(
                PolicyEvaluationErrors.engineFailure(
                    policyKey,
                    "COMPUTE",
                    definition.computeEngineVersion,
                    computeResult.errorOrNull()!,
                ),
            );
        }

        return Result.ok(computeResult.getOrNull()!);
    }
}
