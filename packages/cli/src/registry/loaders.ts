import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { findCulletPackageRoot, kitMetaDir } from "./paths.js";
import {
    isRecord,
    parseDeprecation,
    parseKitMeta,
    parseRegistry,
} from "./parse.js";
import {
    type KitDeprecation,
    type KitMeta,
    type Registry,
    type RegistryEntry,
} from "./types.js";

async function readKitMeta(metaPath: string): Promise<KitMeta | null> {
    try {
        const raw = await readFile(metaPath, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        return parseKitMeta(parsed);
    } catch {
        return null;
    }
}

export async function loadRegistry(fromMetaUrl: string): Promise<Registry> {
    const packageRoot = findCulletPackageRoot(fromMetaUrl);
    const registryPath = join(packageRoot, "registry", "index.json");

    try {
        const registryRaw = await readFile(registryPath, "utf8");
        const registryJson = JSON.parse(registryRaw) as unknown;
        return parseRegistry(registryJson);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "falha ao ler o arquivo";
        throw new Error(
            `Nao foi possivel carregar o registry do cullet: ${message}`,
        );
    }
}

export function resolveRegistryEntry(
    registry: Registry,
    name: string,
): RegistryEntry {
    const entry = registry[name];

    if (entry === undefined) {
        throw new Error(`O kit "${name}" nao existe no registry.`);
    }

    return entry;
}

export function resolveVersion(
    name: string,
    entry: RegistryEntry,
    requestedVersion?: string,
): string {
    const version = requestedVersion ?? entry.latest;

    if (!entry.versions.includes(version)) {
        throw new Error(
            `A versao "${version}" nao foi encontrada para "${name}". Versoes disponiveis: ${entry.versions.join(
                ", ",
            )}.`,
        );
    }

    return version;
}

export async function loadKitDeprecation(
    fromMetaUrl: string,
    name: string,
): Promise<KitDeprecation | null> {
    const packageRoot = findCulletPackageRoot(fromMetaUrl);
    const metaPath = join(kitMetaDir(packageRoot, name), "meta.json");

    try {
        const raw = await readFile(metaPath, "utf8");
        const parsed = JSON.parse(raw) as unknown;
        return isRecord(parsed) ? parseDeprecation(parsed.deprecated) : null;
    } catch {
        return null;
    }
}

export async function loadKitMeta(
    fromMetaUrl: string,
    name: string,
): Promise<KitMeta | null> {
    const packageRoot = findCulletPackageRoot(fromMetaUrl);
    return readKitMeta(join(kitMetaDir(packageRoot, name), "meta.json"));
}

export async function loadKitContext(
    fromMetaUrl: string,
    name: string,
): Promise<string | null> {
    const packageRoot = findCulletPackageRoot(fromMetaUrl);
    const contextPath = join(kitMetaDir(packageRoot, name), "KIT_CONTEXT.md");

    try {
        return await readFile(contextPath, "utf8");
    } catch {
        return null;
    }
}
