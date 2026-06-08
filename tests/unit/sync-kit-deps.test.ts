import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    buildPeerDependenciesMap,
    main,
    syncKitPeerDependencies,
} from "../../scripts/sync-kit-deps.mjs";

let workspace: string;
let packagesRoot: string;
let importCounter = 0;

const originalArgv = [...process.argv];
const scriptPath = fileURLToPath(
    new URL("../../scripts/sync-kit-deps.mjs", import.meta.url),
);

class ExitSignal extends Error {
    constructor(readonly code: number | undefined) {
        super(`process.exit(${code})`);
    }
}

async function importSyncKitDepsEntrypoint() {
    const scriptUrl = new URL(
        "../../scripts/sync-kit-deps.mjs",
        import.meta.url,
    );
    scriptUrl.searchParams.set("t", String((importCounter += 1)));
    await import(/* @vite-ignore */ scriptUrl.href);
}

async function writeJson(path: string, value: unknown) {
    await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

async function createKit(options: {
    name: string;
    metaPeerDependencies?: Array<{ name: string; range: string }>;
    packagePeerDependencies?: Record<string, string>;
}) {
    const kitRoot = join(packagesRoot, options.name);
    await mkdir(kitRoot, { recursive: true });

    await writeJson(join(kitRoot, "meta.json"), {
        version: "1.0.0",
        compatibility: {
            directImport: {
                peerDependencies: options.metaPeerDependencies ?? [],
            },
        },
    });

    const packageJson: Record<string, unknown> = {
        name: `@cullet/${options.name}`,
        version: "1.0.0",
    };

    if (options.packagePeerDependencies) {
        packageJson.peerDependencies = options.packagePeerDependencies;
    }

    await writeJson(join(kitRoot, "package.json"), packageJson);
}

beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), "cullet-sync-kit-deps-"));
    packagesRoot = join(workspace, "packages");
    await mkdir(packagesRoot, { recursive: true });
    await mkdir(join(packagesRoot, "cli"), { recursive: true });
});

afterEach(async () => {
    process.argv = [...originalArgv];
    await rm(workspace, { recursive: true, force: true });
});

describe("buildPeerDependenciesMap", () => {
    it("normalizes peerDependencies declared in meta.json", () => {
        expect(
            buildPeerDependenciesMap({
                compatibility: {
                    directImport: {
                        peerDependencies: [
                            { name: "zod", range: ">=3.22.0 <5" },
                            { name: "@scope/logger", range: "^1.0.0" },
                        ],
                    },
                },
            }),
        ).toEqual({
            "@scope/logger": "^1.0.0",
            zod: ">=3.22.0 <5",
        });
    });
});

describe("syncKitPeerDependencies", () => {
    it("reports drift in check mode without rewriting manifests", async () => {
        await createKit({
            name: "erp-core",
            metaPeerDependencies: [{ name: "zod", range: ">=3.22.0 <5" }],
            packagePeerDependencies: { zod: "^4.0.0" },
        });

        const result = await syncKitPeerDependencies(packagesRoot, {
            check: true,
        });
        const manifest = JSON.parse(
            await readFile(
                join(packagesRoot, "erp-core", "package.json"),
                "utf8",
            ),
        ) as {
            peerDependencies?: Record<string, string>;
        };

        expect(result.updated).toEqual([]);
        expect(result.drift).toHaveLength(1);
        expect(result.drift[0]?.expectedPeerDependencies).toEqual({
            zod: ">=3.22.0 <5",
        });
        expect(manifest.peerDependencies).toEqual({ zod: "^4.0.0" });
    });

    it("rewrites manifests from meta.json and removes empty peerDependencies", async () => {
        await createKit({
            name: "erp-core",
            metaPeerDependencies: [{ name: "zod", range: ">=3.22.0 <5" }],
        });
        await createKit({
            name: "dummy-api",
            metaPeerDependencies: [],
            packagePeerDependencies: { zod: "^3.0.0" },
        });

        const result = await syncKitPeerDependencies(packagesRoot);
        const erpCoreManifest = JSON.parse(
            await readFile(
                join(packagesRoot, "erp-core", "package.json"),
                "utf8",
            ),
        ) as {
            peerDependencies?: Record<string, string>;
        };
        const dummyApiManifest = JSON.parse(
            await readFile(
                join(packagesRoot, "dummy-api", "package.json"),
                "utf8",
            ),
        ) as {
            peerDependencies?: Record<string, string>;
        };

        expect(result.updated).toEqual([
            "dummy-api/package.json",
            "erp-core/package.json",
        ]);
        expect(erpCoreManifest.peerDependencies).toEqual({
            zod: ">=3.22.0 <5",
        });
        expect(dummyApiManifest.peerDependencies).toBeUndefined();
    });
});

describe("main", () => {
    it("returns a non-zero exit code when unknown flags are provided", async () => {
        await expect(main(["--write"], packagesRoot)).resolves.toBe(1);
    });

    it("exits with zero when the script runs as an entrypoint in check mode", async () => {
        const exitSpy = vi
            .spyOn(process, "exit")
            .mockImplementation((code?: string | number | null) => {
                throw new ExitSignal(
                    typeof code === "number" ? code : undefined,
                );
            });
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        process.argv = ["node", scriptPath, "--check"];

        try {
            await importSyncKitDepsEntrypoint();
            throw new Error("sync-kit-deps entrypoint did not exit");
        } catch (error) {
            expect(error).toBeInstanceOf(ExitSignal);
            expect((error as ExitSignal).code).toBe(0);
        } finally {
            exitSpy.mockRestore();
            logSpy.mockRestore();
            errorSpy.mockRestore();
        }
    });
});
