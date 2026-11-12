# 🌿 Bonsai Garden

Bonsais 3D gerados por **sistemas de Lindenmayer (L-Systems)** em **Three.js**, com uma *seed* (texto) que define cada planta de forma única e determinística.

**Página ao vivo:** https://rafapignataro.github.io/lsystem-plants/

## Visão

A ideia original (do Rafael, anos atrás) era usar o formalismo do biólogo Aristid Lindenmayer para gerar plantas e transformá-las em **NFTs**: cada pessoa recebe uma *seed*, e a seed altera as partes do sistema (probabilidades das regras, ângulos, proporções, cores, idade…), de modo que cada pessoa tenha uma planta totalmente diferente, mas sempre reproduzível a partir da mesma seed.

Este repositório é a POC dessa ideia, agora só com **bonsais**: um motor L-System genérico, uma tartaruga 3D, geometria contínua de galhos com regra de Leonardo, casca procedural e animação de crescimento da muda até a planta formada. Desde a v7, a copa pode ser **simulada ano a ano** (colonização do espaço, sombra, autopoda, poda de formação). Na **v8**, o foco é o **motor**: junções contínuas, ambiente interativo, genoma legível com cruzamento, folhagem em cachos e export NFT (PNG/glTF). As espécies realistas e raras saíram; o motor continua genérico para o próximo bonsai.

## Como rodar

Arquivos principais: `index.html`, `v8-engine.mjs`, `joint-worker.mjs`. Sem build. O Three.js (r170) vem do jsDelivr via *importmap* (precisa de internet).

- Abra `index.html` direto no navegador, **ou**
- sirva a pasta: `python3 -m http.server 8000` e acesse `http://localhost:8000/`.
- Verificação headless (opcional): `npm i playwright && npx playwright install chromium && node scripts/verify-v8.mjs`.

## Parâmetros de URL

| Parâmetro | Onde | Exemplo | Efeito |
|---|---|---|---|
| `especie` ou `species` | hash ou query | `#especie=junipero` · `?species=olmo_chines` | bonsais: `bordo`, `pinheiro_branco`, `cipreste`, `junipero`, `olmo_chines`, `ficus`, `azaleia`, `pinheiro_negro`; ou `jardim` (todos juntos, cada um no estilo tradicional). Espécie desconhecida abre o bordo |
| `estilo` ou `style` | hash ou query | `#especie=olmo_chines&estilo=moyogi` · `?species=junipero&style=kengai&seed=x` | estilo, se a espécie o aceita. Sem o parâmetro, vale o estilo tradicional da espécie. No jardim o parâmetro é ignorado |
| `cresc` | hash | `#especie=junipero&cresc=classico` | modo de crescimento: sem o parâmetro = **Simulado** (padrão, v7); `classico` = L-System clássico |
| `seed` | hash ou query | `#especie=bordo&seed=rafael` | seed (qualquer texto) |
| `genoma` | hash | `#especie=bordo&seed=rafael&genoma=vigor:1.1,ramificacao:0.95` | genes v8 (opcional; omitir = só da seed) |
| `age` | query | `?age=0.3` | abre sem animação, na idade dada (0–1). No fim da idade a azaleia abre a flor |
| `bloom` | query | `?bloom=0.6` | abre a árvore crescida com a flor nessa abertura (0 botão, 1 aberta) |
| `florescer` | query | `?florescer` | abre crescida e corre a animação do botão **Ver florescer** |
| `nogrow` | query | `?nogrow` | abre sem animação de crescimento, em 100% |
| `norotate` | query | `?norotate` | desliga a auto-rotação |
| `debug` | query | `?debug=rules` | mostra as medidas das regras de desenho da árvore atual (afunilamento, primeiro galho, cruzamentos, galhos em barra, copa, almofadas, espaço negativo) |

Exemplos: `?species=olmo_chines&style=moyogi&seed=x` · `#especie=junipero&estilo=kengai&seed=rafael` · `#especie=jardim&seed=rafael`

O botão **🔗 Copiar link** gera o link da planta atual (espécie, seed, estilo e, se houver, o genoma).

## Espécie e estilo

A **espécie** é a biologia. Ela guarda o tipo de folha ou agulha, a casca, as cores, o entrenó, a tendência de ramificação, a dominância apical, a floração e o vigor. O **estilo** é a arquitetura, num registro à parte (`STYLES`, em `style-engine.mjs`): a linha do tronco (inclinação, curvatura, número de dobras e onde o ápice fica em relação à base), a proporção entre altura e largura, a silhueta da copa e o desenho das almofadas.

O usuário escolhe os dois. O seletor de estilo, ao lado do de espécie, só lista os estilos compatíveis e mostra o nome japonês com uma frase em português. Não há interação durante o crescimento.

