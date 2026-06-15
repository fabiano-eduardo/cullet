import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    DIST_DIR,
    kitFullControlAliasTarget,
    kitFullControlDir,
    kitFullControlSubpathAlias,
    kitFullControlSubpathAliasTarget,
    kitNodeModulesEntry,
    kitToolingDestinationDir,
    resolveKitPackageRoot,
} from "../../packages/cli/src/cli/utils/paths.js";

describe("paths", () => {
    it("exposes the canonical directory names", () => {
        expect(DIST_DIR).toBe("dist");
    });

    it("renders the published node_modules entry for the scoped package", () => {
        expect(kitNodeModulesEntry("@cullet/erp-core")).toBe(
            "./node_modules/@cullet/erp-core/dist/index.js",
        );
    });

    it("builds the full-control destination directory inside the project cwd", () => {
        expect(kitFullControlDir("/proj", "erp-core", "1.0.0")).toMatch(
            /proj[\\/]+cullet[\\/]+erp-core@1\.0\.0$/,
        );
    });

    it("renders the full-control alias target with the @version suffix", () => {
        expect(kitFullControlAliasTarget("erp-core", "1.0.0")).toBe(
            "./cullet/erp-core@1.0.0/index.ts",
        );
    });

    it("derives the subpath wildcard alias from the npm name", () => {
        expect(kitFullControlSubpathAlias("@cullet/erp-core")).toBe(
            "@cullet/erp-core/*",
        );
    });

    it("renders subpath wildcard targets covering file, barrel, and bundler forms", () => {
        // A ordem importa: nodenext exige um caminho concreto (arquivo ou
        // barril) antes do fallback bundler (`*`).
        expect(kitFullControlSubpathAliasTarget("erp-core", "1.0.0")).toEqual([
            "./cullet/erp-core@1.0.0/*.ts",
            "./cullet/erp-core@1.0.0/*/index.ts",
            "./cullet/erp-core@1.0.0/*",
        ]);
    });

    it("resolves a tooling placement relative to the project cwd", () => {
        expect(kitToolingDestinationDir("/proj", ".claude/")).toMatch(
            /proj[\\/]+\.claude$/,
        );
        expect(kitToolingDestinationDir("/proj", "config/agents")).toMatch(
            /proj[\\/]+config[\\/]+agents$/,
        );
    });

    it("allows a placement equal to the project root", () => {
        expect(kitToolingDestinationDir("/proj", ".")).toMatch(/proj$/);
    });

    it("rejects a placement that escapes the project root", () => {
        expect(() => kitToolingDestinationDir("/proj", "../outside")).toThrow(
            /aponta para fora do projeto/,
        );
        expect(() => kitToolingDestinationDir("/proj", "/etc")).toThrow(
            /aponta para fora do projeto/,
        );
    });
});

describe("resolveKitPackageRoot", () => {
    let consumer: string;

    beforeEach(async () => {
        consumer = await mkdtemp(join(tmpdir(), "cullet-consumer-"));
    });

    afterEach(async () => {
        await rm(consumer, { recursive: true, force: true });
    });

    it("resolves the installed kit package root from the consumer node_modules", async () => {
        const packageRoot = join(
            consumer,
            "node_modules",
            "@cullet",
            "erp-core",
        );
        await mkdir(packageRoot, { recursive: true });
        await writeFile(
            join(packageRoot, "package.json"),
            JSON.stringify({ name: "@cullet/erp-core", version: "1.0.0" }),
        );

        const resolved = resolveKitPackageRoot(consumer, "@cullet/erp-core");

        expect(resolved).toMatch(/node_modules[\\/]+@cullet[\\/]+erp-core$/);
        expect(existsSync(join(resolved, "package.json"))).toBe(true);
    });

    it("throws a descriptive error when the kit is not installed", () => {
        expect(() =>
            resolveKitPackageRoot(consumer, "@cullet/erp-core"),
        ).toThrow(/Nao foi possivel resolver o pacote "@cullet\/erp-core"/);
    });
});
