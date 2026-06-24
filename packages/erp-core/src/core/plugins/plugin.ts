import {
    type BasePlugin,
    type InvokeOptions,
    type PipelineReducer,
    type PluginContract,
} from "./types.js";

/**
 * Registry that holds a set of plugins implementing a shared {@link PluginContract}
 * and resolves which of them answer a given extension point.
 *
 * Plugins are kept sorted by priority (descending). For a given method,
 * {@link invoke} either delegates to the highest-priority enabled plugin
 * (`'first'`) or folds every enabled plugin into a single value (`'pipeline'`).
 * When no plugin is enabled, the supplied `fallback` runs instead, so the host
 * always has defined behaviour even with an empty registry.
 *
 * @typeParam P - The plugin contract this manager coordinates.
 */
class PluginManager<P extends PluginContract> {
    /** Internal list, kept sorted by priority (desc). */
    private plugins: (P & BasePlugin)[] = [];

    /** Registers one or more plugins and re-sorts by priority. */
    public register(...plugins: (P & BasePlugin)[]): void {
        this.plugins.push(...plugins);
        this.reorder();
    }

    /** Removes a previously registered plugin by name. */
    public unregister(name: string): void {
        this.plugins = this.plugins.filter((p) => p.name !== name);
    }

    /** Enables a registered plugin by name. */
    public enable(name: string): void {
        const plugin = this.plugins.find((p) => p.name === name);
        if (plugin) plugin.enabled = true;
    }

    /** Disables a registered plugin by name (without removing it). */
    public disable(name: string): void {
        const plugin = this.plugins.find((p) => p.name === name);
        if (plugin) plugin.enabled = false;
    }

    /** Lists enabled plugins only, already in priority order. */
    public list(): readonly (P & BasePlugin)[] {
        return this.plugins.filter((p) => p.enabled !== false);
    }

    /**
     * Resolves `method` against the registered plugins.
     *
     * In `'first'` mode the highest-priority enabled plugin that implements
     * `method` answers. In `'pipeline'` mode every enabled plugin runs and the
     * results are folded with `reducer` (defaults to "keep the last result").
     * When no enabled plugin implements `method`, `fallback` is called.
     */
    public invoke<K extends keyof P>(
        method: K,
        args: Parameters<P[K]>,
        opts: InvokeOptions<P, K>,
    ): ReturnType<P[K]> {
        const { mode = "first", fallback, reducer } = opts;
        const enabled = this.list().filter((p) => method in p) as Array<
            P & BasePlugin
        >;

        if (enabled.length === 0) {
            return (fallback as P[K])(...args);
        }

        if (mode === "first") {
            const fn = enabled[0][method] as P[K];
            return fn(...args);
        }

        const defaultReducer: PipelineReducer<ReturnType<P[K]>, P> = (
            _,
            curr,
        ) => curr;
        const red = reducer ?? defaultReducer;

        let acc: ReturnType<P[K]> = enabled[0][method]!(...args);
        enabled.slice(1).forEach((plugin, idx) => {
            const res = plugin[method]!(...args);
            acc = red(acc, res, plugin, idx + 1);
        });
        return acc;
    }

    /** Re-sorts the internal list by priority (desc; default priority = 0). */
    private reorder(): void {
        this.plugins.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }
}

export { PluginManager };
