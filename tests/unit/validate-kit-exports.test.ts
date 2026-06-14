import fs from "fs-extra";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { collectFileExports } from "../../scripts/kit-ast.mjs";
import { parseTsSource } from "../../scripts/source-analysis.mjs";
import { checkDeclaredExports } from "../../scripts/kit-validators.mjs";
import { buildKitEntry } from "../../scripts/validate-kit.mjs";

describe("collectFileExports", () => {
    function exportsOf(src: string) {
        return collectFileExports(parseTsSource("entry.ts", src));
    }

    it("collects direct declarations, including types and enums", () => {
        const { names, starReexports } = exportsOf(`
            export class Entity {}
            export function build() {}
            export interface Props {}
            export type Id = string;
            export enum Status { On, Off }
            export const VALUE = 1;
            const internal = 2;
        `);

        expect(new Set(names)).toEqual(
            new Set(["Entity", "build", "Props", "Id", "Status", "VALUE"]),
        );
        expect(starReexports).toEqual([]);
    });

    it("collects named re-exports and their aliases", () => {
        const { names } = exportsOf(`
            export { Foo, Bar as Baz } from "./other.js";
            export { type OnlyType } from "./types.js";
            const Local = 1;
            export { Local };
        `);

        expect(new Set(names)).toEqual(
            new Set(["Foo", "Baz", "OnlyType", "Local"]),
        );
    });

    it("records `export *` specifiers and namespace re-exports", () => {
        const { names, starReexports } = exportsOf(`
            export * from "./barrel.js";
            export type * from "./type-barrel.js";
            export * as ns from "./ns.js";
        `);

        expect(names).toEqual(["ns"]);
        expect(new Set(starReexports)).toEqual(
            new Set(["./barrel.js", "./type-barrel.js"]),
        );
    });
});

describe("checkDeclaredExports", () => {
    let root: string;

    beforeEach(async () => {
        root = await mkdtemp(join(tmpdir(), "cullet-declared-exports-"));
    });

    afterEach(async () => {
        await rm(root, { recursive: true, force: true });
    });

    // Writes a minimal library kit and returns its built entry plus a meta
    // object carrying the given `exports` list. The entry barrel re-exports a
    // class via `export *` and a const by name, exercising the transitive
    // resolver. `extraEntryLines` lets a test add edges (e.g. an external star).
    async function writeLibraryKit(
        declaredExports: string[],
        extraEntryLines = "",
    ) {
        const packageDir = join(root, "lib-kit");
        await fs.ensureDir(join(packageDir, "src"));

        const meta: Record<string, unknown> = {
            schemaVersion: "2",
            name: "lib-kit",
            version: "1.0.0",
            description: "Kit de biblioteca para validar exports",
            entryPoint: "index.ts",
            docs: { context: "KIT_CONTEXT.md", readme: "README.md" },
            exports: declaredExports,
        };

        await writeFile(
            join(packageDir, "meta.json"),
            JSON.stringify(meta),
            "utf8",
        );
        await writeFile(
            join(packageDir, "package.json"),
            JSON.stringify({ name: "@cullet/lib-kit", version: "1.0.0" }),
            "utf8",
        );
        await writeFile(
            join(packageDir, "src", "index.ts"),
            [
                `export * from "./shapes.js";`,
                `export { Foo } from "./foo.js";`,
                extraEntryLines,
            ].join("\n"),
            "utf8",
        );
        await writeFile(
            join(packageDir, "src", "shapes.ts"),
            `export class Shape {}\nexport type ShapeId = string;\n`,
            "utf8",
        );
        await writeFile(
            join(packageDir, "src", "foo.ts"),
            `export const Foo = 1;\n`,
            "utf8",
        );

        const kit = await buildKitEntry(packageDir);
        if (kit === null) throw new Error("expected a kit entry");
        return { kit, meta };
    }

    function severities(
        findings: Array<{ severity: string; msg: string }>,
        severity: string,
    ): string[] {
        return findings
            .filter((finding) => finding.severity === severity)
            .map((finding) => finding.msg);
    }

    it("passes when every declared export resolves through the surface", async () => {
        const { kit, meta } = await writeLibraryKit([
            "Shape",
            "ShapeId",
            "Foo",
        ]);
        const findings: Array<{ severity: string; msg: string }> = [];

        await checkDeclaredExports(kit, meta, findings);

        expect(findings).toEqual([]);
    });

    it("errors on a declared export the entrypoint does not expose", async () => {
        const { kit, meta } = await writeLibraryKit(["Shape", "Missing"]);
        const findings: Array<{ severity: string; msg: string }> = [];

        await checkDeclaredExports(kit, meta, findings);

        const errors = severities(findings, "error");
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatch(/declares export "Missing"/);
        expect(errors[0]).toMatch(/does not export it/);
    });

    it("warns instead of erroring when an `export *` target is unresolvable", async () => {
        // An external `export *` means the real surface is a superset we cannot
        // read, so absence of "Unknown" cannot be proven — warn, never error.
        const { kit, meta } = await writeLibraryKit(
            ["Unknown"],
            `export * from "zod";`,
        );
        const findings: Array<{ severity: string; msg: string }> = [];

        await checkDeclaredExports(kit, meta, findings);

        expect(severities(findings, "error")).toEqual([]);
        const warnings = severities(findings, "warn");
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatch(/could not be confirmed/);
    });

    it("is a no-op when no exports are declared", async () => {
        const { kit, meta } = await writeLibraryKit([]);
        const findings: Array<{ severity: string; msg: string }> = [];

        await checkDeclaredExports(kit, meta, findings);

        expect(findings).toEqual([]);
    });
});
