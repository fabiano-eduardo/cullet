import { Command } from "commander";
import pc from "picocolors";
import {
  describeKitSuccessor,
  getKitKind,
  loadKitDeprecation,
  loadKitMeta,
  loadRegistry,
} from "../utils/resolve.js";
import { runCommandWithTelemetry } from "../utils/telemetry.js";

export function createListCommand(): Command {
  return new Command("list")
    .description("Lista os kits disponiveis no registry")
    .action(async () => {
      await runCommandWithTelemetry({
        fromMetaUrl: import.meta.url,
        command: "list",
        async handler(tracker) {
          const registry = await loadRegistry(import.meta.url);
          const names = Object.keys(registry).sort((left, right) =>
            left.localeCompare(right),
          );
          tracker.set("kitCount", names.length);

          if (names.length === 0) {
            console.log(pc.yellow("Nenhum kit foi encontrado no registry."));
            return;
          }

          console.log(pc.bold(pc.cyan("Kits disponiveis")));

          for (const name of names) {
            const entry = registry[name];
            const [deprecation, meta] = await Promise.all([
              loadKitDeprecation(import.meta.url, name, entry.latest),
              loadKitMeta(import.meta.url, name, entry.latest),
            ]);
            const kind = getKitKind(meta);
            const kindMarker = pc.dim(` [${kind}]`);
            const marker = deprecation ? pc.yellow(" [deprecated]") : "";

            console.log(
              `${pc.green(name)} ${pc.dim(
                `(latest: ${entry.latest})`,
              )}${kindMarker}${marker}`,
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
                for (const detail of describeKitSuccessor(
                  deprecation.successor,
                )) {
                  console.log(pc.yellow(`  ${detail}`));
                }
              }
            }
          }
        },
      });
    });
}
