import fs from "fs-extra";
import { relative } from "node:path";
import pc from "picocolors";
import { formatDependency } from "../../utils/formatDependency.js";
import {
    kitFullControlAliasTarget,
    kitFullControlDir,
} from "../../utils/paths.js";
import {
    getFullControlDependencies,
    resolveKitSourceDir,
} from "../../utils/resolve.js";
import { upsertPathAlias } from "../../utils/tsconfig.js";
import { collectSampleFiles } from "./files.js";
import { ensureKitInstalled } from "./install.js";
import {
    printAliasOutcome,
    printExternalDepsWarning,
    printInstallPreview,
} from "./output.js";
import { confirmOverwrite } from "./prompts.js";
import { copyDirectoryTransactional } from "./transaction.js";
import { type FullControlContext } from "./types.js";

/** Importable kits (foundation/capability): copy `src/` and register a tsconfig alias. */
export async function runLibraryFullControl(
    context: FullControlContext,
): Promise<void> {
    const { name, npmName, version, meta, options, tracker } = context;
    const destinationDir = kitFullControlDir(process.cwd(), name, version);

    if (options.dryRun) {
        console.log(pc.bold(`[dry-run] full-control para ${name}@${version}`));
        printInstallPreview(context);

        console.log(`Destino: ${pc.cyan(destinationDir)}`);
        if (await fs.pathExists(destinationDir)) {
            console.log(
                pc.yellow(
                    `O destino ja existe. Em execucao real, o CLI pedira confirmacao antes de sobrescrever.`,
                ),
            );
        }

        if (context.alreadyInstalled) {
            const sourceDir = await resolveKitSourceDir(process.cwd(), npmName);
            console.log(`Origem:  ${pc.cyan(sourceDir)}`);
            const sample = await collectSampleFiles(sourceDir, 12);
            if (sample.files.length > 0) {
                console.log(pc.bold("Arquivos que seriam copiados (amostra):"));
                for (const file of sample.files) {
                    console.log(`  ${pc.dim(relative(sourceDir, file))}`);
                }
                if (sample.truncated) {
                    console.log(pc.dim(`  ... e mais arquivos`));
                }
            }
        } else {
            console.log(
                pc.dim(
                    `O fonte do kit seria copiado de node_modules/${npmName}/src apos a instalacao.`,
                ),
            );
        }

        const aliasPreview = await upsertPathAlias(
            process.cwd(),
            npmName,
            kitFullControlAliasTarget(name, version),
            { dryRun: true },
        );

        printAliasOutcome(aliasPreview, { dryRun: true });

        const deps = getFullControlDependencies(meta);
        if (deps.length > 0) {
            console.log("");
            console.log(
                pc.dim(
                    `Apos a copia real, voce precisara instalar: ${deps
                        .map(formatDependency)
                        .join(", ")}`,
                ),
            );
        }
        return;
    }

    await ensureKitInstalled(context);

    const sourceDir = await resolveKitSourceDir(process.cwd(), npmName);
    const destinationExists = await fs.pathExists(destinationDir);

    if (destinationExists) {
        const shouldOverwrite = await confirmOverwrite(destinationDir);

        if (!shouldOverwrite) {
            console.log(
                pc.yellow("Operacao cancelada. Nenhum arquivo foi alterado."),
            );
            tracker.set("cancelled", true);
            return;
        }
    }

    await copyDirectoryTransactional(sourceDir, destinationDir);

    const aliasResult = await upsertPathAlias(
        process.cwd(),
        npmName,
        kitFullControlAliasTarget(name, version),
    );

    console.log(
        pc.green(`Kit ${name} copiado para ./cullet/${name}@${version}/`),
    );
    console.log(`Origem: ${pc.cyan(sourceDir)}`);
    console.log(`Destino: ${pc.cyan(destinationDir)}`);

    printAliasOutcome(aliasResult, { dryRun: false });

    const deps = getFullControlDependencies(meta);
    printExternalDepsWarning(deps);

    console.log("");
    console.log(pc.bold("Como usar agora:"));
    console.log(pc.cyan(`import { ... } from "${npmName}";`));
    console.log(
        pc.dim(
            "O alias local aponta para a copia em ./cullet/, permitindo editar o kit dentro do projeto.",
        ),
    );
}
