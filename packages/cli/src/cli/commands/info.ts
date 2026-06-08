import { Command } from "commander";
import pc from "picocolors";
import { formatDependency } from "../utils/formatDependency.js";
import { fetchPublishedPackageInfo } from "../utils/npm-registry.js";
import { kitNodeModulesEntry } from "../utils/paths.js";
import { loadKit, type CatalogKitContext } from "../../registry/index.js";
import {
  describeKitSuccessor,
  getCopyDependencies,
  getCopyPlacement,
  getDirectImportPeerDependencies,
  getImportPeerDependencies,
  isToolingKit,
  kitExposesImport,
  parseKitArg,
  type KitMeta,
} from "../utils/resolve.js";
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

function printCompatibility(meta: KitMeta | null): void {
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

function printKitContext(
  context: CatalogKitContext,
  options: { full: boolean },
): void {
  const sections = context.sections;

  if (sections.length === 0) {
    console.log(pc.dim(context.raw.trim()));
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
    console.log(
      pc.dim(`  ... e mais ${sorted.length - preview.length} versao(oes)`),
    );
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
          const { name, version, npmName, meta, context, deprecation } =
            await loadKit(parsed.name, parsed.version);
          const importSpecifier = npmName;
          tracker.set("kit", name);
          tracker.set("resolvedVersion", version);

          console.log(pc.green(`Kit validado: ${name}@${version}`));

          if (meta?.description) {
            console.log(pc.dim(meta.description));
          }

          if (deprecation) {
            console.log(
              pc.yellow(
                `Aviso: ${name}@${version} esta deprecated desde ${deprecation.since}. Motivo: ${deprecation.reason}`,
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

          const tooling = isToolingKit(meta);
          // A tooling kit that declares `delivery.import` is copy-first but also
          // importable straight from node_modules — surface both paths.
          const importableTooling = tooling && kitExposesImport(meta);

          console.log("");
          if (tooling) {
            if (importableTooling) {
              console.log(pc.bold("Importe direto (sem copiar):"));
              console.log(pc.cyan(`import { ... } from "${importSpecifier}";`));
              console.log("");
              console.log(pc.bold("Ou copie para o projeto:"));
            } else {
              console.log(pc.bold("Adicione ao projeto:"));
            }
            console.log(pc.cyan(`npx cullet fc ${name}@${version}`));
            const placement = getCopyPlacement(meta);
            if (placement !== undefined) {
              console.log(
                pc.dim(`Os arquivos sao copiados para: ${placement}`),
              );
            }
          } else {
            console.log(pc.bold("Importe direto no codigo:"));
            console.log(pc.cyan(`import { ... } from "${importSpecifier}";`));
          }

          await printPublishedVersions(npmName);

          if (tooling) {
            const importDeps = getImportPeerDependencies(meta);
            if (importDeps.length > 0) {
              console.log("");
              console.log(pc.bold("Peer deps para import direto:"));
              for (const dependency of importDeps) {
                console.log(pc.dim(`  ${formatDependency(dependency)}`));
              }
            }
            const deps = getCopyDependencies(meta);
            if (deps.length > 0) {
              console.log("");
              console.log(pc.bold("Dependencias externas do payload:"));
              for (const dependency of deps) {
                console.log(pc.dim(`  ${formatDependency(dependency)}`));
              }
            }
          } else {
            printCompatibility(meta);
          }

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

          // Copy-only tooling kits cannot be aliased (they are not imported).
          // Importable tooling kits fall through to the alias logic below, just
          // like library kits.
          if (tooling && !importableTooling) {
            if (options.alias) {
              console.log("");
              console.log(
                pc.yellow(
                  "O parametro --alias nao se aplica a kits do tipo tooling: eles nao sao importados, e sim copiados para o projeto.",
                ),
              );
            }
            console.log("");
            console.log(
              pc.dim(
                `Dica: rode \`npx cullet fc ${name}\` para copiar o kit para dentro do projeto.`,
              ),
            );
            return;
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
            npmName,
            kitNodeModulesEntry(npmName),
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
              `Alias ${actionLabel}: ${npmName} -> ${aliasResult.target}`,
            ),
          );
        },
      });
    });
}
