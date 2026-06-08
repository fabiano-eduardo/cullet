import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    loadKitContext,
    loadKitDeprecation,
    loadKitMeta,
    loadRegistry,
    resolveKitSourceDir,
} from "../../packages/cli/src/cli/utils/resolve.js";

let root: string;
let metaUrl: string;

async function writeJson(path: string, data: unknown): Promise<void> {
    await mkdir(join(path, ".."), { recursive: true });
    await writeFile(path, JSON.stringify(data, null, 2));
}

async function setupFakeCullet(
    opts: {
        registry?: unknown;
        meta?: Record<string, unknown> | null;
        context?: string | null;
    } = {},
): Promise<void> {
    await writeJson(join(root, "package.json"), {
        name: "cullet",
        version: "0.0.0",
    });

    const registry = opts.registry ?? {
        "erp-core": {
            versions: ["1.0.0"],
            latest: "1.0.0",
            description: "ERP core",
        },
    };
    await writeJson(join(root, "registry", "index.json"), registry);

    const kitDir = join(root, "packages", "erp-core");
    if (opts.meta !== null) {
        await writeJson(
            join(kitDir, "meta.json"),
            opts.meta ?? {
                schemaVersion: "2",
                name: "erp-core",
                version: "1.0.0",
                description: "ERP core",
                philosophy: { externalDeps: ["zod"], testDeps: [] },
                compatibility: {
                    engines: {
                        node: ">=18",
                        typescript: ">=5.0.0",
                    },
                    directImport: {
                        peerDependencies: [
                            {
                                name: "zod",
                                range: ">=3.22.0 <5",
                            },
                        ],
                    },
                    fullControl: {
                        dependencies: [
                            {
                                name: "zod",
                                range: ">=3.22.0 <5",
                            },
                        ],
                    },
                },
            },
        );
    }

    if (opts.context !== null) {
        await mkdir(kitDir, { recursive: true });
        await writeFile(
            join(kitDir, "KIT_CONTEXT.md"),
            opts.context ?? "# Context\nHello",
        );
    }

    metaUrl = pathToFileURL(join(root, "cli", "index.js")).href;
    await mkdir(join(root, "cli"), { recursive: true });
    await writeFile(join(root, "cli", "index.js"), "");
}

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "cullet-resolve-fs-"));
});

afterEach(async () => {
    vi.restoreAllMocks();
    await rm(root, { recursive: true, force: true });
});

describe("loadRegistry", () => {
    it("parses a valid registry into the expected shape", async () => {
        await setupFakeCullet();
        const registry = await loadRegistry(metaUrl);
        expect(registry["erp-core"]).toEqual({
            versions: ["1.0.0"],
            latest: "1.0.0",
            description: "ERP core",
            npmName: "cullet/erp-core",
        });
    });

    it("rejects a registry whose root is not an object", async () => {
        await setupFakeCullet({ registry: ["not", "an", "object"] });
        await expect(loadRegistry(metaUrl)).rejects.toThrow(/registry/);
    });

    it("rejects a kit entry that is not an object", async () => {
        await setupFakeCullet({ registry: { broken: "string-entry" } });
        await expect(loadRegistry(metaUrl)).rejects.toThrow(/broken/);
    });

    it("rejects a kit entry whose versions field is not a string array", async () => {
        await setupFakeCullet({
            registry: {
                broken: { versions: [1, 2], latest: "1", description: "x" },
            },
        });
        await expect(loadRegistry(metaUrl)).rejects.toThrow(/versoes/);
    });

    it("rejects a kit entry whose latest is missing", async () => {
        await setupFakeCullet({
            registry: { broken: { versions: ["1.0.0"], description: "x" } },
        });
        await expect(loadRegistry(metaUrl)).rejects.toThrow(/latest/);
    });

    it("rejects a kit entry whose description is missing", async () => {
        await setupFakeCullet({
            registry: { broken: { versions: ["1.0.0"], latest: "1.0.0" } },
        });
        await expect(loadRegistry(metaUrl)).rejects.toThrow(/description/);
    });
});

describe("resolveKitSourceDir", () => {
    let consumer = "";
    let installedKitRoot: string;

    afterEach(async () => {
        if (consumer) {
            await rm(consumer, { recursive: true, force: true });
            consumer = "";
        }
    });

    async function installKit(
        opts: { src?: boolean; dist?: boolean } = {},
    ): Promise<void> {
        consumer = await mkdtemp(join(tmpdir(), "cullet-consumer-"));
        installedKitRoot = join(
            consumer,
            "node_modules",
            "@cullet",
            "erp-core",
        );
        await mkdir(installedKitRoot, { recursive: true });
        await writeFile(
            join(installedKitRoot, "package.json"),
            JSON.stringify({ name: "@cullet/erp-core", version: "1.0.0" }),
        );

        if (opts.src ?? true) {
            await mkdir(join(installedKitRoot, "src"), { recursive: true });
            await writeFile(
                join(installedKitRoot, "src", "index.ts"),
                "export {};",
            );
        }
        if (opts.dist ?? false) {
            await mkdir(join(installedKitRoot, "dist"), { recursive: true });
            await writeFile(join(installedKitRoot, "dist", "index.js"), "");
        }
    }

    it("returns the src directory of the kit installed in the consumer", async () => {
        await installKit({ src: true });
        const dir = await resolveKitSourceDir(consumer, "@cullet/erp-core");
        expect(dir).toBe(join(installedKitRoot, "src"));
    });

    it("falls back to dist when the package was published without src", async () => {
        await installKit({ src: false, dist: true });
        const dir = await resolveKitSourceDir(consumer, "@cullet/erp-core");
        expect(dir).toBe(join(installedKitRoot, "dist"));
    });

    it("throws when neither src nor dist are present in the installed package", async () => {
        await installKit({ src: false, dist: false });
        await expect(
            resolveKitSourceDir(consumer, "@cullet/erp-core"),
        ).rejects.toThrow(/nao foi encontrado/);
    });

    it("throws when the kit is not installed in the consumer", async () => {
        const empty = await mkdtemp(join(tmpdir(), "cullet-consumer-"));
        await expect(
            resolveKitSourceDir(empty, "@cullet/erp-core"),
        ).rejects.toThrow(/Nao foi possivel resolver o pacote/);
        await rm(empty, { recursive: true, force: true });
    });
});