| Estilo | Nome | Silhueta |
|---|---|---|
| `chokkan` | 直幹 ereto formal | tronco reto, ápice sobre a base, copa triangular em andares |
| `moyogi` | 模様木 ereto informal | tronco em S, ápice à frente da base, copa assimétrica |
| `shakan` | 斜幹 inclinado | tronco a 30–45°, ápice fora da base, um galho de contrapeso |
| `kengai` | 懸崖 cascata | o tronco dobra na borda e a ponta desce abaixo da base do vaso |
| `han_kengai` | 半懸崖 semi-cascata | a ponta para junto da borda, sem chegar à base |
| `hokidachi` | 箒立ち vassoura | tronco reto até cerca de um terço e um domo de galhos finos |

Compatibilidade, pelo uso tradicional (a vassoura fica com o olmo, a zelkova e o ficus; a cascata com pinheiros, junípero e azaleia; o bordo e o ficus não caem em cascata):

| Espécie | Estilo tradicional | Também aceita |
|---|---|---|
| Bordo | moyogi | shakan, chokkan |
| Pinheiro-branco | moyogi | chokkan, shakan, han-kengai, kengai |
| Cipreste | chokkan | moyogi, shakan |
| Junípero | moyogi | chokkan, shakan, han-kengai, kengai |
| Olmo chinês | hokidachi | chokkan, moyogi, shakan |
| Ficus | moyogi | chokkan, shakan, hokidachi |
| Azaleia | moyogi | shakan, han-kengai, kengai |
| Pinheiro-negro | kengai | han-kengai, chokkan, moyogi, shakan |

No estilo tradicional a gramática é a de hoje, para o desenho de cada espécie continuar reconhecível. Nos outros estilos o axioma é o do estilo e as regras finas (folhas, flores, almofadas, casca) continuam as da espécie.

**Frente.** Cada árvore tem uma frente. O tronco inclina um pouco para o observador, o ápice vem um pouco para a frente, o nebari aparece e nenhum galho grosso do terço de baixo aponta direto para a câmera. A câmera inicial abre nessa frente.

**Vaso.** A forma e o material saem da convenção, sem escolha manual. Coníferas (pinheiros, junípero, cipreste) levam vaso sem esmalte, marrom ou cinza, de lados retos. Árvores de folha e as que florescem levam esmalte numa cor que conversa com a folha, a flor ou o outono. Ereto formal: retângulo ou oval de lados retos. Informal: oval ou redondo. Cascata e semi-cascata: vaso fundo, quadrado, hexagonal ou redondo (a semi-cascata um pouco mais baixa), num suporte alto. Vassoura: oval raso. O comprimento fica em torno de dois terços da altura da árvore, ou da envergadura da copa quando ela é maior; a profundidade acompanha o diâmetro da base do tronco. Em retângulo e oval a árvore senta um pouco fora do centro; em redondo e quadrado, no centro. As pedras e o musgo continuam dentro do vaso.

**Determinismo.** A mesma `(seed, espécie, estilo)` gera a mesma árvore. Trocar só o estilo replanta o mesmo indivíduo — o genoma que veio da seed não é sorteado de novo — na arquitetura nova. O estilo entra no genoma e na exportação (`estilo:moyogi` no hash). O cruzamento herda o estilo de um dos pais.

As regras clássicas de desenho entram no crescimento e no acabamento de toda combinação de espécie e estilo, com parâmetros em `designOf` (o estilo manda na arquitetura, a espécie afina). São oito: afunilamento contínuo do tronco (cerca de 6:1 a 10:1, a vassoura mais baixa), nebari radial sem raiz apontada para a frente, primeiro galho por volta de um quarto a um terço da altura, alternância em espiral sem galhos em barra nem cruzamentos, ângulo dos galhos (conífera cai e levanta a ponta; folhosa sobe um pouco) com ramificação no plano da almofada, almofadas separadas que diminuem até um ápice de várias nuvens pequenas, copa perto de dois terços da altura nos estilos eretos (na cascata as almofadas encolhem até a ponta) e a exceção da vassoura, que abre o domo perto de um terço. O afunilamento só tira o que engrossa para cima e devolve esse volume à base: a base e o volume do tronco não ficam abaixo da gramática, e o espaço negativo vem de agrupar a folhagem, não de apagá-la. `scripts/compare-mass.mjs` confere isso contra o `main`. `measureDesign` devolve as medidas para o estágio seguinte. `scoreTree` continua sem nota. `?debug=rules` imprime os números da árvore atual.

## Funcionalidades

