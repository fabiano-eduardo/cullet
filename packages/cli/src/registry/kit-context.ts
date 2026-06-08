export const KIT_CONTEXT_SCHEMA_VERSION = "1" as const;

export const KIT_CONTEXT_SECTION_ORDER = [
    "purpose",
    "layers",
    "key-decisions",
    "extension-points",
    "non-goals",
] as const;

export type KitContextSectionId = (typeof KIT_CONTEXT_SECTION_ORDER)[number];

export interface KitContextSection {
    id: KitContextSectionId | null;
    title: string;
    body: string;
}

export interface KitContextDocument {
    schemaVersion: typeof KIT_CONTEXT_SCHEMA_VERSION;
    title: string | null;
    sections: KitContextSection[];
    raw: string;
}

const SECTION_DEFINITIONS: readonly {
    id: KitContextSectionId;
    titles: readonly string[];
}[] = [
    { id: "purpose", titles: ["Propósito", "Purpose"] },
    { id: "layers", titles: ["Camadas", "Layers"] },
    { id: "key-decisions", titles: ["Decisões-chave", "Key decisions"] },
    {
        id: "extension-points",
        titles: ["Pontos de extensão", "Extension points"],
    },
    { id: "non-goals", titles: ["Não-objetivos", "Non-goals"] },
];

const SECTION_IDS = new Set<KitContextSectionId>(KIT_CONTEXT_SECTION_ORDER);
const LEGACY_TITLE_TO_ID = new Map<string, KitContextSectionId>(
    SECTION_DEFINITIONS.flatMap((definition) =>
        definition.titles.map(
            (title) => [normalize(title), definition.id] as const,
        ),
    ),
);

const STRUCTURED_SECTION_HEADING_PATTERN =
    /^##\s+\[(?<id>[a-z-]+)\]\s+(?<title>.*\S)\s*$/u;
const LEGACY_SECTION_HEADING_PATTERN = /^##\s+(?<title>.*\S)\s*$/u;
const TITLE_HEADING_PATTERN = /^#\s+(.*\S)\s*$/u;

function normalize(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function resolveSectionId(
    explicitId: string | undefined,
    title: string,
): KitContextSectionId | null {
    if (
        explicitId !== undefined &&
        SECTION_IDS.has(explicitId as KitContextSectionId)
    ) {
        return explicitId as KitContextSectionId;
    }

    return LEGACY_TITLE_TO_ID.get(normalize(title)) ?? null;
}

export function parseKitContextDocument(raw: string): KitContextDocument {
    const lines = raw.split(/\r?\n/);
    const sections: KitContextSection[] = [];
    let title: string | null = null;
    let current: KitContextSection | null = null;

    for (const line of lines) {
        if (current === null && title === null) {
            const titleMatch = TITLE_HEADING_PATTERN.exec(line);
            if (titleMatch) {
                title = titleMatch[1];
                continue;
            }
        }

        const structuredHeadingMatch =
            STRUCTURED_SECTION_HEADING_PATTERN.exec(line);
        const legacyHeadingMatch =
            structuredHeadingMatch === null
                ? LEGACY_SECTION_HEADING_PATTERN.exec(line)
                : null;

        const headingTitle =
            structuredHeadingMatch?.groups?.title ??
            legacyHeadingMatch?.groups?.title;

        if (headingTitle !== undefined) {
            if (current !== null) {
                sections.push({ ...current, body: current.body.trim() });
            }

            const explicitId = structuredHeadingMatch?.groups?.id;

            current = {
                id: resolveSectionId(explicitId, headingTitle),
                title: headingTitle,
                body: "",
            };
            continue;
        }

        if (current !== null) {
            current.body += `${line}\n`;
        }
    }

    if (current !== null) {
        sections.push({ ...current, body: current.body.trim() });
    }

    return {
        schemaVersion: KIT_CONTEXT_SCHEMA_VERSION,
        title,
        sections,
        raw,
    };
}

export function findMissingKitContextSections(
    document: KitContextDocument,
): KitContextSectionId[] {
    const present = new Set<KitContextSectionId>();

    for (const section of document.sections) {
        if (section.id !== null) {
            present.add(section.id);
        }
    }

    return KIT_CONTEXT_SECTION_ORDER.filter(
        (sectionId) => !present.has(sectionId),
    );
}
