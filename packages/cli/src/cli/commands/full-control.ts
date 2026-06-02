import { Command } from "commander";
import fs from "fs-extra";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { basename, dirname, join, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { promisify } from "node:util";
import pc from "picocolors";
import { formatDependency } from "../utils/formatDependency.js";
import {
  detectPackageManager,
  formatInstallCommand,
  installPackage,
  type PackageManager,
} from "../utils/package-manager.js";
import {
  kitFullControlAliasTarget,
  kitFullControlDir,
  kitToolingDestinationDir,
} from "../utils/paths.js";
import {
  describeKitSuccessor,
  getCopyDelivery,
  getCopyDependencies,
  getFullControlDependencies,
  isToolingKit,
  kitExposesImport,
  loadKitDeprecation,
  loadKitMeta,
  loadRegistry,
  parseKitArg,
  type KitDependency,
  type KitMeta,
  type RegistryEntry,
  resolveInstalledKitVersion,
  resolveKitPayloadDir,
  resolveKitSourceDir,
  resolveRegistryEntry,
  resolveVersion,
} from "../utils/resolve.js";
import {
  runCommandWithTelemetry,
  type TelemetryCommandTracker,
} from "../utils/telemetry.js";
import { upsertPathAlias } from "../utils/tsconfig.js";

const execFileAsync = promisify(execFile);

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

interface FullControlContext {
  parsed: { name: string; version?: string };
  entry: RegistryEntry;
  version: string;
  meta: KitMeta | null;
  installSpec: string;
  alreadyInstalled: boolean;
  packageManager: PackageManager;
  options: FullControlOptions;
  tracker: TelemetryCommandTracker;
}

export function createFullControlCommand(): Command {
  return new Command("fc")
    .description(
      "Adiciona um kit ao projeto atual: copia o codigo do kit para dentro do projeto. Kits importaveis ganham um alias local; kits do tipo tooling sao copiados para o placement declarado.",
    )
    .argument("<kit>", "Nome do kit no formato nome ou nome@versao")
    .option(
      "--dry-run",
      "Lista o que seria copiado e o resultado (alias/placement) sem escrever nada",
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

          const meta = await loadKitMeta(import.meta.url, parsed.name, version);
          const installSpec = `${entry.npmName}@${version}`;
          const installedVersion = resolveInstalledKitVersion(
            process.cwd(),
            entry.npmName,
          );
          const context: FullControlContext = {
            parsed,
            entry,
            version,
            meta,
            installSpec,
            alreadyInstalled: installedVersion === version,
            packageManager: detectPackageManager(process.cwd()),
            options,
            tracker,
          };

          if (isToolingKit(meta)) {
            tracker.set("kind", "tooling");
            await runToolingFullControl(context);
          } else {
            tracker.set("kind", "library");
            await runLibraryFullControl(context);
          }
        },
      });
    });
}

/** Print the install line shared by both strategies' dry-run previews. */
function printInstallPreview(context: FullControlContext): void {
  const { alreadyInstalled, options, installSpec, packageManager } = context;
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
}

/** Install the kit package when it is not already present, shared by both strategies. */
async function ensureKitInstalled(context: FullControlContext): Promise<void> {
  const { alreadyInstalled, options, installSpec, packageManager, tracker } =
    context;
  if (alreadyInstalled) return;

  if (options.install === false) {
    throw new Error(
      `${installSpec} nao esta instalado e --no-install foi usado. Instale com: ${formatInstallCommand(packageManager, installSpec)}`,
    );
  }

  console.log(pc.cyan(`Instalando ${installSpec} com ${packageManager}...`));
  try {
    await installPackage(process.cwd(), packageManager, installSpec);
  } catch (error) {
    throw new Error(
      `Falha ao instalar ${installSpec} com ${packageManager}: ${errorMessage(error)}`,
    );
  }
  tracker.set("installed", true);
}

