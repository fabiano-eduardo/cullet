import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    extractFileBlocks,
    nodeFileWriter,
    readFileSafe,
    shellVerifier,
} from "./node.js";
import type { ApplyArgs } from "../harness/types.js";

/** Wrap raw model text in the ApplyArgs shape the apply strategy receives. */
function applyArgs(text: string): ApplyArgs {
    return {
        task: { id: "t", description: "d" },
        result: { text, usage: { inputTokens: 0, outputTokens: 0 }, raw: null },
    };
}

describe("extractFileBlocks", () => {
    it("extracts multiple blocks in order", () => {
        const output = [
            "Some preamble.",
            "FILE: src/a.ts",
            "```ts",
            "const a = 1;",
            "```",
            "More prose between blocks.",
            "FILE: src/b.ts",
            "```js",
            "const b = 2;",
            "```",
        ].join("\n");

        const blocks = extractFileBlocks(output);

        expect(blocks).toEqual([
            { path: "src/a.ts", content: "const a = 1;\n" },
            { path: "src/b.ts", content: "const b = 2;\n" },
        ]);
    });

    it("parses a fence with no language tag", () => {
        const output = "FILE: notes.md\n```\nhello\n```";

        const blocks = extractFileBlocks(output);

        expect(blocks).toEqual([{ path: "notes.md", content: "hello\n" }]);
    });

    it("handles CRLF line endings", () => {
        const output = "FILE: src/c.ts\r\n```ts\r\nconst c = 3;\r\n```";

        const blocks = extractFileBlocks(output);

        expect(blocks).toHaveLength(1);
        expect(blocks[0].path).toBe("src/c.ts");
        expect(blocks[0].content).toBe("const c = 3;\r\n");
    });

    it("trims surrounding whitespace from the path", () => {
        const output = "FILE:    src/spaced.ts   \n```ts\nx\n```";

        const blocks = extractFileBlocks(output);

        expect(blocks[0].path).toBe("src/spaced.ts");
    });

    it("returns an empty array when there are no blocks", () => {
        expect(extractFileBlocks("no file blocks here")).toEqual([]);
    });
});

describe("nodeFileWriter", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "harness-node-"));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("writes a file inside the project root", async () => {
        const onWrite = vi.fn();
        const apply = nodeFileWriter({ projectRoot: root, onWrite });

        await apply(
            applyArgs("FILE: src/feature.ts\n```ts\nexport const x = 1;\n```"),
        );

        const written = await readFile(join(root, "src/feature.ts"), "utf-8");
        expect(written).toBe("export const x = 1;\n");
        expect(onWrite).toHaveBeenCalledWith({
            path: "src/feature.ts",
            written: true,
        });
    });

    it("creates intermediate subdirectories", async () => {
        const apply = nodeFileWriter({ projectRoot: root });

        await apply(
            applyArgs("FILE: a/b/c/deep.ts\n```ts\nexport const d = 1;\n```"),
        );

        expect(existsSync(join(root, "a/b/c/deep.ts"))).toBe(true);
    });

    it("refuses paths that escape the root via traversal", async () => {
        const onWrite = vi.fn();
        const apply = nodeFileWriter({ projectRoot: root, onWrite });

        await apply(
            applyArgs("FILE: ../escape.ts\n```ts\nexport const e = 1;\n```"),
        );

        expect(existsSync(join(root, "..", "escape.ts"))).toBe(false);
        expect(onWrite).toHaveBeenCalledWith({
            path: "../escape.ts",
            written: false,
            reason: "outside project root",
        });
    });

    it("refuses a path that resolves to the root itself", async () => {
        const onWrite = vi.fn();
        const apply = nodeFileWriter({ projectRoot: root, onWrite });

        await apply(applyArgs("FILE: .\n```ts\nignored\n```"));

        expect(onWrite).toHaveBeenCalledWith({
            path: ".",
            written: false,
            reason: "outside project root",
        });
    });

    it.each([
        [".env", "SECRET=1"],
        [".env.production", "SECRET=1"],
        ["tsconfig.json", "{}"],
        ["tsconfig.build.json", "{}"],
        ["package.json", "{}"],
        ["package-lock.json", "{}"],
        ["yarn.lock", ""],
        ["pnpm-lock.yaml", ""],
        [".git/config", "[core]"],
        [".github/workflows/ci.yml", "name: ci"],
        ["src/feature.spec.ts", "test"],
        ["src/feature.test.ts", "test"],
    ])("refuses the protected path %s", async (path, content) => {
        const onWrite = vi.fn();
        const apply = nodeFileWriter({ projectRoot: root, onWrite });

        await apply(applyArgs(`FILE: ${path}\n\`\`\`\n${content}\n\`\`\``));

        expect(existsSync(join(root, path))).toBe(false);
        expect(onWrite).toHaveBeenCalledWith({
            path,
            written: false,
            reason: "protected path",
        });
    });

    it("honours custom protectedPatterns over the defaults", async () => {
        const apply = nodeFileWriter({
            projectRoot: root,
            protectedPatterns: [/secrets\.ts$/],
        });

        // package.json is no longer protected once defaults are replaced.
        await apply(applyArgs("FILE: package.json\n```\n{}\n```"));
        await apply(applyArgs("FILE: secrets.ts\n```ts\nx\n```"));

        expect(existsSync(join(root, "package.json"))).toBe(true);
        expect(existsSync(join(root, "secrets.ts"))).toBe(false);
    });

    it("with allowedPatterns set, writes matching paths and refuses the rest", async () => {
        const onWrite = vi.fn();
        const apply = nodeFileWriter({
            projectRoot: root,
            allowedPatterns: [/^src\//],
            onWrite,
        });

        await apply(
            applyArgs(
                "FILE: src/ok.ts\n```ts\nexport const ok = 1;\n```\n" +
                    "FILE: docs/nope.md\n```\nhi\n```",
            ),
        );

        expect(existsSync(join(root, "src/ok.ts"))).toBe(true);
        expect(existsSync(join(root, "docs/nope.md"))).toBe(false);
        expect(onWrite).toHaveBeenCalledWith({
            path: "src/ok.ts",
            written: true,
        });
        expect(onWrite).toHaveBeenCalledWith({
            path: "docs/nope.md",
            written: false,
            reason: "not allowlisted",
        });
    });

    it("dryRun reports the intended write without touching disk", async () => {
        const onWrite = vi.fn();
        const apply = nodeFileWriter({
            projectRoot: root,
            dryRun: true,
            onWrite,
        });

        await apply(
            applyArgs("FILE: src/preview.ts\n```ts\nexport const p = 1;\n```"),
        );

        expect(existsSync(join(root, "src/preview.ts"))).toBe(false);
        expect(onWrite).toHaveBeenCalledWith({
            path: "src/preview.ts",
            written: false,
            reason: "dry run",
        });
    });

    it("defaults the project root to process.cwd() when omitted", async () => {
        const onWrite = vi.fn();
        // No projectRoot → root is process.cwd(). Target a protected path so
        // the guardrail refuses it and nothing is written into the real cwd.
        const apply = nodeFileWriter({ onWrite });

        await apply(applyArgs("FILE: package.json\n```\n{}\n```"));

        expect(onWrite).toHaveBeenCalledWith({
            path: "package.json",
            written: false,
            reason: "protected path",
        });
    });
});

