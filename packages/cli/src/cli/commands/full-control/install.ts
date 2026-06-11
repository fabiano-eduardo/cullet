import fs from "fs-extra";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import pc from "picocolors";
import {
    formatInstallCommand,
    installPackage,
} from "../../utils/package-manager.js";
import { type TelemetryCommandTracker } from "../../utils/telemetry.js";
import { errorMessage } from "./error.js";
import { type FullControlContext } from "./types.js";

const execFileAsync = promisify(execFile);

/** Install the kit package when it is not already present, shared by both strategies. */
export async function ensureKitInstalled(
    context: FullControlContext,
): Promise<void> {
    const { alreadyInstalled, options, installSpec, packageManager, tracker } =
        context;
    if (alreadyInstalled) return;

    if (options.install === false) {
        throw new Error(
            `${installSpec} nao esta instalado e --no-install foi usado. Instale com: ${formatInstallCommand(packageManager, installSpec)}`,
        );
    }

    console.log(pc.cyan(`Instalando ${installSpec} com ${packageManager}...`));
    try {
        await installPackage(process.cwd(), packageManager, installSpec);
    } catch (error) {
        throw new Error(
            `Falha ao instalar ${installSpec} com ${packageManager}: ${errorMessage(error)}`,
        );
    }
    tracker.set("installed", true);
}

export async function runPostInstall(
    destinationDir: string,
    postInstall: string,
    tracker: TelemetryCommandTracker,
): Promise<void> {
    const scriptPath = join(destinationDir, postInstall);
    if (!(await fs.pathExists(scriptPath))) {
        console.log(
            pc.yellow(
                `Aviso: o script de postInstall declarado (${postInstall}) nao foi encontrado em ${destinationDir}; pulando.`,
            ),
        );
        return;
    }

    console.log(pc.cyan(`Executando postInstall: ${postInstall}...`));
    try {
        await execFileAsync(process.execPath, [scriptPath], {
            cwd: destinationDir,
        });
        tracker.set("postInstall", true);
    } catch (error) {
        throw new Error(
            `Falha ao executar o postInstall (${postInstall}): ${errorMessage(error)}`,
        );
    }
}
