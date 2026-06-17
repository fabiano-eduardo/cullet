import { describe, expect, it } from "vitest";
import { createProvider } from "./factory.js";
import type { ProviderName } from "./types.js";

describe("createProvider", () => {
    const base = { apiKey: "key", model: "model" } as const;

    it.each<[ProviderName, ProviderName]>([
        ["anthropic", "anthropic"],
        ["openai", "openai"],
        ["openrouter", "openrouter"],
        ["google", "google"],
    ])(
        "builds the %s provider with the expected id",
        (provider, expectedId) => {
            const built = createProvider({ ...base, provider });
            expect(built.id).toBe(expectedId);
            expect(built.model).toBe("model");
        },
    );

    it("throws on an unknown provider, naming it in the message", () => {
        // Cast past the exhaustive `never` to exercise the default branch.
        expect(() =>
            createProvider({
                ...base,
                provider: "mistral" as ProviderName,
            }),
        ).toThrow("Unknown provider: mistral");
    });
});
