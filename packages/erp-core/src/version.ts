// Versao do kit, sincronizada com package.json por scripts/sync-kit-version.mjs.
// Nao edite a mao: rode `npm run sync-kit-version` (ou e regenerado no release).
//
// Mantemos a versao aqui, dentro de src/, para que a copia full-control seja
// auto-contida: ao copiar so o conteudo de src/, o entry nao depende de um
// `../package.json` que deixaria de existir no projeto consumidor.
export const version = "1.0.7";
