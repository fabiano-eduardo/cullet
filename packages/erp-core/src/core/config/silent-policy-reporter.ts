import type { PolicyReporter } from "./policy-reporter";

export class SilentPolicyReporter implements PolicyReporter {
    report(_event: Parameters<PolicyReporter["report"]>[0]): void {}
}
