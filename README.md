# 🌱 Jardim L-System — POC

POC em **Three.js** que gera plantas 3D com **sistemas de Lindenmayer (L-Systems)**. Cada *seed* (texto) gera uma planta única e determinística: mesma seed + mesma espécie = mesma planta.

## Espécies
- 🌳 **Carvalho Ancestral**: ramificação simpodial estocástica (2 ou 3 ramos) com alongamento dos entrenós.
- 🌲 **Pinheiro Boreal**: monopodial, um verticilo de galhos por iteração, formando o cone.
- 🌿 **Samambaia Espiral**: roseta de frondes com brotação atrasada, pinas e báculos enrolados.
- 🌺 **Arbusto Florido**: multicaule estocástico; paleta, nº de pétalas e abertura vêm da seed.
- ✨ **Salgueiro Lumínico**: espécie fantástica com gavinhas pendentes e orbes bioluminescentes.

## Como funciona
- Motor L-System genérico: regras paramétricas, estocásticas e condicionais + passo final de decomposição.
- Tartaruga 3D (`F f + - & ^ \ / | [ ] ! ~` + `L` folha, `K` flor, `O` orbe, `N` agulhas).
- PRNG determinística `cyrb128 → sfc32` a partir da seed.
- Galhos mesclados em uma única malha, folhas/pétalas instanciadas, animação de crescimento e vento via shader.
- Link compartilhável: `#especie=carvalho&seed=minha-seed` (ou `especie=jardim` para ver as 5).

Arquivo único: `index.html` (Three.js via CDN). Basta abrir no navegador.
