import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { kitDistDir, kitSrcDir } from "./paths.js";

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
  // O CLI sempre roda a partir de dist/cli/index.js; a raiz do pacote
  // esta dois niveis acima do diretorio do modulo atual.
  const moduleDir = dirname(fileURLToPath(fromMetaUrl));
  return resolve(moduleDir, "..", "..");
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
