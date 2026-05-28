export const ESM_ONLY_REQUIRE_STUB_EXPORT_PATH: string;

export interface PackageRegistryEntry {
  versions: string[];
  latest: string;
  description: string;
}

export type PackageRegistry = Record<string, PackageRegistryEntry>;

export interface PackageExportConditions {
  types: string;
  import: string;
  require: string;
  default: string;
  [condition: string]: string;
}

export type PackageExportValue = string | PackageExportConditions;
export type PackageExportsMap = Record<string, PackageExportValue>;

export type PackageExportConflict =
  | {
      type: "extra-export";
      subpath: string;
    }
  | {
      type: "extra-condition";
      subpath: string;
      condition: string;
    };

export function buildPackageExports(
  registry: PackageRegistry,
): PackageExportsMap;

export function findPackageExportConflicts(
  currentExports: unknown,
  nextExports: unknown,
): PackageExportConflict[];
