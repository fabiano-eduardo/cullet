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

const BARE_LEADING_AT_NAME_PATTERN = /^@[^@/\s]+$/u;
const SCOPED_KIT_ARG_PATTERN =
  /^(?<name>@[^/\s]+\/[^@\s]+)(?:@(?<version>[^@\s]+))?$/u;
const UNSCOPED_KIT_ARG_PATTERN = /^(?<name>[^@\s]+)(?:@(?<version>[^@\s]+))?$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCulletPackageRoot(dir: string): boolean {
  const packageJsonPath = join(dir, "package.json");
  const registryPath = join(dir, "registry", "index.json");

  if (!existsSync(packageJsonPath) || !existsSync(registryPath)) {
    return false;
  }

  try {
    const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: unknown;
    };

    return parsed.name === "cullet";
  } catch {
    return false;
  }
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

  if (version === undefined) {
    return { name };
  }

  return { name, version };
}

export function findCulletPackageRoot(fromMetaUrl: string): string {
  // O bundler move o corpo dos modulos para chunks na raiz de
  // dist/, entao a profundidade do `import.meta.url` em runtime nao e fixa.
  // Procura os marcadores do proprio pacote `cullet` subindo a partir do
  // modulo. Isso evita parar em qualquer package.json homonimo no caminho.
  let dir = dirname(fileURLToPath(fromMetaUrl));
  const filesystemRoot = parse(dir).root;

  while (true) {
    if (isCulletPackageRoot(dir)) {
      return dir;
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
      `A versao \"${version}\" nao foi encontrada para \"${name}\". Versoes disponiveis: ${entry.versions.join(
        ", ",
      )}.`,
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
  successor?: KitSuccessor;
}

export interface KitSuccessorCodemod {
  path: string;
  description?: string;
}

export interface KitSuccessor {
  name: string;
  version: string;
  notes?: string;
  guide?: string;
  codemod?: KitSuccessorCodemod;
}

export interface KitDependency {
  name: string;
  range: string;
  optional?: boolean;
  notes?: string;
}

export interface KitCompatibility {
  engines: {
    node: string;
    typescript: string;
  };
  directImport: {
    peerDependencies: KitDependency[];
  };
  fullControl: {
    dependencies: KitDependency[];
  };
}

function parseLegacySuccessorReference(value: string): KitSuccessor | null {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const separatorIndex = trimmed.lastIndexOf("/");
  if (separatorIndex > 0 && separatorIndex < trimmed.length - 1) {
    const name = trimmed.slice(0, separatorIndex).trim();
    const version = trimmed.slice(separatorIndex + 1).trim();

    if (name.length > 0 && version.length > 0) {
      return { name, version };
    }
  }

  try {
    const parsed = parseKitArg(trimmed);
    if (parsed.version === undefined) {
      return null;
    }

    return { name: parsed.name, version: parsed.version };
  } catch {
    return null;
  }
}

function parseSuccessorCodemod(
  value: unknown,
): KitSuccessorCodemod | undefined {
  if (!isRecord(value)) return undefined;

  const path = value.path;
  const description = value.description;

  if (typeof path !== "string") {
    return undefined;
  }

  const codemod: KitSuccessorCodemod = { path };

  if (typeof description === "string") {
    codemod.description = description;
  }

  return codemod;
}

function parseSuccessor(value: unknown): KitSuccessor | undefined {
  if (typeof value === "string") {
    return parseLegacySuccessorReference(value) ?? undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const name = value.name;
  const version = value.version;
  const notes = value.notes;
  const guide = value.guide;
  const codemod = parseSuccessorCodemod(value.codemod);

  if (typeof name !== "string" || typeof version !== "string") {
    return undefined;
  }

  const successor: KitSuccessor = { name, version };

  if (typeof notes === "string") {
    successor.notes = notes;
  }

  if (typeof guide === "string") {
    successor.guide = guide;
  }

  if (codemod !== undefined) {
    successor.codemod = codemod;
  }

  return successor;
}

export function formatKitSuccessor(successor: KitSuccessor): string {
  return `${successor.name}@${successor.version}`;
}

export function describeKitSuccessor(successor: KitSuccessor): string[] {
  const lines = [`Sucessor recomendado: ${formatKitSuccessor(successor)}`];

  if (typeof successor.guide === "string") {
    lines.push(`Guia de migracao: ${successor.guide}`);
  }

  if (successor.codemod !== undefined) {
    const detail =
      successor.codemod.description === undefined
        ? successor.codemod.path
        : `${successor.codemod.description} (${successor.codemod.path})`;
    lines.push(`Codemod disponivel: ${detail}`);
  }

  if (typeof successor.notes === "string") {
    lines.push(`Notas de migracao: ${successor.notes}`);
  }

  return lines;
}

function parseDeprecation(value: unknown): KitDeprecation | null {
  if (!isRecord(value)) return null;

  const since = value.since;
  const reason = value.reason;
  const successor = parseSuccessor(value.successor);

  if (typeof since !== "string" || typeof reason !== "string") return null;

  const result: KitDeprecation = { since, reason };
  if (successor !== undefined) result.successor = successor;
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
    join(packageRoot, "dist", "kits", name, "versions", version, "meta.json"),
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
  compatibility?: KitCompatibility;
  philosophy?: {
    externalDeps?: string[];
    testDeps?: string[];
  };
}

function parseKitDependency(value: unknown): KitDependency | null {
  if (!isRecord(value)) return null;

  const name = value.name;
  const range = value.range;
  const optional = value.optional;
  const notes = value.notes;

  if (typeof name !== "string" || typeof range !== "string") {
    return null;
  }

  const dependency: KitDependency = { name, range };
  if (typeof optional === "boolean") dependency.optional = optional;
  if (typeof notes === "string") dependency.notes = notes;
  return dependency;
}

function parseKitDependencyList(value: unknown): KitDependency[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const dependencies: KitDependency[] = [];

  for (const entry of value) {
    const dependency = parseKitDependency(entry);
    if (dependency === null) {
      return undefined;
    }
    dependencies.push(dependency);
  }

  return dependencies;
}

function parseKitCompatibility(value: unknown): KitCompatibility | undefined {
  if (!isRecord(value)) return undefined;

  const engines = value.engines;
  const directImport = value.directImport;
  const fullControl = value.fullControl;

  if (!isRecord(engines) || !isRecord(directImport) || !isRecord(fullControl)) {
    return undefined;
  }

  const node = engines.node;
  const typescript = engines.typescript;
  const peerDependencies = parseKitDependencyList(
    directImport.peerDependencies,
  );
  const dependencies = parseKitDependencyList(fullControl.dependencies);

  if (
    typeof node !== "string" ||
    typeof typescript !== "string" ||
    peerDependencies === undefined ||
    dependencies === undefined
  ) {
    return undefined;
  }

  return {
    engines: {
      node,
      typescript,
    },
    directImport: {
      peerDependencies,
    },
    fullControl: {
      dependencies,
    },
  };
}

function cloneKitDependencies(dependencies: KitDependency[]): KitDependency[] {
  return dependencies.map((dependency) => ({ ...dependency }));
}

function fallbackKitDependencies(names: string[] | undefined): KitDependency[] {
  if (names === undefined) return [];

  return names.map((name) => ({ name, range: "" }));
}

export function getDirectImportPeerDependencies(
  meta: KitMeta | null | undefined,
): KitDependency[] {
  const dependencies = meta?.compatibility?.directImport.peerDependencies;

  return dependencies !== undefined
    ? cloneKitDependencies(dependencies)
    : fallbackKitDependencies(meta?.philosophy?.externalDeps);
}

export function getFullControlDependencies(
  meta: KitMeta | null | undefined,
): KitDependency[] {
  const dependencies = meta?.compatibility?.fullControl.dependencies;

  return dependencies !== undefined
    ? cloneKitDependencies(dependencies)
    : fallbackKitDependencies(meta?.philosophy?.externalDeps);
}

async function readKitMeta(metaPath: string): Promise<KitMeta | null> {
  try {
    const raw = await readFile(metaPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const philosophy = isRecord(parsed.philosophy) ? parsed.philosophy : {};
    const compatibility = parseKitCompatibility(parsed.compatibility);
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
    if (compatibility !== undefined) meta.compatibility = compatibility;
    if (externalDeps !== undefined || testDeps !== undefined) {
      meta.philosophy = {};
      if (externalDeps !== undefined)
        meta.philosophy.externalDeps = externalDeps;
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
    join(
      packageRoot,
      "dist",
      "kits",
      name,
      "versions",
      version,
      "KIT_CONTEXT.md",
    ),
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
