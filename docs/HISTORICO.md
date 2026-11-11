# Histórico

Datas no horário de Brasília (UTC−3).

## v3: casca procedural (10/11/2026)

Commit: ver o log do repositório (`v3: casca procedural …`).

- **UV do tubo**: cada vértice ganha `aBk = (cos θ·r_final, sin θ·r_final, arco)`; o arco continua do pai para o filho através do colar. Usar `(cos θ, sin θ)` em vez do ângulo evita a costura em θ = 0/2π.
- **Ruído** no fragment shader: fBm de value noise 3D (4 oitavas) e Voronoi 3D (F1, F2, id da célula), com o eixo do galho esticado para alongar as células.
- **Tipos de casca** por espécie, com variante sorteada pela seed (fluxo próprio `bark`): carvalho sulcado / reticulado / escamoso; pinheiro em placas largas / escamas (avermelhado, com lascas); arbusto liso / lenticelado; salgueiro liso / lenticelas luminosas (emissivas, com bloom) / fissurado; samambaia com raque lisa e estriada. A seed também define escala, profundidade, largura das fendas, paleta (multiplicadores de cor das cristas e fendas) e quantidade de musgo.
- **Idade**: a maturidade da casca depende da idade do nó e da espessura atual; pontas novas e galhos finos ficam lisos e verdes, madeira velha fica rachada, mais funda e mais escura.
- **Relevo**: a altura do padrão vira bump no fragment shader (normal perturbada por derivadas de tela, método de Mikkelsen), via `onBeforeCompile` no `MeshStandardMaterial`; sombras continuam funcionando (o material de profundidade só usa o vertex shader). Rugosidade também varia (fendas e musgo mais ásperos).
- **Musgo** opcional (pela seed) nas faces viradas para cima da madeira velha.
- Antisserrilhado simples: bordas das fendas alargam com o tamanho do pixel e o detalhe some ao longe.
- Painel mostra a variante da casca, escala, profundidade e musgo.
- Determinismo: a casca usa fluxos novos (`bark`, `bark-off`), então a forma das plantas e as cores de folhas de cada seed continuam iguais às da v2.

## Documentação (10/11/2026)

Commit [`0bd18fb`](https://github.com/rafapignataro/lsystem-plants/commit/0bd18fb197c8186593cb27d99ae003ebad429178), 22:06: README e pasta `docs/` (arquitetura, espécies, histórico, roadmap).

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
