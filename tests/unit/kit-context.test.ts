import { describe, expect, it } from "vitest";
import {
  findMissingKitContextSections,
  parseKitContextDocument,
} from "../../cli/utils/kit-context.js";

describe("parseKitContextDocument", () => {
  it("parses the explicit section schema used by KIT_CONTEXT.md", () => {
    const document = parseKitContextDocument(`# demo-kit — KIT_CONTEXT

## [purpose] Propósito

Contexto da seção de propósito.

## [layers] Camadas

- domain

## [key-decisions] Decisões-chave

- decisão

## [extension-points] Pontos de extensão

- extensão

## [non-goals] Não-objetivos

- fora do escopo
`);

    expect(document).not.toBeNull();
    expect(document?.schemaVersion).toBe("1");
    expect(document?.title).toBe("demo-kit — KIT_CONTEXT");
    expect(document?.sections.map((section) => section.id)).toEqual([
      "purpose",
      "layers",
      "key-decisions",
      "extension-points",
      "non-goals",
    ]);
    expect(findMissingKitContextSections(document!)).toEqual([]);
  });

  it("maps legacy headings to the canonical section ids", () => {
    const document = parseKitContextDocument(`## Propósito

Texto.

## Camadas

Texto.

## Decisões-chave

Texto.

## Pontos de extensão

Texto.

## Não-objetivos

Texto.`);

    expect(document?.sections.map((section) => section.id)).toEqual([
      "purpose",
      "layers",
      "key-decisions",
      "extension-points",
      "non-goals",
    ]);
  });

  it("reports which required sections are still missing", () => {
    const document = parseKitContextDocument(`## [purpose] Propósito

Texto.`);

    expect(findMissingKitContextSections(document!)).toEqual([
      "layers",
      "key-decisions",
      "extension-points",
      "non-goals",
    ]);
  });
});