describe("loadKitMeta", () => {
    it("returns the parsed meta with philosophy", async () => {
        await setupFakeCullet();
        const meta = await loadKitMeta(metaUrl, "erp-core");
        expect(meta?.name).toBe("erp-core");
        expect(meta?.philosophy?.externalDeps).toEqual(["zod"]);
        expect(meta?.compatibility).toEqual({
            engines: {
                node: ">=18",
                typescript: ">=5.0.0",
            },
            directImport: {
                peerDependencies: [
                    {
                        name: "zod",
                        range: ">=3.22.0 <5",
                    },
                ],
            },
            fullControl: {
                dependencies: [
                    {
                        name: "zod",
                        range: ">=3.22.0 <5",
                    },
                ],
            },
        });
    });

    it("returns null when meta.json does not exist", async () => {
        await setupFakeCullet({ meta: null });
        const meta = await loadKitMeta(metaUrl, "erp-core");
        expect(meta).toBeNull();
    });

    it("ignores fields with unexpected types", async () => {
        await setupFakeCullet({
            meta: {
                name: 42,
                description: ["wrong"],
                philosophy: { externalDeps: [1, 2] },
                compatibility: {
                    engines: {
                        node: 18,
                    },
                    directImport: {
                        peerDependencies: [1, 2],
                    },
                },
            },
        });
        const meta = await loadKitMeta(metaUrl, "erp-core");
        expect(meta).not.toBeNull();
        expect(meta?.name).toBeUndefined();
        expect(meta?.description).toBeUndefined();
        expect(meta?.philosophy?.externalDeps).toEqual([]);
        expect(meta?.compatibility).toBeUndefined();
    });
});

describe("loadKitContext", () => {
    it("returns the raw KIT_CONTEXT.md content", async () => {
        await setupFakeCullet({ context: "# Context\nHello" });
        expect(await loadKitContext(metaUrl, "erp-core")).toBe(
            "# Context\nHello",
        );
    });

    it("returns null when the context file is missing", async () => {
        await setupFakeCullet({ context: null });
        expect(await loadKitContext(metaUrl, "erp-core")).toBeNull();
    });
});

describe("loadKitDeprecation", () => {
    it("returns the deprecation block when present", async () => {
        await setupFakeCullet({
            meta: {
                deprecated: {
                    since: "2026-01-01",
                    reason: "rewritten",
                    successor: {
                        name: "erp-core",
                        version: "2.0.0",
                        guide: "MIGRATION.md",
                        notes: "Renomeie RuleSet para PolicySet antes de atualizar.",
                        codemod: {
                            path: "codemods/1.0.0-to-2.0.0.mjs",
                            description:
                                "Renomeia simbolos legados da API de policies",
                        },
                    },
                },
            },
        });
        const deprecation = await loadKitDeprecation(metaUrl, "erp-core");
        expect(deprecation).toEqual({
            since: "2026-01-01",
            reason: "rewritten",
            successor: {
                name: "erp-core",
                version: "2.0.0",
                guide: "MIGRATION.md",
                notes: "Renomeie RuleSet para PolicySet antes de atualizar.",
                codemod: {
                    path: "codemods/1.0.0-to-2.0.0.mjs",
                    description: "Renomeia simbolos legados da API de policies",
                },
            },
        });
    });

    it("normalizes legacy successor strings", async () => {
        await setupFakeCullet({
            meta: {
                deprecated: {
                    since: "2026-01-01",
                    reason: "rewritten",
                    successor: "erp-core/2.0.0",
                },
            },
        });

        await expect(loadKitDeprecation(metaUrl, "erp-core")).resolves.toEqual({
            since: "2026-01-01",
            reason: "rewritten",
            successor: {
                name: "erp-core",
                version: "2.0.0",
            },
        });
    });

    it("returns null when the meta has no deprecated block", async () => {
        await setupFakeCullet();
        expect(await loadKitDeprecation(metaUrl, "erp-core")).toBeNull();
    });

    it("ignores a malformed deprecated block", async () => {
        await setupFakeCullet({
            meta: { deprecated: { since: 1, reason: 2 } },
        });
        expect(await loadKitDeprecation(metaUrl, "erp-core")).toBeNull();
    });
});
