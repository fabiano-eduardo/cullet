import { Command } from "commander";
import pc from "picocolors";
import { detectPackageManager } from "../utils/package-manager.js";
import { loadKit } from "../../registry/index.js";
import {
    describeKitSuccessor,
    isToolingKit,
    parseKitArg,
    resolveInstalledKitVersion,
} from "../utils/resolve.js";
import { runCommandWithTelemetry } from "../utils/telemetry.js";
import { runLibraryFullControl } from "./full-control/library.js";
import { runToolingFullControl } from "./full-control/tooling.js";
import {
    type FullControlContext,
    type FullControlOptions,
} from "./full-control/types.js";

// Re-exported so existing consumers (and tests) keep importing them from this module.
export { copyDirectoryTransactional } from "./full-control/transaction.js";
export {
    findPayloadConflicts,
    listRelativeFiles,
} from "./full-control/files.js";

export function createFullControlCommand(): Command {
    return new Command("fc")
        .description(
            "Adiciona um kit ao projeto atual: copia o codigo do kit para dentro do projeto. Kits importaveis ganham um alias local; kits do tipo tooling sao copiados para o placement declarado.",
        )
        .argument("<kit>", "Nome do kit no formato nome ou nome@versao")
        .option(
            "--dry-run",
            "Lista o que seria copiado e o resultado (alias/placement) sem escrever nada",
        )
        .option(
            "--no-install",
            "Nao instala o pacote do kit; assume que ja esta presente no projeto",
        )
        .action(async (kit: string, options: FullControlOptions) => {
            await runCommandWithTelemetry({
                fromMetaUrl: import.meta.url,
                command: "fc",
                async handler(tracker) {
                    tracker.set("requestedKit", kit);
                    tracker.set("dryRun", Boolean(options.dryRun));

                    const { name: requestedName, version: requestedVersion } =
                        parseKitArg(kit);
                    const { name, version, npmName, meta, deprecation } =
                        await loadKit(requestedName, requestedVersion, {
                            context: false,
                        });
                    tracker.set("kit", name);
                    tracker.set("resolvedVersion", version);

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

                    const installSpec = `${npmName}@${version}`;
                    const installedVersion = resolveInstalledKitVersion(
                        process.cwd(),
                        npmName,
                    );
                    const context: FullControlContext = {
                        name,
                        version,
                        npmName,
                        meta,
                        installSpec,
                        alreadyInstalled: installedVersion === version,
                        packageManager: detectPackageManager(process.cwd()),
                        options,
                        tracker,
                    };

                    if (isToolingKit(meta)) {
                        tracker.set("kind", "tooling");
                        await runToolingFullControl(context);
                    } else {
                        tracker.set("kind", "library");
                        await runLibraryFullControl(context);
                    }
                },
            });
        });
}
