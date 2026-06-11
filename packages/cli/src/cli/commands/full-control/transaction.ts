import fs from "fs-extra";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { errorMessage } from "./error.js";

function createTransactionalPath(
    destinationDir: string,
    kind: "staging" | "backup",
): string {
    const parentDir = dirname(destinationDir);
    const directoryName = basename(destinationDir);
    return join(parentDir, `.${directoryName}.${kind}-${randomUUID()}`);
}

async function removeIfExists(path: string): Promise<void> {
    if (await fs.pathExists(path)) {
        await fs.remove(path);
    }
}

export async function copyDirectoryTransactional(
    sourceDir: string,
    destinationDir: string,
): Promise<void> {
    const parentDir = dirname(destinationDir);
    const stagingDir = createTransactionalPath(destinationDir, "staging");
    const backupDir = createTransactionalPath(destinationDir, "backup");
    const destinationExists = await fs.pathExists(destinationDir);

    await fs.ensureDir(parentDir);

    try {
        await fs.copy(sourceDir, stagingDir, { overwrite: true });
    } catch (error) {
        await removeIfExists(stagingDir);
        throw new Error(
            `Falha ao preparar a copia para ${destinationDir}: ${errorMessage(error)}`,
        );
    }

    if (!destinationExists) {
        try {
            await fs.move(stagingDir, destinationDir, { overwrite: false });
            return;
        } catch (error) {
            await removeIfExists(stagingDir);
            throw new Error(
                `Falha ao finalizar a copia para ${destinationDir}: ${errorMessage(
                    error,
                )}`,
            );
        }
    }

    try {
        await fs.move(destinationDir, backupDir, { overwrite: false });
        await fs.move(stagingDir, destinationDir, { overwrite: false });
    } catch (error) {
        await removeIfExists(stagingDir);

        if (
            (await fs.pathExists(backupDir)) &&
            !(await fs.pathExists(destinationDir))
        ) {
            try {
                await fs.move(backupDir, destinationDir, { overwrite: false });
            } catch (restoreError) {
                throw new Error(
                    `Falha ao sobrescrever ${destinationDir}; o backup em ${backupDir} nao pode ser restaurado automaticamente. Erro original: ${errorMessage(
                        error,
                    )}. Erro ao restaurar: ${errorMessage(restoreError)}.`,
                );
            }
        }

        throw new Error(
            `Falha ao sobrescrever ${destinationDir}. O conteudo anterior foi preservado. Detalhe: ${errorMessage(
                error,
            )}.`,
        );
    }

    try {
        await removeIfExists(backupDir);
    } catch {
        // Best-effort cleanup: the destination is already in place.
    }
}
