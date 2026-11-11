# 🌱 Jardim L-System — POC

POC em **Three.js** que gera plantas 3D com **sistemas de Lindenmayer (L-Systems)**. Cada *seed* (texto) gera uma planta única e determinística: mesma seed + mesma espécie = mesma planta.

## Espécies
- 🌳 **Carvalho Ancestral**: ramificação simpodial estocástica (2 ou 3 ramos) com alongamento dos entrenós.
- 🌲 **Pinheiro Boreal**: monopodial, um verticilo de galhos por iteração, formando o cone.
- 🌿 **Samambaia Espiral**: roseta de frondes com brotação atrasada, pinas e báculos enrolados.
- 🌺 **Arbusto Florido**: multicaule estocástico; paleta, nº de pétalas e abertura vêm da seed.
- ✨ **Salgueiro Lumínico**: espécie fantástica com gavinhas pendentes e orbes bioluminescentes.

## Novidades da v2
- **Galhos como tubos contínuos**: a tartaruga grava um esqueleto de nós (posição, pai, nascimento); cada galho vira um tubo único seguindo uma curva Catmull-Rom, com anéis orientados por *parallel transport* (sem torção nem costuras).
- **Colar nas junções**: o galho filho nasce dentro do pai e sua base se alarga em direção ao raio do pai, afinando rápido até o raio próprio; a curva sai tangente ao eixo do pai (forquilha suave). Raiz com leve alargamento (sapopema).
- **Regra de Leonardo**: raios calculados de baixo para cima, `r^e = Σ r_filhos^e` (e ≈ 2,0–2,8 por espécie, com variação pela seed).
- **Idade da planta**: o slider é a idade (100% = idade limite). Cada módulo do L-System guarda o tempo em que nasceu (iteração + ordem no sucessor); em cada idade só existem os nós já nascidos (a ponta cresce), Leonardo usa só as pontas existentes e o crescimento secundário (anéis) engrossa a madeira velha. A planta começa como muda, com folhas juvenis no ápice, e vira árvore; flores abrem na maturidade.
- Raios recalculados na CPU (≈0,2 ms por quadro no carvalho) e enviados ao shader numa textura float; a geometria é montada uma vez só.
- Pequenas irregularidades de casca pela seed; opção "Câmera segue" acompanha o tamanho da planta durante o crescimento.

## Como funciona
- Motor L-System genérico: regras paramétricas, estocásticas e condicionais + passo final de decomposição.
- Tartaruga 3D (`F f + - & ^ \ / | [ ] ! ~` + `L` folha, `K` flor, `O` orbe, `N` agulhas).
- PRNG determinística `cyrb128 → sfc32` a partir da seed.
- Galhos mesclados em uma única malha, folhas/pétalas instanciadas, animação de crescimento e vento via shader.
- Link compartilhável: `#especie=carvalho&seed=minha-seed` (ou `especie=jardim` para ver as 5).

Arquivo único: `index.html` (Three.js via CDN). Basta abrir no navegador.
