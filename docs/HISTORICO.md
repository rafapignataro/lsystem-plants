# Histórico

Datas no horário de Brasília (UTC−3).

## v2: tubos contínuos, colar, Leonardo e idade (10/11/2026)

Commit [`250622a`](https://github.com/rafapignataro/lsystem-plants/commit/250622a6f40f571dff9037d8fbb7f7aa1c5bbe53), 21:07.

- A tartaruga deixou de emitir cilindros por segmento e passou a gravar um **esqueleto de nós** (posição, pai, nascimento).
- **Tubos contínuos**: cada galho é um tubo único por uma curva Catmull-Rom, com anéis orientados por *parallel transport*; subdivisão e segmentos radiais adaptados à espessura.
- **Colar** nas junções: o filho nasce dentro do pai, a base alarga até 0.88× o raio do pai e afina em ~1.5 raios; a curva sai tangente ao pai. Alargamento na base do tronco.
- **Regra de Leonardo** para os raios (`r^e = Σ r_filho^e`), com expoente por espécie e seed.
- **Idade da planta**: tempo de nascimento por módulo, nós aparecem conforme a idade, crescimento secundário e anéis engrossam a madeira velha, folhas juvenis nos ápices que caem depois, flores na maturidade. Raios recalculados na CPU e enviados por textura float ao vertex shader.
- Pequenas irregularidades de casca pela seed; cor jovem (verde) → casca conforme o raio.
- Opção **"Câmera segue"**; slider renomeado para "Idade da planta"; parâmetro `?age=` na URL.
- Ajustes de espécie: pinheiro com tronco inicial mais curto, samambaia com raque mais fina, arbusto com flores aparecendo por completo em 100%.

## v1: POC (10/11/2026)

Commit [`346f296`](https://github.com/rafapignataro/lsystem-plants/commit/346f296be2618f4c5c6df4f4e4dba3cb088f4b8e), 17:48.

- Página única `index.html` com Three.js r170 via importmap.
- Motor L-System genérico: regras fixas, paramétricas, condicionais e estocásticas; passo `finalize`.
- PRNG determinística `cyrb128` + `sfc32`, fluxos separados por finalidade.
- Tartaruga 3D com `F f + - & ^ \ / | [ ] ! ~ L K O N`.
- Galhos como cilindros afunilados mesclados numa malha; folhas, pétalas, agulhas e orbes instanciados.
- 5 espécies: Carvalho Ancestral, Pinheiro Boreal, Samambaia Espiral, Arbusto Florido, Salgueiro Lumínico.
- Animação de crescimento e vento no shader; sombras, bloom, neblina, céu em gradiente, tema noturno.
- UI em pt-BR: espécie, seed, seed aleatória, gerar, crescimento, jardim com as 5, parâmetros, regras, palavra, DNA, copiar link (hash `#especie=…&seed=…`).
- Publicado no GitHub Pages: https://rafapignataro.github.io/lsystem-plants/
