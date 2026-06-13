import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { kitMetaDir } from "../../packages/cli/src/registry/paths.js";
import {
    loadKitContext,
    loadKitDeprecation,
    loadKitMeta,
} from "../../packages/cli/src/registry/loaders.js";

// Regression guard for the published-CLI metadata gap: when the CLI runs from
// node_modules the tarball does NOT ship `packages/`, so meta.json/KIT_CONTEXT.md
// must be read from the bundled snapshot at `<packageRoot>/registry/kits/<name>/`.

let root: string;

beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "cullet-snapshot-"));
});

afterEach(async () => {
    await rm(root, { recursive: true, force: true });
});

describe("kitMetaDir", () => {
    it("prefers the live monorepo source when packages/<name> exists", async () => {
        await mkdir(join(root, "packages", "erp-core"), { recursive: true });

        expect(kitMetaDir(root, "erp-core")).toBe(
            join(root, "packages", "erp-core"),
        );
    });

    it("falls back to the bundled snapshot when the source is absent", () => {
        // No packages/erp-core here — the published-package layout.
        expect(kitMetaDir(root, "erp-core")).toBe(
            join(root, "registry", "kits", "erp-core"),
        );
    });
});

describe("loaders in a published-package layout (snapshot only)", () => {
    // Build a temp dir that looks like an installed `cullet` package: a cullet
    // package.json + registry/index.json marker, a bundled kit snapshot, and a
    // nested dist file to anchor findCulletPackageRoot — but NO packages/.
    async function writePublishedCullet(
        name: string,
        meta: Record<string, unknown>,
        context?: string,
    ): Promise<string> {
        await writeFile(
            join(root, "package.json"),
            JSON.stringify({ name: "cullet", version: "0.0.0" }, null, 2),
        );
        await mkdir(join(root, "registry", "kits", name), { recursive: true });
        await writeFile(join(root, "registry", "index.json"), "{}\n");
        await writeFile(
            join(root, "registry", "kits", name, "meta.json"),
            `${JSON.stringify(meta, null, 4)}\n`,
        );
        if (context !== undefined) {
            await writeFile(
                join(root, "registry", "kits", name, "KIT_CONTEXT.md"),
                context,
            );
        }

        const nested = join(root, "dist", "registry", "loaders.js");
        await mkdir(join(root, "dist", "registry"), { recursive: true });
        await writeFile(nested, "");
        return pathToFileURL(nested).href;
    }

    it("loads meta, context and deprecation from the snapshot", async () => {
        const metaUrl = await writePublishedCullet(
            "erp-core",
            {
                schemaVersion: "3",
                name: "erp-core",
                version: "1.0.0",
                description: "core de teste",
                compatibility: {
                    engines: { node: ">=18", typescript: ">=5.0.0" },
                    directImport: {
                        peerDependencies: [{ name: "zod", range: ">=3" }],
                    },
                    fullControl: { dependencies: [] },
                },
                deprecated: { since: "2026-01-01", reason: "apenas teste" },
            },
            "# erp-core\n\n## [purpose] Propósito\nNúcleo.\n",
        );

        const meta = await loadKitMeta(metaUrl, "erp-core");
        expect(meta?.name).toBe("erp-core");
        expect(meta?.compatibility?.engines.node).toBe(">=18");
        expect(
            meta?.compatibility?.directImport.peerDependencies[0]?.name,
        ).toBe("zod");

        const context = await loadKitContext(metaUrl, "erp-core");
        expect(context).toContain("Propósito");

        const deprecation = await loadKitDeprecation(metaUrl, "erp-core");
        expect(deprecation).toEqual({
            since: "2026-01-01",
            reason: "apenas teste",
        });
    });
});
