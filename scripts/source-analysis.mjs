import { readdirSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import ts from "typescript";

const DEFAULT_IGNORED_DIRECTORIES = new Set(["node_modules"]);

/** @type {ReadonlySet<string>} */
export const TYPESCRIPT_SOURCE_EXTENSIONS = new Set([
    ".cts",
    ".mts",
    ".ts",
    ".tsx",
]);

/**
 * @typedef {{
 *   extensions?: ReadonlySet<string>;
 *   ignoredDirectories?: ReadonlySet<string>;
 *   ignoreDotEntries?: boolean;
 * }} WalkOptions
 */

/**
 * @typedef {{
 *   includeDynamicImports?: boolean;
 *   includeImportEquals?: boolean;
 * }} ModuleSpecifierOptions
 */

/**
 * @param {string} entryName
 * @param {ReadonlySet<string>} ignoredDirectories
 * @param {boolean} ignoreDotEntries
 * @returns {boolean}
 */
function shouldSkipEntry(entryName, ignoredDirectories, ignoreDotEntries) {
    return (
        ignoredDirectories.has(entryName) ||
        (ignoreDotEntries && entryName.startsWith("."))
    );
}

/**
 * @param {WalkOptions} [options]
 */
function resolveWalkOptions(options = {}) {
    return {
        extensions: options.extensions,
        ignoredDirectories:
            options.ignoredDirectories ?? DEFAULT_IGNORED_DIRECTORIES,
        ignoreDotEntries: options.ignoreDotEntries ?? true,
    };
}

/**
 * @param {string} filePath
 * @param {ReadonlySet<string> | undefined} extensions
 * @returns {boolean}
 */
function matchesExtensions(filePath, extensions) {
    return extensions === undefined || extensions.has(extname(filePath));
}

/**
 * @param {string} rootDir
 * @param {WalkOptions} [options]
 * @returns {Promise<string[]>}
 */
export async function walkFiles(rootDir, options = {}) {
    const files = [];
    const { extensions, ignoredDirectories, ignoreDotEntries } =
        resolveWalkOptions(options);

    const walk = async (currentDir) => {
        for (const entry of await readdir(currentDir, {
            withFileTypes: true,
        })) {
            if (
                shouldSkipEntry(
                    entry.name,
                    ignoredDirectories,
                    ignoreDotEntries,
                )
            ) {
                continue;
            }

            const entryPath = join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await walk(entryPath);
                continue;
            }

            if (entry.isFile() && matchesExtensions(entryPath, extensions)) {
                files.push(entryPath);
            }
        }
    };

    await walk(rootDir);

    return files;
}

/**
 * @param {string} rootDir
 * @param {WalkOptions} [options]
 * @returns {string[]}
 */
export function walkFilesSync(rootDir, options = {}) {
    const files = [];
    const { extensions, ignoredDirectories, ignoreDotEntries } =
        resolveWalkOptions(options);

    const walk = (currentDir) => {
        for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
            if (
                shouldSkipEntry(
                    entry.name,
                    ignoredDirectories,
                    ignoreDotEntries,
                )
            ) {
                continue;
            }

            const entryPath = join(currentDir, entry.name);
            if (entry.isDirectory()) {
                walk(entryPath);
                continue;
            }

            if (entry.isFile() && matchesExtensions(entryPath, extensions)) {
                files.push(entryPath);
            }
        }
    };

    walk(rootDir);

    return files;
}

/**
 * @param {string} sourcePath
 * @param {string} [sourceText]
 * @returns {import("typescript").SourceFile}
 */
export function parseTsSource(
    sourcePath,
    sourceText = readFileSync(sourcePath, "utf8"),
) {
    return ts.createSourceFile(
        sourcePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        extname(sourcePath) === ".tsx" ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
}

/**
 * @param {import("typescript").Node} node
 * @param {(node: import("typescript").Node) => void} cb
 */
function visit(node, cb) {
    cb(node);
    ts.forEachChild(node, (child) => visit(child, cb));
}

/**
 * @param {import("typescript").SourceFile} sourceFile
 * @param {ModuleSpecifierOptions} [options]
 * @returns {string[]}
 */
export function collectModuleSpecifiers(sourceFile, options = {}) {
    const specifiers = [];
    const includeDynamicImports = options.includeDynamicImports ?? true;
    const includeImportEquals = options.includeImportEquals ?? true;

    visit(sourceFile, (node) => {
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier !== undefined &&
            ts.isStringLiteralLike(node.moduleSpecifier)
        ) {
            specifiers.push(node.moduleSpecifier.text);
            return;
        }

        if (
            includeImportEquals &&
            ts.isImportEqualsDeclaration(node) &&
            ts.isExternalModuleReference(node.moduleReference) &&
            node.moduleReference.expression !== undefined &&
            ts.isStringLiteral(node.moduleReference.expression)
        ) {
            specifiers.push(node.moduleReference.expression.text);
            return;
        }

        if (
            includeDynamicImports &&
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments.length >= 1 &&
            ts.isStringLiteralLike(node.arguments[0])
        ) {
            specifiers.push(node.arguments[0].text);
        }
    });

    return specifiers;
}
