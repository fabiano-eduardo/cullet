#!/usr/bin/env node
// Scaffolds a new kit under kits/<name>/versions/1.0.0/ from templates/kit/,
// substituting placeholders and updating registry/index.json. Internal command
// for catalog maintainers — not exposed to end-users.
//
// Usage: node scripts/new-kit.mjs <kit-name> [--description "..."]

import { readFile, readdir, stat, mkdir, copyFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const templateRoot = resolve(repoRoot, "templates", "kit");
const kitsRoot = resolve(repoRoot, "kits");
const registryPath = resolve(repoRoot, "registry", "index.json");

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const KIT_NAME_RE = /^[a-z][a-z0-9-]*$/;

function fail(message) {
  console.error(c.red(`new-kit: ${message}`));
  process.exit(1);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let name;
  let description;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--description" || arg === "-d") {
      description = args[i + 1];
      i += 1;
    } else if (arg.startsWith("--description=")) {
      description = arg.slice("--description=".length);
    } else if (!arg.startsWith("-") && name === undefined) {
      name = arg;
    } else {
      fail(`unknown argument: ${arg}`);
    }
  }

  if (!name) fail("kit name is required. Usage: node scripts/new-kit.mjs <kit-name>");
  if (!KIT_NAME_RE.test(name)) {
    fail(
      `invalid kit name "${name}". Use kebab-case starting with a letter: ^[a-z][a-z0-9-]*$`,
    );
  }
  if (!description) description = `Kit ${name} gerado a partir do template.`;
  if (description.length < 10) {
    fail("description must be at least 10 characters (schema requirement).");
  }

  return { name, description };
}

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

function toCamelCase(name) {
  return name
    .split("-")
    .map((part, i) =>
      i === 0
        ? part
        : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join("");
}

function toScreamingSnakeCase(name) {
  return name.toUpperCase().replace(/-/g, "_");
}

function applySubstitutions(content, ctx) {
  return content
    .replace(/__KIT_NAME__/g, ctx.name)
    .replace(/__KIT_DESCRIPTION__/g, ctx.description)
    .replace(/__KIT_CONST__/g, `${ctx.screamingSnake}_`)
    .replace(/__KIT_CAMEL__/g, ctx.camel);
}

const SUBSTITUTE_EXTENSIONS = new Set([
  ".ts",
  ".md",
  ".json",
  ".mjs",
  ".cjs",
  ".js",
]);

function shouldSubstitute(file) {
  const lastDot = file.lastIndexOf(".");
  if (lastDot === -1) return false;
  return SUBSTITUTE_EXTENSIONS.has(file.slice(lastDot));
}

async function copyTree(srcRoot, destRoot, ctx) {
  const entries = await readdir(srcRoot, { withFileTypes: true });
  await mkdir(destRoot, { recursive: true });

  for (const entry of entries) {
    const srcPath = join(srcRoot, entry.name);
    const destPath = join(destRoot, entry.name);

    if (entry.isDirectory()) {
      await copyTree(srcPath, destPath, ctx);
      continue;
    }

    if (entry.name === ".gitkeep") {
      await copyFile(srcPath, destPath);
      continue;
    }

    if (shouldSubstitute(entry.name)) {
      const raw = await readFile(srcPath, "utf8");
      const substituted = applySubstitutions(raw, ctx);
      await writeFile(destPath, substituted, "utf8");
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

async function readRegistry() {
  const raw = await readFile(registryPath, "utf8");
  const parsed = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    fail("registry/index.json is not a JSON object.");
  }
  return parsed;
}

async function writeRegistry(registry) {
  const sorted = Object.fromEntries(
    Object.keys(registry)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => [key, registry[key]]),
  );
  await writeFile(registryPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

async function main() {
  const { name, description } = parseArgs(process.argv);
  const version = "1.0.0";

  const ctx = {
    name,
    description,
    camel: toCamelCase(name),
    screamingSnake: toScreamingSnakeCase(name),
  };

  if (!(await pathExists(templateRoot))) {
    fail(`template not found at ${relative(repoRoot, templateRoot)}.`);
  }

  const registry = await readRegistry();
  if (registry[name] !== undefined) {
    fail(`kit "${name}" already exists in registry/index.json.`);
  }

  const destDir = join(kitsRoot, name, "versions", version);
  if (await pathExists(destDir)) {
    fail(`destination already exists: ${relative(repoRoot, destDir)}.`);
  }

  await copyTree(templateRoot, destDir, ctx);

  registry[name] = {
    versions: [version],
    latest: version,
    description,
  };
  await writeRegistry(registry);

  console.log(c.green(`✓ created kit ${c.bold(`${name}@${version}`)}`));
  console.log(`  files in: ${c.cyan(relative(repoRoot, destDir))}`);
  console.log(`  registry: ${c.cyan(relative(repoRoot, registryPath))} updated`);
  console.log("");
  console.log(c.bold("Next steps:"));
  console.log(`  1. edit ${c.cyan(relative(repoRoot, join(destDir, "meta.json")))} (philosophy, exports)`);
  console.log(`  2. fill ${c.cyan(relative(repoRoot, join(destDir, "KIT_CONTEXT.md")))} with the real prompt-friendly summary`);
  console.log(`  3. implement the layers under ${c.cyan(relative(repoRoot, join(destDir, "core")))}`);
  console.log(`  4. run ${c.cyan("npm run validate-kits")} to lint your kit`);
  console.log(`  5. run ${c.cyan("npm run build")} to bundle it (sync-exports is automatic via prebuild)`);
}

main().catch((err) => {
  console.error(c.red("new-kit crashed:"), err);
  process.exit(2);
});
