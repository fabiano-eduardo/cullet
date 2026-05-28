#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { createDoctorCommand } from "./commands/doctor.js";
import { createFullControlCommand } from "./commands/fullControl.js";
import { createInfoCommand } from "./commands/info.js";
import { createListCommand } from "./commands/list.js";
import { createMigrateCommand } from "./commands/migrate.js";
import { createTelemetryCommand } from "./commands/telemetry.js";
import { findCulletPackageRoot } from "./utils/resolve.js";

async function readPackageVersion(): Promise<string> {
    const packageRoot = findCulletPackageRoot(import.meta.url);
    const raw = await readFile(join(packageRoot, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };

    if (typeof parsed.version !== "string") {
        throw new Error(
            "package.json do cullet nao contem um campo version valido."
        );
    }

    return parsed.version;
}

async function main(): Promise<void> {
    const program = new Command();

    program
        .name("cullet")
        .description("Colecao de kits arquiteturais opinativos")
        .version(await readPackageVersion());

    program.addCommand(createListCommand());
    program.addCommand(createInfoCommand());
    program.addCommand(createFullControlCommand());
    program.addCommand(createMigrateCommand());
    program.addCommand(createTelemetryCommand());
    program.addCommand(createDoctorCommand());

    await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
    const message =
        error instanceof Error
            ? error.message
            : "Erro inesperado ao executar o CLI do cullet.";
    console.error(pc.red(`Erro: ${message}`));
    process.exitCode = 1;
});
