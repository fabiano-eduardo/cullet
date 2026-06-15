import type { PolicyReporter } from "./policy-reporter.js";

export class SilentPolicyReporter implements PolicyReporter {
    report(_event: Parameters<PolicyReporter["report"]>[0]): void {}
}
