import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { kitDistDir, kitSrcDir } from "./paths.js";
import {
  findCulletPackageRoot,
  loadKitDeprecation,
  type KitDeprecation,
  type KitSuccessor,
} from "./resolve.js";

export interface KitMigrationAsset {
  declaredPath: string;
  resolvedPath: string | null;
}

export interface KitMigrationCodemodAsset extends KitMigrationAsset {
  description?: string;
}

export interface KitMigrationPlan {
  source: {
    name: string;
    version: string;
  };
  deprecation: KitDeprecation;
  target: KitSuccessor;
  guide?: KitMigrationAsset;
  codemod?: KitMigrationCodemodAsset;
}

export interface KitMigrationContext {
  projectDir: string;
  dryRun: boolean;
  source: {
    name: string;
    version: string;
  };
  target: {
    name: string;
    version: string;
  };
  report(message: string): void;
}

export interface KitMigrationResult {
  summary?: string;
  changedFiles?: string[];
}

type KitMigrationRunner = (
  context: KitMigrationContext,
) => Promise<KitMigrationResult | void>;

interface MigrationModuleShape {
  default?: unknown;
  run?: unknown;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function assertPathInsideVersionRoot(
  rootDir: string,
  declaredPath: string,
): string {
  const resolvedPath = resolve(rootDir, declaredPath);
  const rootWithSeparator = `${rootDir}${sep}`;

  if (resolvedPath !== rootDir && !resolvedPath.startsWith(rootWithSeparator)) {
    throw new Error(
      `O asset de migracao "${declaredPath}" precisa permanecer dentro da pasta da versao do kit.`,
    );
  }

  return resolvedPath;
}

async function resolveKitVersionAsset(
  fromMetaUrl: string,
  name: string,
  version: string,
  declaredPath: string,
): Promise<string | null> {
  const packageRoot = findCulletPackageRoot(fromMetaUrl);
  const roots = [
    kitSrcDir(packageRoot, name, version),
    kitDistDir(packageRoot, name, version),
  ];

  for (const rootDir of roots) {
    const candidate = assertPathInsideVersionRoot(rootDir, declaredPath);
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function normalizeResult(value: unknown): KitMigrationResult {
  if (value === undefined || value === null || typeof value !== "object") {
    return {};
  }

  const result = value as {
    summary?: unknown;
    changedFiles?: unknown;
  };
  const normalized: KitMigrationResult = {};

  if (typeof result.summary === "string") {
    normalized.summary = result.summary;
  }

  if (
    Array.isArray(result.changedFiles) &&
    result.changedFiles.every(
      (entry): entry is string => typeof entry === "string",
    )
  ) {
    normalized.changedFiles = [...result.changedFiles];
  }

  return normalized;
}

async function loadKitMigrationRunner(
  codemodPath: string,
): Promise<KitMigrationRunner> {
  const moduleExports = (await import(
    pathToFileURL(codemodPath).href
  )) as MigrationModuleShape;
  const candidate =
    typeof moduleExports.run === "function"
      ? moduleExports.run
      : typeof moduleExports.default === "function"
      ? moduleExports.default
      : null;

  if (candidate === null) {
    throw new Error(
      `O codemod ${codemodPath} precisa exportar uma funcao \"run\" ou default.`,
    );
  }

  return candidate as KitMigrationRunner;
}

export async function loadKitMigrationPlan(
  fromMetaUrl: string,
  name: string,
  version: string,
): Promise<KitMigrationPlan | null> {
  const deprecation = await loadKitDeprecation(fromMetaUrl, name, version);

  if (deprecation === null || deprecation.successor === undefined) {
    return null;
  }

  const plan: KitMigrationPlan = {
    source: { name, version },
    deprecation,
    target: deprecation.successor,
  };

  if (typeof deprecation.successor.guide === "string") {
    plan.guide = {
      declaredPath: deprecation.successor.guide,
      resolvedPath: await resolveKitVersionAsset(
        fromMetaUrl,
        name,
        version,
        deprecation.successor.guide,
      ),
    };
  }

  if (deprecation.successor.codemod !== undefined) {
    plan.codemod = {
      declaredPath: deprecation.successor.codemod.path,
      description: deprecation.successor.codemod.description,
      resolvedPath: await resolveKitVersionAsset(
        fromMetaUrl,
        name,
        version,
        deprecation.successor.codemod.path,
      ),
    };
  }

  return plan;
}

export async function runKitMigrationCodemod(
  plan: KitMigrationPlan,
  options: {
    projectDir: string;
    dryRun: boolean;
    report(message: string): void;
  },
): Promise<KitMigrationResult> {
  if (plan.codemod === undefined) {
    throw new Error(
      `Nenhum codemod foi declarado para ${plan.source.name}@${plan.source.version}.`,
    );
  }

  if (plan.codemod.resolvedPath === null) {
    throw new Error(
      `O codemod ${plan.codemod.declaredPath} nao foi encontrado para ${plan.source.name}@${plan.source.version}.`,
    );
  }

  const runner = await loadKitMigrationRunner(plan.codemod.resolvedPath);
  const result = await runner({
    projectDir: options.projectDir,
    dryRun: options.dryRun,
    source: { ...plan.source },
    target: {
      name: plan.target.name,
      version: plan.target.version,
    },
    report: options.report,
  });

  return normalizeResult(result);
}
