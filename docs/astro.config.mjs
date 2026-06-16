import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLlmsTxt from "starlight-llms-txt";

export default defineConfig({
  site: "https://fabiano-eduardo.github.io",
  base: "/cullet/",
  integrations: [
    starlight({
      title: "cullet",
      description: "Catálogo de kits arquiteturais opinativos para TypeScript.",
      plugins: [starlightLlmsTxt()],
      customCss: ["./src/styles/custom.css"],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/fabiano-eduardo/cullet",
        },
      ],
      sidebar: [
        {
          label: "Começar",
          items: [
            { label: "Visão geral", link: "/getting-started/overview/" },
            { label: "CLI", link: "/reference/cli/" },
            { label: "Versionamento", link: "/reference/versioning/" },
          ],
        },
        {
          label: "Kits",
          items: [
            { label: "erp-core", link: "/kits/erp-core/" },
            { label: "dummy-api", link: "/kits/dummy-api/" },
          ],
        },
        {
          label: "Mantenedores",
          items: [
            { label: "Release", link: "/maintainers/release/" },
            { label: "Anatomia de um kit", link: "/maintainers/authoring/" },
          ],
        },
      ],
    }),
  ],
});