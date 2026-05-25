#!/usr/bin/env node
// Valida cada kit em kits/<name>/versions/<v>/ contra kits/kit-spec.schema.json
// e contra as regras de lint declaradas em meta.json.lint.
//
// Saída: relatório agrupado por kit; exit code != 0 se houver erros (warnings não bloqueiam).

import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const kitsRoot = resolve(repoRoot, "kits");
const schemaPath = resolve(kitsRoot, "kit-spec.schema.json");

const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const DEFAULT_LINT = {
  nodenextImports: "error",
  noBareAny: "error",
  noExternalImports: "error",
  noUpwardImports: "error",
};

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

async function findKitMetas() {
  const out = [];
  const kits = await readdir(kitsRoot, { withFileTypes: true });
  for (const k of kits) {
    if (!k.isDirectory()) continue;
    const versionsDir = join(kitsRoot, k.name, "versions");
    if (!(await exists(versionsDir))) continue;
    const versions = await readdir(versionsDir, { withFileTypes: true });
    for (const v of versions) {
      if (!v.isDirectory()) continue;
      const kitDir = join(versionsDir, v.name);
      const metaPath = join(kitDir, "meta.json");
      if (await exists(metaPath)) {
        out.push({ kitName: k.name, version: v.name, kitDir, metaPath });
      }
    }
  }
  return out;
}

// --- Schema validator (lean, hand-rolled for this schema's shape) ---

function validateAgainstSchema(data, schema, path = "$") {
  const errors = [];

  if (Array.isArray(schema.oneOf)) {
    const variantErrors = schema.oneOf.map((variant) =>
      validateAgainstSchema(data, variant, path),
    );
    const matched = variantErrors.some((errs) => errs.length === 0);
    if (!matched) {
      const detail = variantErrors
        .map((errs, i) => `  variant ${i}: ${errs.join("; ")}`)
        .join("\n");
      errors.push(`${path}: did not match any of oneOf variants\n${detail}`);
    }
    return errors;
  }

  const type = schema.type;
  if (type === "object") {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      errors.push(`${path}: expected object`);
      return errors;
    }
    for (const req of schema.required ?? []) {
      if (!(req in data)) errors.push(`${path}: missing required field "${req}"`);
    }
    for (const [k, v] of Object.entries(data)) {
      if (schema.properties && k in schema.properties) {
        errors.push(...validateAgainstSchema(v, schema.properties[k], `${path}.${k}`));
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: unknown field "${k}"`);
      }
    }
  } else if (type === "array") {
    if (!Array.isArray(data)) { errors.push(`${path}: expected array`); return errors; }
    if (schema.uniqueItems && new Set(data.map((x) => JSON.stringify(x))).size !== data.length) {
      errors.push(`${path}: items must be unique`);
    }
    if (schema.items) {
      data.forEach((item, i) => {
        errors.push(...validateAgainstSchema(item, schema.items, `${path}[${i}]`));
      });
    }
  } else if (type === "string") {
    if (typeof data !== "string") { errors.push(`${path}: expected string`); return errors; }
    if (schema.minLength != null && data.length < schema.minLength) {
      errors.push(`${path}: string shorter than minLength ${schema.minLength}`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${path}: does not match pattern ${schema.pattern}`);
    }
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push(`${path}: must be one of ${JSON.stringify(schema.enum)}`);
    }
  } else if (type === "boolean") {
    if (typeof data !== "boolean") errors.push(`${path}: expected boolean`);
  }
  // top-level schema may use `enum` without `type` (e.g. lint values)
  if (!type && schema.enum && !schema.enum.includes(data)) {
    errors.push(`${path}: must be one of ${JSON.stringify(schema.enum)}`);
  }
  return errors;
}

// --- File walker ---

async function walkTs(dir, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walkTs(p, acc);
    else if (e.isFile() && e.name.endsWith(".ts")) acc.push(p);
  }
  return acc;
}

// --- Import extraction ---

const IMPORT_RE = /(?:^|\n)\s*(?:import\b[^;]*?from|export\b[^;]*?from|import\()\s*['"]([^'"]+)['"]/g;

function extractImports(src) {
  const out = [];
  let m;
  while ((m = IMPORT_RE.exec(src)) !== null) out.push(m[1]);
  return out;
}

// --- Any-usage scanner (skips strings & comments roughly) ---

function stripCommentsAndStrings(src) {
  // Replace block comments
  let s = src.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
  // Replace line comments (preserve newlines)
  s = s.replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
  // Replace string literals (single, double, backtick) — keep length so line numbers stay
  s = s.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, (m) => m[0] + " ".repeat(m.length - 2) + m[0]);
  return s;
}

function findBareAny(src) {
  const stripped = stripCommentsAndStrings(src);
  const ANY_RE = /(?<![A-Za-z0-9_$])(?::\s*any\b|as\s+any\b|<any>|\bany\[\])/g;
  const hits = [];
  let m;
  while ((m = ANY_RE.exec(stripped)) !== null) {
    const upto = src.slice(0, m.index);
    const line = upto.split("\n").length;
    const lineEnd = src.indexOf("\n", m.index);
    const lineSrc = src.slice(upto.lastIndexOf("\n") + 1, lineEnd === -1 ? src.length : lineEnd);
    // Justification: trailing "// any-ok: <reason>" on same line
    if (/\/\/\s*any-ok:/.test(lineSrc)) continue;
    hits.push({ line, snippet: lineSrc.trim() });
  }
  return hits;
}

// --- Main validation pass ---

