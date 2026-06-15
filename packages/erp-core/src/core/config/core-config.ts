import type {
    ConditionEvaluationOptions,
    ConditionEvaluatorReporter,
} from "../policies/engines/condition-evaluator-reporter.js";
import type { PolicyEvent, PolicyReporter } from "./policy-reporter.js";
import { SilentPolicyReporter } from "./silent-policy-reporter.js";

export interface CoreObservabilityConfig {
    readonly reporter?: PolicyReporter;
}

export interface CoreConfigOptions {
    readonly observability?: CoreObservabilityConfig;
}

function reportSafely(
    policyReporter: PolicyReporter,
    event: PolicyEvent,
): void {
    try {
        policyReporter.report(event);
    } catch {
        // Falhas de telemetria nao podem interromper o fluxo de dominio.
    }
}

/**
 * Centraliza a configuracao pura do core sem depender de implementacoes
 * concretas de logging, tracing ou report.
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

    configure(options: CoreConfigOptions): this {
        const reporter = options.observability?.reporter;
        if (reporter) {
            this.#currentReporter = reporter;
        }
        return this;
    }

    // Restores the reporter captured at construction time.
    reset(): this {
        this.#currentReporter = this.#initialReporter;
        return this;
    }

    getPolicyReporter(): PolicyReporter {
        return this.#currentReporter;
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
        return {
            warn(report) {
                reportSafely(policyReporter, {
                    kind: "condition-eval",
                    ...report,
                } satisfies PolicyEvent);
            },
            error(report) {
                reportSafely(policyReporter, {
                    kind: "condition-eval",
                    ...report,
                } satisfies PolicyEvent);
            },
        };
    }
}
