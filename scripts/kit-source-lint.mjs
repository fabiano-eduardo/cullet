// The per-source-file lint pass for importable library kits: walks every .ts
// file once and applies the file-scoped rules (size, import hygiene,
// architecture layers, pure ports, application Result constraint, test
// conventions, no module mocks in core tests, bare `any`). Appends to the
// shared `findings` array — behaviour is identical to the inline loop it
// replaced in validate-kit.mjs.

import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import ts from "typescript";
import { collectModuleSpecifiers, parseTsSource } from "./source-analysis.mjs";
import {
    collectExportNames,
    collectRootDescribeTitles,
    collectTestCaseTitles,
    getTypeParameterConstraintText,
    hasModuleMockCallInSourceFile,
    hasOutputTypeParameter,
    hasRuntimeImport,
    isPortDeclarationStatement,
    matchesResultConstraint,
    visit,
} from "./kit-ast.mjs";
import {
    bareRoot,
    baseNameWithoutSpec,
    exists,
    expectedTargetPathForSpec,
    findBareAny,
    getCoreLayerFromPath,
    hardSeverity,
    isAllowedPackageRootImport,
    isBare,
    isRelative,
    isSpecFile,
    level,
    normalizeLabel,
    pushFinding,
    resolveRelative,
    softSeverity,
} from "./kit-lint-helpers.mjs";

