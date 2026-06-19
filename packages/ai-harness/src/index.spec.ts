import { describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };
import * as api from "./index.js";

// Guards the public surface of the barrel. The names below are the contract
// advertised in meta.json `exports` (plus the OpenAI-compatible base URLs and
// the task helpers); if a re-export is dropped or renamed, this fails before a
// consumer's import does.
describe("public API surface", () => {
    it.each([
        "createProvider",
        "createAnthropicProvider",
        "createOpenAIProvider",
        "createOpenRouterProvider",
        "createGoogleProvider",
        "createProviderResolver",
        "runHarness",
        "defaultBuildPrompt",
        "resolveSkills",
        "nextRunnableTask",
        "normalizeTask",
        "markDone",
        "markFailed",
        "recordAttempt",
        "countTasks",
    ])("exports %s as a function", (name) => {
        expect(typeof (api as Record<string, unknown>)[name]).toBe("function");
    });

    it("exports the ProviderError class", () => {
        expect(typeof api.ProviderError).toBe("function");
        expect(api.ProviderError.prototype).toBeInstanceOf(Error);
    });

    it("exports the OpenAI-compatible base URLs", () => {
        expect(api.OPENAI_BASE_URL).toMatch(/^https:\/\//);
        expect(api.OPENROUTER_BASE_URL).toMatch(/^https:\/\//);
    });

    it("exports DEFAULT_LIMITS with a positive maxAttempts", () => {
        expect(api.DEFAULT_LIMITS.maxAttempts).toBeGreaterThan(0);
    });

    it("exports DEFAULT_PROTECTED_PATTERNS as a non-empty list of regexps", () => {
        expect(api.DEFAULT_PROTECTED_PATTERNS.length).toBeGreaterThan(0);
        expect(
            api.DEFAULT_PROTECTED_PATTERNS.every((p) => p instanceof RegExp),
        ).toBe(true);
    });
});

describe("release metadata", () => {
    it("reports the name and the package.json version", () => {
        expect(api.AI_HARNESS_NAME).toBe("ai-harness");
        expect(api.AI_HARNESS_VERSION).toBe(pkg.version);
    });

    it("bundles both into aiHarnessRelease", () => {
        expect(api.aiHarnessRelease).toEqual({
            name: api.AI_HARNESS_NAME,
            version: api.AI_HARNESS_VERSION,
        });
    });
});
