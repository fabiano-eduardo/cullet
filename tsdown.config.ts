import { existsSync, readFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { defineConfig } from "tsdown";
import {
  collectModuleSpecifiers,
  parseTsSource,
  TYPESCRIPT_SOURCE_EXTENSIONS,
  walkFilesSync,
} from "./scripts/source-analysis.mjs";

const kitsRoot = resolve("kits");
const ESM_ONLY_REQUIRE_STUB_SOURCE_PATH = resolve(
  "scripts",
  "esm-only-require.cjs",
);
const ESM_ONLY_REQUIRE_STUB_FILENAME = "esm-only-require.cjs";
const KIT_SOURCE_SCAN_OPTIONS = {
  extensions: TYPESCRIPT_SOURCE_EXTENSIONS,
  ignoredDirectories: new Set(["node_modules"]),
  ignoreDotEntries: true,
};

type RegistryEntry = {
  versions: string[];
};

type Registry = Record<string, RegistryEntry>;

export interface KitImportViolation {
  importer: string;
  specifier: string;
}

function readRegistry(): Registry {
  const path = resolve("registry/index.json");
  return JSON.parse(readFileSync(path, "utf8")) as Registry;
}

function discoverKitEntries(): string[] {
  const registry = readRegistry();
  const entries: string[] = [];

  for (const [name, entry] of Object.entries(registry)) {
    for (const version of entry.versions) {
      const versioned = `kits/${name}/versions/${version}/index.ts`;
      if (existsSync(resolve(versioned))) entries.push(versioned);
    }
  }

  return entries;
}

async function syncKitSources(): Promise<void> {
  const violations = findTestOnlyKitImports(kitsRoot);

  if (violations.length > 0) {
    throw new Error(formatTestOnlyImportViolations(violations));
  }

  await cp(kitsRoot, "dist/kits", {
    recursive: true,
    filter: (source) => shouldCopyKitPath(source),
  });
}

export async function syncRuntimeAssets(outDir = "dist"): Promise<void> {
  await cp(
    ESM_ONLY_REQUIRE_STUB_SOURCE_PATH,
    join(resolve(outDir), ESM_ONLY_REQUIRE_STUB_FILENAME),
  );
}

function normalizePathSegments(value: string): string {
  return value.split(sep).join("/");
}

function isTestOnlyPath(pathLike: string): boolean {
  const normalized = normalizePathSegments(pathLike);

  if (
    normalized === "__tests__" ||
    normalized.startsWith("__tests__/") ||
    normalized.includes("/__tests__/")
  ) {
    return true;
  }

  return /(?:^|\/)[^/]+\.(spec|test)(?:\.[^/]+)?$/u.test(normalized);
}

function formatTestOnlyImportViolations(
  violations: KitImportViolation[],
): string {
  const lines = violations.map(
    ({ importer, specifier }) => `- ${importer} -> ${specifier}`,
  );

  return [
    "Nao foi possivel copiar os kits para dist/kits.",
    "Arquivos de producao nao podem importar arquivos excluidos da publicacao (*.spec.*, *.test.* ou __tests__/).",
    ...lines,
  ].join("\n");
}

export function findTestOnlyKitImports(rootDir: string): KitImportViolation[] {
  const violations: KitImportViolation[] = [];

  for (const sourcePath of walkFilesSync(rootDir, KIT_SOURCE_SCAN_OPTIONS)) {
    const importer = normalizePathSegments(relative(rootDir, sourcePath));

    if (isTestOnlyPath(importer)) {
      continue;
    }

    const sourceFile = parseTsSource(sourcePath);
    for (const specifier of collectModuleSpecifiers(sourceFile)) {
      if (!specifier.startsWith(".")) {
        continue;
      }

      if (isTestOnlyPath(specifier)) {
        violations.push({ importer, specifier });
      }
    }
  }

  return violations;
}

export function shouldCopyKitPath(source: string, rootDir = kitsRoot): boolean {
  const relativePath = relative(rootDir, resolve(source));

  if (relativePath === "") return true;

  if (basename(source) === ".gitkeep") return false;

  return !isTestOnlyPath(relativePath);
}

export default defineConfig({
  entry: [
    "cli/index.ts",
    "cli/commands/*.ts",
    "cli/utils/*.ts",
    "registry/*.ts",
    ...discoverKitEntries(),
  ],
  external: ["pino", "zod"],
  dts: true,
  format: ["esm"],
  target: "node18",
  hash: false,
  clean: true,
  outDir: "dist",
  sourcemap: true,
  hooks: {
    "build:done": async () => {
      await syncKitSources();
      await syncRuntimeAssets();
    },
  },
});
