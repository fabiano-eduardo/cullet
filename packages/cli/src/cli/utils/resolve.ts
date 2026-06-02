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
  getKitKind,
  isToolingKit,
  loadKitContext,
  loadKitDeprecation,
  loadKitMeta,
  loadRegistry,
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
  getKitKind,
  isToolingKit,
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
