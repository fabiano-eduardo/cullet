---
"cullet": minor
---

Kits `tooling` agora podem opcionalmente expor uma superfície importável (`entryPoint` + `delivery.import`), consumível direto do node_modules sem cópia. `cullet info` mostra os dois caminhos (import direto e `fc`) e `--alias` passa a funcionar para esses kits; `cullet fc` avisa quando o kit também é importável; e `validate-kit` exige um `entryPoint` existente quando `delivery.import` é declarado. Kits copy-only seguem inalterados.