function level(lintCfg, rule) {
  return lintCfg[rule] ?? DEFAULT_LINT[rule];
}

function isRelative(spec) {
  return spec.startsWith("./") || spec.startsWith("../") || spec === "." || spec === "..";
}

function isBare(spec) {
  return !isRelative(spec) && !spec.startsWith("/") && !spec.startsWith("node:");
}

function bareRoot(spec) {
  if (spec.startsWith("@")) return spec.split("/").slice(0, 2).join("/");
  return spec.split("/")[0];
}

function resolveRelative(fromFile, spec) {
  // Mirror what TS bundler resolution does for our limited use: drop trailing /
  return resolve(dirname(fromFile), spec);
}

async function validateKit(kit, schema) {
  const findings = []; // { severity: "error"|"warn", msg, file? }

  let meta;
  try {
    meta = JSON.parse(await readFile(kit.metaPath, "utf8"));
  } catch (err) {
    findings.push({ severity: "error", msg: `meta.json: invalid JSON — ${err.message}` });
    return { kit, findings };
  }

  const schemaErrors = validateAgainstSchema(meta, schema);
  for (const e of schemaErrors) findings.push({ severity: "error", msg: `schema: ${e}` });
  if (schemaErrors.length > 0) return { kit, findings };

  // Existence checks
  const readmePath = join(kit.kitDir, meta.docs.readme);
  const contextPath = join(kit.kitDir, meta.docs.context);
  const entryPath = join(kit.kitDir, meta.entryPoint);

  for (const [label, p] of [
    ["docs.readme", readmePath],
    ["docs.context", contextPath],
    ["entryPoint", entryPath],
  ]) {
    if (!(await exists(p))) {
      findings.push({ severity: "error", msg: `${label}: file not found at ${relative(kit.kitDir, p)}` });
      continue;
    }
    if (label !== "entryPoint") {
      const content = (await readFile(p, "utf8")).trim();
      if (content.length === 0) findings.push({ severity: "error", msg: `${label}: file is empty` });
    }
  }

  // Lint pass
  const lint = meta.lint ?? {};
  const externalDeps = new Set(meta.philosophy.externalDeps ?? []);
  const testDeps = new Set(meta.philosophy.testDeps ?? []);

  const tsFiles = await walkTs(kit.kitDir);
  const kitDirResolved = resolve(kit.kitDir);

  for (const file of tsFiles) {
    const rel = relative(kit.kitDir, file);
    const isSpec = /\.spec\.ts$/.test(file) || /\.test\.ts$/.test(file);
    const src = await readFile(file, "utf8");

    // Imports
    const imports = extractImports(src);
    for (const spec of imports) {
      if (isRelative(spec)) {
        // noUpwardImports
        const lvl = level(lint, "noUpwardImports");
        if (lvl !== "off") {
          const target = resolveRelative(file, spec);
          if (!target.startsWith(kitDirResolved)) {
            findings.push({
              severity: lvl,
              msg: `import escapes kit root: "${spec}"`,
              file: rel,
            });
          }
        }
        // nodenextImports
        const nl = level(lint, "nodenextImports");
        if (nl !== "off") {
          if (!/\.(js|mjs|cjs|json)$/.test(spec)) {
            findings.push({
              severity: nl,
              msg: `relative import missing extension (nodenext-safe): "${spec}"`,
              file: rel,
            });
          }
        }
      } else if (isBare(spec)) {
        const nl = level(lint, "noExternalImports");
        if (nl !== "off") {
          const root = bareRoot(spec);
          const allowed = externalDeps.has(root) || (isSpec && testDeps.has(root));
          if (!allowed) {
            findings.push({
              severity: nl,
              msg: `external import not declared in philosophy.${isSpec ? "testDeps|externalDeps" : "externalDeps"}: "${spec}"`,
              file: rel,
            });
          }
        }
      }
    }

    // Bare any
    const anyLvl = level(lint, "noBareAny");
    if (anyLvl !== "off") {
      for (const hit of findBareAny(src)) {
        findings.push({
          severity: anyLvl,
          msg: `bare "any" without "// any-ok: <reason>" justification — ${hit.snippet}`,
          file: `${rel}:${hit.line}`,
        });
      }
    }
  }

  return { kit, findings };
}

async function main() {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const kits = await findKitMetas();
  if (kits.length === 0) {
    console.error(c.red("no kits found under kits/*/versions/*/meta.json"));
    process.exit(1);
  }

  let errors = 0;
  let warnings = 0;

  for (const kit of kits) {
    const { findings } = await validateKit(kit, schema);
    const errs = findings.filter((f) => f.severity === "error");
    const warns = findings.filter((f) => f.severity === "warn");
    errors += errs.length;
    warnings += warns.length;

    const header = `${kit.kitName}@${kit.version}`;
    if (findings.length === 0) {
      console.log(`${c.green("✓")} ${c.bold(header)} ${c.dim("(no findings)")}`);
      continue;
    }
    const status = errs.length > 0 ? c.red("✗") : c.yellow("!");
    console.log(`${status} ${c.bold(header)} — ${errs.length} error(s), ${warns.length} warning(s)`);
    for (const f of findings) {
      const tag = f.severity === "error" ? c.red("error") : c.yellow("warn ");
      const loc = f.file ? c.dim(` [${f.file}]`) : "";
      console.log(`  ${tag} ${f.msg}${loc}`);
    }
  }

  console.log(c.dim(`\n${kits.length} kit(s) scanned — ${errors} error(s), ${warnings} warning(s).`));
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(c.red("validate-kit crashed:"), err);
  process.exit(2);
});
