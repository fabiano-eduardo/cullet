#!/usr/bin/env node

import { Command } from "commander";
import pc from "picocolors";
import { createFullControlCommand } from "./commands/fullControl.js";
import { createInstallCommand } from "./commands/install.js";
import { createListCommand } from "./commands/list.js";

const program = new Command();

program
  .name("cullet")
  .description("Colecao de kits arquiteturais opinativos")
  .version("0.1.0");

program.addCommand(createListCommand());
program.addCommand(createInstallCommand());
program.addCommand(createFullControlCommand());

program.parseAsync(process.argv).catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : "Erro inesperado ao executar o CLI do cullet.";
  console.error(pc.red(`Erro: ${message}`));
  process.exitCode = 1;
});
