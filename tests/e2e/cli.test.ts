import { spawn, spawnSync, type SpawnOptions } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const cliEntry = join(repoRoot, "cli", "index.js");
const distEntry = join(repoRoot, "dist", "cli", "index.js");

interface RunResult {
    stdout: string;
    stderr: string;
    status: number | null;
}

function runCli(
    args: string[],
    cwd: string,
    options: { input?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<RunResult> {
    return new Promise((resolvePromise, rejectPromise) => {
        const spawnOptions: SpawnOptions = {
            cwd,
            env: { ...process.env, ...(options.env ?? {}) },
            stdio: ["pipe", "pipe", "pipe"],
        };
        const child = spawn("node", [cliEntry, ...args], spawnOptions);

        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr?.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        child.on("error", rejectPromise);
        child.on("close", (status) => {
            resolvePromise({ stdout, stderr, status });
        });

        if (options.input !== undefined) {
            child.stdin?.write(options.input);
        }
        child.stdin?.end();
    });
}

function ensureBuilt(): void {
    if (existsSync(distEntry)) return;
    const result = spawnSync("npm", ["run", "build"], {
        cwd: repoRoot,
        stdio: "inherit",
        env: process.env,
    });
    if (result.status !== 0) {
        throw new Error(
            `npm run build failed with status ${result.status}; cannot run e2e tests`
        );
    }
}

const E2E_ROOT = join(repoRoot, "tmp", "e2e");

beforeAll(() => {
    ensureBuilt();
    mkdirSync(E2E_ROOT, { recursive: true });
});

afterAll(() => {
    if (!process.env.CULLET_E2E_KEEP) {
        rmSync(E2E_ROOT, { recursive: true, force: true });
    }
});

function makeProject(tag: string): string {
    const dir = mkdtempSync(join(E2E_ROOT, `${tag}-`));
    writeFileSync(
        join(dir, "tsconfig.json"),
        JSON.stringify(
            {
                compilerOptions: {
                    target: "ES2020",
                    module: "ESNext",
                    moduleResolution: "Bundler",
                    strict: true,
                },
                include: ["src/**/*"],
            },
            null,
            2
        )
    );
    writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: tag, type: "module", version: "0.0.0" }, null, 2)
    );
    return dir;
}

describe("cullet CLI e2e", () => {
    let project: string;

    beforeEach(() => {
        project = makeProject("e2e");
    });

    it("cullet info erp-core succeeds in a minimal project", async () => {
        const result = await runCli(["info", "erp-core"], project);
        expect(result.status).toBe(0);
        expect(result.stdout).toMatch(/Kit validado: erp-core@/);
        expect(result.stdout).toMatch(
            /import \{ \.\.\. \} from "cullet\/erp-core"/
        );
    });

    it("cullet fc copies the kit, creates the alias, and writes valid TypeScript", async () => {
        const result = await runCli(["fc", "erp-core"], project);
        expect(result.status).toBe(0);

        const copiedDir = join(project, "cullet");
        expect(existsSync(copiedDir)).toBe(true);
        const subdirs = readDirEntries(copiedDir);
        expect(subdirs.length).toBeGreaterThan(0);
        const kitDir = join(copiedDir, subdirs[0]);
        expect(existsSync(join(kitDir, "index.ts"))).toBe(true);

        const tsconfig = JSON.parse(
            readFileSync(join(project, "tsconfig.json"), "utf8")
        ) as { compilerOptions?: { paths?: Record<string, unknown> } };
        expect(tsconfig.compilerOptions?.paths).toBeDefined();
        expect(tsconfig.compilerOptions?.paths?.["cullet/erp-core"]).toEqual([
            `./cullet/${subdirs[0]}/index.ts`,
        ]);
    });

    it("running cullet fc twice with an explicit version overwrites without duplicating", async () => {
        const first = await runCli(["fc", "erp-core@1.0.0"], project);
        expect(first.status).toBe(0);

        const kitDir = join(project, "cullet", "erp-core@1.0.0");
        expect(existsSync(kitDir)).toBe(true);

        // Touch a sentinel file inside the kit to verify the second run wipes it.
        writeFileSync(join(kitDir, "__sentinel__"), "should be removed");

        const second = await runCli(["fc", "erp-core@1.0.0"], project, {
            input: "y\n",
        });
        expect(second.status).toBe(0);

        // After overwrite the sentinel must be gone.
        expect(existsSync(join(kitDir, "__sentinel__"))).toBe(false);

        // No duplicate directory should appear (no erp-core@1.0.0 (1), etc.).
        const entries = readDirEntries(join(project, "cullet"));
        expect(entries).toEqual(["erp-core@1.0.0"]);

        // Alias should still resolve to the same target.
        const tsconfig = JSON.parse(
            readFileSync(join(project, "tsconfig.json"), "utf8")
        ) as { compilerOptions?: { paths?: Record<string, unknown> } };
        expect(tsconfig.compilerOptions?.paths?.["cullet/erp-core"]).toEqual([
            `./cullet/erp-core@1.0.0/index.ts`,
        ]);
    });

    it("cullet fc aborts cleanly when the user declines overwrite", async () => {
        const first = await runCli(["fc", "erp-core@1.0.0"], project);
        expect(first.status).toBe(0);

        const kitDir = join(project, "cullet", "erp-core@1.0.0");
        writeFileSync(join(kitDir, "__sentinel__"), "should NOT be removed");

        const second = await runCli(["fc", "erp-core@1.0.0"], project, {
            input: "n\n",
        });
        expect(second.status).toBe(0);
        expect(second.stdout).toMatch(/Operacao cancelada/);
        expect(existsSync(join(kitDir, "__sentinel__"))).toBe(true);
    });
});

function readDirEntries(dir: string): string[] {
    return readdirSync(dir).sort();
}
