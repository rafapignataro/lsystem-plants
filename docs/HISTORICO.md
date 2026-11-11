# Histórico

Datas no horário de Brasília (UTC−3).

## v6: 4 bonsais (11/11/2026)

Commit [`2e7f3bb`](https://github.com/rafapignataro/lsystem-plants/commit/2e7f3bb0f9bcf67c61053c8f1de0e2f8253d31bd), 11:31.

- **4 espécies novas**, no grupo "Bonsais" do seletor (agora Realistas / Raras / Exóticas / Bonsais): 🍁 Bordo Japonês, 🌲 Pinheiro-Branco, 🎋 Cipreste Hinoki, 🌀 Junípero (ver [ESPECIES](ESPECIES.md#os-4-bonsais-v6)), inspiradas em 4 fotos de referência do Rafael.
- **Vaso procedural** (superelipse: oval, redondo ou retangular) com terra, monte e musgo, e mesinha de madeira no junípero. O vaso se ajusta ao tamanho da copa e define o chão da planta.
- **Motor**: almofadas de folhagem `Z`, raízes de superfície (nebari) com peso `Q` na regra de Leonardo, nivelamento `_` (galhos "aramados" na horizontal), jin `J`, folhas `palm`/`palm7`/`hinoki`.
- **Casca**: shader de madeira morta (`LS_DEAD`): shari em espiral no junípero e em faixa reta no cipreste, jin, veios e borda de casca viva.
- **Idade = anos de formação**: o slider mostra os anos (sorteados pela seed) e a madeira morta só aparece com a maturidade.
- **Cenários**: `preto`, `estudio`, `terracota`, `zen`.
- **Jardim com as 19** em quatro fileiras (bonsais na frente).
- **Compatibilidade**: as 15 espécies anteriores continuam idênticas à v5 para a mesma seed (hash completo 15 × 5 seeds, e pixel a pixel das realistas e raras). Os bonsais são determinísticos entre recarregamentos.
- Screenshots: `screenshots/v6/` (no workspace do POC, fora do repositório).

## v5: 5 árvores raras (11/11/2026)

Commit [`ea5a6d6`](https://github.com/rafapignataro/lsystem-plants/commit/ea5a6d62bcd93f5e4a1257fd11c8968b3cf4dd79), 02:17.

- **5 espécies novas**, no grupo "Raras" do seletor (agora Realistas / Raras / Exóticas): 🐉 Dragoeiro de Socotra, 🪵 Baobá, 🌈 Eucalipto Arco-Íris, 🌳 Figueira-de-Bengala, 🌲 Sequoia Gigante (ver [ESPECIES](ESPECIES.md#as-5-árvores-raras-v5)).
- **Motor**: `tube.bump` (perfil do tronco: garrafa, sapopemas, alargamento), símbolo `W` (raiz aérea que desce até o chão e engrossa como tronco secundário, fora da regra de Leonardo), símbolo `Y` (fruto pendente), folhas `strap`, `euca`, `banyan` e geometria `fruit`.
- **Casca**: tipo novo do eucalipto arco-íris (placas verticais que mudam de cor com a idade, paleta e padrão pela seed) e escorridos de resina do dragoeiro, ambos atrás de `#ifdef` no shader da casca da v3.
- **Escala**: silhueta humana de 1,8 m ao pé da sequoia, proporcional à altura real sorteada (70–95 m).
- **Cenários**: `arido` e `savana`.
- **Jardim com as 15** em três fileiras (exóticas, realistas, raras), câmera mais alta, rótulos que não se sobrepõem e LOD (tubos com menos lados e metade das folhas). Mesmo com 5 plantas a mais, ficou mais leve que o da v4.
- **Compatibilidade**: as 10 espécies anteriores continuam idênticas à v4 para a mesma seed (hash completo para 10 espécies × 5 seeds, e screenshot pixel a pixel das realistas). As raras são determinísticas entre recarregamentos.
- Screenshots: `screenshots/v5/` (no workspace do POC, fora do repositório).

## v4: 5 espécies exóticas (11/11/2026)

Commit [`7a1a60b`](https://github.com/rafapignataro/lsystem-plants/commit/7a1a60bd90aafe07cc689ea82806514197eef2c1), 01:18.

- **5 espécies novas**, num grupo "Exóticas" do seletor: 💎 Árvore de Cristal, 🪼 Medusa Flutuante, 🌵 Cacto Gravitacional, 🧠 Raiz Neural, 🍄 Coral-Fungo Bioluminescente (ver [ESPECIES](ESPECIES.md#as-5-espécies-exóticas-v4)).
- **Motor**: ganchos opcionais por espécie (`fx`, `tube`, `material`, `instMaterial`, `geom`, `float`, `tags`, `extra`/`tick`, `glow`, `theme(P)`), símbolos novos da tartaruga (`$` tropismo para um ponto, `P` chapéu com lamelas, `X` lasca de cristal) e distância acumulada no esqueleto.
- **Shaders**: efeitos atrás de `#ifdef LS_FX`: ondulação dos tentáculos pela distância à raiz, pulsos neurais em dois sentidos, costelas e aréolas do cacto, flores que abrem perto do planeta, prismas facetados de vidro físico (transmissão, IOR, dispersão, iridescência).
- **Objetos extras**: sino pulsante com gônadas, planeta em órbita kepleriana com luz, soma que pisca, partículas (bolhas, esporos, neve marinha), céu estrelado.
- **Cenários**: `gruta`, `abismo`, `deserto`, `vazio`, `floresta` e `jardim`.
- **Jardim com as 10** em duas fileiras (exóticas na frente, realistas atrás). URL aceita `#especie=cristal|medusa|cacto|neural|coral`.
- **Compatibilidade**: as 5 realistas continuam idênticas à v3 para a mesma seed (hash de palavra, esqueleto, raios, geometria e instâncias, e screenshot da cena pixel a pixel). As exóticas são determinísticas entre recarregamentos.
- Screenshots: `screenshots/v4/` (no workspace do POC, fora do repositório).

## v3: casca procedural (10/11/2026)

Commit [`45ae0ca`](https://github.com/rafapignataro/lsystem-plants/commit/45ae0ca303c25b5f72ab88ee4cfa5d49d8c82106), 22:22.

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
