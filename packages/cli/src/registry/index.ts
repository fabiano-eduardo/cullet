import {
  getCopyDelivery,
  getCopyDependencies,
  getCopyPlacement,
  getKitKind,
  isToolingKit,
  loadKitContext,
  loadKitDeprecation,
  loadKitMeta,
  loadRegistry as loadRegistryFromFiles,
  resolveRegistryEntry,
  resolveVersion,
  type KitCopyDelivery,
  type KitDelivery,
  type KitDeprecation,
  type KitDependency,
  type KitCompatibility,
  type KitKind,
  type KitMeta,
  type KitSuccessor,
  type KitSuccessorCodemod,
  type Registry,
  type RegistryEntry,
} from "./catalog.js";
import {
  parseKitContextDocument,
  type KitContextDocument,
  type KitContextSection,
  type KitContextSectionId,
} from "./kit-context.js";

export type {
  Registry,
  RegistryEntry,
  KitDeprecation,
  KitDependency,
  KitCompatibility,
  KitCopyDelivery,
  KitDelivery,
  KitKind,
  KitMeta,
  KitSuccessor,
  KitSuccessorCodemod,
  KitContextDocument,
  KitContextSection,
  KitContextSectionId,
};

export {
  getCopyDelivery,
  getCopyDependencies,
  getCopyPlacement,
  getKitKind,
  isToolingKit,
};

export interface CatalogKitSummary {
  name: string;
  description: string;
  latest: string;
  versions: string[];
  npmName: string;
}

export interface CatalogKitContext {
  schemaVersion: KitContextDocument["schemaVersion"];
  title: KitContextDocument["title"];
  sections: KitContextDocument["sections"];
  raw: string;
}

export interface CatalogKit {
  name: string;
  description: string;
  latest: string;
  versions: string[];
  version: string;
  npmName: string;
  meta: KitMeta | null;
  context: CatalogKitContext | null;
  deprecation: KitDeprecation | null;
}

export interface LoadKitOptions {
  /**
   * Load and parse the kit's `KIT_CONTEXT.md`. Defaults to `true`. Pass `false`
   * when the caller only needs meta/deprecation (e.g. `cullet fc`), to skip the
   * context read entirely.
   */
  context?: boolean;
}

export async function loadRegistry(): Promise<Registry> {
  return loadRegistryFromFiles(import.meta.url);
}

export async function listKits(): Promise<CatalogKitSummary[]> {
  const registry = await loadRegistry();

  return Object.entries(registry)
    .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
    .map(([name, entry]) => ({
      name,
      description: entry.description,
      latest: entry.latest,
      versions: [...entry.versions],
      npmName: entry.npmName,
    }));
}

export async function loadKit(
  name: string,
  requestedVersion?: string,
  options: LoadKitOptions = {},
): Promise<CatalogKit> {
  const includeContext = options.context ?? true;
  const registry = await loadRegistry();
  const entry = resolveRegistryEntry(registry, name);
  const version = resolveVersion(name, entry, requestedVersion);
  const [meta, contextRaw, deprecation] = await Promise.all([
    loadKitMeta(import.meta.url, name, version),
    includeContext
      ? loadKitContext(import.meta.url, name, version)
      : Promise.resolve(null),
    loadKitDeprecation(import.meta.url, name, version),
  ]);

  return {
    name,
    description: entry.description,
    latest: entry.latest,
    versions: [...entry.versions],
    version,
    npmName: entry.npmName,
    meta,
    context:
      contextRaw === null
        ? null
        : (() => {
            const context = parseKitContextDocument(contextRaw);
            return {
              schemaVersion: context.schemaVersion,
              title: context.title,
              sections: context.sections,
              raw: context.raw,
            };
          })(),
    deprecation,
  };
}
