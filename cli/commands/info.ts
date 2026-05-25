import { Command } from "commander";
import pc from "picocolors";
import { kitImportSpecifier, kitNodeModulesEntry } from "../utils/paths.js";
import {
  loadKitContext,
  loadKitDeprecation,
  loadKitMeta,
  loadRegistry,
  parseKitArg,
  resolveRegistryEntry,
  resolveVersion,
} from "../utils/resolve.js";
import { upsertPathAlias } from "../utils/tsconfig.js";

interface InfoCommandOptions {
  alias?: boolean;
  full?: boolean;
}

const CONTEXT_SECTIONS = [
  "Propósito",
  "Camadas",
  "Decisões-chave",
  "Pontos de extensão",
  "Não-objetivos",
] as const;

interface ContextSection {
  heading: string;
  body: string;
}

function parseKitContext(raw: string): ContextSection[] {
  const lines = raw.split(/\r?\n/);
  const sections: ContextSection[] = [];
  let current: ContextSection | null = null;

  for (const line of lines) {
    const headingMatch = /^##\s+(.*\S)\s*$/.exec(line);
    if (headingMatch) {
      if (current) sections.push(current);
      current = { heading: headingMatch[1], body: "" };
      continue;
    }
    if (current) {
      current.body += `${line}\n`;
    }
  }
  if (current) sections.push(current);

  return sections.map((section) => ({
    heading: section.heading,
    body: section.body.trim(),
  }));
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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

function printKitContext(raw: string, options: { full: boolean }): void {
  const sections = parseKitContext(raw);

  if (sections.length === 0) {
    console.log(pc.dim(raw.trim()));
    return;
  }

  const expected = new Set(CONTEXT_SECTIONS.map((value) => normalize(value)));

  for (const section of sections) {
    const isExpected = expected.has(normalize(section.heading));
    if (!options.full && !isExpected) continue;

    console.log("");
    console.log(pc.bold(pc.cyan(section.heading)));

    const body = options.full
      ? section.body
      : summarizeBody(section.body, normalize(section.heading) === normalize("Propósito") ? 3 : 6);

    if (body.length > 0) {
      console.log(body);
    }
  }
}

export function createInfoCommand(): Command {
  return new Command("info")
    .alias("install")
    .description(
      "Valida um kit do registry e mostra como importa-lo no codigo",
    )
    .argument("<kit>", "Nome do kit no formato nome ou nome@versao")
    .option(
      "--alias",
      "Adiciona ou atualiza um path alias no tsconfig.json do projeto atual",
    )
    .option(
      "--full",
      "Exibe o KIT_CONTEXT.md inteiro, sem resumir",
    )
    .action(async (kit: string, options: InfoCommandOptions) => {
      const parsed = parseKitArg(kit);
      const registry = await loadRegistry(import.meta.url);
      const entry = resolveRegistryEntry(registry, parsed.name);
      const version = resolveVersion(parsed.name, entry, parsed.version);
      const isLatestImplicit =
        parsed.version === undefined && version === entry.latest;
      const importSpecifier = kitImportSpecifier(
        parsed.name,
        version,
        isLatestImplicit,
      );

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
          console.log(
            pc.yellow(`Sucessor recomendado: ${deprecation.successor}`),
          );
        }
      }

      console.log("");
      console.log(pc.bold("Importe direto no codigo:"));
      console.log(pc.cyan(`import { ... } from \"${importSpecifier}\";`));

      const externalDeps = meta?.philosophy?.externalDeps ?? [];
      if (externalDeps.length > 0) {
        console.log("");
        console.log(pc.bold("Dependencias externas esperadas:"));
        console.log(pc.dim(`  ${externalDeps.join(", ")}`));
      }

      const context = await loadKitContext(
        import.meta.url,
        parsed.name,
        version,
      );

      if (context !== null) {
        printKitContext(context, { full: Boolean(options.full) });
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
          pc.dim(
            "Este kit nao publicou um KIT_CONTEXT.md ainda.",
          ),
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
        `cullet/${parsed.name}`,
        kitNodeModulesEntry(parsed.name, version),
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
          `Alias ${actionLabel}: cullet/${parsed.name} -> ${aliasResult.target}`,
        ),
      );
    });
}
