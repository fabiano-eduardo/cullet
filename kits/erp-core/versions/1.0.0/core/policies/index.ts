// Policy Engine — Pure Core
// Re-exports all public types, classes and utilities.

// ─── Core Config ────────────────────────────────────────────────────────────
export type {
	CoreConfigOptions,
	CoreObservabilityConfig,
} from '../config';
export { CoreConfig, coreConfig } from '../config';

// ─── Result (technical execution) ───────────────────────────────────────────
export { Err, Ok, Result } from '../result/result';

// ─── Outcome (business decision) ───────────────────────────────────────────
export type { CommonOutcomeStatus } from '../result/outcome';
export { Outcome } from '../result/outcome';

// ─── Utils ──────────────────────────────────────────────────────────────────
export { PolicyHashing } from './utils';

// ─── Catalog ────────────────────────────────────────────────────────────────
export type {
	AsOfSource,
	PolicyCatalogEntryProps,
	PolicyKind,
	PolicyOwner,
	PolicyScopeLevel,
} from './catalog';
export { PolicyCatalog, PolicyCatalogFactory, PolicyKey } from './catalog';

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
} from './defs';
export {
	InMemoryPolicyDefinitionRepository,
	PolicyDefinition,
	PolicyScopeMatcher,
} from './defs';

// ─── Context ────────────────────────────────────────────────────────────────
export type { ContextSeed, ContextValueResolver } from './context';
export {
	ContextSeedValidator,
	ContextResolverRegistry,
	contextResolverRegistry,
	PolicyContextBuilder,
	PolicyContextPath,
} from './context';

// ─── AsOf ───────────────────────────────────────────────────────────────────
export type { DeriveAsOfOptions } from './asof';
export { PolicyAsOfResolver } from './asof';

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
} from './engines';
export type {
	ComputeEvaluator,
	ComputeEvaluatorRegistration,
	ComputeOutcome,
	ComputeOutcomeData,
	ComputeStatus,
	VersionedComputeEngine,
} from './engines';
export {
	ComputeEngineRegistry,
	ComputeEvaluatorRegistry,
	ComputePayloadParsers,
	ComputePayloadParserRegistry,
	ComputeRegistry,
	GateEngineRegistry,
	GatePayloadParsers,
} from './engines';

// ─── Resolver ───────────────────────────────────────────────────────────────
export { PolicyResolver } from './resolver';

// ─── Service ────────────────────────────────────────────────────────────────
export type {
	EvaluateInput,
	PolicyDecision,
	PolicyEvaluationError,
	PolicyEvaluationResult,
	PolicyServiceParams,
	PolicyServiceOptions,
} from './service';
export { PolicyEvaluationErrors, PolicyService } from './service';

// ─── Package (contribution protocol) ────────────────────────────────────────
export type { PolicyPackage } from './package/policy-package';
