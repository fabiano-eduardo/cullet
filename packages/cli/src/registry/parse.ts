import {
  DEFAULT_COPY_SOURCE_DIR,
  KIT_KINDS,
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
} from "./types.js";

const BARE_LEADING_AT_NAME_PATTERN = /^@[^@/\s]+$/u;
const SCOPED_KIT_ARG_PATTERN =
  /^(?<name>@[^/\s]+\/[^@\s]+)(?:@(?<version>[^@\s]+))?$/u;
const UNSCOPED_KIT_ARG_PATTERN = /^(?<name>[^@\s]+)(?:@(?<version>[^@\s]+))?$/u;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseRegistry(data: unknown): Registry {
  if (!isRecord(data)) {
    throw new Error(
      "O arquivo registry/index.json nao contem um objeto valido.",
    );
  }

  const registry: Registry = {};

  for (const [name, entry] of Object.entries(data)) {
    if (!isRecord(entry)) {
      throw new Error(`A entrada do kit "${name}" no registry esta invalida.`);
    }

    const versions = entry.versions;
    const latest = entry.latest;
    const description = entry.description;

    if (
      !Array.isArray(versions) ||
      !versions.every((value): value is string => typeof value === "string")
    ) {
      throw new Error(
        `A lista de versoes de "${name}" no registry esta invalida.`,
      );
    }

    if (typeof latest !== "string") {
      throw new Error(`O campo latest de "${name}" no registry esta invalido.`);
    }

    if (typeof description !== "string") {
      throw new Error(
        `O campo description de "${name}" no registry esta invalido.`,
      );
    }

    const npmName =
      typeof entry.npmName === "string" ? entry.npmName : `cullet/${name}`;

    registry[name] = {
      versions: [...versions],
      latest,
      description,
      npmName,
    };
  }

  return registry;
}

/**
 * Core parser for a `nome` / `nome@versao` argument. Returns the parsed parts,
 * or `null` when the string is empty or malformed. The throwing, CLI-facing
 * variant (`parseKitArg`) is built on top of this in the CLI layer.
 */
export function matchKitArg(
  rawValue: string,
): { name: string; version?: string } | null {
  const value = rawValue.trim();

  if (value.length === 0) {
    return null;
  }

  if (value.startsWith("@") && !value.includes("/")) {
    return BARE_LEADING_AT_NAME_PATTERN.test(value) ? { name: value } : null;
  }

  const match =
    SCOPED_KIT_ARG_PATTERN.exec(value) ?? UNSCOPED_KIT_ARG_PATTERN.exec(value);

  if (match === null || match.groups?.name === undefined) {
    return null;
  }

  const { name, version } = match.groups;
  return version === undefined ? { name } : { name, version };
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

  const parsed = matchKitArg(trimmed);
  if (parsed?.version === undefined) {
    return null;
  }

  return { name: parsed.name, version: parsed.version };
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

export function parseDeprecation(value: unknown): KitDeprecation | null {
  if (!isRecord(value)) return null;

  const since = value.since;
  const reason = value.reason;
  const successor = parseSuccessor(value.successor);

  if (typeof since !== "string" || typeof reason !== "string") return null;

  const result: KitDeprecation = { since, reason };
  if (successor !== undefined) result.successor = successor;
  return result;
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

function parseKitKind(value: unknown): KitKind | undefined {
  return typeof value === "string" && KIT_KINDS.has(value)
    ? (value as KitKind)
    : undefined;
}

function parseKitCopyDelivery(value: unknown): KitCopyDelivery | undefined {
  if (!isRecord(value)) return undefined;

  const placement = value.placement;
  if (typeof placement !== "string" || placement.length === 0) {
    return undefined;
  }

  const source =
    typeof value.source === "string" && value.source.length > 0
      ? value.source
      : DEFAULT_COPY_SOURCE_DIR;
  const dependencies = parseKitDependencyList(value.dependencies) ?? [];

  const copy: KitCopyDelivery = { placement, source, dependencies };
  if (typeof value.postInstall === "string" && value.postInstall.length > 0) {
    copy.postInstall = value.postInstall;
  }

  return copy;
}

function parseKitDelivery(value: unknown): KitDelivery | undefined {
  if (!isRecord(value)) return undefined;

  const delivery: KitDelivery = {};

  if (isRecord(value.import)) {
    const peerDependencies = parseKitDependencyList(
      value.import.peerDependencies,
    );
    if (peerDependencies !== undefined) {
      delivery.import = { peerDependencies };
    }
  }

  const copy = parseKitCopyDelivery(value.copy);
  if (copy !== undefined) {
    delivery.copy = copy;
  }

  return delivery.import === undefined && delivery.copy === undefined
    ? undefined
    : delivery;
}

export function parseKitMeta(parsed: unknown): KitMeta | null {
  if (!isRecord(parsed)) return null;
  const philosophy = isRecord(parsed.philosophy) ? parsed.philosophy : {};
  const compatibility = parseKitCompatibility(parsed.compatibility);
  const kind = parseKitKind(parsed.kind);
  const delivery = parseKitDelivery(parsed.delivery);
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
  if (typeof parsed.schemaVersion === "string") {
    meta.schemaVersion = parsed.schemaVersion;
  }
  if (kind !== undefined) meta.kind = kind;
  if (delivery !== undefined) meta.delivery = delivery;
  if (typeof parsed.name === "string") meta.name = parsed.name;
  if (typeof parsed.version === "string") meta.version = parsed.version;
  if (typeof parsed.description === "string") {
    meta.description = parsed.description;
  }
  if (compatibility !== undefined) meta.compatibility = compatibility;
  if (externalDeps !== undefined || testDeps !== undefined) {
    meta.philosophy = {};
    if (externalDeps !== undefined) {
      meta.philosophy.externalDeps = externalDeps;
    }
    if (testDeps !== undefined) meta.philosophy.testDeps = testDeps;
  }
  return meta;
}
