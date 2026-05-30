import { Command } from "commander";
import fs from "fs-extra";
import { randomUUID } from "node:crypto";
import { basename, dirname, join, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import pc from "picocolors";
import { formatDependency } from "../utils/formatDependency.js";
import {
  detectPackageManager,
  formatInstallCommand,
  installPackage,
} from "../utils/package-manager.js";
import {
  kitFullControlAliasTarget,
  kitFullControlDir,
} from "../utils/paths.js";
import {
  describeKitSuccessor,
  getFullControlDependencies,
  loadKitDeprecation,
  loadKitMeta,
  loadRegistry,
  parseKitArg,
  type KitDependency,
  resolveInstalledKitVersion,
  resolveKitSourceDir,
  resolveRegistryEntry,
  resolveVersion,
} from "../utils/resolve.js";
import { runCommandWithTelemetry } from "../utils/telemetry.js";
import { upsertPathAlias } from "../utils/tsconfig.js";

interface FullControlOptions {
  dryRun?: boolean;
  // Commander maps `--no-install` to `install: false` (defaults to true).
  install?: boolean;
}

async function confirmOverwrite(destinationDir: string): Promise<boolean> {
  const readline = createInterface({ input, output });

  try {
    const answer = await readline.question(
      pc.yellow(
        `O diretorio ${destinationDir} ja existe. Deseja sobrescrever? (y/N) `,
      ),
    );

    return /^(y|yes|s|sim)$/i.test(answer.trim());
  } finally {
    readline.close();
  }
}

function toInstallSpecifier(dependency: KitDependency): string {
  if (dependency.range.length === 0) {
    return dependency.name;
  }

  const specifier = `${dependency.name}@${dependency.range}`;
  return /\s/u.test(dependency.range) ? `"${specifier}"` : specifier;
}

function printExternalDepsWarning(deps: KitDependency[]): void {
  if (deps.length === 0) return;

  console.log("");
  console.log(pc.yellow(`Este kit requer as seguintes dependencias externas:`));
  for (const dep of deps) {
    console.log(`   ${formatDependency(dep)}`);
  }
  console.log("");
  console.log(pc.bold("Instale com:"));
  const installSpecifiers = [...new Set(deps.map(toInstallSpecifier))];
  console.log(pc.cyan(`   npm install ${installSpecifiers.join(" ")}`));
  console.log(
    pc.dim(
      `As peerDependencies do pacote cullet nao se aplicam no modo full-control: depois da copia, o Node resolve imports pelo node_modules do seu projeto.`,
    ),
  );
}

function createTransactionalPath(
  destinationDir: string,
  kind: "staging" | "backup",
): string {
  const parentDir = dirname(destinationDir);
  const directoryName = basename(destinationDir);
  return join(parentDir, `.${directoryName}.${kind}-${randomUUID()}`);
}

async function removeIfExists(path: string): Promise<void> {
  if (await fs.pathExists(path)) {
    await fs.remove(path);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "erro inesperado";
}

export async function copyDirectoryTransactional(
  sourceDir: string,
  destinationDir: string,
): Promise<void> {
  const parentDir = dirname(destinationDir);
  const stagingDir = createTransactionalPath(destinationDir, "staging");
  const backupDir = createTransactionalPath(destinationDir, "backup");
  const destinationExists = await fs.pathExists(destinationDir);

  await fs.ensureDir(parentDir);

  try {
    await fs.copy(sourceDir, stagingDir, { overwrite: true });
  } catch (error) {
    await removeIfExists(stagingDir);
    throw new Error(
      `Falha ao preparar a copia para ${destinationDir}: ${errorMessage(error)}`,
    );
  }

  if (!destinationExists) {
    try {
      await fs.move(stagingDir, destinationDir, { overwrite: false });
      return;
    } catch (error) {
      await removeIfExists(stagingDir);
      throw new Error(
        `Falha ao finalizar a copia para ${destinationDir}: ${errorMessage(
          error,
        )}`,
      );
    }
  }

  try {
    await fs.move(destinationDir, backupDir, { overwrite: false });
    await fs.move(stagingDir, destinationDir, { overwrite: false });
  } catch (error) {
    await removeIfExists(stagingDir);

    if (
      (await fs.pathExists(backupDir)) &&
      !(await fs.pathExists(destinationDir))
    ) {
      try {
        await fs.move(backupDir, destinationDir, { overwrite: false });
      } catch (restoreError) {
        throw new Error(
          `Falha ao sobrescrever ${destinationDir}; o backup em ${backupDir} nao pode ser restaurado automaticamente. Erro original: ${errorMessage(
            error,
          )}. Erro ao restaurar: ${errorMessage(restoreError)}.`,
        );
      }
    }

    throw new Error(
      `Falha ao sobrescrever ${destinationDir}. O conteudo anterior foi preservado. Detalhe: ${errorMessage(
        error,
      )}.`,
    );
  }

  try {
    await removeIfExists(backupDir);
  } catch {
    // Best-effort cleanup: the destination is already in place.
  }
}

export function createFullControlCommand(): Command {
  return new Command("fc")
    .description(
      "Copia um kit para dentro do projeto atual e atualiza o alias local",
    )
    .argument("<kit>", "Nome do kit no formato nome ou nome@versao")
    .option(
      "--dry-run",
      "Lista o que seria copiado e o alias resultante sem escrever nada",
    )
    .option(
      "--no-install",
      "Nao instala o pacote do kit; assume que ja esta presente no projeto",
    )
    .action(async (kit: string, options: FullControlOptions) => {
      await runCommandWithTelemetry({
        fromMetaUrl: import.meta.url,
        command: "fc",
        async handler(tracker) {
          tracker.set("requestedKit", kit);
          tracker.set("dryRun", Boolean(options.dryRun));

          const parsed = parseKitArg(kit);
          const registry = await loadRegistry(import.meta.url);
          const entry = resolveRegistryEntry(registry, parsed.name);
          const version = resolveVersion(parsed.name, entry, parsed.version);
          tracker.set("kit", parsed.name);
          tracker.set("resolvedVersion", version);

          const deprecation = await loadKitDeprecation(
            import.meta.url,
            parsed.name,
            version,
          );
          if (deprecation) {
            console.log(
              pc.yellow(
                `Aviso: ${parsed.name}@${version} esta deprecated desde ${deprecation.since}. Motivo: ${deprecation.reason}`,
              ),
            );
            if (deprecation.successor) {
              for (const detail of describeKitSuccessor(
                deprecation.successor,
              )) {
                console.log(pc.yellow(detail));
              }
            }
          }

          const installSpec = `${entry.npmName}@${version}`;
          const installedVersion = resolveInstalledKitVersion(
            process.cwd(),
            entry.npmName,
          );
          const alreadyInstalled = installedVersion === version;
          const packageManager = detectPackageManager(process.cwd());
          const destinationDir = kitFullControlDir(
            process.cwd(),
            parsed.name,
            version,
          );

          if (options.dryRun) {
            console.log(
              pc.bold(`[dry-run] full-control para ${parsed.name}@${version}`),
            );

            if (alreadyInstalled) {
              console.log(
                pc.dim(
                  `${installSpec} ja esta instalado; nenhuma instalacao seria necessaria.`,
                ),
              );
            } else if (options.install === false) {
              console.log(
                pc.yellow(
                  `--no-install: o pacote ${installSpec} nao seria instalado. Garanta que ele ja esteja presente.`,
                ),
              );
            } else {
              console.log(
                pc.dim(
                  `Instalaria ${installSpec} com: ${formatInstallCommand(packageManager, installSpec)}`,
                ),
              );
            }

            console.log(`Destino: ${pc.cyan(destinationDir)}`);
            if (await fs.pathExists(destinationDir)) {
              console.log(
                pc.yellow(
                  `O destino ja existe. Em execucao real, o CLI pedira confirmacao antes de sobrescrever.`,
                ),
              );
            }

            if (alreadyInstalled) {
              const sourceDir = await resolveKitSourceDir(
                process.cwd(),
                entry.npmName,
              );
              console.log(`Origem:  ${pc.cyan(sourceDir)}`);
              const sample = await collectSampleFiles(sourceDir, 12);
              if (sample.files.length > 0) {
                console.log(pc.bold("Arquivos que seriam copiados (amostra):"));
                for (const file of sample.files) {
                  console.log(`  ${pc.dim(relative(sourceDir, file))}`);
                }
                if (sample.truncated) {
                  console.log(pc.dim(`  ... e mais arquivos`));
                }
              }
            } else {
              console.log(
                pc.dim(
                  `O fonte do kit seria copiado de node_modules/${entry.npmName}/src apos a instalacao.`,
                ),
              );
            }

            const aliasPreview = await upsertPathAlias(
              process.cwd(),
              entry.npmName,
              kitFullControlAliasTarget(parsed.name, version),
              { dryRun: true },
            );

            printAliasOutcome(aliasPreview, { dryRun: true });

            const meta = await loadKitMeta(
              import.meta.url,
              parsed.name,
              version,
            );
            const deps = getFullControlDependencies(meta);
            if (deps.length > 0) {
              console.log("");
              console.log(
                pc.dim(
                  `Apos a copia real, voce precisara instalar: ${deps
                    .map(formatDependency)
                    .join(", ")}`,
                ),
              );
            }
            return;
          }

          if (!alreadyInstalled) {
            if (options.install === false) {
              throw new Error(
                `${installSpec} nao esta instalado e --no-install foi usado. Instale com: ${formatInstallCommand(packageManager, installSpec)}`,
              );
            }

            console.log(
              pc.cyan(`Instalando ${installSpec} com ${packageManager}...`),
            );
            try {
              await installPackage(process.cwd(), packageManager, installSpec);
            } catch (error) {
              throw new Error(
                `Falha ao instalar ${installSpec} com ${packageManager}: ${errorMessage(error)}`,
              );
            }
            tracker.set("installed", true);
          }

          const sourceDir = await resolveKitSourceDir(
            process.cwd(),
            entry.npmName,
          );

          const destinationExists = await fs.pathExists(destinationDir);

          if (destinationExists) {
            const shouldOverwrite = await confirmOverwrite(destinationDir);

            if (!shouldOverwrite) {
              console.log(
                pc.yellow("Operacao cancelada. Nenhum arquivo foi alterado."),
              );
              tracker.set("cancelled", true);
              return;
            }
          }

          await copyDirectoryTransactional(sourceDir, destinationDir);

          const aliasResult = await upsertPathAlias(
            process.cwd(),
            entry.npmName,
            kitFullControlAliasTarget(parsed.name, version),
          );

          console.log(
            pc.green(
              `Kit ${parsed.name} copiado para ./cullet/${parsed.name}@${version}/`,
            ),
          );
          console.log(`Origem: ${pc.cyan(sourceDir)}`);
          console.log(`Destino: ${pc.cyan(destinationDir)}`);

          printAliasOutcome(aliasResult, { dryRun: false });

          const meta = await loadKitMeta(import.meta.url, parsed.name, version);
          const deps = getFullControlDependencies(meta);
          printExternalDepsWarning(deps);

          console.log("");
          console.log(pc.bold("Como usar agora:"));
          console.log(pc.cyan(`import { ... } from "${entry.npmName}";`));
          console.log(
            pc.dim(
              "O alias local aponta para a copia em ./cullet/, permitindo editar o kit dentro do projeto.",
            ),
          );
        },
      });
    });
}

async function collectSampleFiles(
  root: string,
  limit: number,
): Promise<{ files: string[]; truncated: boolean }> {
  const files: string[] = [];
  let truncated = false;

  async function walk(dir: string): Promise<void> {
    if (files.length >= limit) {
      truncated = true;
      return;
    }
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= limit) {
        truncated = true;
        return;
      }
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        files.push(full);
      }
    }
  }

  try {
    await walk(root);
  } catch {
    // ignore — sampling is best-effort
  }

  return { files, truncated };
}

