import { describe, expect, it } from "vitest";
import {
    getCopyDelivery,
    getCopyDependencies,
    getCopyPlacement,
    getDirectImportPeerDependencies,
    getFullControlDependencies,
    getImportPeerDependencies,
    getKitKind,
    isToolingKit,
    kitExposesImport,
    type KitMeta,
} from "../../packages/cli/src/registry/catalog.js";

describe("dependency fallbacks from philosophy.externalDeps", () => {
    it("derives rangeless dependencies when compatibility is absent", () => {
        const meta: KitMeta = { philosophy: { externalDeps: ["zod", "pino"] } };

        expect(getDirectImportPeerDependencies(meta)).toEqual([
            { name: "zod", range: "" },
            { name: "pino", range: "" },
        ]);
        expect(getFullControlDependencies(meta)).toEqual([
            { name: "zod", range: "" },
            { name: "pino", range: "" },
        ]);
    });

    it("returns an empty list when there is no meta at all", () => {
        expect(getDirectImportPeerDependencies(null)).toEqual([]);
        expect(getFullControlDependencies(undefined)).toEqual([]);
    });
});

describe("getKitKind", () => {
    it("defaults to foundation when kind is absent", () => {
        expect(getKitKind({})).toBe("foundation");
        expect(getKitKind(null)).toBe("foundation");
        expect(getKitKind(undefined)).toBe("foundation");
    });

    it("returns the declared kind", () => {
        expect(getKitKind({ kind: "tooling" })).toBe("tooling");
        expect(getKitKind({ kind: "capability" })).toBe("capability");
    });
});

describe("isToolingKit", () => {
    it("is true only for tooling kits", () => {
        expect(isToolingKit({ kind: "tooling" })).toBe(true);
        expect(isToolingKit({ kind: "foundation" })).toBe(false);
        expect(isToolingKit({})).toBe(false);
    });
});

describe("getCopyDelivery", () => {
    const meta: KitMeta = {
        kind: "tooling",
        delivery: {
            copy: {
                placement: ".claude/",
                source: "files",
                dependencies: [{ name: "zod", range: ">=3" }],
                postInstall: "init.mjs",
            },
        },
    };

    it("returns a clone of the copy delivery", () => {
        const copy = getCopyDelivery(meta);
        expect(copy).toEqual({
            placement: ".claude/",
            source: "files",
            dependencies: [{ name: "zod", range: ">=3" }],
            postInstall: "init.mjs",
        });
        // mutating the result must not leak into the source meta
        copy?.dependencies.push({ name: "leak", range: "*" });
        expect(meta.delivery?.copy?.dependencies).toHaveLength(1);
    });

    it("returns undefined when there is no copy delivery", () => {
        expect(getCopyDelivery({ kind: "foundation" })).toBeUndefined();
        expect(getCopyDelivery({})).toBeUndefined();
    });
});

describe("getCopyPlacement / getCopyDependencies", () => {
    it("reads placement and dependencies from the copy delivery", () => {
        const meta: KitMeta = {
            kind: "tooling",
            delivery: {
                copy: {
                    placement: "config/agents/",
                    source: "files",
                    dependencies: [{ name: "pino", range: "^9" }],
                },
            },
        };
        expect(getCopyPlacement(meta)).toBe("config/agents/");
        expect(getCopyDependencies(meta)).toEqual([
            { name: "pino", range: "^9" },
        ]);
    });

    it("returns sensible empties for non-tooling kits", () => {
        expect(getCopyPlacement({})).toBeUndefined();
        expect(getCopyDependencies({})).toEqual([]);
    });
});

describe("kitExposesImport / getImportPeerDependencies", () => {
    it("is true when the kit declares an import delivery surface", () => {
        const meta: KitMeta = {
            kind: "tooling",
            delivery: {
                copy: {
                    placement: ".claude/",
                    source: "files",
                    dependencies: [],
                },
                import: { peerDependencies: [{ name: "zod", range: ">=3" }] },
            },
        };
        expect(kitExposesImport(meta)).toBe(true);
        expect(getImportPeerDependencies(meta)).toEqual([
            { name: "zod", range: ">=3" },
        ]);
    });

    it("treats an empty peerDependencies array as importable", () => {
        const meta: KitMeta = {
            kind: "tooling",
            delivery: {
                copy: {
                    placement: ".claude/",
                    source: "files",
                    dependencies: [],
                },
                import: { peerDependencies: [] },
            },
        };
        expect(kitExposesImport(meta)).toBe(true);
        expect(getImportPeerDependencies(meta)).toEqual([]);
    });

    it("is false for copy-only tooling and library kits", () => {
        const copyOnly: KitMeta = {
            kind: "tooling",
            delivery: {
                copy: {
                    placement: ".claude/",
                    source: "files",
                    dependencies: [],
                },
            },
        };
        expect(kitExposesImport(copyOnly)).toBe(false);
        expect(kitExposesImport({})).toBe(false);
        expect(getImportPeerDependencies(copyOnly)).toEqual([]);
    });

    it("returns a clone that does not leak into the source meta", () => {
        const meta: KitMeta = {
            kind: "tooling",
            delivery: {
                copy: {
                    placement: ".claude/",
                    source: "files",
                    dependencies: [],
                },
                import: { peerDependencies: [{ name: "zod", range: ">=3" }] },
            },
        };
        const deps = getImportPeerDependencies(meta);
        deps.push({ name: "leak", range: "*" });
        expect(meta.delivery?.import?.peerDependencies).toHaveLength(1);
    });
});
