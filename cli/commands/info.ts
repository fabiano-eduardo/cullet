import { Command } from "commander";
import pc from "picocolors";
import { kitImportSpecifier, kitNodeModulesEntry } from "../utils/paths.js";
import {
  loadRegistry,
  parseKitArg,
  resolveRegistryEntry,
  resolveVersion,
} from "../utils/resolve.js";
import { upsertPathAlias } from "../utils/tsconfig.js";

interface InfoCommandOptions {
  alias?: boolean;
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
