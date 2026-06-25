import { describe, expect, it } from "vitest";
import { createProviderResolver } from "./resolver.js";
import type { Task } from "../harness/types.js";

const task = (over: Partial<Task> = {}): Task => ({
    id: "t",
    description: "x",
    ...over,
});

describe("createProviderResolver", () => {
    it("picks the vendor and model from the task", () => {
        const resolve = createProviderResolver({
            anthropic: { apiKey: "a" },
            openai: { apiKey: "o" },
        });

        const p = resolve(task({ provider: "openai", model: "gpt-4o" }));
        expect(p.id).toBe("openai");
        expect(p.model).toBe("gpt-4o");
    });

    it("falls back to defaultProvider and defaultModel", () => {
        const resolve = createProviderResolver({
            anthropic: { apiKey: "a" },
            defaultProvider: "anthropic",
            defaultModel: "claude-opus-4-8",
        });

        const p = resolve(task());
        expect(p.id).toBe("anthropic");
        expect(p.model).toBe("claude-opus-4-8");
    });

    it("prefers the vendor defaultModel over config.defaultModel", () => {
        const resolve = createProviderResolver({
            anthropic: { apiKey: "a", defaultModel: "claude-haiku-4-5" },
            defaultProvider: "anthropic",
            defaultModel: "claude-opus-4-8",
        });

        expect(resolve(task()).model).toBe("claude-haiku-4-5");
    });

    it("memoizes by provider|model|baseURL", () => {
        const resolve = createProviderResolver({ anthropic: { apiKey: "a" } });

        const first = resolve(task({ provider: "anthropic", model: "m" }));
        const second = resolve(task({ provider: "anthropic", model: "m" }));
        const other = resolve(task({ provider: "anthropic", model: "n" }));

        expect(second).toBe(first);
        expect(other).not.toBe(first);
    });

    it("throws when the task has no provider and there is no default", () => {
        const resolve = createProviderResolver({ anthropic: { apiKey: "a" } });
        expect(() => resolve(task())).toThrow(/has no provider/);
    });

    it("throws when the task targets an unconfigured vendor", () => {
        const resolve = createProviderResolver({ anthropic: { apiKey: "a" } });
        expect(() =>
            resolve(task({ provider: "openai", model: "gpt-4o" })),
        ).toThrow(/not configured/);
    });

    it("throws when no model can be determined", () => {
        const resolve = createProviderResolver({ anthropic: { apiKey: "a" } });
        expect(() => resolve(task({ provider: "anthropic" }))).toThrow(
            /has no.*model/s,
        );
    });
});
