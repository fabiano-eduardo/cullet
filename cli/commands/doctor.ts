import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, win32 } from "node:path";
import pc from "picocolors";
import { inspectTsconfig } from "../utils/tsconfig.js";
import { runCommandWithTelemetry } from "../utils/telemetry.js";

interface DoctorOptions {
  cwd?: string;
}

type Severity = "error" | "warn" | "info";

interface Finding {
  severity: Severity;
  code: string;
  message: string;
  hint?: string;
}

const MIN_TS_MAJOR = 5;
const MIN_TS_MINOR = 0;
const MIN_TS_DISPLAY = "5.0.0";

const ACCEPTED_MODULE_RESOLUTIONS = new Set([
  "bundler",
  "node16",
  "nodenext",
  "node20",
]);

const KNOWN_INCOMPATIBLE_MODULE_RESOLUTIONS = new Set([
  "node",
  "node10",
  "classic",
]);

interface PackageJsonLike {
  type?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function findDeclaredTypescriptVersion(pkg: PackageJsonLike): string | null {
  const sources: (Record<string, string> | undefined)[] = [
    pkg.dependencies,
    pkg.devDependencies,
    pkg.peerDependencies,
  ];
  for (const source of sources) {
    if (source && typeof source.typescript === "string") {
      return source.typescript;
    }
  }
  return null;
}

function parseSemverFromRange(
  range: string,
): { major: number; minor: number } | null {
  const match = /(\d+)\.(\d+)/.exec(range);
  if (!match) return null;
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
  };
}

async function detectTypescriptVersion(projectRoot: string): Promise<{
  source: "node_modules" | "package.json";
  raw: string;
  major: number;
  minor: number;
} | null> {
  const installedPath = join(
    projectRoot,
    "node_modules",
    "typescript",
    "package.json",
  );
  const installedPkg = await readJsonFile<{ version?: string }>(installedPath);
  if (installedPkg?.version) {
    const parsed = parseSemverFromRange(installedPkg.version);
    if (parsed) {
      return { source: "node_modules", raw: installedPkg.version, ...parsed };
    }
  }

  const consumerPkg = await readJsonFile<PackageJsonLike>(
    join(projectRoot, "package.json"),
  );
  if (consumerPkg) {
    const declared = findDeclaredTypescriptVersion(consumerPkg);
    if (declared) {
      const parsed = parseSemverFromRange(declared);
      if (parsed) {
        return { source: "package.json", raw: declared, ...parsed };
      }
    }
  }

  return null;
}

function readModuleResolution(
  compilerOptions: Record<string, unknown> | undefined,
): { raw: string; normalized: string } | null {
  if (!compilerOptions) return null;
  const value = compilerOptions.moduleResolution;
  if (typeof value !== "string") return null;
  return { raw: value, normalized: value.toLowerCase() };
}

function readCompilerOptions(
  config: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  if (!config) return undefined;
  const compilerOptions = (config as { compilerOptions?: unknown })
    .compilerOptions;
  if (typeof compilerOptions !== "object" || compilerOptions === null) {
    return undefined;
  }
  return compilerOptions as Record<string, unknown>;
}

function isKitDirAssumingEsm(/* placeholder for future per-kit detection */): boolean {
  // Cullet kits são publicados como ESM (package.json do cullet tem "type": "module"
  // e os exports apontam só para "import"). Assumimos que todo kit assume ESM.
  return true;
}

function isAbsoluteProjectPath(value: string): boolean {
  return isAbsolute(value) || win32.isAbsolute(value);
}

export function resolveDoctorProjectRoot(
  baseCwd: string,
  optionCwd?: string,
): string {
  if (!optionCwd) return baseCwd;
  return isAbsoluteProjectPath(optionCwd)
    ? optionCwd
    : join(baseCwd, optionCwd);
}

