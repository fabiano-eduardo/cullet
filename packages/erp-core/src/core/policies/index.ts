// Policy Engine — Pure Core
// Re-exports all public types, classes and utilities.

// ─── Core Config ────────────────────────────────────────────────────────────
export type {
    CoreConfigOptions,
    CoreObservabilityConfig,
} from "../config/index.js";
export { CoreConfig, coreConfig } from "../config/index.js";

// ─── Result (technical execution) ───────────────────────────────────────────
export { Err, Ok, Result } from "../result/result.js";

// ─── Outcome (business decision) ───────────────────────────────────────────
export type { CommonOutcomeStatus } from "../result/outcome.js";
export { Outcome } from "../result/outcome.js";

// ─── Utils ──────────────────────────────────────────────────────────────────
export { PolicyHashing } from "./utils/index.js";
export type {
    PolicyDecisionId,
    PolicyDefinitionId,
    SchoolId,
    TenantId,
} from "./policy-ids.js";
export {
    asPolicyDecisionId,
    asPolicyDefinitionId,
    asSchoolId,
    asTenantId,
} from "./policy-ids.js";

// ─── Catalog ────────────────────────────────────────────────────────────────
export type {
    AsOfSource,
    PolicyCatalogEntryProps,
    PolicyKind,
    PolicyOwner,
    PolicyScopeLevel,
} from "./catalog/index.js";
export {
    PolicyCatalog,
    PolicyCatalogFactory,
    PolicyKey,
} from "./catalog/index.js";

// ─── Definitions ────────────────────────────────────────────────────────────
export type {
    BasePolicyDefinitionProps,
    ComputePolicyDefinitionProps,
    FindCandidatesParams,
    GatePolicyDefinitionProps,
    PolicyDefinitionProps,
    PolicyDefinitionStatus,
    PolicyScope,
    ScopeChain,
} from "./defs/index.js";
export {
    InMemoryPolicyDefinitionRepository,
    PolicyDefinition,
    PolicyScopeMatcher,
} from "./defs/index.js";

// ─── Context ────────────────────────────────────────────────────────────────
export type {
    ContextResolverCircuitBreakerOptions,
    ContextResolverResilienceOptions,
    ContextResolverRetryOptions,
    ContextSeed,
    ContextValueResolver,
    PolicyContextBuilderOptions,
} from "./context/index.js";
export {
    ContextSeedValidator,
    ContextResolverRegistry,
    contextResolverRegistry,
    PolicyContextBuilder,
    PolicyContextPath,
    registerNamespacedContextResolvers,
    registerNamespacedContextResolversIn,
} from "./context/index.js";

// ─── AsOf ───────────────────────────────────────────────────────────────────
export type { DeriveAsOfOptions } from "./asof/index.js";
export { PolicyAsOfResolver } from "./asof/index.js";

// ─── Engines ────────────────────────────────────────────────────────────────
export type {
    ConditionEvaluationCause,
    ConditionEvaluationOptions,
    ConditionEvaluationReport,
    ConditionEvaluationReportLevel,
    ConditionEvaluationReportTag,
    ConditionEvaluatorReporter,
    GateOutcome,
    GateOutcomeData,
    GatePayload,
    GateStatus,
    GateTraceLeafSnapshot,
    GateTraceNodeSnapshot,
    GateViolationTrace,
    PolicyContext,
    PolicyViolation,
    VersionedGateEngine,
} from "./engines/index.js";
export type {
    ComputeEvaluator,
    ComputeEvaluatorRegistration,
    ComputeOutcome,
    ComputeOutcomeData,
    ComputeStatus,
    VersionedComputeEngine,
} from "./engines/index.js";
export {
    ComputeEngineRegistry,
    ComputeEvaluatorRegistry,
    ComputePayloadParsers,
    ComputePayloadParserRegistry,
    ComputeRegistry,
    GateEngineRegistry,
    GatePayloadParsers,
} from "./engines/index.js";

// ─── Resolver ───────────────────────────────────────────────────────────────
export { PolicyResolver } from "./resolver/index.js";

// ─── Service ────────────────────────────────────────────────────────────────
export type {
    EvaluateInput,
    PolicyDecision,
    PolicyEvaluationError,
    PolicyEvaluationResult,
    PolicyServiceParams,
    PolicyServiceOptions,
} from "./service/index.js";
export { PolicyEvaluationErrors, PolicyService } from "./service/index.js";

// ─── Package (contribution protocol) ────────────────────────────────────────
export type { PolicyPackage } from "./package/policy-package.js";
