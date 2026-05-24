import { Command } from "commander";
import fs from "fs-extra";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import pc from "picocolors";
import {
  loadRegistry,
  parseKitArg,
  resolveBuiltKitDir,
  resolveRegistryEntry,
  resolveVersion,
} from "../utils/resolve.js";
import { upsertPathAlias } from "../utils/tsconfig.js";

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

export function createFullControlCommand(): Command {
  return new Command("fc")
    .description(
      "Copia um kit para dentro do projeto atual e atualiza o alias local",
    )
    .argument(
      "<kit>",
      "Nome do kit no formato nome ou nome@versao",
    )
    .action(async (kit: string) => {
      const parsed = parseKitArg(kit);
      const registry = await loadRegistry(import.meta.url);
      const entry = resolveRegistryEntry(registry, parsed.name);
      const version = resolveVersion(parsed.name, entry, parsed.version);
      const sourceDir = await resolveBuiltKitDir(
        import.meta.url,
        parsed.name,
        version,
      );
      const destinationDir = join(
        process.cwd(),
        "cullet",
        `${parsed.name}@${version}`,
      );

      if (await fs.pathExists(destinationDir)) {
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
        `./cullet/${parsed.name}@${version}/index.ts`,
      );

      console.log(
        pc.green(`Full-control concluido para ${parsed.name}@${version}.`),
      );
      console.log(`Origem: ${pc.cyan(sourceDir)}`);
      console.log(`Destino: ${pc.cyan(destinationDir)}`);

      if (aliasResult.status === "missing-tsconfig") {
        console.log(
          pc.yellow(
            "Nenhum tsconfig.json foi encontrado. O alias local nao foi registrado automaticamente.",
          ),
        );
      } else {
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
      }

      console.log(pc.bold("Como usar agora:"));
      console.log(pc.cyan(`import { ... } from \"cullet/${parsed.name}\";`));
      console.log(
        pc.dim(
          "O alias local vai apontar para a copia em ./cullet/, permitindo editar o kit dentro do projeto.",
        ),
      );
    });
}
