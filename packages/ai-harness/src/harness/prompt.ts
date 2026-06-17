// The default, architecture-neutral prompt builder. It describes the task and
// replays the previous attempt's sensor feedback, but makes no assumption about
// tests, file formats, or stack. Override via `HarnessConfig.buildPrompt` to add
// project rules, output conventions, or a system prompt of your own.
import type { CompletionRequest } from "../providers/types.js";
import type { BuildPromptArgs } from "./types.js";

export function defaultBuildPrompt({
    task,
}: BuildPromptArgs): CompletionRequest {
    const sections: string[] = [];

    sections.push(`# Task\nID: ${task.id}\n${task.description}`);

    if (task.context) {
        sections.push(`# Context\n${task.context}`);
    }

    if (task.lastFeedback) {
        sections.push(
            `# Feedback from the previous attempt\n${task.lastFeedback}\n\nFix exactly the problems above.`,
        );
    }

    return {
        messages: [{ role: "user", content: sections.join("\n\n") }],
    };
}
