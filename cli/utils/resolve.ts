import { constants, existsSync, readFileSync } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { kitDistDir, kitSrcDir, KITS_DIR } from "./paths.js";

export interface RegistryEntry {
  versions: string[];
  latest: string;
  description: string;
}

export type Registry = Record<string, RegistryEntry>;

export interface ParsedKitArg {
  name: string;
  version?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRegistry(data: unknown): Registry {
  if (!isRecord(data)) {
    throw new Error(
      "O arquivo registry/index.json nao contem um objeto valido.",
    );
  }

  const registry: Registry = {};

  for (const [name, entry] of Object.entries(data)) {
    if (!isRecord(entry)) {
      throw new Error(
        `A entrada do kit \"${name}\" no registry esta invalida.`,
      );
    }


    const versions = entry.versions;
    const latest = entry.latest;
    const description = entry.description;

    if (
      !Array.isArray(versions) ||
      !versions.every((value): value is string => typeof value === "string")
    ) {
      throw new Error(
        `A lista de versoes de \"${name}\" no registry esta invalida.`,
      );
    }

    if (typeof latest !== "string") {
      throw new Error(
        `O campo latest de \"${name}\" no registry esta invalido.`,
      );
    }

    if (typeof description !== "string") {
      throw new Error(
        `O campo description de \"${name}\" no registry esta invalido.`,
      );
    }

    registry[name] = {
      versions: [...versions],
      latest,
      description,
    };
  }

  return registry;
}

export function parseKitArg(rawValue: string): ParsedKitArg {
  const value = rawValue.trim();

  if (value.length === 0) {
    throw new Error("Informe um kit no formato nome ou nome@versao.");
  }

  const separatorIndex = value.lastIndexOf("@");

  if (separatorIndex > 0) {
    const name = value.slice(0, separatorIndex).trim();
    const version = value.slice(separatorIndex + 1).trim();

    if (name.length === 0 || version.length === 0) {
      throw new Error("Formato invalido. Use nome ou nome@versao.");
    }

    return { name, version };
  }

  return { name: value };
}

export function findCulletPackageRoot(fromMetaUrl: string): string {
  // tsup com `splitting: true` move o corpo dos modulos para chunks na raiz de
  // dist/, entao a profundidade do `import.meta.url` em runtime nao e fixa.
  // Procura o package.json do proprio pacote `cullet` subindo a partir do modulo.
  let dir = dirname(fileURLToPath(fromMetaUrl));
  const filesystemRoot = parse(dir).root;

  while (true) {
    const candidate = join(dir, "package.json");

    if (existsSync(candidate)) {
      try {
        const parsed = JSON.parse(readFileSync(candidate, "utf8")) as {
          name?: unknown;
        };
        if (parsed.name === "cullet") return dir;
      } catch {
        // ignora e continua subindo
      }
    }

    if (dir === filesystemRoot) break;
    dir = dirname(dir);
  }

  throw new Error(
    "Nao foi possivel localizar o package.json do cullet a partir do CLI.",
  );
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
    throw new Error(`O kit \"${name}\" nao existe no registry.`);
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
      `A versao \"${version}\" nao foi encontrada para \"${name}\". Versoes disponiveis: ${entry.versions.join(", ")}.`,
    );
  }

  return version;
}

export async function resolveBuiltKitDir(
  fromMetaUrl: string,
  name: string,
  version: string,
): Promise<string> {
  const kitDir = kitDistDir(findCulletPackageRoot(fromMetaUrl), name, version);

  try {
    await access(kitDir, constants.F_OK);
    return kitDir;
  } catch {
    throw new Error(
      `O kit compilado \"${name}@${version}\" nao foi encontrado em ${kitDir}. Execute \"npm run build\" no pacote cullet antes de usar full-control.`,
    );
  }
}

export interface KitDeprecation {
  since: string;
  reason: string;
  successor?: string;
}

function parseDeprecation(value: unknown): KitDeprecation | null {
  if (!isRecord(value)) return null;
  const since = value.since;
  const reason = value.reason;
  const successor = value.successor;
  if (typeof since !== "string" || typeof reason !== "string") return null;
  const result: KitDeprecation = { since, reason };
  if (typeof successor === "string") result.successor = successor;
  return result;
}

export async function loadKitDeprecation(
  fromMetaUrl: string,
  name: string,
  version: string,
): Promise<KitDeprecation | null> {
  const packageRoot = findCulletPackageRoot(fromMetaUrl);
  const metaCandidates = [
    join(packageRoot, KITS_DIR, name, "versions", version, "meta.json"),
    join(
      packageRoot,
      "dist",
      "kits",
      name,
      "versions",
      version,
      "meta.json",
    ),
  ];

  for (const candidate of metaCandidates) {
    try {
      const raw = await readFile(candidate, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!isRecord(parsed)) continue;
      return parseDeprecation(parsed.deprecated);
    } catch {
      // try next candidate
    }
  }

  return null;
}

export interface KitMeta {
  schemaVersion?: string;
  name?: string;
  version?: string;
  description?: string;
  philosophy?: {
    externalDeps?: string[];
    testDeps?: string[];
  };
}

async function readKitMeta(metaPath: string): Promise<KitMeta | null> {
  try {
    const raw = await readFile(metaPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const philosophy = isRecord(parsed.philosophy) ? parsed.philosophy : {};
    const externalDeps = Array.isArray(philosophy.externalDeps)
      ? philosophy.externalDeps.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : undefined;
    const testDeps = Array.isArray(philosophy.testDeps)
      ? philosophy.testDeps.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : undefined;

    const meta: KitMeta = {};
    if (typeof parsed.schemaVersion === "string")
      meta.schemaVersion = parsed.schemaVersion;
    if (typeof parsed.name === "string") meta.name = parsed.name;
    if (typeof parsed.version === "string") meta.version = parsed.version;
    if (typeof parsed.description === "string")
      meta.description = parsed.description;
    if (externalDeps !== undefined || testDeps !== undefined) {
      meta.philosophy = {};
      if (externalDeps !== undefined) meta.philosophy.externalDeps = externalDeps;
      if (testDeps !== undefined) meta.philosophy.testDeps = testDeps;
    }
    return meta;
  } catch {
    return null;
  }
}

export async function loadKitMeta(
  fromMetaUrl: string,
  name: string,
  version: string,
): Promise<KitMeta | null> {
  const packageRoot = findCulletPackageRoot(fromMetaUrl);
  const candidates = [
    join(packageRoot, KITS_DIR, name, "versions", version, "meta.json"),
    join(packageRoot, "dist", "kits", name, "versions", version, "meta.json"),
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
    join(packageRoot, KITS_DIR, name, "versions", version, "KIT_CONTEXT.md"),
    join(packageRoot, "dist", "kits", name, "versions", version, "KIT_CONTEXT.md"),
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

export async function resolveKitSourceDir(
  fromMetaUrl: string,
  name: string,
  version: string,
): Promise<string> {
  const packageRoot = findCulletPackageRoot(fromMetaUrl);
  const sourceDir = kitSrcDir(packageRoot, name, version);

  try {
    await access(sourceDir, constants.F_OK);
    return sourceDir;
  } catch {
    // Fallback: pacotes publicados podem conter apenas dist/kits com o fonte copiado.
    const distDir = kitDistDir(packageRoot, name, version);

    try {
      await access(distDir, constants.F_OK);
      return distDir;
    } catch {
      throw new Error(
        `O fonte do kit \"${name}@${version}\" nao foi encontrado em ${sourceDir} nem em ${distDir}.`,
      );
    }
  }
}
