import { Command } from "commander";
import pc from "picocolors";
import { formatDependency } from "../utils/formatDependency.js";
import { fetchPublishedPackageInfo } from "../utils/npm-registry.js";
import { kitNodeModulesEntry } from "../utils/paths.js";
import {
  describeKitSuccessor,
  getDirectImportPeerDependencies,
  loadKitContext,
  loadKitDeprecation,
  loadKitMeta,
  loadRegistry,
  parseKitArg,
  resolveRegistryEntry,
  resolveVersion,
} from "../utils/resolve.js";
import { parseKitContextDocument } from "../utils/kit-context.js";
import { runCommandWithTelemetry } from "../utils/telemetry.js";
import { upsertPathAlias } from "../utils/tsconfig.js";

interface InfoCommandOptions {
  alias?: boolean;
  full?: boolean;
}

function summarizeBody(body: string, maxLines: number): string {
  if (body.length === 0) return "";
  const trimmedLines: string[] = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (line.length === 0) {
      if (trimmedLines.length === 0) continue;
      // collapse multiple blank lines, but break early once we have enough
      if (trimmedLines.length >= maxLines) break;
      continue;
    }
    trimmedLines.push(line);
    if (trimmedLines.length >= maxLines) break;
  }
  return trimmedLines.join("\n");
}

function printCompatibility(
  meta: Awaited<ReturnType<typeof loadKitMeta>>,
): void {
  const engines = meta?.compatibility?.engines;
  const dependencies = getDirectImportPeerDependencies(meta);

  if (engines === undefined && dependencies.length === 0) {
    return;
  }

  console.log("");
  console.log(pc.bold("Compatibilidade do kit:"));

  if (engines !== undefined) {
    console.log(pc.dim(`  Node: ${engines.node}`));
    console.log(pc.dim(`  TypeScript: ${engines.typescript}`));
  }

  if (dependencies.length > 0) {
    console.log("");
    console.log(pc.bold("Peer deps para import direto:"));
    for (const dependency of dependencies) {
      console.log(pc.dim(`  ${formatDependency(dependency)}`));
    }
  }
}

function printKitContext(raw: string, options: { full: boolean }): void {
  const document = parseKitContextDocument(raw);
  const sections = document.sections;

  if (sections.length === 0) {
    console.log(pc.dim(raw.trim()));
    return;
  }

  for (const section of sections) {
    if (!options.full && section.id === null) continue;

    console.log("");
    console.log(pc.bold(pc.cyan(section.title)));

    const body = options.full
      ? section.body
      : summarizeBody(section.body, section.id === "purpose" ? 3 : 6);

    if (body.length > 0) {
      console.log(body);
    }
  }
}

async function printPublishedVersions(npmName: string): Promise<void> {
  const published = await fetchPublishedPackageInfo(npmName);

  console.log("");
  console.log(pc.bold("Versoes publicadas no npm:"));

  if (published === null) {
    console.log(
      pc.dim(
        `  Nao foi possivel consultar o npm (offline ou ${npmName} ainda nao publicado).`,
      ),
    );
    return;
  }

  const latest = published.distTags.latest;
  const sorted = [...published.versions].reverse();
  const preview = sorted.slice(0, 10);
  console.log(pc.dim(`  ${preview.join(", ")}`));
  if (sorted.length > preview.length) {
    console.log(pc.dim(`  ... e mais ${sorted.length - preview.length} versao(oes)`));
  }

  const tags = Object.entries(published.distTags);
  if (tags.length > 0) {
    console.log(
      pc.dim(
        `  dist-tags: ${tags.map(([tag, value]) => `${tag}=${value}`).join(", ")}`,
      ),
    );
  } else if (latest !== undefined) {
    console.log(pc.dim(`  latest: ${latest}`));
  }
}

export function createInfoCommand(): Command {
  return new Command("info")
    .alias("install")
    .description("Valida um kit do registry e mostra como importa-lo no codigo")
    .argument("<kit>", "Nome do kit no formato nome ou nome@versao")
    .option(
      "--alias",
      "Adiciona ou atualiza um path alias no tsconfig.json do projeto atual",
    )
    .option("--full", "Exibe o KIT_CONTEXT.md inteiro, sem resumir")
    .action(async (kit: string, options: InfoCommandOptions) => {
      await runCommandWithTelemetry({
        fromMetaUrl: import.meta.url,
        command: "info",
        async handler(tracker) {
          tracker.set("requestedKit", kit);
          tracker.set("alias", Boolean(options.alias));
          tracker.set("full", Boolean(options.full));

          const parsed = parseKitArg(kit);
          const registry = await loadRegistry(import.meta.url);
          const entry = resolveRegistryEntry(registry, parsed.name);
          const version = resolveVersion(parsed.name, entry, parsed.version);
          const importSpecifier = entry.npmName;
          tracker.set("kit", parsed.name);
          tracker.set("resolvedVersion", version);

          console.log(pc.green(`Kit validado: ${parsed.name}@${version}`));

          const meta = await loadKitMeta(import.meta.url, parsed.name, version);
          if (meta?.description) {
            console.log(pc.dim(meta.description));
          }

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

          console.log("");
          console.log(pc.bold("Importe direto no codigo:"));
          console.log(pc.cyan(`import { ... } from "${importSpecifier}";`));

          await printPublishedVersions(entry.npmName);

          printCompatibility(meta);

          const context = await loadKitContext(
            import.meta.url,
            parsed.name,
            version,
          );

          if (context !== null) {
            printKitContext(context, {
              full: Boolean(options.full),
            });
            if (!options.full) {
              console.log("");
              console.log(
                pc.dim(
                  `Resumo do KIT_CONTEXT.md. Use --full para ler integralmente.`,
                ),
              );
            }
          } else {
            console.log("");
            console.log(
              pc.dim("Este kit nao publicou um KIT_CONTEXT.md ainda."),
            );
          }

          if (!options.alias) {
            console.log("");
            console.log(
              pc.dim(
                "Dica: use --alias se quiser registrar um path alias no tsconfig.json do projeto atual.",
              ),
            );
            return;
          }

          const aliasResult = await upsertPathAlias(
            process.cwd(),
            entry.npmName,
            kitNodeModulesEntry(entry.npmName),
          );

          if (aliasResult.status === "missing-tsconfig") {
            console.log(
              pc.yellow(
                "Nenhum tsconfig.json foi encontrado no projeto atual. O alias nao foi criado.",
              ),
            );
            return;
          }

          const actionLabel =
            aliasResult.status === "created"
              ? "criado"
              : aliasResult.status === "updated"
                ? "atualizado"
                : "mantido";

          console.log(
            pc.green(
              `Alias ${actionLabel}: ${entry.npmName} -> ${aliasResult.target}`,
            ),
          );
        },
      });
    });
}
