// Opt-in, batteries-included strategies for running the harness in a Node.js
// project: extract code blocks from the model output and write them to disk, and
// run shell commands as verification sensors. None of this is imported by the
// neutral core — pull it in only if it fits your project.
import { execSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { DEFAULT_PROTECTED_PATTERNS } from "../constants.js";
import { defaultBuildPrompt } from "../harness/prompt.js";
import type {
    ApplyFn,
    BuildPromptArgs,
    VerifyFn,
    VerifyOutcome,
} from "../harness/types.js";
import type { CompletionRequest } from "../providers/types.js";

export {
    createGitCheckpoint,
    gitCommitAll,
    gitRollback,
    isGitClean,
} from "./git.js";
export type { GitCheckpoint, GitCheckpointOptions } from "./git.js";

export interface FileBlock {
    path: string;
    content: string;
}

/**
 * Parse `FILE: <path>` fenced blocks out of model output:
 *
 *     FILE: src/foo.ts
 *     ```ts
 *     ...content...
 *     ```
 */
export function extractFileBlocks(output: string): FileBlock[] {
    const re = /FILE:\s*(.+?)\r?\n```[\w-]*\r?\n([\s\S]*?)```/g;
    const blocks: FileBlock[] = [];
    let match: RegExpExecArray | null;
    while ((match = re.exec(output)) !== null) {
        blocks.push({ path: match[1].trim(), content: match[2] });
    }
    return blocks;
}

// The output contract the FILE: writer understands, appended to the neutral
// core prompt. Kept here — not in the architecture-neutral `defaultBuildPrompt`
// — because the `FILE:` format belongs to this Node runtime, alongside
// `nodeFileWriter` and `extractFileBlocks` that consume it.
const FILE_BLOCK_INSTRUCTIONS = [
    "# Output format",
    "Return the full contents of every file you create or modify, each in its own block:",
    "",
    "FILE: relative/path/from/project/root.ts",
    "```ts",
    "<the complete file contents>",
    "```",
    "",
    "Rules:",
    "- Start each file with a `FILE:` line, immediately followed by a fenced code block holding the entire file (not a diff or a snippet).",
    "- Use paths relative to the project root; absolute paths and anything outside the root are refused.",
    "- Anything outside these blocks is treated as commentary and is not written to disk.",
].join("\n");

/**
 * A `buildPrompt` that wraps {@link defaultBuildPrompt} and appends the `FILE:`
 * output contract. Pair it with {@link nodeFileWriter}: that writer only applies
 * output shaped as `FILE:` fenced blocks, and the architecture-neutral default
 * prompt never asks for that shape — so without this (or your own equivalent)
 * the writer typically receives output it cannot apply and writes nothing.
 */
export function fileBlockPrompt(args: BuildPromptArgs): CompletionRequest {
    const base = defaultBuildPrompt(args);
    const messages = base.messages.map((message) => ({ ...message }));
    const last = messages.at(-1);
    if (last) {
        last.content = `${last.content}\n\n${FILE_BLOCK_INSTRUCTIONS}`;
    }
    return { ...base, messages };
}

export interface NodeFileWriterOptions {
    /** Root the agent is allowed to write within. Defaults to process.cwd(). */
    projectRoot?: string;
    /** Paths matching any pattern are read-only. Defaults to DEFAULT_PROTECTED_PATTERNS. */
    protectedPatterns?: RegExp[];
    /**
     * Deny-by-default allowlist. When set, only paths (relative to projectRoot)
     * matching one of these patterns are written; everything else is refused
     * with reason `"not allowlisted"`. Tightens the blast radius beyond the
     * `protectedPatterns` denylist — e.g. `[/^src\//]` to confine writes to src.
     */
    allowedPatterns?: RegExp[];
    /**
     * Report what would be written via `onWrite` (reason `"dry run"`) without
     * touching disk, so you can review the agent's diff before committing to it.
     * Only paths that clear every guard are reported as dry-run writes; refusals
     * still surface their own reason.
     */
    dryRun?: boolean;
    /** Called for each write decision; useful for logging. */
    onWrite?: (info: {
        path: string;
        written: boolean;
        reason?: string;
    }) => void;
}

/**
 * Build an `apply` strategy that writes the model's `FILE:` blocks to disk,
 * confined to `projectRoot`, refusing protected paths and — when an allowlist
 * is set — anything outside it. Pass `dryRun` to preview without writing.
 */
export function nodeFileWriter(options: NodeFileWriterOptions = {}): ApplyFn {
    const root = resolve(options.projectRoot ?? process.cwd());
    const protectedPatterns =
        options.protectedPatterns ?? DEFAULT_PROTECTED_PATTERNS;
    const { allowedPatterns, dryRun } = options;

    return async ({ result }) => {
        const blocks = extractFileBlocks(result.text);

        // Non-empty output that yielded no blocks means the format didn't
        // match — the loop below would silently write nothing. Surface that
        // no-op through onWrite instead of marking the task done for free.
        if (blocks.length === 0 && result.text.trim() !== "") {
            options.onWrite?.({
                path: "",
                written: false,
                reason: "no FILE: blocks in output",
            });
            return;
        }

        for (const block of blocks) {
            const full = resolve(root, block.path);
            const rel = relative(root, full);

            if (rel.startsWith("..") || rel === "") {
                options.onWrite?.({
                    path: block.path,
                    written: false,
                    reason: "outside project root",
                });
                continue;
            }
            if (protectedPatterns.some((p) => p.test(rel))) {
                options.onWrite?.({
                    path: block.path,
                    written: false,
                    reason: "protected path",
                });
                continue;
            }
            if (allowedPatterns && !allowedPatterns.some((p) => p.test(rel))) {
                options.onWrite?.({
                    path: block.path,
                    written: false,
                    reason: "not allowlisted",
                });
                continue;
            }
            if (dryRun) {
                options.onWrite?.({
                    path: block.path,
                    written: false,
                    reason: "dry run",
                });
                continue;
            }

            await mkdir(dirname(full), { recursive: true });
            await writeFile(full, block.content, "utf-8");
            options.onWrite?.({ path: block.path, written: true });
        }
    };
}

export interface ShellVerifierOptions {
    /** Working directory for the commands. Defaults to process.cwd(). */
    cwd?: string;
    /** Per-command timeout in ms. */
    timeoutMs?: number;
}

/**
 * Build a `verify` strategy that runs shell commands in order and fails on the
 * first non-zero exit, returning its combined output as feedback. The commands
 * are entirely yours — lint, typecheck, tests, a build, anything.
 */
export function shellVerifier(
    commands: string[],
    options: ShellVerifierOptions = {},
): VerifyFn {
    const cwd = options.cwd ?? process.cwd();

    return (): VerifyOutcome => {
        for (const cmd of commands) {
            try {
                execSync(cmd, {
                    cwd,
                    encoding: "utf-8",
                    stdio: ["ignore", "pipe", "pipe"],
                    timeout: options.timeoutMs,
                });
            } catch (err) {
                const e = err as { stdout?: string; stderr?: string };
                const out = [e.stdout, e.stderr]
                    .filter(Boolean)
                    .join("\n")
                    .trim();
                return {
                    passed: false,
                    feedback: `Command failed: \`${cmd}\`\n\n${out}`,
                };
            }
        }
        return { passed: true };
    };
}

/** Read a UTF-8 file relative to a root, or null if it does not exist. */
export async function readFileSafe(
    root: string,
    relativePath: string,
): Promise<string | null> {
    try {
        return await readFile(resolve(root, relativePath), "utf-8");
    } catch {
        return null;
    }
}
