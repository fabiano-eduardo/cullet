import pc from "picocolors";
import { formatDependency } from "../../utils/formatDependency.js";
import { formatInstallCommand } from "../../utils/package-manager.js";
import { type KitDependency } from "../../utils/resolve.js";
import { upsertPathAlias } from "../../utils/tsconfig.js";
import { type FullControlContext } from "./types.js";

function toInstallSpecifier(dependency: KitDependency): string {
    if (dependency.range.length === 0) {
        return dependency.name;
    }

    const specifier = `${dependency.name}@${dependency.range}`;
    return /\s/u.test(dependency.range) ? `"${specifier}"` : specifier;
}

export function printExternalDepsWarning(deps: KitDependency[]): void {
    if (deps.length === 0) return;

    console.log("");
    console.log(
        pc.yellow(`Este kit requer as seguintes dependencias externas:`),
    );
    for (const dep of deps) {
        console.log(`   ${formatDependency(dep)}`);
    }
    console.log("");
    console.log(pc.bold("Instale com:"));
    const installSpecifiers = [...new Set(deps.map(toInstallSpecifier))];
    console.log(pc.cyan(`   npm install ${installSpecifiers.join(" ")}`));
    console.log(
        pc.dim(
            `As peerDependencies do pacote cullet nao se aplicam no modo full-control: depois da copia, o Node resolve imports pelo node_modules do seu projeto.`,
        ),
    );
}

/** Print the install line shared by both strategies' dry-run previews. */
export function printInstallPreview(context: FullControlContext): void {
    const { alreadyInstalled, options, installSpec, packageManager } = context;
    if (alreadyInstalled) {
        console.log(
            pc.dim(
                `${installSpec} ja esta instalado; nenhuma instalacao seria necessaria.`,
            ),
        );
    } else if (options.install === false) {
        console.log(
            pc.yellow(
                `--no-install: o pacote ${installSpec} nao seria instalado. Garanta que ele ja esteja presente.`,
            ),
        );
    } else {
        console.log(
            pc.dim(
                `Instalaria ${installSpec} com: ${formatInstallCommand(packageManager, installSpec)}`,
            ),
        );
    }
}

export function printAliasOutcome(
    aliasResult: Awaited<ReturnType<typeof upsertPathAlias>>,
    options: { dryRun: boolean },
): void {
    const prefix = options.dryRun ? "[dry-run] " : "";

    if (aliasResult.status === "missing-tsconfig") {
        console.log(
            pc.yellow(
                `${prefix}Nenhum tsconfig.json foi encontrado. O alias local nao sera registrado automaticamente.`,
            ),
        );
        return;
    }

    if (
        aliasResult.baseUrlWasExplicit &&
        aliasResult.consumerBaseUrl !== undefined &&
        aliasResult.consumerBaseUrl !== "."
    ) {
        console.log("");
        console.log(
            pc.yellow(
                `Aviso: compilerOptions.baseUrl do seu tsconfig esta como "${aliasResult.consumerBaseUrl}" (nao "."), e o paths foi adicionado mesmo assim.`,
            ),
        );
        console.log(
            pc.yellow(
                `O TypeScript resolve "paths" relativos a baseUrl. O alias aponta para "${aliasResult.target}", entao confirme se o caminho relativo bate com a estrutura do seu projeto.`,
            ),
        );
    }

    const actionLabel = options.dryRun
        ? aliasResult.status === "unchanged"
            ? "ja esta correto"
            : aliasResult.status === "updated"
              ? "seria atualizado"
              : "seria criado"
        : aliasResult.status === "created"
          ? "criado"
          : aliasResult.status === "updated"
            ? "atualizado"
            : "mantido";

    console.log(
        pc.green(
            `${prefix}Alias ${actionLabel}: ${aliasResult.alias} -> ${aliasResult.target}`,
        ),
    );
}
