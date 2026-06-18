import { describe, expect, it } from "vitest";
import { createGoogleProvider } from "./google.js";
import { ProviderError } from "./types.js";
import type { FetchLike } from "./types.js";

function stubFetch(response: Response): {
    fetchImpl: FetchLike;
    calls: Array<{ url: string; init: RequestInit }>;
} {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(input), init: init ?? {} });
        // Clone so each call gets a fresh, unread body (tests may call twice).
        return response.clone();
    }) as unknown as FetchLike;
    return { fetchImpl, calls };
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
        ...init,
    });
}

const okBody = {
    candidates: [{ content: { parts: [{ text: "hello" }] } }],
    usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 4 },
};

describe("createGoogleProvider", () => {
    it("exposes the google id and the configured model", () => {
        const { fetchImpl } = stubFetch(jsonResponse(okBody));
        const provider = createGoogleProvider({
            apiKey: "key",
            model: "gemini-2.0-flash",
            fetchImpl,
        });

        expect(provider.id).toBe("google");
        expect(provider.model).toBe("gemini-2.0-flash");
    });

    it("maps assistant to model, drops system messages and wraps content in parts", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createGoogleProvider({
            apiKey: "key",
            model: "gemini-2.0-flash",
            fetchImpl,
        });

        await provider.complete({
            messages: [
                { role: "system", content: "ignored" },
                { role: "user", content: "hi" },
                { role: "assistant", content: "yo" },
            ],
        });

        const body = JSON.parse(calls[0].init.body as string);
        expect(body.contents).toEqual([
            { role: "user", parts: [{ text: "hi" }] },
            { role: "model", parts: [{ text: "yo" }] },
        ]);
    });

    it("carries the system prompt as systemInstruction", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createGoogleProvider({
            apiKey: "key",
            model: "gemini-2.0-flash",
            fetchImpl,
        });

        await provider.complete({
            system: "be terse",
            messages: [{ role: "user", content: "hi" }],
        });

        const body = JSON.parse(calls[0].init.body as string);
        expect(body.systemInstruction).toEqual({
            parts: [{ text: "be terse" }],
        });
    });

    it("omits systemInstruction when no system prompt is given", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createGoogleProvider({
            apiKey: "key",
            model: "gemini-2.0-flash",
            fetchImpl,
        });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        const body = JSON.parse(calls[0].init.body as string);
        expect("systemInstruction" in body).toBe(false);
    });

    it("encodes the model and key into the generateContent URL", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createGoogleProvider({
            apiKey: "a key/with?chars",
            model: "models/needs encoding",
            fetchImpl,
        });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        expect(calls[0].url).toBe(
            "https://generativelanguage.googleapis.com/v1beta/models/" +
                encodeURIComponent("models/needs encoding") +
                ":generateContent?key=" +
                encodeURIComponent("a key/with?chars"),
        );
    });

    it("trims a trailing slash from a custom baseURL", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createGoogleProvider({
            apiKey: "k",
            model: "m",
            fetchImpl,
            baseURL: "https://gateway.internal/v1/",
        });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        expect(calls[0].url).toBe(
            "https://gateway.internal/v1/models/m:generateContent?key=k",
        );
    });

    it("builds generationConfig only from the limits that are set", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createGoogleProvider({
            apiKey: "k",
            model: "m",
            fetchImpl,
        });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
            maxTokens: 64,
        });
        const onlyMax = JSON.parse(calls[0].init.body as string);
        expect(onlyMax.generationConfig).toEqual({ maxOutputTokens: 64 });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
            temperature: 0.3,
        });
        const onlyTemp = JSON.parse(calls[1].init.body as string);
        expect(onlyTemp.generationConfig).toEqual({ temperature: 0.3 });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });
        const none = JSON.parse(calls[2].init.body as string);
        expect(none.generationConfig).toEqual({});
    });

    it("merges custom headers with content-type", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createGoogleProvider({
            apiKey: "k",
            model: "m",
            fetchImpl,
            headers: { "x-trace": "abc" },
        });

        await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        const headers = calls[0].init.headers as Record<string, string>;
        expect(headers["content-type"]).toBe("application/json");
        expect(headers["x-trace"]).toBe("abc");
    });

    it("concatenates candidate parts and maps usageMetadata", async () => {
        const { fetchImpl } = stubFetch(
            jsonResponse({
                candidates: [
                    {
                        content: {
                            parts: [{ text: "foo" }, { text: "bar" }, {}],
                        },
                    },
                ],
                usageMetadata: {
                    promptTokenCount: 5,
                    candidatesTokenCount: 8,
                },
            }),
        );
        const provider = createGoogleProvider({
            apiKey: "k",
            model: "m",
            fetchImpl,
        });

        const result = await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        expect(result.text).toBe("foobar");
        expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 8 });
        expect(result.raw).toMatchObject({
            usageMetadata: { promptTokenCount: 5 },
        });
    });

    it("falls back to empty text and zero usage when fields are missing", async () => {
        const { fetchImpl } = stubFetch(jsonResponse({}));
        const provider = createGoogleProvider({
            apiKey: "k",
            model: "m",
            fetchImpl,
        });

        const result = await provider.complete({
            messages: [{ role: "user", content: "hi" }],
        });

        expect(result.text).toBe("");
        expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    });

    it("throws a ProviderError tagged google when the response is not ok", async () => {
        const { fetchImpl } = stubFetch(
            new Response("permission denied", { status: 403 }),
        );
        const provider = createGoogleProvider({
            apiKey: "k",
            model: "m",
            fetchImpl,
        });

        const error = await provider
            .complete({ messages: [{ role: "user", content: "hi" }] })
            .catch((e: unknown) => e);

        expect(error).toBeInstanceOf(ProviderError);
        expect((error as ProviderError).provider).toBe("google");
        expect((error as ProviderError).status).toBe(403);
        expect((error as ProviderError).body).toBe("permission denied");
    });

    it("passes the abort signal through to fetch", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createGoogleProvider({
            apiKey: "k",
            model: "m",
            fetchImpl,
        });
        const controller = new AbortController();

        await provider.complete(
            { messages: [{ role: "user", content: "hi" }] },
            controller.signal,
        );

        expect(calls[0].init.signal).toBe(controller.signal);
    });

    it("ignores thinking — body unchanged, reasoning undefined", async () => {
        const { fetchImpl, calls } = stubFetch(jsonResponse(okBody));
        const provider = createGoogleProvider({
            apiKey: "k",
            model: "m",
            fetchImpl,
        });

        const result = await provider.complete({
            messages: [{ role: "user", content: "hi" }],
            thinking: { budgetTokens: 10_000 },
        });

        const body = JSON.parse(calls[0].init.body as string);
        expect("thinking" in body).toBe(false);
        expect(result.reasoning).toBeUndefined();
    });
});
