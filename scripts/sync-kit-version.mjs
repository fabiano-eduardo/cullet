#!/usr/bin/env node
// Sincroniza, a partir de package.json.version, os tres lugares que tambem
// carregam a versao de cada kit:
//   - packages/<kit>/src/version.ts        (entry auto-contido p/ copia full-control)
//   - packages/<kit>/meta.json             (campo "version" do contrato do kit)
//   - packages/cli/registry/index.json     (versions/latest do catalogo da CLI)
//
// Tambem projeta o array "changelog" do meta.json a partir do CHANGELOG.md
// (a fonte da verdade gerida pelo Changesets), para o changelog do contrato do
// kit nao defasar a cada release — como ja acontecera (faltavam 1.0.7/1.0.8 no
// erp-core e 1.0.1-1.0.3 no dummy-api).
//
// O entry de cada kit (src/index.ts) le a versao de ./version.js em vez de
// `../package.json`. Isso mantem o src/ auto-contido: a copia full-control
// (que copia apenas o conteudo de src/) compila sem depender de um arquivo
// um nivel acima que nao existe no projeto consumidor.
//
// package.json e a fonte da verdade (o Changesets a versiona, mas nao conhece
// version.ts, meta.json nem o registry). Este script projeta essa versao para
// os tres e roda como parte de `changeset:version`, mantendo o release
// consistente. No registry a projecao e ADITIVA (regra de imutabilidade de
// VERSIONING.md S2): a versao do pacote e acrescentada a "versions" se ainda
// nao estiver la (nenhuma versao antiga e removida) e "latest" passa a aponta-la.
//
// Flags:
//   --check   Nao escreve nada; sai com codigo != 0 se houver drift.

import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const here = dirname(scriptPath);
const repoRoot = resolve(here, "..");
const defaultPackagesRoot = resolve(repoRoot, "packages");

// O registry vive dentro do pacote da CLI. Derivamos o caminho de packagesRoot
// (e nao de repoRoot) para que os testes possam apontar para um workspace
// temporario com seu proprio registry.
export function registryPathFor(packagesRoot = defaultPackagesRoot) {
    return join(packagesRoot, "cli", "registry", "index.json");
}

// Comparador SemVer enxuto, suficiente para as versoes simples dos kits
// (x.y.z, com prerelease opcional). Mantem "versions" ordenada de forma
// deterministica ao acrescentar uma versao nova.
export function compareSemver(a, b) {
    const parse = (value) => {
        const [core] = String(value).split("+");
        const [main, prerelease = ""] = core.split("-");
        const nums = main
            .split(".")
            .map((part) => Number.parseInt(part, 10))
            .map((n) => (Number.isNaN(n) ? 0 : n));
        return { nums, prerelease };
    };

    const left = parse(a);
    const right = parse(b);

    for (let i = 0; i < 3; i += 1) {
        const diff = (left.nums[i] ?? 0) - (right.nums[i] ?? 0);
        if (diff !== 0) return diff < 0 ? -1 : 1;
    }

    // Uma versao com prerelease (1.0.0-beta.1) precede a final (1.0.0).
    if (left.prerelease && !right.prerelease) return -1;
    if (!left.prerelease && right.prerelease) return 1;
    if (left.prerelease === right.prerelease) return 0;
    return left.prerelease < right.prerelease ? -1 : 1;
}

async function pathExists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

export function renderVersionModule(version) {
    return [
        "// Versao do kit, sincronizada com package.json por scripts/sync-kit-version.mjs.",
        "// Nao edite a mao: rode `npm run sync-kit-version` (ou e regenerado no release).",
        "//",
        "// Mantemos a versao aqui, dentro de src/, para que a copia full-control seja",
        "// auto-contida: ao copiar so o conteudo de src/, o entry nao depende de um",
        "// `../package.json` que deixaria de existir no projeto consumidor.",
        `export const version = ${JSON.stringify(version)};`,
        "",
    ].join("\n");
}

