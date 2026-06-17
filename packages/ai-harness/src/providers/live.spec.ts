import { describe, expect, it } from "vitest";
import { createProvider } from "./factory.js";
import type { ProviderName } from "./types.js";

// Opt-in live smoke tests that hit the real provider APIs over the network.
// Everything in the unit suite stubs `fetch`, so the actual wire format is never
// exercised; these close that gap. They are SKIPPED unless `AI_HARNESS_LIVE=1`
// and the provider's key + model env vars are set, so CI (which has neither) and
// `npm run test:kits` never run them and never cost a token.
//
// Run them by hand before a release, against each provider you actually ship:
//
//   AI_HARNESS_LIVE=1 \
//   ANTHROPIC_API_KEY=sk-... ANTHROPIC_MODEL=claude-opus-4-8 \
//   npm run test:live
//
// No model id is hard-coded — it comes from `<PROVIDER>_MODEL` — so this test
// honours the kit's "models are input, never baked in" rule.
const live = process.env.AI_HARNESS_LIVE === "1";

interface LiveTarget {
    provider: ProviderName;
    keyEnv: string;
    modelEnv: string;
}

const TARGETS: LiveTarget[] = [
    {
        provider: "anthropic",
        keyEnv: "ANTHROPIC_API_KEY",
        modelEnv: "ANTHROPIC_MODEL",
    },
    { provider: "openai", keyEnv: "OPENAI_API_KEY", modelEnv: "OPENAI_MODEL" },
    {
        provider: "openrouter",
        keyEnv: "OPENROUTER_API_KEY",
        modelEnv: "OPENROUTER_MODEL",
    },
    { provider: "google", keyEnv: "GOOGLE_API_KEY", modelEnv: "GOOGLE_MODEL" },
];

describe("live provider smoke tests", () => {
    for (const { provider, keyEnv, modelEnv } of TARGETS) {
        const apiKey = process.env[keyEnv];
        const model = process.env[modelEnv];
        const ready = live && Boolean(apiKey) && Boolean(model);

        it.skipIf(!ready)(
            `${provider} returns text and token usage for a trivial prompt`,
            async () => {
                const agent = createProvider({
                    provider,
                    apiKey: apiKey as string,
                    model: model as string,
                });

                const result = await agent.complete({
                    messages: [
                        {
                            role: "user",
                            content: "Reply with a short greeting.",
                        },
                    ],
                    maxTokens: 32,
                });

                expect(result.text.trim().length).toBeGreaterThan(0);
                expect(result.usage.outputTokens).toBeGreaterThan(0);
            },
            30_000,
        );
    }
});
