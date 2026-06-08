import { type KitSuccessor } from "./types.js";

export function formatKitSuccessor(successor: KitSuccessor): string {
    return `${successor.name}@${successor.version}`;
}

export function describeKitSuccessor(successor: KitSuccessor): string[] {
    const lines = [`Sucessor recomendado: ${formatKitSuccessor(successor)}`];

    if (typeof successor.guide === "string") {
        lines.push(`Guia de migracao: ${successor.guide}`);
    }

    if (successor.codemod !== undefined) {
        const detail =
            successor.codemod.description === undefined
                ? successor.codemod.path
                : `${successor.codemod.description} (${successor.codemod.path})`;
        lines.push(`Codemod disponivel: ${detail}`);
    }

    if (typeof successor.notes === "string") {
        lines.push(`Notas de migracao: ${successor.notes}`);
    }

    return lines;
}
