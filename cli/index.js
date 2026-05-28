#!/usr/bin/env node

async function main() {
  try {
    const cliEntryUrl = new URL("../dist/cli/index.js", import.meta.url);
    await import(cliEntryUrl.href);
  } catch (error) {
    const message =
      error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

void main();
