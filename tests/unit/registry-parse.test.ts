import { describe, expect, it } from "vitest";
import {
    matchKitArg,
    parseDeprecation,
    parseKitMeta,
    parseRegistry,
} from "../../packages/cli/src/registry/parse.js";
import { DEFAULT_COPY_SOURCE_DIR } from "../../packages/cli/src/registry/types.js";

describe("parseRegistry", () => {
    it("rejects a root that is not an object", () => {
        expect(() => parseRegistry(null)).toThrow(/registry/);
        expect(() => parseRegistry("texto")).toThrow(/registry/);
    });

    it("keeps a custom npmName when the entry declares one", () => {
        const registry = parseRegistry({
            "agent-kit": {
                versions: ["1.0.0"],
                latest: "1.0.0",
                description: "Harness",
                npmName: "@cullet/agent-kit",
            },
        });

        expect(registry["agent-kit"]?.npmName).toBe("@cullet/agent-kit");
    });
});

describe("matchKitArg", () => {
    it("returns null for an empty or whitespace-only value", () => {
        expect(matchKitArg("")).toBeNull();
        expect(matchKitArg("   ")).toBeNull();
    });
});

describe("parseDeprecation", () => {
    it("drops a legacy successor string that is empty", () => {
        const deprecation = parseDeprecation({
            since: "2026-01-01",
            reason: "rewritten",
            successor: "   ",
        });

        expect(deprecation).toEqual({
            since: "2026-01-01",
            reason: "rewritten",
        });
    });

    it("normalizes a legacy successor in nome@versao form", () => {
        const deprecation = parseDeprecation({
            since: "2026-01-01",
            reason: "rewritten",
            successor: "erp-core@2.0.0",
        });

        expect(deprecation?.successor).toEqual({
            name: "erp-core",
            version: "2.0.0",
        });
    });

    it("drops a legacy successor without a version", () => {
        const deprecation = parseDeprecation({
            since: "2026-01-01",
            reason: "rewritten",
            successor: "erp-core",
        });

        expect(deprecation?.successor).toBeUndefined();
    });

    it("drops a successor object without string name and version", () => {
        const deprecation = parseDeprecation({
            since: "2026-01-01",
            reason: "rewritten",
            successor: { name: 42, version: "2.0.0" },
        });

        expect(deprecation?.successor).toBeUndefined();
    });

    it("drops a codemod whose path is not a string", () => {
        const deprecation = parseDeprecation({
            since: "2026-01-01",
            reason: "rewritten",
            successor: {
                name: "erp-core",
                version: "2.0.0",
                codemod: { description: "sem path" },
            },
        });

        expect(deprecation?.successor).toEqual({
            name: "erp-core",
            version: "2.0.0",
        });
    });

    it("returns null when the value is not an object", () => {
        expect(parseDeprecation("deprecated")).toBeNull();
    });
});

describe("parseKitMeta", () => {
    it("returns null when the input is not an object", () => {
        expect(parseKitMeta("nope")).toBeNull();
        expect(parseKitMeta(null)).toBeNull();
    });

    it("parses a complete meta with every optional field", () => {
        const meta = parseKitMeta({
            schemaVersion: "2",
            kind: "tooling",
            name: "agent-kit",
            version: "1.0.0",
            description: "Harness de agente",
            philosophy: { externalDeps: ["zod"], testDeps: ["vitest"] },
            compatibility: {
                engines: { node: ">=18", typescript: ">=5.0.0" },
                directImport: { peerDependencies: [] },
                fullControl: { dependencies: [] },
            },
            delivery: { copy: { placement: ".claude" } },
            exports: ["Entity", "ValueObject"],
        });

        expect(meta).toEqual({
            schemaVersion: "2",
            kind: "tooling",
            name: "agent-kit",
            version: "1.0.0",
            description: "Harness de agente",
            philosophy: { externalDeps: ["zod"], testDeps: ["vitest"] },
            compatibility: {
                engines: { node: ">=18", typescript: ">=5.0.0" },
                directImport: { peerDependencies: [] },
                fullControl: { dependencies: [] },
            },
            delivery: {
                copy: {
                    placement: ".claude",
                    source: DEFAULT_COPY_SOURCE_DIR,
                    dependencies: [],
                },
            },
            exports: ["Entity", "ValueObject"],
        });
    });

    it("ignores an unknown kind", () => {
        expect(parseKitMeta({ kind: "plugin" })?.kind).toBeUndefined();
    });

    it("keeps only string entries in exports and omits an empty list", () => {
        expect(
            parseKitMeta({ exports: ["Entity", 42, null, "ValueObject"] })
                ?.exports,
        ).toEqual(["Entity", "ValueObject"]);
        expect(parseKitMeta({ exports: [] })?.exports).toBeUndefined();
        expect(parseKitMeta({ exports: "Entity" })?.exports).toBeUndefined();
        expect(parseKitMeta({})?.exports).toBeUndefined();
    });
});

