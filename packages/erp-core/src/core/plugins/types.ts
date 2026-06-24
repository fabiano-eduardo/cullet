/**
 * Common shape every plugin shares, regardless of the contract it implements.
 * Carries the metadata the {@link PluginManager} uses to identify, order and
 * toggle plugins.
 */
interface BasePlugin {
    /** Unique identifier, used for logs / debugging and for enable/disable. */
    readonly name: string;
    /** Weight; the highest priority wins (default = 0). */
    readonly priority?: number;
    /** Shortcut to disable a plugin without removing it. */
    enabled?: boolean;
}

/**
 * A plugin contract is a record whose values are the methods plugins may
 * implement for a given extension point.
 *
 * `any` here is intentional: it is the only way to express the constraint
 * "a record whose values are arbitrary functions". Using `unknown` for the
 * parameters breaks assignment of concrete contracts by contravariance —
 * TypeScript rejects functions with specific parameters as a subtype of
 * `(...args: unknown[]) => unknown`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PluginContract = Record<string, (...args: any[]) => any>;

/**
 * Reducer used in `pipeline` mode to combine the result of each plugin into a
 * single accumulated value.
 */
type PipelineReducer<R, P extends PluginContract> = (
    accumulated: R,
    current: R,
    plugin: P & BasePlugin,
    index: number,
) => R;

/** Options accepted by {@link PluginManager.invoke}. */
interface InvokeOptions<P extends PluginContract, K extends keyof P> {
    /**
     * `'first'`    → returns the first enabled plugin with the highest priority.
     * `'pipeline'` → runs every enabled plugin, combining results via `reducer`.
     * default = `'first'`.
     */
    mode?: "first" | "pipeline";
    /** Executed when no plugin is enabled for the method. */
    fallback: P[K];
    /** Reducer used only when `mode = "pipeline"`. */
    reducer?: PipelineReducer<ReturnType<P[K]>, P>;
}

export type { BasePlugin, InvokeOptions, PipelineReducer, PluginContract };
