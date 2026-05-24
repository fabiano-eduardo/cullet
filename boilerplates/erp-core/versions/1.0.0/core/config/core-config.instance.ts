import { CoreConfig } from './core-config';
import { SilentPolicyReporter } from './silent-policy-reporter';

/**
 * Shared instance for the application composition root.
 * Tests may create new instances when they need isolation.
 *
 * The default reporter is silent so the core has no runtime logging dependency.
 * Hosts can swap in their own `PolicyReporter` (e.g. the `pino` adapter shipped
 * in the sibling `adapters/pino` package) via `coreConfig.update({ observability: { reporter } })`.
 */
export const coreConfig = new CoreConfig({
	observability: { reporter: new SilentPolicyReporter() },
});
