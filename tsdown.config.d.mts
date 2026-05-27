import type { UserConfig } from "tsdown";

export interface KitImportViolation {
  importer: string;
  specifier: string;
}

export function findTestOnlyKitImports(rootDir: string): KitImportViolation[];

export function shouldCopyKitPath(source: string, rootDir?: string): boolean;

export function syncRuntimeAssets(outDir?: string): Promise<void>;

declare const config: UserConfig;

export default config;