export async function checkSourceFiles(
    kit,
    lint,
    tsFiles,
    externalDeps,
    testDeps,
    kitDirResolved,
    findings,
) {
    for (const file of tsFiles) {
        const rel = relative(kit.sourceDir, file);
        const isSpec = isSpecFile(file);
        const src = await readFile(file, "utf8");
        const sourceFile = parseTsSource(file, src);
        const imports = collectModuleSpecifiers(sourceFile);

        const fileSizeLint = level(lint, "fileSize");
        if (fileSizeLint !== "off") {
            const lineCount = src.split("\n").length;
            if (lineCount > 600) {
                pushFinding(
                    findings,
                    hardSeverity(fileSizeLint),
                    `file exceeds hard size limit of 600 lines (${lineCount})`,
                    rel,
                );
            } else if (lineCount > 300) {
                pushFinding(
                    findings,
                    softSeverity(fileSizeLint),
                    `file exceeds review threshold of 300 lines (${lineCount})`,
                    rel,
                );
            }
        }

        // Imports
        for (const spec of imports) {
            if (isRelative(spec)) {
                // noUpwardImports
                const lvl = level(lint, "noUpwardImports");
                if (lvl !== "off") {
                    const target = resolveRelative(file, spec);
                    if (
                        !target.startsWith(kitDirResolved) &&
                        !isAllowedPackageRootImport(kit, target)
                    ) {
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
                    const allowed =
                        externalDeps.has(root) ||
                        (isSpec && testDeps.has(root));
                    if (!allowed) {
                        findings.push({
                            severity: nl,
                            msg: `external import not declared in philosophy.${
                                isSpec
                                    ? "testDeps|externalDeps"
                                    : "externalDeps"
                            }: "${spec}"`,
                            file: rel,
                        });
                    }
                }
            }
        }

        const architectureLint = level(lint, "architectureLayers");
        if (architectureLint !== "off") {
            const sourceLayer = getCoreLayerFromPath(kit.sourceDir, file);
            for (const spec of imports) {
                if (sourceLayer === "domain" && !isSpec && isBare(spec)) {
                    pushFinding(
                        findings,
                        architectureLint,
                        `domain must not import runtime modules from outside the kit: "${spec}"`,
                        rel,
                    );
                    continue;
                }

                if (!isRelative(spec)) continue;

                const target = resolveRelative(file, spec);
                const targetLayer = getCoreLayerFromPath(kit.sourceDir, target);

                if (sourceLayer === "domain" && !isSpec) {
                    if (
                        targetLayer === "application" ||
                        targetLayer === "adapters"
                    ) {
                        pushFinding(
                            findings,
                            architectureLint,
                            `domain may only import domain or exceptions; found "${spec}"`,
                            rel,
                        );
                    }
                }

                if (
                    sourceLayer === "application" &&
                    targetLayer === "adapters"
                ) {
                    pushFinding(
                        findings,
                        architectureLint,
                        `application must not import adapters directly`,
                        rel,
                    );
                }

                if (
                    sourceLayer === "adapters" &&
                    targetLayer === "application"
                ) {
                    pushFinding(
                        findings,
                        architectureLint,
                        `adapters must not import application directly`,
                        rel,
                    );
                }
            }
        }

        const portsLint = level(lint, "portsArePure");
        if (portsLint !== "off" && rel.startsWith("core/application/ports/")) {
            for (const stmt of sourceFile.statements) {
                if (!isPortDeclarationStatement(stmt)) {
                    const kind = ts.SyntaxKind[stmt.kind] ?? "unknown";
                    pushFinding(
                        findings,
                        portsLint,
                        `ports must stay as pure contracts; found top-level ${kind}`,
                        rel,
                    );
                }
            }

            for (const stmt of sourceFile.statements) {
                if (!ts.isImportDeclaration(stmt)) continue;
                if (hasRuntimeImport(stmt)) {
                    pushFinding(
                        findings,
                        portsLint,
                        `ports must use type-only imports`,
                        rel,
                    );
                }
            }
        }

        const applicationResultLint = level(lint, "applicationReturnsResult");
        if (
            applicationResultLint !== "off" &&
            rel.startsWith("core/application/") &&
            !rel.startsWith("core/application/ports/") &&
            !isSpec
        ) {
            visit(sourceFile, (node) => {
                if (!ts.isClassDeclaration(node) || !node.name) return;
                if (!hasOutputTypeParameter(node)) return;
                const constraint = getTypeParameterConstraintText(
                    node,
                    sourceFile,
                    "Output",
                );
                if (!matchesResultConstraint(constraint)) {
                    pushFinding(
                        findings,
                        applicationResultLint,
                        `application class ${node.name.text} must constrain Output to Result<...>`,
                        rel,
                    );
                }
            });
        }

        const testLint = level(lint, "testConventions");
        if (testLint !== "off" && isSpec) {
            if (rel.includes("/__tests__/")) {
                pushFinding(
                    findings,
                    testLint,
                    `tests must be colocated; __tests__/ is not allowed`,
                    rel,
                );
            }

            if (rel.endsWith(".test.ts")) {
                pushFinding(
                    findings,
                    testLint,
                    `test files must use the .spec.ts suffix`,
                    rel,
                );
            }

            const rootDescribeTitles = collectRootDescribeTitles(sourceFile);
            if (rootDescribeTitles.length === 0) {
                pushFinding(
                    findings,
                    testLint,
                    `spec file must declare at least one root describe() block`,
                    rel,
                );
            } else if (rootDescribeTitles.some((title) => title == null)) {
                pushFinding(
                    findings,
                    testLint,
                    `root describe() title must be a string literal`,
                    rel,
                );
            } else if (rootDescribeTitles.length === 1) {
                const expected = normalizeLabel(baseNameWithoutSpec(rel));
                const actual = normalizeLabel(rootDescribeTitles[0]);
                const targetPath = expectedTargetPathForSpec(file);
                let exportedNames = [];
                if (targetPath && (await exists(targetPath))) {
                    const targetSrc = await readFile(targetPath, "utf8");
                    exportedNames = collectExportNames(
                        parseTsSource(targetPath, targetSrc),
                    ).map((name) => normalizeLabel(name));
                }
                const matchesTarget =
                    actual === expected ||
                    actual.includes(expected) ||
                    expected.includes(actual);
                const matchesExport = exportedNames.some(
                    (name) =>
                        actual === name ||
                        actual.includes(name) ||
                        name.includes(actual),
                );
                if (!matchesTarget && !matchesExport) {
                    pushFinding(
                        findings,
                        testLint,
                        `root describe() must match the tested unit name`,
                        rel,
                    );
                }
            }

            for (const title of collectTestCaseTitles(sourceFile)) {
                if (title == null) {
                    pushFinding(
                        findings,
                        testLint,
                        `it()/test() titles must be string literals`,
                        rel,
                    );
                    continue;
                }
                if (/^should\b/i.test(title)) {
                    pushFinding(
                        findings,
                        testLint,
                        `it() descriptions must avoid "should"; use active voice`,
                        rel,
                    );
                }
            }
        }

        const noMocksLint = level(lint, "noMocksInCoreTests");
        if (
            noMocksLint !== "off" &&
            isSpec &&
            /^(core\/domain|core\/application)\//.test(rel) &&
            hasModuleMockCallInSourceFile(sourceFile)
        ) {
            pushFinding(
                findings,
                noMocksLint,
                `core tests must use in-memory stubs instead of module mocks`,
                rel,
            );
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
}
