export type { LogPayload, LoggerPort } from "./logger.port.js";
export type { MetricLabels, MetricsPort } from "./metrics.port.js";
export type {
    PolicyEvaluationInput,
    PolicyEvaluationOutput,
    PolicyPort,
    PolicyPortError,
} from "./policy-port.js";
export type { Repository, ResultRepository } from "./repository.port.js";
export type {
    ResultTemporalRepository,
    TemporalHistory,
    TemporalRepository,
} from "./temporal-repository.port.js";
export type {
    TraceAttributeValue,
    TraceSpan,
    TracerPort,
} from "./tracer.port.js";

// Note: `AuthorizerPort` (RBAC) and `AbacAuthorizerPort` (ABAC) also live in
// this folder but are intentionally NOT re-exported here — they belong to the
// `rbac` / `abac` surfaces and are exported from those barrels instead (each
// port file documents why). Import them from `cullet/erp-core` rbac/abac
// entry points, not from this ports barrel.
