import { Command } from "commander";
import { resolve } from "node:path";
import pc from "picocolors";
import {
    loadKitMigrationPlan,
    runKitMigrationCodemod,
} from "../utils/migration.js";
import { formatKitSuccessor, resolveKitFromArg } from "../utils/resolve.js";
import { runCommandWithTelemetry } from "../utils/telemetry.js";

interface MigrateCommandOptions {
    cwd?: string;
    apply?: boolean;
    dryRun?: boolean;
}

function printMigrationPlan(
    plan: Awaited<ReturnType<typeof loadKitMigrationPlan>>,
): void {
    if (plan === null) {
        return;
    }

    console.log(
        pc.bold(
            `Migracao codificada: ${plan.source.name}@${
                plan.source.version
            } -> ${formatKitSuccessor(plan.target)}`,
        ),
    );
    console.log(pc.dim(`Deprecated desde: ${plan.deprecation.since}`));
    console.log(pc.dim(`Motivo: ${plan.deprecation.reason}`));

    if (plan.guide !== undefined) {
        if (plan.guide.resolvedPath === null) {
            console.log(
                pc.yellow(
                    `Guia de migracao declarado, mas ausente: ${plan.guide.declaredPath}`,
                ),
            );
        } else {
            console.log(
                pc.cyan(`Guia de migracao: ${plan.guide.resolvedPath}`),
            );
        }
    }

    if (typeof plan.target.notes === "string") {
        console.log(pc.dim(`Notas: ${plan.target.notes}`));
    }

    if (plan.codemod !== undefined) {
        const codemodLabel =
            plan.codemod.description === undefined
                ? plan.codemod.declaredPath
                : `${plan.codemod.description} (${plan.codemod.declaredPath})`;
        console.log(pc.cyan(`Codemod: ${codemodLabel}`));
        if (plan.codemod.resolvedPath === null) {
            console.log(
                pc.yellow(
                    `Arquivo de codemod nao encontrado: ${plan.codemod.declaredPath}`,
                ),
            );
        }
        console.log(
            pc.yellow(
                "Aviso: o codemod vem do proprio kit e roda codigo localmente. Revise a origem do kit antes de usar --dry-run ou --apply.",
            ),
        );
    }
}

export function createMigrateCommand(): Command {
    return new Command("migrate")
        .description(
            "Mostra ou executa o caminho de migracao codificado para um kit deprecated",
        )
        .argument("<kit>", "Nome do kit no formato nome ou nome@versao")
        .option(
            "--cwd <path>",
            "Diretorio do projeto a migrar (padrao: process.cwd())",
        )
        .option(
            "--apply",
            "Executa o codemod declarado pelo kit no projeto atual (roda codigo do kit)",
        )
        .option(
            "--dry-run",
            "Executa o codemod em modo simulacao (tambem executa o codigo do kit)",
        )
        .action(async (kit: string, options: MigrateCommandOptions) => {
            await runCommandWithTelemetry({
                fromMetaUrl: import.meta.url,
                command: "migrate",
                async handler(tracker) {
                    tracker.set("requestedKit", kit);
                    tracker.set("apply", Boolean(options.apply));
                    tracker.set("dryRun", Boolean(options.dryRun));

                    const { name, version } = await resolveKitFromArg(
                        import.meta.url,
                        kit,
                    );
                    tracker.set("kit", name);
                    tracker.set("resolvedVersion", version);

                    const plan = await loadKitMigrationPlan(
                        import.meta.url,
                        name,
                        version,
                    );

                    if (plan === null) {
                        console.log(
                            pc.yellow(
                                `Nenhum caminho de migracao foi codificado para ${name}@${version}.`,
                            ),
                        );
                        return;
                    }

                    printMigrationPlan(plan);

                    const shouldRunCodemod =
                        options.apply === true || options.dryRun === true;
                    if (!shouldRunCodemod) {
                        console.log("");
                        if (plan.codemod !== undefined) {
                            console.log(
                                pc.dim(
                                    `Use --dry-run para simular o codemod ou --apply para executa-lo em ${resolve(
                                        process.cwd(),
                                        options.cwd ?? ".",
                                    )}.`,
                                ),
                            );
                        } else {
                            console.log(
                                pc.dim(
                                    "Nenhum arquivo foi alterado. Esta migracao depende apenas do guia/ajustes manuais.",
                                ),
                            );
                        }
                        return;
                    }

                    const projectDir = resolve(
                        process.cwd(),
                        options.cwd ?? ".",
                    );
                    const dryRun =
                        options.apply !== true || options.dryRun === true;
                    const result = await runKitMigrationCodemod(plan, {
                        projectDir,
                        dryRun,
                        report(message) {
                            console.log(pc.dim(message));
                        },
                    });

                    console.log("");
                    console.log(
                        pc.green(
                            dryRun
                                ? `Codemod executado em modo simulacao para ${projectDir}.`
                                : `Codemod aplicado em ${projectDir}.`,
                        ),
                    );

                    if (typeof result.summary === "string") {
                        console.log(pc.dim(result.summary));
                    }

                    if ((result.changedFiles?.length ?? 0) > 0) {
                        console.log(pc.bold("Arquivos afetados:"));
                        for (const file of result.changedFiles ?? []) {
                            console.log(`  ${file}`);
                        }
                    }
                },
            });
        });
}
