// TypeScript AST helpers used by the kit lint pass: small, dependency-free
// readers over a parsed SourceFile (describe/it titles, exported names, port
// declarations, type-only imports, mock calls, …). Pure analysis — no findings.

import ts from "typescript";
import { parseTsSource } from "./source-analysis.mjs";

export function visit(node, cb) {
    cb(node);
    ts.forEachChild(node, (child) => visit(child, cb));
}

export function getCallName(node) {
    if (ts.isIdentifier(node.expression)) return node.expression.text;
    if (ts.isPropertyAccessExpression(node.expression))
        return node.expression.name.text;
    return null;
}

function isModuleMockCallExpression(node) {
    if (!ts.isCallExpression(node)) return false;
    if (!ts.isPropertyAccessExpression(node.expression)) return false;
    const { expression, name } = node.expression;
    return (
        ts.isIdentifier(expression) &&
        (expression.text === "vi" || expression.text === "jest") &&
        name.text === "mock"
    );
}

export function hasModuleMockCallInSourceFile(sourceFile) {
    let found = false;

    visit(sourceFile, (node) => {
        if (!found && isModuleMockCallExpression(node)) {
            found = true;
        }
    });

    return found;
}

export function hasModuleMockCall(src, file = "inline.ts") {
    return hasModuleMockCallInSourceFile(parseTsSource(file, src));
}

export function collectRootDescribeTitles(sourceFile) {
    const titles = [];

    for (const stmt of sourceFile.statements) {
        if (!ts.isExpressionStatement(stmt)) continue;
        if (!ts.isCallExpression(stmt.expression)) continue;
        if (getCallName(stmt.expression) !== "describe") continue;

        const [titleArg] = stmt.expression.arguments;
        if (
            ts.isStringLiteral(titleArg) ||
            ts.isNoSubstitutionTemplateLiteral(titleArg)
        ) {
            titles.push(titleArg.text);
        } else {
            titles.push(null);
        }
    }

    return titles;
}

export function collectTestCaseTitles(sourceFile) {
    const titles = [];

    visit(sourceFile, (node) => {
        if (!ts.isCallExpression(node)) return;
        const name = getCallName(node);
        if (name !== "it" && name !== "test") return;

        const [titleArg] = node.arguments;
        if (
            ts.isStringLiteral(titleArg) ||
            ts.isNoSubstitutionTemplateLiteral(titleArg)
        ) {
            titles.push(titleArg.text);
        } else {
            titles.push(null);
        }
    });

    return titles;
}

export function collectExportNames(sourceFile) {
    const names = new Set();

    for (const stmt of sourceFile.statements) {
        if (
            ts.isClassDeclaration(stmt) ||
            ts.isFunctionDeclaration(stmt) ||
            ts.isInterfaceDeclaration(stmt) ||
            ts.isTypeAliasDeclaration(stmt)
        ) {
            if (
                stmt.modifiers?.some(
                    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
                ) &&
                stmt.name
            ) {
                names.add(stmt.name.text);
            }
            continue;
        }

        if (!ts.isVariableStatement(stmt)) continue;
        if (
            !stmt.modifiers?.some(
                (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
            )
        )
            continue;
        for (const decl of stmt.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) names.add(decl.name.text);
        }
    }

    return [...names];
}

export function getTypeParameterConstraintText(
    classDecl,
    sourceFile,
    typeParamName,
) {
    const typeParam = classDecl.typeParameters?.find(
        (param) => param.name.text === typeParamName,
    );
    if (!typeParam?.constraint) return null;
    return typeParam.constraint.getText(sourceFile);
}

export function hasRuntimeImport(importDecl) {
    const clause = importDecl.importClause;
    if (!clause) return true;
    if (clause.isTypeOnly) return false;
    if (clause.name) return true;
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings))
        return true;
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        return clause.namedBindings.elements.some(
            (element) => !element.isTypeOnly,
        );
    }
    return true;
}

export function isPortDeclarationStatement(stmt) {
    return (
        ts.isInterfaceDeclaration(stmt) ||
        ts.isTypeAliasDeclaration(stmt) ||
        (ts.isExportDeclaration(stmt) && stmt.isTypeOnly) ||
        (ts.isImportDeclaration(stmt) && !hasRuntimeImport(stmt))
    );
}

export function hasOutputTypeParameter(classDecl) {
    return (
        classDecl.typeParameters?.some(
            (param) => param.name.text === "Output",
        ) ?? false
    );
}

export function matchesResultConstraint(constraintText) {
    return constraintText != null && /\bResult\s*</.test(constraintText);
}

// Bare-`any` scanner over the parsed AST. Replaces the old regex heuristic:
// it flags exactly the `any` *type* keyword (annotations, generic arguments,
// `as any`, `<any>` casts, `any[]`, return types, …) and never the identifier
// or word "any" living in comments, strings, property names or test titles —
// so it has no false positives. A line carrying a trailing
// `// any-ok: <reason>` justification is skipped. One finding per offending
// line. Returns `{ line, snippet }[]` with 1-based line numbers, matching the
// shape the lint pass already reports.
export function findBareAnyUsages(sourceFile) {
    const fullText = sourceFile.getFullText();
    const hits = [];
    const seenLines = new Set();

    visit(sourceFile, (node) => {
        if (node.kind !== ts.SyntaxKind.AnyKeyword) return;

        const start = node.getStart(sourceFile);
        const { line } = sourceFile.getLineAndCharacterOfPosition(start);
        if (seenLines.has(line)) return;

        const lineStart = fullText.lastIndexOf("\n", start - 1) + 1;
        const newlineIndex = fullText.indexOf("\n", start);
        const lineEnd = newlineIndex === -1 ? fullText.length : newlineIndex;
        const lineText = fullText.slice(lineStart, lineEnd);

        // Justification: trailing "// any-ok: <reason>" on the same line.
        if (/\/\/\s*any-ok:/.test(lineText)) return;

        seenLines.add(line);
        hits.push({ line: line + 1, snippet: lineText.trim() });
    });

    return hits;
}