export function createDoctorCommand(): Command {
  return new Command("doctor")
    .description(
      "Audita o projeto consumidor procurando configuracoes incompativeis com o cullet",
    )
    .option(
      "--cwd <path>",
      "Diretorio do projeto a auditar (padrao: process.cwd())",
    )
    .action(async (options: DoctorOptions) => {
      await runCommandWithTelemetry({
        fromMetaUrl: import.meta.url,
        command: "doctor",
        async handler(tracker) {
          tracker.set("cwdOverride", options.cwd !== undefined);

          const projectRoot = resolveDoctorProjectRoot(
            process.cwd(),
            options.cwd,
          );
          const findings: Finding[] = [];

          const tsconfigInspection = await inspectTsconfig(projectRoot);
          if (tsconfigInspection === null) {
            findings.push({
              severity: "warn",
              code: "tsconfig-missing",
              message:
                "Nenhum tsconfig.json foi encontrado no projeto. Sem ele, o cullet nao consegue registrar aliases nem garantir resolucao correta.",
              hint: 'Crie um tsconfig.json na raiz com moduleResolution "bundler" (ou "nodenext") e baseUrl ".".',
            });
          } else {
            const compilerOptions = readCompilerOptions(
              tsconfigInspection.config as Record<string, unknown>,
            );
            const moduleResolution = readModuleResolution(compilerOptions);

            if (moduleResolution === null) {
              findings.push({
                severity: "warn",
                code: "module-resolution-absent",
                message:
                  "compilerOptions.moduleResolution nao esta definido. O TypeScript pode cair em uma resolucao classica que ignora os exports do cullet.",
                hint: 'Defina "moduleResolution": "bundler" (ou "nodenext") no tsconfig.json.',
              });
            } else if (
              KNOWN_INCOMPATIBLE_MODULE_RESOLUTIONS.has(
                moduleResolution.normalized,
              )
            ) {
              findings.push({
                severity: "error",
                code: "module-resolution-incompatible",
                message: `compilerOptions.moduleResolution="${moduleResolution.raw}" nao le os subpath exports do cullet.`,
                hint: 'Use "bundler" (Vite/tsdown/esbuild) ou "nodenext" (Node ESM). Esses sao os modos que respeitam o campo "exports" do package.json do cullet.',
              });
            } else if (
              !ACCEPTED_MODULE_RESOLUTIONS.has(moduleResolution.normalized)
            ) {
              findings.push({
                severity: "warn",
                code: "module-resolution-unverified",
                message: `compilerOptions.moduleResolution="${moduleResolution.raw}" nao foi validado com o cullet.`,
                hint: 'O cullet e testado contra "bundler" e "nodenext". Outros modos podem funcionar, mas a equivalencia nao e garantida.',
              });
            }

            if (compilerOptions) {
              const hasPaths =
                typeof compilerOptions.paths === "object" &&
                compilerOptions.paths !== null &&
                !Array.isArray(compilerOptions.paths);
              const hasBaseUrl = typeof compilerOptions.baseUrl === "string";

              if (hasPaths && !hasBaseUrl) {
                findings.push({
                  severity: "warn",
                  code: "paths-without-baseurl",
                  message:
                    "compilerOptions.paths esta definido sem compilerOptions.baseUrl. Em TypeScript < 5.0, paths so e resolvido com baseUrl explicito.",
                  hint: 'Adicione "baseUrl": "." ao tsconfig para garantir compatibilidade com versoes antigas do TS.',
                });
              }
            }
          }

          const consumerPkg = await readJsonFile<PackageJsonLike>(
            join(projectRoot, "package.json"),
          );
          if (consumerPkg === null) {
            findings.push({
              severity: "warn",
              code: "package-json-missing",
              message:
                "Nenhum package.json foi encontrado no diretorio raiz. Verifique se voce esta executando o doctor a partir da raiz do projeto.",
            });
          } else {
            const kitAssumesEsm = isKitDirAssumingEsm();
            if (kitAssumesEsm && consumerPkg.type !== "module") {
              findings.push({
                severity: "error",
                code: "package-type-not-module",
                message:
                  'Os kits do cullet sao publicados como ESM, mas o seu package.json nao declara "type": "module".',
                hint: 'Adicione "type": "module" ao package.json, ou consuma os kits via bundler com interop CJS->ESM.',
              });
            }
          }

          const ts = await detectTypescriptVersion(projectRoot);
          if (ts === null) {
            findings.push({
              severity: "info",
              code: "typescript-not-detected",
              message:
                "Nao foi possivel detectar a versao do TypeScript (nem em node_modules, nem nas dependencias do package.json).",
              hint: `Os kits sao testados com TypeScript >= ${MIN_TS_DISPLAY}.`,
            });
          } else {
            const tooOld =
              ts.major < MIN_TS_MAJOR ||
              (ts.major === MIN_TS_MAJOR && ts.minor < MIN_TS_MINOR);
            if (tooOld) {
              findings.push({
                severity: "error",
                code: "typescript-version-low",
                message: `TypeScript ${ts.raw} detectado (origem: ${ts.source}). Minimo testado: ${MIN_TS_DISPLAY}.`,
                hint: `Atualize com: npm install -D typescript@latest`,
              });
            }
          }

          const errorCount = findings.filter(
            (finding) => finding.severity === "error",
          ).length;
          const warnCount = findings.filter(
            (finding) => finding.severity === "warn",
          ).length;
          tracker.set("findingCount", findings.length);
          tracker.set("errorCount", errorCount);
          tracker.set("warnCount", warnCount);

          report(findings);
          if (errorCount > 0) {
            process.exitCode = 1;
          }
        },
      });
    });
}

function report(findings: Finding[]): void {
  if (findings.length === 0) {
    console.log(
      pc.green(
        "cullet doctor: nenhum problema detectado. Tudo certo para usar o cullet.",
      ),
    );
    return;
  }

  const errors = findings.filter((entry) => entry.severity === "error");
  const warns = findings.filter((entry) => entry.severity === "warn");
  const infos = findings.filter((entry) => entry.severity === "info");

  console.log(
    pc.bold(
      `cullet doctor: ${errors.length} erro(s), ${warns.length} aviso(s), ${infos.length} nota(s).`,
    ),
  );

  for (const finding of findings) {
    const tag =
      finding.severity === "error"
        ? pc.red("error")
        : finding.severity === "warn"
        ? pc.yellow("warn ")
        : pc.cyan("info ");
    console.log("");
    console.log(`${tag} ${pc.bold(`[${finding.code}]`)} ${finding.message}`);
    if (finding.hint) {
      console.log(`      ${pc.dim(finding.hint)}`);
    }
  }
}
