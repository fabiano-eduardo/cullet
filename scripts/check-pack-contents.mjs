#!/usr/bin/env node
// Verifica que um tarball real gerado por `npm pack` contem os arquivos
// criticos para um pacote workspace do cullet funcionar quando publicado.
//
// Uso:
//   node scripts/check-pack-contents.mjs [--package packages/cli] [tarball.tgz]
//   node scripts/check-pack-contents.mjs --all

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  expectedTarballName,
  readPackageManifest,
} from "./package-tarball.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "..");

function parseArgs(argv = process.argv.slice(2)) {
  let packageDir = process.cwd();
  let tarballPath;
  let validateAll = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--all") {
      validateAll = true;
      continue;
    }

    if (arg === "--package") {
      packageDir = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith("--package=")) {
      packageDir = arg.slice("--package=".length);
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Flag nao reconhecida: ${arg}`);
    }

    if (tarballPath !== undefined) {
      throw new Error(
        `Apenas um caminho de tarball pode ser informado: ${arg}`,
      );
    }

    tarballPath = arg;
  }

  return {
    packageRoot: resolve(process.cwd(), packageDir),
    tarballPath,
    validateAll,
  };
}

function normalizeManifestPath(pathLike) {
  if (typeof pathLike !== "string") return null;

  return pathLike.replace(/^\.\//, "");
}

function getWorkspacePatterns(rootManifest) {
  if (Array.isArray(rootManifest.workspaces)) {
    return rootManifest.workspaces;
  }

  if (
    rootManifest.workspaces !== null &&
    typeof rootManifest.workspaces === "object" &&
    Array.isArray(rootManifest.workspaces.packages)
  ) {
    return rootManifest.workspaces.packages;
  }

  return [];
}

function shouldValidateAllByDefault(packageRoot) {
  const packageJsonPath = resolve(packageRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    return false;
  }

  const pkg = readPackageManifest(packageJsonPath);
  return pkg.private === true && getWorkspacePatterns(pkg).length > 0;
}

function collectWorkspacePackageRoots(rootDir = repoRoot) {
  const rootManifestPath = resolve(rootDir, "package.json");
  if (!existsSync(rootManifestPath)) {
    throw new Error(`package.json nao encontrado em ${rootDir}.`);
  }

  const rootManifest = readPackageManifest(rootManifestPath);
  const packageRoots = new Set();

  for (const pattern of getWorkspacePatterns(rootManifest)) {
    if (typeof pattern !== "string") continue;

    if (pattern.endsWith("/*")) {
      const workspaceDir = resolve(rootDir, pattern.slice(0, -2));
      if (!existsSync(workspaceDir) || !statSync(workspaceDir).isDirectory()) {
        continue;
      }

      for (const entry of readdirSync(workspaceDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;

        const candidate = resolve(workspaceDir, entry.name);
        const manifestPath = resolve(candidate, "package.json");
        if (!existsSync(manifestPath)) continue;

        const manifest = readPackageManifest(manifestPath);
        if (manifest.private === true) continue;
        packageRoots.add(candidate);
      }

      continue;
    }

    const candidate = resolve(rootDir, pattern);
    const manifestPath = resolve(candidate, "package.json");
    if (!existsSync(manifestPath)) continue;

    const manifest = readPackageManifest(manifestPath);
    if (manifest.private === true) continue;
    packageRoots.add(candidate);
  }

  return [...packageRoots].sort((left, right) =>
    relative(rootDir, left).localeCompare(relative(rootDir, right)),
  );
}

function resolveTarballPath(rawPath) {
  if (typeof rawPath === "string" && rawPath.trim().length > 0) {
    return resolve(process.cwd(), rawPath.trim());
  }

  return null;
}

function collectExportTargets(exportsValue, required) {
  if (typeof exportsValue === "string") {
    const normalized = normalizeManifestPath(exportsValue);
    if (normalized !== null) required.add(normalized);
    return;
  }

  if (exportsValue === null || typeof exportsValue !== "object") {
    return;
  }

  for (const value of Object.values(exportsValue)) {
    collectExportTargets(value, required);
  }
}

function collectBinTargets(binValue, required) {
  if (typeof binValue === "string") {
    const normalized = normalizeManifestPath(binValue);
    if (normalized !== null) required.add(normalized);
    return;
  }

  if (binValue === null || typeof binValue !== "object") {
    return;
  }

  for (const value of Object.values(binValue)) {
    const normalized = normalizeManifestPath(value);
    if (normalized !== null) required.add(normalized);
  }
}

function isFileEntry(packageRoot, relativePath) {
  const absolutePath = resolve(packageRoot, relativePath);
  return existsSync(absolutePath) && statSync(absolutePath).isFile();
}

function collectDirectoryEntries(packageRoot, relativeDir) {
  const directoryPath = resolve(packageRoot, relativeDir);
  if (!existsSync(directoryPath) || !statSync(directoryPath).isDirectory()) {
    return [];
  }

  const collected = [];
  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const relativeEntry = normalizeTarballEntry(
      relative(packageRoot, resolve(directoryPath, entry.name)),
    );

    if (entry.isDirectory()) {
      collected.push(...collectDirectoryEntries(packageRoot, relativeEntry));
      continue;
    }

    if (!entry.isFile() || isTestOnlyEntry(relativeEntry)) {
      continue;
    }

    collected.push(relativeEntry);
  }

  return collected;
}

async function collectRequiredEntries(packageRoot) {
  const packageJsonPath = resolve(packageRoot, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(
      `package.json nao encontrado em ${packageRoot}. Use --package <dir> para apontar para um pacote workspace.`,
    );
  }

  const pkg = readPackageManifest(packageJsonPath);
  const required = new Set(["package.json", "README.md"]);

  const mainPath = normalizeManifestPath(pkg.main);
  if (mainPath !== null) required.add(mainPath);

  const typesPath = normalizeManifestPath(pkg.types);
  if (typesPath !== null) required.add(typesPath);

  collectBinTargets(pkg.bin, required);
  collectExportTargets(pkg.exports, required);

  for (const fileEntry of pkg.files ?? []) {
    const normalized = normalizeManifestPath(fileEntry);
    if (normalized === null || normalized.startsWith("!")) {
      continue;
    }

    if (isFileEntry(packageRoot, normalized)) {
      required.add(normalized);
      continue;
    }

    for (const directoryEntry of collectDirectoryEntries(
      packageRoot,
      normalized,
    )) {
      required.add(directoryEntry);
    }
  }

  if ((pkg.files ?? []).includes("src")) {
    const metaPath = resolve(packageRoot, "meta.json");
    if (existsSync(metaPath)) {
      const meta = JSON.parse(await readFile(metaPath, "utf8"));
      const entryPoint = normalizeManifestPath(meta.entryPoint) ?? "index.ts";
      required.add(
        entryPoint.startsWith("src/") ? entryPoint : `src/${entryPoint}`,
      );
    } else {
      required.add("src/index.ts");
    }
  }

  return {
    packageName: pkg.name,
    required,
  };
}

function isTestOnlyEntry(entry) {
  return (
    /(^|\/)__tests__(\/|$)/.test(entry) || /\.(spec|test)\.[^/]+$/u.test(entry)
  );
}

function stripSourceMapSuffix(entry) {
  return entry.endsWith(".map") ? entry.slice(0, -4) : entry;
}

function normalizeTarballEntry(pathLike) {
  return pathLike.replace(/\\/g, "/");
}

function collectEntriesFromDryRun(packageRoot) {
  const result = spawnSync("npm", ["pack", "--json", "--dry-run"], {
    cwd: packageRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(
      result.stderr || result.stdout || "npm pack --dry-run falhou.",
    );
  }

  let parsed;

  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error(
      `Falha ao interpretar a saida do npm pack --dry-run em ${packageRoot}.`,
    );
  }

  const packInfo = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!packInfo || !Array.isArray(packInfo.files)) {
    throw new Error(
      `npm pack --dry-run nao retornou a lista de arquivos para ${packageRoot}.`,
    );
  }

  return {
    sourceLabel:
      packInfo.filename ??
      `${expectedTarballName(readPackageManifest(resolve(packageRoot, "package.json")))} (dry-run)`,
    entries: packInfo.files
      .map((entry) => normalizeTarballEntry(entry.path))
      .filter(Boolean),
  };
}

function collectEntriesFromTarball(packageRoot, tarballPath) {
  if (!existsSync(tarballPath)) {
    return {
      exitCode: 1,
      sourceLabel: basename(tarballPath),
      entries: [],
      error: `Tarball nao encontrado: ${tarballPath}`,
    };
  }

  const result = spawnSync("tar", ["-tf", tarballPath], {
    cwd: packageRoot,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    return {
      exitCode: result.status ?? 1,
      sourceLabel: basename(tarballPath),
      entries: [],
      error: `Falha ao listar o conteudo de ${basename(tarballPath)}.\n${result.stderr}`,
    };
  }

  return {
    exitCode: 0,
    sourceLabel: basename(tarballPath),
    entries: result.stdout
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => entry.replace(/^package\//, ""))
      .filter(Boolean),
  };
}

function collectRelativeImportSpecifiers(sourceText) {
  const specifiers = [];
  const pattern =
    /from\s+["'](?<from>\.[^"']+)["']|import\s*\(\s*["'](?<dynamic>\.[^"']+)["']\s*\)|import\s+["'](?<side>\.[^"']+)["']/gu;
  let match;

  while ((match = pattern.exec(sourceText)) !== null) {
    const specifier =
      match.groups?.from ?? match.groups?.dynamic ?? match.groups?.side;
    if (specifier !== undefined) {
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

function resolveReferencedCandidates(packageRoot, currentEntry, specifier) {
  const resolvedEntry = normalizeTarballEntry(
    relative(
      packageRoot,
      resolve(packageRoot, dirname(currentEntry), specifier),
    ),
  );
  const candidates = [resolvedEntry];

  if (currentEntry.endsWith(".d.ts") && resolvedEntry.endsWith(".js")) {
    candidates.unshift(resolvedEntry.replace(/\.js$/u, ".d.ts"));
  }

  return candidates;
}

async function collectReferencedDistEntries(packageRoot, entries, required) {
  const entrySet = new Set(entries);
  const referenced = new Set();
  const missing = new Set();
  const visited = new Set();
  const queue = [...required].filter(
    (entry) => entry.startsWith("dist/") && /\.(?:[cm]?js|d\.ts)$/u.test(entry),
  );

  while (queue.length > 0) {
    const currentEntry = queue.pop();
    if (currentEntry === undefined || visited.has(currentEntry)) {
      continue;
    }

    visited.add(currentEntry);

    const currentPath = resolve(packageRoot, currentEntry);
    if (!existsSync(currentPath) || !statSync(currentPath).isFile()) {
      continue;
    }

    const sourceText = await readFile(currentPath, "utf8");
    for (const specifier of collectRelativeImportSpecifiers(sourceText)) {
      const candidates = resolveReferencedCandidates(
        packageRoot,
        currentEntry,
        specifier,
      ).filter((candidate) => candidate.startsWith("dist/"));

      const resolvedEntry = candidates.find((candidate) =>
        entrySet.has(candidate),
      );
      if (resolvedEntry === undefined) {
        if (candidates[0] !== undefined) {
          missing.add(candidates[0]);
        }
        continue;
      }

      if (!referenced.has(resolvedEntry)) {
        referenced.add(resolvedEntry);
        if (/\.(?:[cm]?js|d\.ts)$/u.test(resolvedEntry)) {
          queue.push(resolvedEntry);
        }
      }
    }
  }

  return { referenced, missing };
}

function isUnexpectedRootDistChunk(entry, allowedDistEntries) {
  if (!/^dist\/[^/]+\.(?:[cm]?js|d\.ts)(?:\.map)?$/u.test(entry)) {
    return false;
  }

  return !allowedDistEntries.has(stripSourceMapSuffix(entry));
}

function findForbiddenEntries(entries, allowedDistEntries) {
  return entries.filter(
    (entry) =>
      entry.startsWith("tests/") ||
      entry.startsWith("packages/") ||
      entry.startsWith("kits/") ||
      entry.startsWith("tmp/") ||
      entry === ".gitkeep" ||
      (entry.startsWith("registry/") && entry !== "registry/index.json") ||
      isTestOnlyEntry(entry) ||
      isUnexpectedRootDistChunk(entry, allowedDistEntries),
  );
}

async function validatePackage(packageRoot, rawTarballPath) {
  const tarballPath = resolveTarballPath(rawTarballPath);
  const entrySource = tarballPath
    ? collectEntriesFromTarball(packageRoot, tarballPath)
    : collectEntriesFromDryRun(packageRoot);

  if (entrySource.exitCode) {
    console.error(entrySource.error);
    return entrySource.exitCode;
  }

  const { entries, sourceLabel } = entrySource;
  const { packageName, required } = await collectRequiredEntries(packageRoot);
  const missing = [...required].filter(
    (expected) => !entries.includes(expected),
  );
  const { referenced, missing: missingReferenced } =
    await collectReferencedDistEntries(packageRoot, entries, required);
  const allowedDistEntries = new Set([...required, ...referenced]);
  const forbidden = findForbiddenEntries(entries, allowedDistEntries);

  for (const referencedEntry of missingReferenced) {
    if (!missing.includes(referencedEntry)) {
      missing.push(referencedEntry);
    }
  }

  if (missing.length > 0 || forbidden.length > 0) {
    if (missing.length > 0) {
      console.error(`[${packageName}] Arquivos esperados ausentes do tarball:`);
      for (const file of missing) console.error(`  - ${file}`);
    }
    if (forbidden.length > 0) {
      console.error(
        `[${packageName}] Arquivos proibidos presentes no tarball:`,
      );
      for (const file of forbidden) console.error(`  - ${file}`);
    }
    return 1;
  }

  console.log(
    `Tarball OK (${sourceLabel}): ${packageName} com ${entries.length} arquivo(s), ${required.size} caminho(s) criticos verificados.`,
  );
  return 0;
}

export async function main(argv = process.argv.slice(2)) {
  const {
    packageRoot,
    tarballPath: rawTarballPath,
    validateAll,
  } = parseArgs(argv);

  if (validateAll && rawTarballPath !== undefined) {
    console.error("Nao combine --all com um tarball explicito.");
    return 1;
  }

  if (
    validateAll ||
    (rawTarballPath === undefined && shouldValidateAllByDefault(packageRoot))
  ) {
    const packageRoots = collectWorkspacePackageRoots(repoRoot);
    if (packageRoots.length === 0) {
      console.error("Nenhum pacote publicavel encontrado no workspace.");
      return 1;
    }

    let hasFailures = false;
    for (const workspacePackageRoot of packageRoots) {
      const exitCode = await validatePackage(workspacePackageRoot);
      if (exitCode !== 0) {
        hasFailures = true;
      }
    }

    return hasFailures ? 1 : 0;
  }

  return validatePackage(packageRoot, rawTarballPath);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    const exitCode = await main();
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