export async function collectKitPackageEntries(
    packagesRoot = defaultPackagesRoot,
) {
    const packageEntries = await readdir(packagesRoot, { withFileTypes: true });
    const kits = [];

    for (const packageEntry of packageEntries) {
        if (!packageEntry.isDirectory() || packageEntry.name === "cli") {
            continue;
        }

        const dir = join(packagesRoot, packageEntry.name);
        const packageJsonPath = join(dir, "package.json");
        const metaPath = join(dir, "meta.json");

        if (
            !(await pathExists(packageJsonPath)) ||
            !(await pathExists(metaPath))
        ) {
            continue;
        }

        kits.push({
            kitName: packageEntry.name,
            dir,
            packageJsonPath,
            metaPath,
            versionFilePath: join(dir, "src", "version.ts"),
        });
    }

    return kits.sort((left, right) =>
        left.kitName.localeCompare(right.kitName),
    );
}

// Substitui apenas o valor do campo de nivel superior "version" no texto do
// JSON, preservando indentacao e o resto do arquivo byte a byte (para nao
// brigar com o Prettier). Nao casa "schemaVersion" (precisa de aspas + "v"
// minusculo logo apos), nem "since"/engines, que usam outras chaves.
export function setJsonVersionField(jsonText, version) {
    return jsonText.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
}

function normalizeChangelogSummary(text) {
    return text
        .replace(/\s+/g, " ")
        .replace(/\s*:+\s*$/, "")
        .trim();
}

// Deriva o array "changelog" do meta.json a partir do CHANGELOG.md gerido pelo
// Changesets. Para cada secao "## x.y.z" usa a primeira linha de bullet
// ("- <id>: <resumo>") como resumo de uma linha, removendo o prefixo do id do
// changeset e dois-pontos finais. O resultado fica em ordem crescente de versao
// (o CHANGELOG.md lista da mais nova para a mais antiga).
export function deriveChangelogFromMd(changelogText) {
    const lines = String(changelogText).split(/\r?\n/);
    const entries = [];

    for (const line of lines) {
        const header = /^##\s+(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\s*$/.exec(
            line,
        );
        if (header) {
            entries.push({ version: header[1], summary: null });
            continue;
        }

        const current = entries[entries.length - 1];
        if (current === undefined || current.summary !== null) continue;

        const bullet =
            /^-\s+(?:[0-9A-Za-z][0-9A-Za-z._-]*:\s+)?(.*\S)\s*$/.exec(line);
        if (bullet) {
            current.summary = normalizeChangelogSummary(bullet[1]);
        }
    }

    return entries
        .filter((entry) => entry.summary)
        .reverse()
        .map((entry) => `${entry.version} - ${entry.summary}`);
}

