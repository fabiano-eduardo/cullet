import { constants, readFileSync } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { resolveKitPackageRoot } from "./paths.js";
import {
    describeKitSuccessor,
    findCulletPackageRoot,
    formatKitSuccessor,
    getCopyDelivery,
    getCopyDependencies,
    getCopyPlacement,
    getDirectImportPeerDependencies,
    getFullControlDependencies,
    getImportPeerDependencies,
    getKitKind,
    isToolingKit,
    kitExposesImport,
    loadKitContext,
    loadKitDeprecation,
    loadKitMeta,
    loadRegistry,
    matchKitArg,
    resolveBuiltKitDir as resolveSharedBuiltKitDir,
    resolveRegistryEntry,
    resolveVersion,
    type KitCompatibility,
    type KitCopyDelivery,
    type KitDelivery,
    type KitDependency,
    type KitDeprecation,
    type KitKind,
    type KitMeta,
    type KitSuccessor,
    type KitSuccessorCodemod,
    type Registry,
    type RegistryEntry,
} from "../../registry/catalog.js";

export {
    describeKitSuccessor,
    findCulletPackageRoot,
    formatKitSuccessor,
    getCopyDelivery,
    getCopyDependencies,
    getCopyPlacement,
    getDirectImportPeerDependencies,
    getFullControlDependencies,
    getImportPeerDependencies,
    getKitKind,
    isToolingKit,
    kitExposesImport,
    loadKitContext,
    loadKitDeprecation,
    loadKitMeta,
    loadRegistry,
    resolveRegistryEntry,
    resolveVersion,
    type KitCompatibility,
    type KitCopyDelivery,
    type KitDelivery,
    type KitDependency,
    type KitDeprecation,
    type KitKind,
    type KitMeta,
    type KitSuccessor,
    type KitSuccessorCodemod,
    type Registry,
    type RegistryEntry,
};

export interface ParsedKitArg {
    name: string;
    version?: string;
}

/**
 * CLI-facing parser for a `nome` / `nome@versao` argument. Wraps the shared
 * {@link matchKitArg} core, turning its `null` result into the friendly error
 * messages the CLI surfaces (distinguishing an empty arg from a malformed one).
 */
export function parseKitArg(rawValue: string): ParsedKitArg {
    const value = rawValue.trim();

    if (value.length === 0) {
        throw new Error("Informe um kit no formato nome ou nome@versao.");
    }

    const parsed = matchKitArg(value);

    if (parsed === null) {
        throw new Error("Formato invalido. Use nome ou nome@versao.");
    }

    return parsed;
}

export interface ResolvedKitArg {
    name: string;
    version: string;
    entry: RegistryEntry;
}

/**
 * Parse a `nome@versao` argument and resolve it against the registry in one
 * step: validates the arg, loads the registry, locates the entry and pins the
 * concrete version. Shared by the single-kit commands so the resolution
 * preamble lives in one place.
 */
export async function resolveKitFromArg(
    fromMetaUrl: string,
    kit: string,
): Promise<ResolvedKitArg> {
    const parsed = parseKitArg(kit);
    const registry = await loadRegistry(fromMetaUrl);
    const entry = resolveRegistryEntry(registry, parsed.name);
    const version = resolveVersion(parsed.name, entry, parsed.version);
    return { name: parsed.name, version, entry };
}

export async function resolveBuiltKitDir(
    fromMetaUrl: string,
    name: string,
    version: string,
): Promise<string> {
    return resolveSharedBuiltKitDir(fromMetaUrl, name, version);
}

/**
 * Locate the kit source to copy in full-control mode. Resolves the kit package
 * (`npmName`) from the **consumer's** node_modules (it must already be
 * installed) and returns its `src/` directory, falling back to `dist/` when the
 * package was published without sources.
 */
/**
 * Returns the version of `npmName` currently installed in the consumer's
 * node_modules, or `null` when the package cannot be resolved. Used by
 * full-control to decide whether the requested version still needs to be
 * installed before copying.
 */
export function resolveInstalledKitVersion(
    consumerCwd: string,
    npmName: string,
): string | null {
    try {
        const packageRoot = resolveKitPackageRoot(consumerCwd, npmName);
        const manifest = JSON.parse(
            readFileSync(join(packageRoot, "package.json"), "utf8"),
        ) as { version?: unknown };
        return typeof manifest.version === "string" ? manifest.version : null;
    } catch {
        return null;
    }
}

export async function resolveKitSourceDir(
    consumerCwd: string,
    npmName: string,
): Promise<string> {
    const packageRoot = resolveKitPackageRoot(consumerCwd, npmName);
    const sourceDir = join(packageRoot, "src");

    try {
        await access(sourceDir, constants.F_OK);
        return sourceDir;
    } catch {
        // Fallback: pacotes publicados sem `src/` ainda trazem o build em `dist/`.
        const distDir = join(packageRoot, "dist");

        try {
            await access(distDir, constants.F_OK);
            return distDir;
        } catch {
            throw new Error(
                `O fonte do pacote "${npmName}" nao foi encontrado em ${sourceDir} nem em ${distDir}.`,
            );
        }
    }
}

/**
 * Locate the payload directory of a copy-only (`tooling`) kit inside the
 * consumer's installed package (`node_modules/<npmName>/<source>`). Unlike
 * {@link resolveKitSourceDir}, there is no `dist/` fallback: the payload is
 * shipped verbatim and must be present where the kit declares it.
 */
export async function resolveKitPayloadDir(
    consumerCwd: string,
    npmName: string,
    source: string,
): Promise<string> {
    const packageRoot = resolveKitPackageRoot(consumerCwd, npmName);
    const payloadDir = join(packageRoot, source);

    try {
        await access(payloadDir, constants.F_OK);
        return payloadDir;
    } catch {
        throw new Error(
            `O payload do kit "${npmName}" nao foi encontrado em ${payloadDir}. O pacote pode nao incluir o diretorio "${source}".`,
        );
    }
}
