import { describe, expect, it, vi } from "vitest";

import { PluginManager } from "./plugin.js";

type Greeter = {
    greet: (who: string) => string;
};

function greeter(
    name: string,
    word: string,
    extra: { priority?: number; enabled?: boolean } = {},
): Greeter & { name: string; priority?: number; enabled?: boolean } {
    return {
        name,
        ...extra,
        greet: (who) => `${word}, ${who}`,
    };
}

describe("PluginManager", () => {
    describe("register / list ordering", () => {
        it("lists registered plugins ordered by priority (descending)", () => {
            const pm = new PluginManager<Greeter>();
            pm.register(
                greeter("low", "low", { priority: 1 }),
                greeter("high", "high", { priority: 10 }),
                greeter("mid", "mid", { priority: 5 }),
            );

            expect(pm.list().map((p) => p.name)).toEqual([
                "high",
                "mid",
                "low",
            ]);
        });

        it("treats a missing priority as 0", () => {
            const pm = new PluginManager<Greeter>();
            pm.register(
                greeter("default", "d"),
                greeter("top", "t", { priority: 1 }),
            );

            expect(pm.list().map((p) => p.name)).toEqual(["top", "default"]);
        });

        it("replaces a previously registered plugin with the same name", () => {
            const pm = new PluginManager<Greeter>();
            pm.register(greeter("dup", "old"));
            pm.register(greeter("dup", "new"));

            expect(pm.list()).toHaveLength(1);
            expect(pm.invoke("greet", ["x"], { fallback: () => "fb" })).toBe(
                "new, x",
            );
        });
    });

    describe("enable / disable", () => {
        it("omits disabled plugins from list() and restores them on enable", () => {
            const pm = new PluginManager<Greeter>();
            pm.register(greeter("a", "a"), greeter("b", "b"));

            pm.disable("a");
            expect(pm.list().map((p) => p.name)).toEqual(["b"]);

            pm.enable("a");
            expect(pm.list().map((p) => p.name)).toEqual(["a", "b"]);
        });

        it("enabling or disabling an unknown name is a no-op", () => {
            const pm = new PluginManager<Greeter>();
            pm.register(greeter("a", "a"));

            pm.enable("ghost");
            pm.disable("ghost");

            expect(pm.list().map((p) => p.name)).toEqual(["a"]);
        });
    });

    describe("unregister", () => {
        it("removes a plugin by name", () => {
            const pm = new PluginManager<Greeter>();
            pm.register(greeter("a", "a"), greeter("b", "b"));

            pm.unregister("a");

            expect(pm.list().map((p) => p.name)).toEqual(["b"]);
        });

        it("unregistering an unknown name is a no-op", () => {
            const pm = new PluginManager<Greeter>();
            pm.register(greeter("a", "a"));

            pm.unregister("ghost");

            expect(pm.list().map((p) => p.name)).toEqual(["a"]);
        });
    });

    describe("invoke — first mode (default)", () => {
        it("delegates to the highest-priority enabled plugin", () => {
            const pm = new PluginManager<Greeter>();
            pm.register(
                greeter("low", "low", { priority: 1 }),
                greeter("high", "high", { priority: 10 }),
            );

            expect(pm.invoke("greet", ["x"], { fallback: () => "fb" })).toBe(
                "high, x",
            );
        });

        it('honours an explicit mode: "first"', () => {
            const pm = new PluginManager<Greeter>();
            pm.register(
                greeter("low", "low", { priority: 1 }),
                greeter("high", "high", { priority: 10 }),
            );

            expect(
                pm.invoke("greet", ["x"], {
                    mode: "first",
                    fallback: () => "fb",
                }),
            ).toBe("high, x");
        });

        it("runs the fallback when nothing is registered", () => {
            const pm = new PluginManager<Greeter>();

            expect(
                pm.invoke("greet", ["x"], { fallback: (who) => `fb, ${who}` }),
            ).toBe("fb, x");
        });

        it("runs the fallback when every plugin is disabled", () => {
            const pm = new PluginManager<Greeter>();
            pm.register(greeter("a", "a", { enabled: false }));

            expect(pm.invoke("greet", ["x"], { fallback: () => "fb" })).toBe(
                "fb",
            );
        });
    });

    describe("invoke — pipeline mode", () => {
        it("folds every enabled plugin with the default reducer (keeps the last)", () => {
            const pm = new PluginManager<Greeter>();
            pm.register(
                greeter("first", "first", { priority: 10 }),
                greeter("second", "second", { priority: 1 }),
            );

            expect(
                pm.invoke("greet", ["x"], {
                    mode: "pipeline",
                    fallback: () => "fb",
                }),
            ).toBe("second, x");
        });

        it("returns the lone plugin's result without calling the reducer", () => {
            const pm = new PluginManager<Greeter>();
            pm.register(greeter("only", "only"));

            const reducer = vi.fn((acc: string) => acc);
            expect(
                pm.invoke("greet", ["x"], {
                    mode: "pipeline",
                    fallback: () => "fb",
                    reducer,
                }),
            ).toBe("only, x");
            expect(reducer).not.toHaveBeenCalled();
        });

        it("combines results with a custom reducer, in priority order", () => {
            const pm = new PluginManager<Greeter>();
            pm.register(
                greeter("a", "A", { priority: 2 }),
                greeter("b", "B", { priority: 1 }),
            );

            const out = pm.invoke("greet", ["x"], {
                mode: "pipeline",
                fallback: () => "fb",
                reducer: (acc, curr) => `${acc} | ${curr}`,
            });

            expect(out).toBe("A, x | B, x");
        });
    });
});
