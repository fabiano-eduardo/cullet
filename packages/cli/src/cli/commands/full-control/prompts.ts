import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import pc from "picocolors";

export async function confirmOverwrite(
    destinationDir: string,
): Promise<boolean> {
    const readline = createInterface({ input, output });

    try {
        const answer = await readline.question(
            pc.yellow(
                `O diretorio ${destinationDir} ja existe. Deseja sobrescrever? (y/N) `,
            ),
        );

        return /^(y|yes|s|sim)$/i.test(answer.trim());
    } finally {
        readline.close();
    }
}

export async function confirmToolingOverwrite(
    placement: string,
    conflicts: string[],
): Promise<boolean> {
    const readline = createInterface({ input, output });
    const preview = conflicts.slice(0, 10);

    try {
        console.log(
            pc.yellow(
                `Os seguintes arquivos ja existem em ${placement} e serao sobrescritos:`,
            ),
        );
        for (const file of preview) {
            console.log(`  ${pc.dim(file)}`);
        }
        if (conflicts.length > preview.length) {
            console.log(
                pc.dim(`  ... e mais ${conflicts.length - preview.length}`),
            );
        }

        const answer = await readline.question(pc.yellow(`Continuar? (y/N) `));
        return /^(y|yes|s|sim)$/i.test(answer.trim());
    } finally {
        readline.close();
    }
}
