import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface RegistryEntry {
  versions: string[];
  latest: string;
  description: string;
}

export type Registry = Record<string, RegistryEntry>;

export interface ParsedBoilerplateArg {
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
        `A entrada do boilerplate \"${name}\" no registry esta invalida.`,
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

export function parseBoilerplateArg(rawValue: string): ParsedBoilerplateArg {
  const value = rawValue.trim();

  if (value.length === 0) {
    throw new Error("Informe um boilerplate no formato nome ou nome@versao.");
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

export async function findCulletPackageRoot(
  fromMetaUrl: string,
): Promise<string> {
  let currentDir = dirname(fileURLToPath(fromMetaUrl));

  while (true) {
    const packageJsonPath = join(currentDir, "package.json");

    try {
      await access(packageJsonPath, constants.F_OK);
      const packageJsonRaw = await readFile(packageJsonPath, "utf8");
      const packageJson = JSON.parse(packageJsonRaw) as unknown;

      if (isRecord(packageJson) && packageJson.name === "cullet") {
        return currentDir;
      }
    } catch {
      // Continue subindo a arvore de diretorios ate localizar o pacote.
    }

    const parentDir = dirname(currentDir);

    if (parentDir === currentDir) {
      throw new Error("Nao foi possivel localizar a raiz do pacote cullet.");
    }

    currentDir = parentDir;
  }
}

export async function loadRegistry(fromMetaUrl: string): Promise<Registry> {
  const packageRoot = await findCulletPackageRoot(fromMetaUrl);
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
    throw new Error(`O boilerplate \"${name}\" nao existe no registry.`);
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

export async function resolveBuiltBoilerplateDir(
  fromMetaUrl: string,
  name: string,
  version: string,
): Promise<string> {
  const packageRoot = await findCulletPackageRoot(fromMetaUrl);
  const boilerplateDir = join(
    packageRoot,
    "dist",
    "boilerplates",
    name,
    "versions",
    version,
  );

  try {
    await access(boilerplateDir, constants.F_OK);
    return boilerplateDir;
  } catch {
    throw new Error(
      `O boilerplate buildado \"${name}@${version}\" nao foi encontrado em ${boilerplateDir}. Execute \"npm run build\" no pacote cullet antes de usar full-control.`,
    );
  }
}
