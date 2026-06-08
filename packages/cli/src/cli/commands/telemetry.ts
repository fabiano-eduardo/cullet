import { Command } from "commander";
import pc from "picocolors";
import {
    disableTelemetry,
    enableTelemetry,
    getTelemetryStatus,
} from "../utils/telemetry.js";

interface EnableTelemetryOptions {
    endpoint?: string;
}

function printStatus(
    status: Awaited<ReturnType<typeof getTelemetryStatus>>,
): void {
    console.log(
        status.enabled
            ? pc.green("Telemetria do CLI: habilitada")
            : pc.yellow("Telemetria do CLI: desabilitada"),
    );
    console.log(pc.dim(`Config: ${status.configPath}`));
    console.log(pc.dim(`Log local: ${status.localLogPath}`));
    if (status.endpoint) {
        console.log(pc.dim(`Endpoint remoto: ${status.endpoint}`));
    } else {
        console.log(pc.dim("Endpoint remoto: nao configurado"));
    }
}

export function createTelemetryCommand(): Command {
    const command = new Command("telemetry").description(
        "Gerencia a telemetria opt-in do CLI do cullet",
    );

    command.action(async () => {
        printStatus(await getTelemetryStatus());
    });

    command
        .command("status")
        .description("Mostra o estado atual da telemetria")
        .action(async () => {
            printStatus(await getTelemetryStatus());
        });

    command
        .command("enable")
        .description("Habilita a telemetria opt-in")
        .option(
            "--endpoint <url>",
            "Endpoint HTTPS para exportar eventos alem do log local",
        )
        .action(async (options: EnableTelemetryOptions) => {
            const status = await enableTelemetry({
                endpoint: options.endpoint,
            });
            printStatus(status);
            console.log("");
            console.log(
                pc.dim(
                    "Os eventos continuam sendo gravados localmente; o endpoint remoto e opcional, precisa usar HTTPS e recebe um POST JSON por evento.",
                ),
            );
        });

    command
        .command("disable")
        .description("Desabilita a telemetria opt-in")
        .action(async () => {
            printStatus(await disableTelemetry());
        });

    return command;
}
