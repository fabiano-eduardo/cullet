import { existsSync, readFileSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRepoRoot } from "../shared/repo-root.js";

export function kitPackageDir(packageRoot: string, name: string): string {
    return join(resolveRepoRoot(packageRoot), "packages", name);
}

function isCulletPackageRoot(dir: string): boolean {
    const packageJsonPath = join(dir, "package.json");
    const registryPath = join(dir, "registry", "index.json");

    if (!existsSync(packageJsonPath) || !existsSync(registryPath)) {
        return false;
    }

    try {
        const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
            name?: unknown;
        };

        return parsed.name === "cullet";
    } catch {
        return false;
    }
}

export function findCulletPackageRoot(fromMetaUrl: string): string {
    // O bundler move o corpo dos modulos para chunks na raiz de dist/,
    // entao a profundidade do `import.meta.url` em runtime nao e fixa.
    let dir = dirname(fileURLToPath(fromMetaUrl));
    const filesystemRoot = parse(dir).root;

    while (true) {
        if (isCulletPackageRoot(dir)) {
            return dir;
        }

        if (dir === filesystemRoot) break;
        dir = dirname(dir);
    }

    throw new Error(
        "Nao foi possivel localizar o package.json do cullet a partir do pacote.",
    );
}
