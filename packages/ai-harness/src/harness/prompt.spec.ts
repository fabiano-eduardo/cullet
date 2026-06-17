import { describe, expect, it } from "vitest";
import { defaultBuildPrompt } from "./prompt.js";
import type { Task } from "./types.js";

function buildFor(task: Task): string {
    const request = defaultBuildPrompt({ task, tasks: [task] });
    return request.messages[0]?.content ?? "";
}

describe("defaultBuildPrompt", () => {
    it("describes the task with its id and description", () => {
        const content = buildFor({ id: "t-1", description: "do the thing" });

        expect(content).toContain("# Task");
        expect(content).toContain("ID: t-1");
        expect(content).toContain("do the thing");
        // No optional sections when context/feedback are absent.
        expect(content).not.toContain("# Context");
        expect(content).not.toContain("# Feedback");
    });

    it("appends a context section when the task carries context", () => {
        const content = buildFor({
            id: "t-1",
            description: "do the thing",
            context: "module lives in src/foo",
        });

        expect(content).toContain("# Context\nmodule lives in src/foo");
    });

    it("replays the previous attempt's feedback when present", () => {
        const content = buildFor({
            id: "t-1",
            description: "do the thing",
            lastFeedback: "tests failed on line 3",
        });

        expect(content).toContain("# Feedback from the previous attempt");
        expect(content).toContain("tests failed on line 3");
        expect(content).toContain("Fix exactly the problems above.");
    });

    it("includes both context and feedback sections together", () => {
        const content = buildFor({
            id: "t-1",
            description: "do the thing",
            context: "ctx here",
            lastFeedback: "fb here",
        });

        expect(content).toContain("# Context\nctx here");
        expect(content).toContain(
            "# Feedback from the previous attempt\nfb here",
        );
    });

    it("produces a single user message", () => {
        const request = defaultBuildPrompt({
            task: { id: "t-1", description: "x" },
            tasks: [],
        });

        expect(request.messages).toHaveLength(1);
        expect(request.messages[0]?.role).toBe("user");
    });
});
