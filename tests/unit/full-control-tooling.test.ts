import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runToolingFullControl } from "../../packages/cli/src/cli/commands/full-control/tooling.js";
import { confirmToolingOverwrite } from "../../packages/cli/src/cli/commands/full-control/prompts.js";
import { type FullControlContext } from "../../packages/cli/src/cli/commands/full-control/types.js";
import { type KitMeta } from "../../packages/cli/src/cli/utils/resolve.js";
import {
    type TelemetryCommandTracker,
    type TelemetryProperty,
} from "../../packages/cli/src/cli/utils/telemetry.js";

vi.mock("../../packages/cli/src/cli/commands/full-control/prompts.js", () => ({
    confirmOverwrite: vi.fn(),
    confirmToolingOverwrite: vi.fn(),
}));

const confirmToolingOverwriteMock = vi.mocked(confirmToolingOverwrite);

const NPM_NAME = "@cullet/agent-kit";

let consumer: string;
let previousCwd: string;
let logSpy: ReturnType<typeof vi.spyOn>;

function makeTracker() {
    const set =
        vi.fn<(name: string, value: TelemetryProperty | undefined) => void>();
    return { set } satisfies TelemetryCommandTracker;
}

function makeMeta(overrides: Partial<KitMeta> = {}): KitMeta {
    return {
        kind: "tooling",
        delivery: {
            copy: {
                placement: ".claude",
                source: "files",
                dependencies: [],
            },
        },
        ...overrides,
    };
}

function makeContext(
    overrides: Partial<FullControlContext> = {},
): FullControlContext {
    return {
        name: "agent-kit",
        version: "1.0.0",
        npmName: NPM_NAME,
        meta: makeMeta(),
        installSpec: `${NPM_NAME}@1.0.0`,
        alreadyInstalled: true,
        packageManager: "npm",
        options: {},
        tracker: makeTracker(),
        ...overrides,
    };
}

async function installPayload(files: Record<string, string>): Promise<void> {
    const payloadRoot = join(consumer, "node_modules", NPM_NAME, "files");
    await writeFile(
        join(consumer, "node_modules", NPM_NAME, "package.json"),
        JSON.stringify({ name: NPM_NAME, version: "1.0.0" }),
    );
    for (const [rel, content] of Object.entries(files)) {
        const path = join(payloadRoot, rel);
        await mkdir(join(path, ".."), { recursive: true });
        await writeFile(path, content);
    }
}

function loggedOutput(): string {
    return logSpy.mock.calls
        .map((call: unknown[]) => call.join(" "))
        .join("\n");
}

