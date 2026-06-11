import fs from "fs-extra";
import { relative } from "node:path";
import pc from "picocolors";
import { formatDependency } from "../../utils/formatDependency.js";
import { kitToolingDestinationDir } from "../../utils/paths.js";
import {
    getCopyDelivery,
    getCopyDependencies,
    kitExposesImport,
    resolveKitPayloadDir,
} from "../../utils/resolve.js";
import { collectSampleFiles, findPayloadConflicts } from "./files.js";
import { ensureKitInstalled, runPostInstall } from "./install.js";
import { printExternalDepsWarning, printInstallPreview } from "./output.js";
import { confirmToolingOverwrite } from "./prompts.js";
import { type FullControlContext } from "./types.js";

/**
 * Copy-only (`tooling`) kits: merge the kit's payload into the declared
 * placement (e.g. ".claude/"). Unlike library kits there is no tsconfig alias
 * and no `import` — the files become part of the project as-is. The placement
 * is a shared directory, so the payload is merged (existing siblings are
 * preserved); only files the kit ships can be overwritten, and only after
 * confirmation.
 */
export async function runToolingFullControl(
    context: FullControlContext,
): Promise<void> {
    const { name, npmName, version, meta, options, tracker } = context;

    const copy = getCopyDelivery(meta);
    if (copy === undefined) {
        throw new Error(
            `O kit ${name}@${version} e do tipo tooling mas nao declara delivery.copy no meta.json. O catalogo esta inconsistente.`,
        );
    }

    const destinationDir = kitToolingDestinationDir(
        process.cwd(),
        copy.placement,
    );
    const deps = getCopyDependencies(meta);

    if (options.dryRun) {
        console.log(
            pc.bold(`[dry-run] full-control (tooling) para ${name}@${version}`),
        );
        printInstallPreview(context);

        console.log(
            `Destino: ${pc.cyan(destinationDir)} ${pc.dim(`(placement: ${copy.placement})`)}`,
        );

        if (context.alreadyInstalled) {
            const sourceDir = await resolveKitPayloadDir(
                process.cwd(),
                npmName,
                copy.source,
            );
            console.log(`Origem:  ${pc.cyan(sourceDir)}`);
            const conflicts = await findPayloadConflicts(
                sourceDir,
                destinationDir,
            );
            const sample = await collectSampleFiles(sourceDir, 12);
            if (sample.files.length > 0) {
                console.log(
                    pc.bold("Arquivos que seriam adicionados (amostra):"),
                );
                for (const file of sample.files) {
                    console.log(`  ${pc.dim(relative(sourceDir, file))}`);
                }
                if (sample.truncated) {
                    console.log(pc.dim(`  ... e mais arquivos`));
                }
            }
            if (conflicts.length > 0) {
                console.log(
                    pc.yellow(
                        `${conflicts.length} arquivo(s) ja existem em ${copy.placement} e seriam sobrescritos (apos confirmacao).`,
                    ),
                );
            }
        } else {
            console.log(
                pc.dim(
                    `O payload seria copiado de node_modules/${npmName}/${copy.source} apos a instalacao.`,
                ),
            );
        }

        console.log(
            pc.dim(
                "Kits do tipo tooling nao criam alias no tsconfig: os arquivos passam a fazer parte do projeto.",
            ),
        );
        if (copy.postInstall !== undefined) {
            console.log(
                pc.dim(
                    `Apos a copia, o script ${copy.postInstall} seria executado em ${copy.placement}.`,
                ),
            );
        }
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

    const sourceDir = await resolveKitPayloadDir(
        process.cwd(),
        npmName,
        copy.source,
    );

    const conflicts = await findPayloadConflicts(sourceDir, destinationDir);
    if (conflicts.length > 0) {
        const shouldOverwrite = await confirmToolingOverwrite(
            copy.placement,
            conflicts,
        );
        if (!shouldOverwrite) {
            console.log(
                pc.yellow("Operacao cancelada. Nenhum arquivo foi alterado."),
            );
            tracker.set("cancelled", true);
            return;
        }
    }

    await fs.ensureDir(destinationDir);
    await fs.copy(sourceDir, destinationDir, { overwrite: true });

    console.log(pc.green(`Kit ${name} adicionado em ${copy.placement}`));
    console.log(`Origem: ${pc.cyan(sourceDir)}`);
    console.log(`Destino: ${pc.cyan(destinationDir)}`);

    if (copy.postInstall !== undefined) {
        await runPostInstall(destinationDir, copy.postInstall, tracker);
    }

    printExternalDepsWarning(deps);

    console.log("");
    console.log(pc.bold("Como usar agora:"));
    console.log(
        pc.dim(
            `Os arquivos do kit foram adicionados em ${copy.placement}. Nenhum import nem alias de tsconfig e necessario.`,
        ),
    );
    if (kitExposesImport(meta)) {
        console.log(
            pc.dim(
                `Este kit tambem expoe uma superficie importavel: voce pode usa-lo direto do node_modules com \`import { ... } from "${npmName}"\`, sem copiar.`,
            ),
        );
    }
}