describe("shellVerifier", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "harness-shell-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("passes when every command exits zero", async () => {
        const verify = shellVerifier(
            ['node -e "process.exit(0)"', 'node -e "process.exit(0)"'],
            { cwd },
        );

        expect(await verify({ task: { id: "t", description: "d" } })).toEqual({
            passed: true,
        });
    });

    it("fails on the first non-zero exit and reports stdout + stderr", async () => {
        const verify = shellVerifier(
            [
                'node -e "process.exit(0)"',
                "node -e \"process.stdout.write('OUT_MARKER'); process.stderr.write('ERR_MARKER'); process.exit(1)\"",
                "node -e \"throw new Error('should not run')\"",
            ],
            { cwd },
        );

        const outcome = await verify({ task: { id: "t", description: "d" } });

        expect(outcome.passed).toBe(false);
        expect(outcome.feedback).toContain("Command failed");
        expect(outcome.feedback).toContain("OUT_MARKER");
        expect(outcome.feedback).toContain("ERR_MARKER");
        // It must short-circuit before the third command would have thrown.
        expect(outcome.feedback).not.toContain("should not run");
    });

    it("runs commands in the configured cwd", async () => {
        writeFileSync(join(cwd, "marker.txt"), "present");
        // This succeeds only if the command runs in `cwd`, where marker.txt lives.
        const verify = shellVerifier(
            ["node -e \"require('fs').readFileSync('marker.txt')\""],
            { cwd },
        );

        const outcome = await verify({ task: { id: "t", description: "d" } });
        expect(outcome.passed).toBe(true);
    });

    it("defaults the working directory to process.cwd() when omitted", async () => {
        // No cwd option → runs in process.cwd(); the command itself is inert.
        const verify = shellVerifier(['node -e ""']);

        expect(await verify({ task: { id: "t", description: "d" } })).toEqual({
            passed: true,
        });
    });
});

describe("readFileSafe", () => {
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "harness-read-"));
    });

    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });

    it("reads an existing file relative to the root", async () => {
        writeFileSync(join(root, "exists.txt"), "content here");

        expect(await readFileSafe(root, "exists.txt")).toBe("content here");
    });

    it("returns null when the file does not exist", async () => {
        expect(await readFileSafe(root, "missing.txt")).toBeNull();
    });
});
