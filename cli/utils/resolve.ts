import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { kitDistDir, kitSrcDir } from "./paths.js";
import {
  describeKitSuccessor,
  findCulletPackageRoot,
  formatKitSuccessor,
  getDirectImportPeerDependencies,
  getFullControlDependencies,
  loadKitContext,
  loadKitDeprecation,
  loadKitMeta,
  loadRegistry,
  resolveBuiltKitDir as resolveSharedBuiltKitDir,
  resolveRegistryEntry,
  resolveVersion,
  type KitCompatibility,
  type KitDependency,
  type KitDeprecation,
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
  getDirectImportPeerDependencies,
  getFullControlDependencies,
  loadKitContext,
  loadKitDeprecation,
  loadKitMeta,
  loadRegistry,
  resolveRegistryEntry,
  resolveVersion,
  type KitCompatibility,
  type KitDependency,
  type KitDeprecation,
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

const BARE_LEADING_AT_NAME_PATTERN = /^@[^@/\s]+$/u;
const SCOPED_KIT_ARG_PATTERN =
  /^(?<name>@[^/\s]+\/[^@\s]+)(?:@(?<version>[^@\s]+))?$/u;
const UNSCOPED_KIT_ARG_PATTERN = /^(?<name>[^@\s]+)(?:@(?<version>[^@\s]+))?$/u;

export function parseKitArg(rawValue: string): ParsedKitArg {
  const value = rawValue.trim();

  if (value.length === 0) {
    throw new Error("Informe um kit no formato nome ou nome@versao.");
  }

  if (value.startsWith("@") && !value.includes("/")) {
    if (!BARE_LEADING_AT_NAME_PATTERN.test(value)) {
      throw new Error("Formato invalido. Use nome ou nome@versao.");
    }

    return { name: value };
  }

  const match =
    SCOPED_KIT_ARG_PATTERN.exec(value) ?? UNSCOPED_KIT_ARG_PATTERN.exec(value);

  if (match === null || match.groups?.name === undefined) {
    throw new Error("Formato invalido. Use nome ou nome@versao.");
  }

  const { name, version } = match.groups;
  return version === undefined ? { name } : { name, version };
}

export async function resolveBuiltKitDir(
  fromMetaUrl: string,
  name: string,
  version: string
): Promise<string> {
  return resolveSharedBuiltKitDir(fromMetaUrl, name, version);
}

export async function resolveKitSourceDir(
  fromMetaUrl: string,
  name: string,
  version: string
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
        `O fonte do kit "${name}@${version}" nao foi encontrado em ${sourceDir} nem em ${distDir}.`
      );
    }
  }
}
