import { Command } from "commander";
import fs from "fs-extra";
import { join, relative } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import pc from "picocolors";
import {
  kitFullControlAliasTarget,
  kitFullControlDir,
} from "../utils/paths.js";
import {
  loadKitDeprecation,
  loadKitMeta,
  loadRegistry,
  parseKitArg,
  resolveKitSourceDir,
  resolveRegistryEntry,
  resolveVersion,
} from "../utils/resolve.js";
import { upsertPathAlias } from "../utils/tsconfig.js";

interface FullControlOptions {
  dryRun?: boolean;
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

function printExternalDepsWarning(name: string, deps: string[]): void {
  if (deps.length === 0) return;

  console.log("");
  console.log(
    pc.yellow(`Este kit requer as seguintes dependencias externas:`),
  );
  for (const dep of deps) {
    console.log(`   ${dep}`);
  }
  console.log("");
  console.log(pc.bold("Instale com:"));
  const names = deps
    .map((dep) => dep.split(/\s+/)[0])
    .filter((value, index, all) => all.indexOf(value) === index);
  console.log(pc.cyan(`   npm install ${names.join(" ")}`));
  console.log(
    pc.dim(
      `As peerDependencies do pacote cullet nao se aplicam no modo full-control: depois da copia, o Node resolve imports pelo node_modules do seu projeto.`,
    ),
  );
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
    .action(async (kit: string, options: FullControlOptions) => {
      const parsed = parseKitArg(kit);
      const registry = await loadRegistry(import.meta.url);
      const entry = resolveRegistryEntry(registry, parsed.name);
      const version = resolveVersion(parsed.name, entry, parsed.version);

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
          console.log(
            pc.yellow(`Sucessor recomendado: ${deprecation.successor}`),
          );
        }
      }

      const sourceDir = await resolveKitSourceDir(
        import.meta.url,
        parsed.name,
        version,
      );
      const destinationDir = kitFullControlDir(
        process.cwd(),
        parsed.name,
        version,
      );

      const destinationExists = await fs.pathExists(destinationDir);

      if (options.dryRun) {
        console.log(pc.bold(`[dry-run] full-control para ${parsed.name}@${version}`));
        console.log(`Origem:  ${pc.cyan(sourceDir)}`);
        console.log(`Destino: ${pc.cyan(destinationDir)}`);
        if (destinationExists) {
          console.log(
            pc.yellow(
              `O destino ja existe. Em execucao real, o CLI pedira confirmacao antes de sobrescrever.`,
            ),
          );
        }

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

        const aliasPreview = await upsertPathAlias(
          process.cwd(),
          `cullet/${parsed.name}`,
          kitFullControlAliasTarget(parsed.name, version),
          { dryRun: true },
        );

        printAliasOutcome(aliasPreview, { dryRun: true });

        const meta = await loadKitMeta(import.meta.url, parsed.name, version);
        const deps = meta?.philosophy?.externalDeps ?? [];
        if (deps.length > 0) {
          console.log("");
          console.log(
            pc.dim(
              `Apos a copia real, voce precisara instalar: ${deps.join(", ")}`,
            ),
          );
        }
        return;
      }

      if (destinationExists) {
        const shouldOverwrite = await confirmOverwrite(destinationDir);

        if (!shouldOverwrite) {
          console.log(
            pc.yellow("Operacao cancelada. Nenhum arquivo foi alterado."),
          );
          return;
        }

        await fs.remove(destinationDir);
      }

      await fs.ensureDir(join(process.cwd(), "cullet"));
      await fs.copy(sourceDir, destinationDir, { overwrite: true });

      const aliasResult = await upsertPathAlias(
        process.cwd(),
        `cullet/${parsed.name}`,
        kitFullControlAliasTarget(parsed.name, version),
      );

      console.log(
        pc.green(`Kit ${parsed.name} copiado para ./cullet/${parsed.name}@${version}/`),
      );
      console.log(`Origem: ${pc.cyan(sourceDir)}`);
      console.log(`Destino: ${pc.cyan(destinationDir)}`);

      printAliasOutcome(aliasResult, { dryRun: false });

      const meta = await loadKitMeta(import.meta.url, parsed.name, version);
      const deps = meta?.philosophy?.externalDeps ?? [];
      printExternalDepsWarning(parsed.name, deps);

      console.log("");
      console.log(pc.bold("Como usar agora:"));
      console.log(pc.cyan(`import { ... } from \"cullet/${parsed.name}\";`));
      console.log(
        pc.dim(
          "O alias local aponta para a copia em ./cullet/, permitindo editar o kit dentro do projeto.",
        ),
      );
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
