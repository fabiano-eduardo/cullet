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
 * Plugins are kept sorted by priority (descending); ties keep registration
 * order (the sort is stable). For a given method, {@link invoke} either
 * delegates to the highest-priority enabled plugin (`'first'`) or folds every
 * enabled plugin into a single value (`'pipeline'`). When no plugin is enabled,
 * the supplied `fallback` runs instead, so the host always has defined
 * behaviour even with an empty registry.
 *
 * `name` is a unique key: registering a plugin whose name already exists
 * replaces the previous one, so register/enable/disable/unregister all address
 * the same single plugin.
 *
 * Plugins run arbitrary host code and are trusted: {@link invoke} does NOT wrap
 * them in try/catch. A throwing plugin propagates to the caller (and, in
 * `'pipeline'` mode, discards the accumulated result). Error handling, logging
 * and retries are the host's responsibility by design — the registry's only
 * defined-behaviour guarantee is `fallback` for an empty registry. Every plugin
 * is expected to implement the full contract `P` (the types enforce it).
 *
 * @typeParam P - The plugin contract this manager coordinates.
 */
class PluginManager<P extends PluginContract> {
    /** Internal list, kept sorted by priority (desc). */
    private plugins: (P & BasePlugin)[] = [];

    /** Registers one or more plugins (replacing any with the same name) and re-sorts by priority. */
    public register(...plugins: (P & BasePlugin)[]): void {
        const incoming = new Set(plugins.map((p) => p.name));
        this.plugins = this.plugins.filter((p) => !incoming.has(p.name));
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
        const enabled = this.list();

        if (enabled.length === 0) {
            return fallback(...args);
        }

        if (mode === "first") {
            return enabled[0][method](...args);
        }

        const defaultReducer: PipelineReducer<ReturnType<P[K]>, P> = (
            _,
            curr,
        ) => curr;
        const red = reducer ?? defaultReducer;

        let acc: ReturnType<P[K]> = enabled[0][method](...args);
        enabled.slice(1).forEach((plugin, idx) => {
            acc = red(acc, plugin[method](...args), plugin, idx + 1);
        });
        return acc;
    }

    /** Re-sorts the internal list by priority (desc; default priority = 0). */
    private reorder(): void {
        this.plugins.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    }
}

export { PluginManager };
