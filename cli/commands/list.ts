import { Command } from "commander";
import pc from "picocolors";
import { loadKitDeprecation, loadRegistry } from "../utils/resolve.js";

export function createListCommand(): Command {
  return new Command("list")
    .description("Lista os kits disponiveis no registry")
    .action(async () => {
      const registry = await loadRegistry(import.meta.url);
      const names = Object.keys(registry).sort((left, right) =>
        left.localeCompare(right),
      );

      if (names.length === 0) {
        console.log(
          pc.yellow("Nenhum kit foi encontrado no registry."),
        );
        return;
      }

      console.log(pc.bold(pc.cyan("Kits disponiveis")));

      for (const name of names) {
        const entry = registry[name];
        const deprecation = await loadKitDeprecation(
          import.meta.url,
          name,
          entry.latest,
        );
        const marker = deprecation ? pc.yellow(" [deprecated]") : "";

        console.log(
          `${pc.green(name)} ${pc.dim(`(latest: ${entry.latest})`)}${marker}`,
        );
        console.log(`  ${entry.description}`);
        console.log(`  versoes: ${pc.bold(entry.versions.join(", "))}`);

        if (deprecation) {
          console.log(
            pc.yellow(
              `  deprecated desde ${deprecation.since}: ${deprecation.reason}`,
            ),
          );
          if (deprecation.successor) {
            console.log(pc.yellow(`  sucessor: ${deprecation.successor}`));
          }
        }
      }
    });
}