function printAliasOutcome(
  aliasResult: Awaited<ReturnType<typeof upsertPathAlias>>,
  options: { dryRun: boolean },
): void {
  const prefix = options.dryRun ? "[dry-run] " : "";

  if (aliasResult.status === "missing-tsconfig") {
    console.log(
      pc.yellow(
        `${prefix}Nenhum tsconfig.json foi encontrado. O alias local nao sera registrado automaticamente.`,
      ),
    );
    return;
  }

  if (
    aliasResult.baseUrlWasExplicit &&
    aliasResult.consumerBaseUrl !== undefined &&
    aliasResult.consumerBaseUrl !== "."
  ) {
    console.log("");
    console.log(
      pc.yellow(
        `Aviso: compilerOptions.baseUrl do seu tsconfig esta como "${aliasResult.consumerBaseUrl}" (nao "."), e o paths foi adicionado mesmo assim.`,
      ),
    );
    console.log(
      pc.yellow(
        `O TypeScript resolve "paths" relativos a baseUrl. O alias aponta para "${aliasResult.target}", entao confirme se o caminho relativo bate com a estrutura do seu projeto.`,
      ),
    );
  }

  const actionLabel = options.dryRun
    ? aliasResult.status === "unchanged"
      ? "ja esta correto"
      : aliasResult.status === "updated"
        ? "seria atualizado"
        : "seria criado"
    : aliasResult.status === "created"
      ? "criado"
      : aliasResult.status === "updated"
        ? "atualizado"
        : "mantido";

  console.log(
    pc.green(
      `${prefix}Alias ${actionLabel}: ${aliasResult.alias} -> ${aliasResult.target}`,
    ),
  );
}