/** Importable kits (foundation/capability): copy `src/` and register a tsconfig alias. */
async function runLibraryFullControl(
  context: FullControlContext,
): Promise<void> {
  const { parsed, entry, version, meta, options, tracker } = context;
  const destinationDir = kitFullControlDir(process.cwd(), parsed.name, version);

  if (options.dryRun) {
    console.log(
      pc.bold(`[dry-run] full-control para ${parsed.name}@${version}`),
    );
    printInstallPreview(context);

    console.log(`Destino: ${pc.cyan(destinationDir)}`);
    if (await fs.pathExists(destinationDir)) {
      console.log(
        pc.yellow(
          `O destino ja existe. Em execucao real, o CLI pedira confirmacao antes de sobrescrever.`,
        ),
      );
    }

    if (context.alreadyInstalled) {
      const sourceDir = await resolveKitSourceDir(process.cwd(), entry.npmName);
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

  await ensureKitInstalled(context);

  const sourceDir = await resolveKitSourceDir(process.cwd(), entry.npmName);
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
}

/**
 * Copy-only (`tooling`) kits: merge the kit's payload into the declared
 * placement (e.g. ".claude/"). Unlike library kits there is no tsconfig alias
 * and no `import` — the files become part of the project as-is. The placement
 * is a shared directory, so the payload is merged (existing siblings are
 * preserved); only files the kit ships can be overwritten, and only after
 * confirmation.
 */
async function runToolingFullControl(
  context: FullControlContext,
): Promise<void> {
  const { parsed, entry, version, meta, options, tracker } = context;

  const copy = getCopyDelivery(meta);
  if (copy === undefined) {
    throw new Error(
      `O kit ${parsed.name}@${version} e do tipo tooling mas nao declara delivery.copy no meta.json. O catalogo esta inconsistente.`,
    );
  }

  const destinationDir = kitToolingDestinationDir(
    process.cwd(),
    copy.placement,
  );
  const deps = getCopyDependencies(meta);

  if (options.dryRun) {
    console.log(
      pc.bold(
        `[dry-run] full-control (tooling) para ${parsed.name}@${version}`,
      ),
    );
    printInstallPreview(context);

    console.log(
      `Destino: ${pc.cyan(destinationDir)} ${pc.dim(`(placement: ${copy.placement})`)}`,
    );

    if (context.alreadyInstalled) {
      const sourceDir = await resolveKitPayloadDir(
        process.cwd(),
        entry.npmName,
        copy.source,
      );
      console.log(`Origem:  ${pc.cyan(sourceDir)}`);
      const conflicts = await findPayloadConflicts(sourceDir, destinationDir);
      const sample = await collectSampleFiles(sourceDir, 12);
      if (sample.files.length > 0) {
        console.log(pc.bold("Arquivos que seriam adicionados (amostra):"));
        for (const file of sample.files) {
          console.log(`  ${pc.dim(relative(sourceDir, file))}`);
        }
        if (sample.truncated) {
          console.log(pc.dim(`  ... e mais arquivos`));
        }
      }
      if (conflicts.length > 0) {
        console.log(
          pc.yellow(
            `${conflicts.length} arquivo(s) ja existem em ${copy.placement} e seriam sobrescritos (apos confirmacao).`,
          ),
        );
      }
    } else {
      console.log(
        pc.dim(
          `O payload seria copiado de node_modules/${entry.npmName}/${copy.source} apos a instalacao.`,
        ),
      );
    }

    console.log(
      pc.dim(
        "Kits do tipo tooling nao criam alias no tsconfig: os arquivos passam a fazer parte do projeto.",
      ),
    );
    if (copy.postInstall !== undefined) {
      console.log(
        pc.dim(
          `Apos a copia, o script ${copy.postInstall} seria executado em ${copy.placement}.`,
        ),
      );
    }
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

  await ensureKitInstalled(context);

  const sourceDir = await resolveKitPayloadDir(
    process.cwd(),
    entry.npmName,
    copy.source,
  );

  const conflicts = await findPayloadConflicts(sourceDir, destinationDir);
  if (conflicts.length > 0) {
    const shouldOverwrite = await confirmToolingOverwrite(
      copy.placement,
      conflicts,
    );
    if (!shouldOverwrite) {
      console.log(
        pc.yellow("Operacao cancelada. Nenhum arquivo foi alterado."),
      );
      tracker.set("cancelled", true);
      return;
    }
  }

  await fs.ensureDir(destinationDir);
  await fs.copy(sourceDir, destinationDir, { overwrite: true });

  console.log(pc.green(`Kit ${parsed.name} adicionado em ${copy.placement}`));
  console.log(`Origem: ${pc.cyan(sourceDir)}`);
  console.log(`Destino: ${pc.cyan(destinationDir)}`);

  if (copy.postInstall !== undefined) {
    await runPostInstall(destinationDir, copy.postInstall, tracker);
  }

  printExternalDepsWarning(deps);

  console.log("");
  console.log(pc.bold("Como usar agora:"));
  console.log(
    pc.dim(
      `Os arquivos do kit foram adicionados em ${copy.placement}. Nenhum import nem alias de tsconfig e necessario.`,
    ),
  );
  if (kitExposesImport(meta)) {
    console.log(
      pc.dim(
        `Este kit tambem expoe uma superficie importavel: voce pode usa-lo direto do node_modules com \`import { ... } from "${entry.npmName}"\`, sem copiar.`,
      ),
    );
  }
}

async function confirmToolingOverwrite(
  placement: string,
  conflicts: string[],
): Promise<boolean> {
  const readline = createInterface({ input, output });
  const preview = conflicts.slice(0, 10);

  try {
    console.log(
      pc.yellow(
        `Os seguintes arquivos ja existem em ${placement} e serao sobrescritos:`,
      ),
    );
    for (const file of preview) {
      console.log(`  ${pc.dim(file)}`);
    }
    if (conflicts.length > preview.length) {
      console.log(pc.dim(`  ... e mais ${conflicts.length - preview.length}`));
    }

    const answer = await readline.question(pc.yellow(`Continuar? (y/N) `));
    return /^(y|yes|s|sim)$/i.test(answer.trim());
  } finally {
    readline.close();
  }
}

/** Files in the payload that already exist at the destination (would be overwritten). */
export async function findPayloadConflicts(
  sourceDir: string,
  destinationDir: string,
): Promise<string[]> {
  const conflicts: string[] = [];
  for (const rel of await listRelativeFiles(sourceDir)) {
    if (await fs.pathExists(join(destinationDir, rel))) {
      conflicts.push(rel);
    }
  }
  return conflicts;
}

export async function listRelativeFiles(root: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        out.push(relative(root, full));
      }
    }
  }

  if (await fs.pathExists(root)) {
    await walk(root);
  }
  return out;
}

async function runPostInstall(
  destinationDir: string,
  postInstall: string,
  tracker: TelemetryCommandTracker,
): Promise<void> {
  const scriptPath = join(destinationDir, postInstall);
  if (!(await fs.pathExists(scriptPath))) {
    console.log(
      pc.yellow(
        `Aviso: o script de postInstall declarado (${postInstall}) nao foi encontrado em ${destinationDir}; pulando.`,
      ),
    );
    return;
  }

  console.log(pc.cyan(`Executando postInstall: ${postInstall}...`));
  try {
    await execFileAsync(process.execPath, [scriptPath], {
      cwd: destinationDir,
    });
    tracker.set("postInstall", true);
  } catch (error) {
    throw new Error(
      `Falha ao executar o postInstall (${postInstall}): ${errorMessage(error)}`,
    );
  }
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
