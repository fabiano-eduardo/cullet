import { Command } from "commander";
import pc from "picocolors";
import { listKits } from "../../registry/index.js";
import {
    describeKitSuccessor,
    getKitKind,
    loadKitDeprecation,
    loadKitMeta,
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
                    const kits = await listKits();
                    tracker.set("kitCount", kits.length);

                    if (kits.length === 0) {
                        console.log(
                            pc.yellow("Nenhum kit foi encontrado no registry."),
                        );
                        return;
                    }

                    console.log(pc.bold(pc.cyan("Kits disponiveis")));

                    for (const kit of kits) {
                        const [deprecation, meta] = await Promise.all([
                            loadKitDeprecation(import.meta.url, kit.name),
                            loadKitMeta(import.meta.url, kit.name),
                        ]);
                        const kind = getKitKind(meta);
                        const kindMarker = pc.dim(` [${kind}]`);
                        const marker = deprecation
                            ? pc.yellow(" [deprecated]")
                            : "";

                        console.log(
                            `${pc.green(kit.name)} ${pc.dim(
                                `(latest: ${kit.latest})`,
                            )}${kindMarker}${marker}`,
                        );
                        console.log(`  ${kit.description}`);
                        console.log(
                            `  versoes: ${pc.bold(kit.versions.join(", "))}`,
                        );

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