beforeEach(async () => {
    consumer = await mkdtemp(join(tmpdir(), "cullet-tooling-"));
    await mkdir(join(consumer, "node_modules", NPM_NAME), { recursive: true });
    previousCwd = process.cwd();
    process.chdir(consumer);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(async () => {
    process.chdir(previousCwd);
    vi.restoreAllMocks();
    confirmToolingOverwriteMock.mockReset();
    await rm(consumer, { recursive: true, force: true });
});

describe("runToolingFullControl", () => {
    it("throws when a tooling kit does not declare delivery.copy", async () => {
        const context = makeContext({ meta: { kind: "tooling" } });

        await expect(runToolingFullControl(context)).rejects.toThrow(
            /delivery\.copy/,
        );
    });

    it("copies the payload into the placement and reports the result", async () => {
        await installPayload({
            "CLAUDE.md": "# kit",
            "hooks/pre.mjs": "export {};",
        });
        const context = makeContext();

        await runToolingFullControl(context);

        await expect(
            readFile(join(consumer, ".claude", "CLAUDE.md"), "utf8"),
        ).resolves.toBe("# kit");
        await expect(
            readFile(join(consumer, ".claude", "hooks", "pre.mjs"), "utf8"),
        ).resolves.toBe("export {};");
        expect(loggedOutput()).toContain("Kit agent-kit adicionado em .claude");
        expect(confirmToolingOverwriteMock).not.toHaveBeenCalled();
    });

    it("runs the declared postInstall script after the copy", async () => {
        await installPayload({
            "CLAUDE.md": "# kit",
            "setup.mjs":
                "import { writeFileSync } from 'node:fs';" +
                "writeFileSync('postinstall-ran', 'ok');",
        });
        const tracker = makeTracker();
        const meta = makeMeta();
        meta.delivery!.copy!.postInstall = "setup.mjs";
        const context = makeContext({ meta, tracker });

        await runToolingFullControl(context);

        expect(existsSync(join(consumer, ".claude", "postinstall-ran"))).toBe(
            true,
        );
        expect(tracker.set).toHaveBeenCalledWith("postInstall", true);
    });

    it("mentions the importable surface when the kit also declares delivery.import", async () => {
        await installPayload({ "CLAUDE.md": "# kit" });
        const meta = makeMeta();
        meta.delivery!.import = { peerDependencies: [] };
        const context = makeContext({ meta });

        await runToolingFullControl(context);

        expect(loggedOutput()).toContain("superficie importavel");
    });

    it("asks before overwriting conflicts and cancels when declined", async () => {
        await installPayload({ "CLAUDE.md": "# kit" });
        await mkdir(join(consumer, ".claude"), { recursive: true });
        await writeFile(join(consumer, ".claude", "CLAUDE.md"), "meu proprio");
        confirmToolingOverwriteMock.mockResolvedValue(false);
        const tracker = makeTracker();
        const context = makeContext({ tracker });

        await runToolingFullControl(context);

        expect(confirmToolingOverwriteMock).toHaveBeenCalledWith(".claude", [
            "CLAUDE.md",
        ]);
        await expect(
            readFile(join(consumer, ".claude", "CLAUDE.md"), "utf8"),
        ).resolves.toBe("meu proprio");
        expect(tracker.set).toHaveBeenCalledWith("cancelled", true);
    });

    it("overwrites conflicts after confirmation", async () => {
        await installPayload({ "CLAUDE.md": "# kit" });
        await mkdir(join(consumer, ".claude"), { recursive: true });
        await writeFile(join(consumer, ".claude", "CLAUDE.md"), "meu proprio");
        confirmToolingOverwriteMock.mockResolvedValue(true);
        const context = makeContext();

        await runToolingFullControl(context);

        await expect(
            readFile(join(consumer, ".claude", "CLAUDE.md"), "utf8"),
        ).resolves.toBe("# kit");
    });

    it("dry-run previews the copy with sample files and conflicts", async () => {
        await installPayload({
            "CLAUDE.md": "# kit",
            "hooks/pre.mjs": "export {};",
        });
        await mkdir(join(consumer, ".claude"), { recursive: true });
        await writeFile(join(consumer, ".claude", "CLAUDE.md"), "meu proprio");
        const meta = makeMeta();
        meta.delivery!.copy!.postInstall = "setup.mjs";
        meta.delivery!.copy!.dependencies = [{ name: "zod", range: ">=4" }];
        const context = makeContext({ meta, options: { dryRun: true } });

        await runToolingFullControl(context);

        const output = loggedOutput();
        expect(output).toContain("[dry-run] full-control (tooling)");
        expect(output).toContain("Arquivos que seriam adicionados");
        expect(output).toContain("seriam sobrescritos");
        expect(output).toContain("setup.mjs");
        expect(output).toContain("zod");
        // Nada foi copiado de fato.
        expect(existsSync(join(consumer, ".claude", "hooks"))).toBe(false);
    });

    it("dry-run without the package installed only describes the source", async () => {
        const context = makeContext({
            alreadyInstalled: false,
            options: { dryRun: true },
        });

        await runToolingFullControl(context);

        expect(loggedOutput()).toContain(
            `O payload seria copiado de node_modules/${NPM_NAME}/files`,
        );
    });
});