// Substitui in-place apenas o array "changelog" no texto do JSON, preservando o
// resto byte a byte (mesma estrategia de setJsonVersionField: nao reserializa o
// objeto inteiro, para nao reformatar outros arrays curtos que o Prettier
// mantem inline). Varre o array com um scanner que respeita strings e escapes,
// para funcionar tanto com arrays inline (curtos) quanto multi-linha, e com
// entradas que contenham colchetes. Assume 4 espacos por nivel de indentacao
// (prettier.config.mjs) e so atua quando o campo ja existe.
export function setJsonChangelogField(jsonText, changelog) {
    const keyMatch = /"changelog"\s*:\s*\[/.exec(jsonText);
    if (keyMatch === null) return jsonText;

    const keyIndex = keyMatch.index;
    const openBracket = jsonText.indexOf("[", keyIndex);
    const lineStart = jsonText.lastIndexOf("\n", keyIndex) + 1;
    const indent = /^[ \t]*/.exec(jsonText.slice(lineStart, keyIndex))[0];

    let inString = false;
    let escaped = false;
    let depth = 1;
    let cursor = openBracket + 1;
    for (; cursor < jsonText.length; cursor += 1) {
        const ch = jsonText[cursor];
        if (inString) {
            if (escaped) escaped = false;
            else if (ch === "\\") escaped = true;
            else if (ch === '"') inString = false;
            continue;
        }
        if (ch === '"') inString = true;
        else if (ch === "[") depth += 1;
        else if (ch === "]" && --depth === 0) break;
    }
    if (depth !== 0) return jsonText; // array malformado: nao arrisca reescrever

    const rendered =
        changelog.length === 0
            ? "[]"
            : `[\n${changelog
                  .map((entry) => `${indent.repeat(2)}${JSON.stringify(entry)}`)
                  .join(",\n")}\n${indent}]`;

    return (
        jsonText.slice(0, openBracket) + rendered + jsonText.slice(cursor + 1)
    );
}

// Projeta as versoes dos pacotes em packages/cli/registry/index.json, de forma
// aditiva: garante que cada versao esteja em "versions" e que "latest" aponte
// para a versao do package.json. Nunca remove versoes antigas (imutabilidade).
// Kits presentes em packages/ mas ausentes do registry viram erro (precisam de
// `new-kit` ou de uma entrada manual com description/npmName) — nao os criamos
// aqui porque essa metadata nao vem do package.json.
async function syncRegistry({
    packagesRoot,
    registryPath,
    kitVersions,
    check,
    drift,
    updated,
    errors,
}) {
    if (!(await pathExists(registryPath))) return;

    const registryText = await readFile(registryPath, "utf8");
    let registry;
    try {
        registry = JSON.parse(registryText);
    } catch (err) {
        errors.push(
            `${relative(repoRoot, registryPath)}: JSON invalido — ${err.message}`,
        );
        return;
    }

    let registryChanged = false;

    for (const [kitName, version] of kitVersions) {
        const entry = registry[kitName];

        if (
            entry === undefined ||
            entry === null ||
            typeof entry !== "object"
        ) {
            errors.push(
                `kit "${kitName}" existe em packages/ mas nao tem entrada em ${relative(
                    repoRoot,
                    registryPath,
                )} (rode \`npm run new-kit\` ou adicione a entrada manualmente).`,
            );
            continue;
        }

        const versions = Array.isArray(entry.versions)
            ? [...entry.versions]
            : [];
        let entryChanged = false;

        if (!versions.includes(version)) {
            versions.push(version);
            versions.sort(compareSemver);
            entry.versions = versions;
            entryChanged = true;
        }

        if (entry.latest !== version) {
            entry.latest = version;
            entryChanged = true;
        }

        if (entryChanged) {
            drift.push({ kitName, path: registryPath, version });
            registryChanged = true;
        }
    }

    if (registryChanged && !check) {
        await writeFile(
            registryPath,
            `${JSON.stringify(registry, null, 4)}\n`,
            "utf8",
        );
        updated.push(relative(packagesRoot, registryPath));
    }
}

export async function syncKitVersions(
    packagesRoot = defaultPackagesRoot,
    options = {},
) {
    const { check = false, registryPath = registryPathFor(packagesRoot) } =
        options;
    const kits = await collectKitPackageEntries(packagesRoot);
    const drift = [];
    const updated = [];
    const errors = [];
    const kitVersions = new Map();

    for (const kit of kits) {
        const packageJson = await readJsonFile(kit.packageJsonPath);
        const version = packageJson.version;
        kitVersions.set(kit.kitName, version);

        // 1) src/version.ts
        const expectedModule = renderVersionModule(version);
        const currentModule = (await pathExists(kit.versionFilePath))
            ? await readFile(kit.versionFilePath, "utf8")
            : null;

        if (currentModule !== expectedModule) {
            drift.push({
                kitName: kit.kitName,
                path: kit.versionFilePath,
                version,
            });
            if (!check) {
                await writeFile(kit.versionFilePath, expectedModule, "utf8");
                updated.push(relative(packagesRoot, kit.versionFilePath));
            }
        }

        // 2) meta.json -> campo "version" (o Changesets bumpa package.json mas
        // nao conhece o meta; sem isso o contrato do kit fica defasado).
        if (await pathExists(kit.metaPath)) {
            const metaText = await readFile(kit.metaPath, "utf8");
            const metaVersion = JSON.parse(metaText).version;

            if (metaVersion !== version) {
                drift.push({
                    kitName: kit.kitName,
                    path: kit.metaPath,
                    version,
                });
                if (!check) {
                    await writeFile(
                        kit.metaPath,
                        setJsonVersionField(metaText, version),
                        "utf8",
                    );
                    updated.push(relative(packagesRoot, kit.metaPath));
                }
            }
        }

        // 2b) meta.json -> "changelog" projetado do CHANGELOG.md. Le o meta apos
        // o passo (2) para compor com uma eventual escrita de "version". So roda
        // quando o kit ja tem CHANGELOG.md e um array "changelog" no meta.
        const changelogPath = join(kit.dir, "CHANGELOG.md");
        if (
            (await pathExists(kit.metaPath)) &&
            (await pathExists(changelogPath))
        ) {
            const metaText = await readFile(kit.metaPath, "utf8");
            const currentChangelog = JSON.parse(metaText).changelog;

            if (Array.isArray(currentChangelog)) {
                const expectedChangelog = deriveChangelogFromMd(
                    await readFile(changelogPath, "utf8"),
                );
                const inSync =
                    currentChangelog.length === expectedChangelog.length &&
                    currentChangelog.every(
                        (entry, index) => entry === expectedChangelog[index],
                    );

                if (!inSync) {
                    drift.push({
                        kitName: kit.kitName,
                        path: kit.metaPath,
                        version,
                    });
                    if (!check) {
                        await writeFile(
                            kit.metaPath,
                            setJsonChangelogField(metaText, expectedChangelog),
                            "utf8",
                        );
                        const relMetaPath = relative(
                            packagesRoot,
                            kit.metaPath,
                        );
                        if (!updated.includes(relMetaPath)) {
                            updated.push(relMetaPath);
                        }
                    }
                }
            }
        }
    }

    // 3) registry/index.json (versions/latest) — aditivo, fonte = package.json.
    await syncRegistry({
        packagesRoot,
        registryPath,
        kitVersions,
        check,
        drift,
        updated,
        errors,
    });

    return {
        checked: kits.map((kit) => relative(packagesRoot, kit.versionFilePath)),
        drift,
        updated,
        errors,
    };
}

export async function main(
    argv = process.argv.slice(2),
    packagesRoot = defaultPackagesRoot,
) {
    const checkOnly = argv.includes("--check");
    const unknownFlags = argv.filter((arg) => arg !== "--check");

    if (unknownFlags.length > 0) {
        console.error(
            `Flags nao reconhecidas: ${unknownFlags.join(", ")}. Use apenas --check.`,
        );
        return 1;
    }

    const { drift, updated, errors } = await syncKitVersions(packagesRoot, {
        check: checkOnly,
    });

    // Erros sao inconsistencias que este script nao corrige sozinho (ex.: kit sem
    // entrada no registry). Falham sempre, em check ou em apply.
    if (errors.length > 0) {
        console.error(
            "Inconsistencias de versao que exigem correcao manual antes do release:",
        );
        for (const message of errors) {
            console.error(`- ${message}`);
        }
        return 1;
    }

    if (drift.length === 0) {
        console.log(
            "src/version.ts, meta.json e registry/index.json dos kits ja estao em sincronia com package.json.",
        );
        return 0;
    }

    if (checkOnly) {
        console.error(
            "src/version.ts/meta.json/registry/index.json dos kits estao fora de sincronia com package.json.",
        );

        for (const mismatch of drift) {
            console.error(
                `- ${relative(repoRoot, mismatch.path)} (esperado version = "${mismatch.version}")`,
            );
        }

        console.error("Execute `npm run sync-kit-version` para regenerar.");
        return 1;
    }

    console.log(`Versao sincronizada em ${updated.length} arquivo(s).`);
    for (const updatedPath of updated) {
        console.log(`- ${updatedPath}`);
    }
    return 0;
}

async function readJsonFile(path) {
    return JSON.parse(await readFile(path, "utf8"));
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
    process.exit(await main());
}