- **Bonsais**, cada um com nebari, almofadas de folhagem e um vaso escolhido pelo estilo e pela família. O slider de idade mostra os **anos de formação**:
  - 🍁 **Bordo Japonês**: folha palmada vermelha (5 ou 7 lobos), casca lisa cinza-clara, entrenós médios. Tradicional: moyogi. Vaso oval esmaltado (azul, celadon ou creme), não mais o vaso quase preto sem esmalte;
  - 🌲 **Pinheiro-Branco**: tronco maciço e nodoso, casca em placas, almofadas de agulha e um galho longo em cascata. Tradicional: moyogi, em vaso oval raso sem esmalte;
  - 🎋 **Cipreste Hinoki**: andares que encurtam até o topo e uma faixa de madeira morta (shari). Tradicional: chokkan, em vaso retangular (ou oval de lados retos) sem esmalte, marrom ou cinza — não mais o vaso redondo fundo;
  - 🌀 **Junípero**: tronco em hélice, madeira morta branca em espiral, veia viva e jin. Tradicional: moyogi, em vaso oval sem esmalte sobre uma mesinha. Também aceita cascata e semi-cascata;
  - 🍃 **Olmo Chinês**: casca que descasca, ramificação fina, folha serrilhada. Tradicional: hokidachi, em oval raso esmaltado;
  - 🪴 **Ficus**: casca lisa, nebari forte, raízes aéreas, folha oval brilhante. Tradicional: moyogi, em vaso oval esmaltado. Também aceita vassoura;
  - 🌸 **Azaleia Satsuki**: tronco curto, casca marrom-avermelhada e copa em domo coberta de flores em funil (rosa, magenta, branca ou as três). Tradicional: moyogi, em vaso esmaltado numa cor que conversa com a flor. Também aceita cascata;
  - 🌲 **Pinheiro-Negro**: agulha rígida verde-escuro, casca em placas alongadas, vigor alto. Tradicional: kengai, num vaso hexagonal fundo sem esmalte (marrom ou cinza) sobre um suporte alto. A queda passa por fora do vaso.
- **Motor v8**: junções com malha de união; vento e sol ajustáveis; genoma de 9 genes + cruzamento; exportação PNG e glTF; cachos de folhagem e LOD no jardim.
- **Crescimento simulado** (v7, padrão; botão "Crescimento: Simulado / L-System clássico"): o andaime (tronco e estilo) vem da gramática e a copa cresce ano a ano por **colonização do espaço** (Runions et al. 2007: pontos de atração num envelope com a forma da espécie, raio de percepção, distância de morte) com **luz por sombra em voxels** e alocação de Borchert-Honda (Palubicki et al. 2009). Cada gema tem destino (cresce, dorme, vira flor ou morre); galhos sombreados **secam e caem** (autopoda); o tronco engrossa todo ano (modelo do cano / Leonardo, mais anéis anuais); há **poda de formação** periódica. O slider de idade mostra a estrutura daquele ano (com "ano X de Y"). Uma espécie sem entrada em `SIMS` continua só L-System.
- Motor L-System com regras paramétricas, estocásticas e condicionais, passo final de "decomposição" (pontas → folhas/flores) e regras juvenis.
- PRNG determinística (`cyrb128` → `sfc32`) com fluxos separados por finalidade: mesma seed + espécie + estilo = mesma planta. O estilo não entra no sorteio dos genes.
- Esqueleto de nós → galhos como **tubos contínuos** (Catmull-Rom + *parallel transport*), **colar** nas junções, **regra de Leonardo** para os raios.
- **Casca procedural** no shader (v3): sulcada, em placas, lisa com lenticelas ou estriada, com variante, escala, profundidade, paleta e musgo definidos pela seed; madeira jovem lisa e verde, madeira velha rachada e mais escura.
- **Idade da planta** (slider): muda → árvore, com crescimento das pontas, engrossamento secundário da madeira, folhas juvenis e floração na maturidade.
- Folhas, pétalas, agulhas e frutos instanciados; vento no shader; sombras, bloom, neblina, céu em gradiente; cada bonsai com o seu cenário de estúdio.
- Seletor com os bonsais registrados. Modo **Bonsai Garden** com todos eles e a mesma seed, em fileiras sem vaga vazia (até 4 por fileira), com LOD menor e rótulos que não se sobrepõem, câmera que acompanha o crescimento, painel com parâmetros derivados da seed, regras e palavra gerada.

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): como tudo funciona por dentro.
- [docs/ESPECIES.md](docs/ESPECIES.md): os bonsais, regras, parâmetros da seed, como cada um é simulado e como registrar o próximo.
- [docs/HISTORICO.md](docs/HISTORICO.md): histórico de versões.
- [docs/ROADMAP.md](docs/ROADMAP.md): limitações conhecidas e próximos passos.
