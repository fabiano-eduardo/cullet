// Barrel for the registry catalog. The implementation is split across focused
// modules; this file preserves the public surface consumers import from
// `./catalog.js`.
//
//   types.ts          — type system + public constants
//   paths.ts          — filesystem path/package-root resolution
//   parse.ts          — unknown JSON → typed validation layer
//   meta-accessors.ts — synchronous reads over a KitMeta
//   loaders.ts        — async filesystem loaders + in-memory registry lookups
//   successor.ts      — KitSuccessor formatting helpers

export type {
  Registry,
  RegistryEntry,
  KitDeprecation,
  KitSuccessorCodemod,
  KitSuccessor,
  KitDependency,
  KitCompatibility,
  KitKind,
  KitCopyDelivery,
  KitDelivery,
  KitMeta,
} from "./types.js";
export { DEFAULT_KIT_KIND, DEFAULT_COPY_SOURCE_DIR } from "./types.js";

export { findCulletPackageRoot } from "./paths.js";

export { matchKitArg } from "./parse.js";

export {
  loadRegistry,
  resolveRegistryEntry,
  resolveVersion,
  loadKitDeprecation,
  loadKitMeta,
  loadKitContext,
  resolveBuiltKitDir,
} from "./loaders.js";

export {
  getDirectImportPeerDependencies,
  getFullControlDependencies,
  getKitKind,
  isToolingKit,
  getCopyDelivery,
  getCopyPlacement,
  getCopyDependencies,
  kitExposesImport,
  getImportPeerDependencies,
} from "./meta-accessors.js";

export { formatKitSuccessor, describeKitSuccessor } from "./successor.js";
