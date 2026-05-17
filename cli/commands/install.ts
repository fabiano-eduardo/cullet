import { Command } from "commander";
import pc from "picocolors";
import {
  loadRegistry,
  parseBoilerplateArg,
  resolveRegistryEntry,
  resolveVersion,
} from "../utils/resolve.js";
import { upsertPathAlias } from "../utils/tsconfig.js";

interface InstallCommandOptions {
  alias?: boolean;
}

function buildImportSpecifier(
  name: string,
  version: string,
  isLatest: boolean,
  requestedExplicitVersion: boolean,
): string {
  if (!requestedExplicitVersion && isLatest) {
    return `bacu/${name}`;
  }

  return `bacu/${name}/${version}`;
}

export function createInstallCommand(): Command {
  return new Command("install")
    .description(
      "Valida um boilerplate do registry e mostra como importa-lo no codigo",
    )
    .argument(
      "<boilerplate>",
      "Nome do boilerplate no formato nome ou nome@versao",
    )
    .option(
      "--alias",
      "Adiciona ou atualiza um path alias no tsconfig.json do projeto atual",
    )
    .action(async (boilerplate: string, options: InstallCommandOptions) => {
      const parsed = parseBoilerplateArg(boilerplate);
      const registry = await loadRegistry(import.meta.url);
      const entry = resolveRegistryEntry(registry, parsed.name);
      const version = resolveVersion(parsed.name, entry, parsed.version);
      const importSpecifier = buildImportSpecifier(
        parsed.name,
        version,
        version === entry.latest,
        parsed.version !== undefined,
      );

      console.log(pc.green(`Boilerplate validado: ${parsed.name}@${version}`));
      console.log(pc.bold("Importe direto no codigo:"));
      console.log(pc.cyan(`import { ... } from \"${importSpecifier}\";`));

      if (!options.alias) {
        console.log(
          pc.dim(
            "Dica: use --alias se quiser registrar um path alias no tsconfig.json do projeto atual.",
          ),
        );
        return;
      }

      const aliasResult = await upsertPathAlias(
        process.cwd(),
        `bacu/${parsed.name}`,
        `./node_modules/bacu/dist/boilerplates/${parsed.name}/versions/${version}/index.js`,
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
          `Alias ${actionLabel}: bacu/${parsed.name} -> ${aliasResult.target}`,
        ),
      );
    });
}
