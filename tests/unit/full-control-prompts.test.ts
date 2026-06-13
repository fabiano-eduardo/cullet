import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInterface } from "node:readline/promises";
import {
    confirmOverwrite,
    confirmToolingOverwrite,
} from "../../packages/cli/src/cli/commands/full-control/prompts.js";

vi.mock("node:readline/promises", () => ({
    createInterface: vi.fn(),
}));

const createInterfaceMock = vi.mocked(createInterface);

const question = vi.fn<(prompt: string) => Promise<string>>();
const close = vi.fn();

function answerWith(answer: string): void {
    question.mockResolvedValueOnce(answer);
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    createInterfaceMock.mockReturnValue({
        question,
        close,
    } as unknown as ReturnType<typeof createInterface>);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
});

describe("confirmOverwrite", () => {
    it.each(["y", "yes", "s", "sim", " Y "])(
        "accepts the affirmative answer %j",
        async (answer) => {
            answerWith(answer);
            await expect(confirmOverwrite("./cullet/kit@1.0.0")).resolves.toBe(
                true,
            );
            expect(close).toHaveBeenCalled();
        },
    );

    it.each(["n", "no", "nao", ""])(
        "treats %j as a refusal",
        async (answer) => {
            answerWith(answer);
            await expect(confirmOverwrite("./cullet/kit@1.0.0")).resolves.toBe(
                false,
            );
        },
    );

    it("closes the readline interface even when the question fails", async () => {
        question.mockRejectedValueOnce(new Error("stdin fechado"));
        await expect(confirmOverwrite("./cullet")).rejects.toThrow(
            /stdin fechado/,
        );
        expect(close).toHaveBeenCalled();
    });
});

describe("confirmToolingOverwrite", () => {
    it("lists the conflicting files before asking", async () => {
        answerWith("y");

        await expect(
            confirmToolingOverwrite(".claude", ["CLAUDE.md", "hooks/pre.mjs"]),
        ).resolves.toBe(true);

        const output = logSpy.mock.calls
            .map((call: unknown[]) => call.join(" "))
            .join("\n");
        expect(output).toContain("CLAUDE.md");
        expect(output).toContain("hooks/pre.mjs");
        expect(output).not.toContain("... e mais");
    });

    it("truncates the preview to ten files", async () => {
        answerWith("n");
        const conflicts = Array.from(
            { length: 13 },
            (_, index) => `file-${index}.md`,
        );

        await expect(
            confirmToolingOverwrite(".claude", conflicts),
        ).resolves.toBe(false);

        const output = logSpy.mock.calls
            .map((call: unknown[]) => call.join(" "))
            .join("\n");
        expect(output).toContain("... e mais 3");
        expect(output).not.toContain("file-10.md");
    });
});
