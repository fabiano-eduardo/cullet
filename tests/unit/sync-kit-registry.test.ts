import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    collectKitNames,
    snapshotRootFor,
    syncKitRegistry,
} from "../../scripts/sync-kit-registry.mjs";

let packagesRoot: string;

beforeEach(async () => {
    packagesRoot = await mkdtemp(join(tmpdir(), "cullet-sync-registry-"));
});

afterEach(async () => {
    await rm(packagesRoot, { recursive: true, force: true });
});

async function writeKit(options: {
    name: string;
    context?: string;
}): Promise<void> {
    const kitRoot = join(packagesRoot, options.name);
    await mkdir(kitRoot, { recursive: true });
    await writeFile(
        join(kitRoot, "meta.json"),
        `${JSON.stringify(
            { schemaVersion: "3", name: options.name, version: "1.0.0" },
            null,
            4,
        )}\n`,
        "utf8",
    );
    if (options.context !== undefined) {
        await writeFile(
            join(kitRoot, "KIT_CONTEXT.md"),
            options.context,
            "utf8",
        );
    }
}

function snapshotFile(name: string, file: string): string {
    return join(snapshotRootFor(packagesRoot), name, file);
}

describe("collectKitNames", () => {
    it("lists kit dirs with a meta.json, skipping cli and meta-less dirs", async () => {
        await writeKit({ name: "erp-core" });
        await writeKit({ name: "dummy-api" });
        await mkdir(join(packagesRoot, "cli"), { recursive: true });
        // A dir without meta.json is not a kit.
        await mkdir(join(packagesRoot, "not-a-kit"), { recursive: true });

        expect(await collectKitNames(packagesRoot)).toEqual([
            "dummy-api",
            "erp-core",
        ]);
    });
});

describe("syncKitRegistry", () => {
    it("copies meta.json and KIT_CONTEXT.md into the snapshot", async () => {
        await writeKit({ name: "erp-core", context: "# Context\n" });

        const result = await syncKitRegistry(packagesRoot);

        expect(result.errors).toEqual([]);
        expect(result.drift.length).toBeGreaterThan(0);
        expect(
            await readFile(snapshotFile("erp-core", "meta.json"), "utf8"),
        ).toContain('"name": "erp-core"');
        expect(
            await readFile(snapshotFile("erp-core", "KIT_CONTEXT.md"), "utf8"),
        ).toBe("# Context\n");
    });

    it("is idempotent: a second run reports no drift", async () => {
        await writeKit({ name: "erp-core", context: "# Context\n" });
        await syncKitRegistry(packagesRoot);

        const second = await syncKitRegistry(packagesRoot);
        expect(second.drift).toEqual([]);
        expect(second.updated).toEqual([]);
    });

    it("omits KIT_CONTEXT.md from the snapshot when the kit has none", async () => {
        await writeKit({ name: "erp-core" });
        await syncKitRegistry(packagesRoot);

        expect(existsSync(snapshotFile("erp-core", "meta.json"))).toBe(true);
        expect(existsSync(snapshotFile("erp-core", "KIT_CONTEXT.md"))).toBe(
            false,
        );
    });

    it("prunes a snapshot dir for a kit that no longer exists", async () => {
        await writeKit({ name: "erp-core" });
        // Pre-seed a stale snapshot for a removed kit.
        const stale = join(snapshotRootFor(packagesRoot), "ghost-kit");
        await mkdir(stale, { recursive: true });
        await writeFile(join(stale, "meta.json"), "{}\n", "utf8");

        const result = await syncKitRegistry(packagesRoot);

        expect(existsSync(stale)).toBe(false);
        expect(result.removed.some((p) => p.includes("ghost-kit"))).toBe(true);
    });

    it("prunes an orphan file the source no longer ships", async () => {
        await writeKit({ name: "erp-core" });
        await syncKitRegistry(packagesRoot);
        // Author deletes KIT_CONTEXT.md from source, but a stale copy lingers.
        await writeFile(
            snapshotFile("erp-core", "KIT_CONTEXT.md"),
            "stale\n",
            "utf8",
        );

        const result = await syncKitRegistry(packagesRoot);

        expect(existsSync(snapshotFile("erp-core", "KIT_CONTEXT.md"))).toBe(
            false,
        );
        expect(existsSync(snapshotFile("erp-core", "meta.json"))).toBe(true);
        expect(result.removed.length).toBeGreaterThan(0);
    });

    it("--check reports drift without writing anything", async () => {
        await writeKit({ name: "erp-core" });

        const result = await syncKitRegistry(packagesRoot, { check: true });

        expect(result.drift.length).toBeGreaterThan(0);
        expect(result.updated).toEqual([]);
        expect(existsSync(snapshotFile("erp-core", "meta.json"))).toBe(false);
    });
});
