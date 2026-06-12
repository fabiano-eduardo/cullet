// Pure, dependency-light helpers for the kit lint pass: lint-level resolution,
// import classification, path/layer math, severity mapping, the bare-`any`
// scanner and the shared rule constants. Nothing here reads findings or kit
// state beyond its arguments.

import fs from "fs-extra";
import { dirname, relative, resolve } from "node:path";

// cullet enforces architecture-neutral *principles* by default — testability,
// decoupled observability, honest imports, file/folder hygiene. These apply to
// every kit regardless of paradigm (backend, frontend, SDK, utilities, …).
//
// Rules that assume one specific architecture (a layered domain/application/
// adapters core with ports and a Result return type) are NOT defaults: a kit
// opts into them in `meta.json -> lint` when it actually adopts that structure.
// This keeps the catalog from binding kits to any single architecture.
export const DEFAULT_LINT = {
    // Principles — on for every kit.
    nodenextImports: "error",
    noBareAny: "error",
    noExternalImports: "error",
    noUpwardImports: "error",
    observabilityPorts: "error", // only fires when the kit declares observability
    testConventions: "error",
    kitContext: "warn",
    folderDepth: "error",
    fileSize: "warn",
    noObservabilityRuntimeDeps: "error",
    // Architecture-specific — off by default, opt-in per kit.
    applicationReturnsResult: "off",
    architectureLayers: "off",
    portsArePure: "off",
    noMocksInCoreTests: "off",
    requiredCoreTests: "off",
};

export const OBSERVABILITY_RUNTIME_ROOTS = new Set([
    "pino",
    "winston",
    "bunyan",
]);
export const OBSERVABILITY_RUNTIME_PREFIXES = ["@opentelemetry/"];

export const REQUIRED_KIT_CONTEXT_SECTION_IDS = [
    "purpose",
    "layers",
    "key-decisions",
    "extension-points",
    "non-goals",
];
// Copy-only `tooling` kits have no clean-architecture layers or extension
// points, so KIT_CONTEXT.md only needs the structural sections that still make
// sense for them.
export const REQUIRED_TOOLING_KIT_CONTEXT_SECTION_IDS = [
    "purpose",
    "key-decisions",
    "non-goals",
];

export async function exists(p) {
    return fs.pathExists(p);
}

export function findDuplicateValues(values) {
    const seen = new Set();
    const duplicates = new Set();

    for (const value of values) {
        if (seen.has(value)) {
            duplicates.add(value);
            continue;
        }
        seen.add(value);
    }

    return [...duplicates];
}

export function level(lintCfg, rule) {
    return lintCfg[rule] ?? DEFAULT_LINT[rule];
}

export function isRelative(spec) {
    return (
        spec.startsWith("./") ||
        spec.startsWith("../") ||
        spec === "." ||
        spec === ".."
    );
}

export function isBare(spec) {
    return (
        !isRelative(spec) && !spec.startsWith("/") && !spec.startsWith("node:")
    );
}

export function bareRoot(spec) {
    if (spec.startsWith("@")) return spec.split("/").slice(0, 2).join("/");
    return spec.split("/")[0];
}

export function resolveRelative(fromFile, spec) {
    // Mirror what TS bundler resolution does for our limited use: drop trailing /
    return resolve(dirname(fromFile), spec);
}

export function isAllowedPackageRootImport(kit, targetPath) {
    return resolve(targetPath) === resolve(kit.packageJsonPath);
}

export function pushFinding(findings, severity, msg, file) {
    if (severity === "off") return;
    findings.push({ severity, msg, file });
}

export function splitRelative(relPath) {
    return relPath.split("/").filter(Boolean);
}

export function getCoreLayerFromPath(kitDir, filePath) {
    const rel = relative(kitDir, filePath);
    const parts = splitRelative(rel);
    if (parts[0] !== "core") return null;
    if (parts[1] === "application" && parts[2] === "ports") return "ports";
    return parts[1] ?? null;
}

export function isSpecFile(file) {
    return /\.(spec|test)\.ts$/.test(file);
}

export function normalizeLabel(value) {
    return value.replace(/[^a-z0-9]+/gi, "").toLowerCase();
}

export function countTokens(text) {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isObservabilityRuntimeDep(name) {
    return (
        OBSERVABILITY_RUNTIME_ROOTS.has(name) ||
        OBSERVABILITY_RUNTIME_PREFIXES.some((prefix) => name.startsWith(prefix))
    );
}

export function expectedTargetPathForSpec(file) {
    if (file.endsWith(".spec.ts")) return file.replace(/\.spec\.ts$/, ".ts");
    if (file.endsWith(".test.ts")) return file.replace(/\.test\.ts$/, ".ts");
    return null;
}

export function baseNameWithoutSpec(relPath) {
    const parts = splitRelative(relPath);
    const fileName = parts[parts.length - 1] ?? relPath;
    return fileName.replace(/\.(spec|test)\.ts$/, "");
}

export function hardSeverity(levelName) {
    if (levelName === "off") return "off";
    if (levelName === "warn") return "warn";
    return "error";
}

export function softSeverity(levelName) {
    if (levelName === "off") return "off";
    return "warn";
}