describe("parseKitMeta compatibility", () => {
    const validCompatibility = {
        engines: { node: ">=18", typescript: ">=5.0.0" },
        directImport: { peerDependencies: [] },
        fullControl: { dependencies: [] },
    };

    it("drops a compatibility whose engines.node is not a string", () => {
        const meta = parseKitMeta({
            compatibility: {
                ...validCompatibility,
                engines: { node: 18, typescript: ">=5.0.0" },
            },
        });

        expect(meta?.compatibility).toBeUndefined();
    });

    it("drops a compatibility with an invalid dependency entry", () => {
        const meta = parseKitMeta({
            compatibility: {
                ...validCompatibility,
                fullControl: { dependencies: [{ name: "zod" }] },
            },
        });

        expect(meta?.compatibility).toBeUndefined();
    });

    it("keeps optional flags and notes on dependencies", () => {
        const meta = parseKitMeta({
            compatibility: {
                ...validCompatibility,
                directImport: {
                    peerDependencies: [
                        {
                            name: "pino",
                            range: ">=9",
                            optional: true,
                            notes: "logging",
                        },
                    ],
                },
            },
        });

        expect(meta?.compatibility?.directImport.peerDependencies).toEqual([
            { name: "pino", range: ">=9", optional: true, notes: "logging" },
        ]);
    });
});

describe("parseKitMeta delivery", () => {
    it("drops a delivery that is not an object", () => {
        expect(parseKitMeta({ delivery: "copy" })?.delivery).toBeUndefined();
    });

    it("drops a delivery without import nor copy", () => {
        expect(parseKitMeta({ delivery: {} })?.delivery).toBeUndefined();
        expect(
            parseKitMeta({ delivery: { copy: "nope" } })?.delivery,
        ).toBeUndefined();
    });

    it("parses an import surface with peer dependencies", () => {
        const meta = parseKitMeta({
            delivery: {
                import: { peerDependencies: [{ name: "zod", range: ">=4" }] },
            },
        });

        expect(meta?.delivery).toEqual({
            import: { peerDependencies: [{ name: "zod", range: ">=4" }] },
        });
    });

    it("drops an import surface whose peerDependencies are invalid", () => {
        const meta = parseKitMeta({
            delivery: { import: { peerDependencies: "zod" } },
        });

        expect(meta?.delivery).toBeUndefined();
    });

    it("drops a copy delivery without a placement", () => {
        const meta = parseKitMeta({
            delivery: { copy: { source: "files" } },
        });

        expect(meta?.delivery).toBeUndefined();
    });

    it("applies defaults to a minimal copy delivery", () => {
        const meta = parseKitMeta({
            delivery: { copy: { placement: ".claude" } },
        });

        expect(meta?.delivery?.copy).toEqual({
            placement: ".claude",
            source: DEFAULT_COPY_SOURCE_DIR,
            dependencies: [],
        });
    });

    it("discards a dependency list with a non-object entry", () => {
        const meta = parseKitMeta({
            delivery: {
                copy: { placement: ".claude", dependencies: ["zod"] },
            },
        });

        expect(meta?.delivery?.copy?.dependencies).toEqual([]);
    });

    it("keeps source, dependencies and postInstall when declared", () => {
        const meta = parseKitMeta({
            delivery: {
                copy: {
                    placement: ".claude",
                    source: "payload",
                    dependencies: [{ name: "zod", range: ">=4" }],
                    postInstall: "setup.mjs",
                },
            },
        });

        expect(meta?.delivery?.copy).toEqual({
            placement: ".claude",
            source: "payload",
            dependencies: [{ name: "zod", range: ">=4" }],
            postInstall: "setup.mjs",
        });
    });

    it("ignores an empty postInstall", () => {
        const meta = parseKitMeta({
            delivery: { copy: { placement: ".claude", postInstall: "" } },
        });

        expect(meta?.delivery?.copy?.postInstall).toBeUndefined();
    });
});
