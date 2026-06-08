import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
    findCulletPackageRoot,
    kitDistDir,
    kitPackageDir,
    kitSrcDir,
} from "./paths.js";
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

const DEPRECATION_META_DIVERGENCE_WARNING_CODE =
    "CULLET_DEPRECATION_META_DIVERGENCE";
const warnedDeprecationMetaDivergences = new Set<string>();

async function readKitDeprecationCandidate(
    metaPath: string,
): Promise<{ status: "ok"; deprecation: KitDeprecation | null } | null> {
    try {
        const raw = await readFile(metaPath, "utf8");
        const parsed = JSON.parse(raw) as unknown;

        return {
            status: "ok",
            deprecation: isRecord(parsed)
                ? parseDeprecation(parsed.deprecated)
                : null,
        };
    } catch {
        return null;
    }
}

function warnOnDeprecationMetaDivergence(
    packageRoot: string,
    name: string,
    version: string,
    sourceMetaPath: string,
    sourceDeprecation: KitDeprecation | null,
    distMetaPath: string,
    distDeprecation: KitDeprecation | null,
): void {
    if (JSON.stringify(sourceDeprecation) === JSON.stringify(distDeprecation)) {
        return;
    }

    const warningKey = `${packageRoot}:${name}@${version}`;
    if (warnedDeprecationMetaDivergences.has(warningKey)) {
        return;
    }
    warnedDeprecationMetaDivergences.add(warningKey);

    process.emitWarning(
        [
            `Os metadados de deprecacao de "${name}@${version}" divergem entre`,
            `${sourceMetaPath} e ${distMetaPath}.`,
            `A resolucao local prioriza ${sourceMetaPath}; rode o build antes de publicar para alinhar o comportamento com o pacote publicado.`,
        ].join(" "),
        { code: DEPRECATION_META_DIVERGENCE_WARNING_CODE },
    );
}

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
    version: string,
): Promise<KitDeprecation | null> {
    const packageRoot = findCulletPackageRoot(fromMetaUrl);
    const distMetaPath = join(
        kitDistDir(packageRoot, name, version),
        "meta.json",
    );

    const srcPaths = [
        join(kitPackageDir(packageRoot, name), "meta.json"),
        join(kitSrcDir(packageRoot, name, version), "meta.json"),
    ];

    for (const sourceMetaPath of srcPaths) {
        const sourceCandidate =
            await readKitDeprecationCandidate(sourceMetaPath);

        if (sourceCandidate !== null) {
            const distCandidate =
                await readKitDeprecationCandidate(distMetaPath);

            if (distCandidate !== null) {
                warnOnDeprecationMetaDivergence(
                    packageRoot,
                    name,
                    version,
                    sourceMetaPath,
                    sourceCandidate.deprecation,
                    distMetaPath,
                    distCandidate.deprecation,
                );
            }

            return sourceCandidate.deprecation;
        }
    }

    const distCandidate = await readKitDeprecationCandidate(distMetaPath);
    return distCandidate?.deprecation ?? null;
}

export async function loadKitMeta(
    fromMetaUrl: string,
    name: string,
    version: string,
): Promise<KitMeta | null> {
    const packageRoot = findCulletPackageRoot(fromMetaUrl);
    const candidates = [
        join(kitPackageDir(packageRoot, name), "meta.json"),
        join(kitSrcDir(packageRoot, name, version), "meta.json"),
        join(kitDistDir(packageRoot, name, version), "meta.json"),
    ];

    for (const candidate of candidates) {
        const meta = await readKitMeta(candidate);
        if (meta !== null) return meta;
    }

    return null;
}

export async function loadKitContext(
    fromMetaUrl: string,
    name: string,
    version: string,
): Promise<string | null> {
    const packageRoot = findCulletPackageRoot(fromMetaUrl);
    const candidates = [
        join(kitPackageDir(packageRoot, name), "KIT_CONTEXT.md"),
        join(kitSrcDir(packageRoot, name, version), "KIT_CONTEXT.md"),
        join(kitDistDir(packageRoot, name, version), "KIT_CONTEXT.md"),
    ];

    for (const candidate of candidates) {
        try {
            return await readFile(candidate, "utf8");
        } catch {
            // try next
        }
    }

    return null;
}

export async function resolveBuiltKitDir(
    fromMetaUrl: string,
    name: string,
    version: string,
): Promise<string> {
    const kitDir = kitDistDir(
        findCulletPackageRoot(fromMetaUrl),
        name,
        version,
    );

    try {
        await access(kitDir, constants.F_OK);
        return kitDir;
    } catch {
        throw new Error(
            `O kit compilado "${name}@${version}" nao foi encontrado em ${kitDir}. Execute "npm run build" no pacote cullet antes de usar full-control.`,
        );
    }
}
