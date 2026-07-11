import type {
    ConditionEvaluationOptions,
    ConditionEvaluationReport,
    ConditionEvaluationReportLevel,
    ConditionEvaluatorReporter,
} from "../policies/engines/condition-evaluator-reporter.js";
import type { PolicyEvent, PolicyReporter } from "./policy-reporter.js";
import { SilentPolicyReporter } from "./silent-policy-reporter.js";

export interface CoreObservabilityConfig {
    readonly reporter?: PolicyReporter;
}

export interface CoreConfigOptions {
    // `observability` is today's only section. Future core config (settings,
    // feature flags) joins here as sibling keys — that umbrella is why the
    // reporter is nested under `observability` instead of living at the root.
    readonly observability?: CoreObservabilityConfig;
}

/** Reports an event without letting a throwing reporter abort the caller. */
function safeReport(policyReporter: PolicyReporter, event: PolicyEvent): void {
    try {
        policyReporter.report(event);
    } catch {
        // Telemetry failures must never interrupt the domain flow.
    }
}

/**
 * The core's config namespace. Today it holds a single section —
 * `observability` — whose whole job is to decide *where policy telemetry goes*
 * while guaranteeing telemetry is best-effort (a throwing reporter can never
 * abort a domain flow). App config (env, settings, feature flags) is
 * deliberately absent for now: when the core needs it, it joins here as a
 * sibling section rather than a new module — which is why this is `config`,
 * not `observability`. It holds the active {@link PolicyReporter} (silent by
 * default, so the core carries no logging dependency), bridges it to the
 * engines' {@link ConditionEvaluatorReporter}, and offers `reportSafely` as
 * the single guarded emit path shared with {@link PolicyService}.
 */
export class CoreConfig {
    readonly #initialReporter: PolicyReporter;
    #currentReporter: PolicyReporter;

    constructor(options: CoreConfigOptions = {}) {
        const reporter =
            options.observability?.reporter ?? new SilentPolicyReporter();
        this.#initialReporter = reporter;
        this.#currentReporter = reporter;
    }

    /**
     * Swaps the active reporter. Pass `observability.reporter` to enable
     * telemetry, or set it explicitly to `undefined` to go silent again.
     * Omitting `observability` (or its `reporter` key) is a no-op.
     */
    configure(options: CoreConfigOptions): this {
        const observability = options.observability;
        if (observability && "reporter" in observability) {
            this.#currentReporter =
                observability.reporter ?? new SilentPolicyReporter();
        }
        return this;
    }

    // Restores the reporter captured at construction time — which is silent
    // only if this instance was built without one.
    reset(): this {
        this.#currentReporter = this.#initialReporter;
        return this;
    }

    /** Emits a policy event through the active reporter, best-effort. */
    reportSafely(event: PolicyEvent): void {
        safeReport(this.#currentReporter, event);
    }

    getConditionEvaluationOptions(
        engineVersion: number,
    ): ConditionEvaluationOptions {
        return {
            reporter: this.#bridgeToConditionReporter(this.#currentReporter),
            engineVersion,
        };
    }

    #bridgeToConditionReporter(
        policyReporter: PolicyReporter,
    ): ConditionEvaluatorReporter {
        // Capture the reporter now so a mid-evaluation reconfigure never splits
        // a single evaluation's reports across two reporters (intentional).
        const emit = (
            level: ConditionEvaluationReportLevel,
            report: ConditionEvaluationReport,
        ): void => {
            safeReport(policyReporter, {
                kind: "condition-eval",
                ...report,
                level,
            });
        };
        return {
            warn: (report) => emit("warn", report),
            error: (report) => emit("error", report),
        };
    }
}
