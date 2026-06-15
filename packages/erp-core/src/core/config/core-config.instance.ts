import { CoreConfig } from "./core-config.js";
import { SilentPolicyReporter } from "./silent-policy-reporter.js";

/**
 * Shared instance for the application composition root.
 * Use `new CoreConfig()` for isolated runtimes, tests, or multi-tenant hosts.
 *
 * The default reporter is silent so the core has no runtime logging dependency.
 * Hosts can swap in their own `PolicyReporter` via
 * `coreConfig.configure({ observability: { reporter } })`.
 */
export const coreConfig = new CoreConfig({
    observability: { reporter: new SilentPolicyReporter() },
});
