# 🌱 Jardim L-System

Plantas 3D geradas por **sistemas de Lindenmayer (L-Systems)** em **Three.js**, com uma *seed* (texto) que define cada planta de forma única e determinística.

**Página ao vivo:** https://rafapignataro.github.io/lsystem-plants/

## Visão

A ideia original (do Rafael, anos atrás) era usar o formalismo do biólogo Aristid Lindenmayer para gerar plantas e transformá-las em **NFTs**: cada pessoa recebe uma *seed*, e a seed altera as partes do sistema (probabilidades das regras, ângulos, proporções, cores, idade…), de modo que cada pessoa tenha uma planta totalmente diferente, mas sempre reproduzível a partir da mesma seed.

Este repositório é a POC dessa ideia: 14 espécies (5 realistas, 5 árvores raras e 4 bonsais), um motor L-System genérico, uma tartaruga 3D, geometria contínua de galhos com regra de Leonardo, casca procedural e animação de crescimento da muda até a planta adulta. Desde a v7, a copa pode ser **simulada ano a ano**: os galhos disputam espaço e luz (colonização do espaço + sombra em voxels), os sombreados caem e o tronco engrossa a cada ano; o L-System continua definindo o caráter de cada espécie.

## Como rodar

É um único arquivo, `index.html`, sem build. O Three.js (r170) é carregado do jsDelivr via *importmap*, então precisa de internet.

- Abra `index.html` direto no navegador, **ou**
- sirva a pasta: `python3 -m http.server 8000` e acesse `http://localhost:8000/`.

## Parâmetros de URL

| Parâmetro | Onde | Exemplo | Efeito |
|---|---|---|---|
| `especie` | hash | `#especie=carvalho` | realistas: `carvalho`, `pinheiro`, `samambaia`, `arbusto`, `salgueiro`; raras: `dragoeiro`, `baoba`, `eucalipto`, `figueira`, `sequoia`; bonsais: `bordo`, `pinheiro_branco`, `cipreste`, `junipero`; ou `jardim` (as 14 juntas). Espécie desconhecida (inclusive as exóticas removidas na v7) abre o carvalho |
| `cresc` | hash | `#especie=sequoia&cresc=classico` | modo de crescimento: sem o parâmetro = **Simulado** (padrão, v7); `classico` = L-System clássico (idêntico à v6) |
| `seed` | hash | `#especie=pinheiro&seed=rafael` | seed (qualquer texto) |
| `age` | query | `?age=0.3` | abre sem animação, na idade dada (0–1) |
| `nogrow` | query | `?nogrow` | abre sem animação de crescimento, em 100% |
| `norotate` | query | `?norotate` | desliga a auto-rotação |

Exemplos: `https://rafapignataro.github.io/lsystem-plants/?age=0.5#especie=carvalho&seed=lindenmayer` · `https://rafapignataro.github.io/lsystem-plants/#especie=sequoia&seed=rafael&cresc=classico` · `https://rafapignataro.github.io/lsystem-plants/#especie=eucalipto&seed=rafael` · `https://rafapignataro.github.io/lsystem-plants/#especie=junipero&seed=rafael`

O botão **🔗 Copiar link** gera o link da planta atual.

## Funcionalidades

- 5 espécies **realistas**: 🌳 Carvalho Ancestral, 🌲 Pinheiro Boreal, 🌿 Samambaia Espiral, 🌺 Arbusto Florido, ✨ Salgueiro Lumínico.
- 5 **árvores raras** (v5), reais e incomuns:
  - 🐉 **Dragoeiro de Socotra**: dicotomias repetidas em planos alternados formam um guarda-chuva denso, rosetas de folhas em fita só nas pontas e, pela seed, escorridos de "sangue de dragão" na casca;
  - 🪵 **Baobá**: tronco em garrafa (Leonardo exagerado e perfil de tubo), copa curta e retorcida, frutos pendurados pela seed;
  - 🌈 **Eucalipto Arco-Íris**: casca nova no shader, com placas verticais que nascem verdes e amadurecem para laranja, roxo, azul e vinho; paleta e padrão pela seed;
  - 🌳 **Figueira-de-Bengala**: raízes aéreas descem dos galhos horizontais e, ao tocar o chão, engrossam e viram troncos secundários;
  - 🌲 **Sequoia Gigante**: tronco nu até muito alto, sapopemas, casca fibrosa sulcada vermelha, copa estreita e uma silhueta humana de 1,8 m para dar a escala.
- 4 **bonsais** (v6), cada um num vaso procedural com terra e musgo, raízes de superfície (nebari) e folhagem em almofadas; no bonsai, o slider de idade mostra os **anos de formação**:
  - 🍁 **Bordo Japonês**: estilo moyogi, tronco liso cinza-claro em S, galhos longos e nuvens largas de folhas palmadas vermelhas (5 ou 7 lobos), fundo preto;
  - 🌲 **Pinheiro-Branco**: tronco maciço, torcido e com casca em placas, nebari exposto, almofadas horizontais de agulhas e um galho em cascata para fora do vaso oval raso;
  - 🎋 **Cipreste Hinoki**: estilo chokkan (ereto formal), andares que alternam de lado e diminuem até o topo, faixa de madeira morta (shari) na frente, vaso redondo de terracota;
  - 🌀 **Junípero**: tronco em hélice com grandes faixas de madeira morta branca em espiral e uma veia viva avermelhada, copa inclinada, galhos mortos (jin), vaso retangular sobre uma mesinha.
- **Crescimento simulado** (v7, padrão; botão "Crescimento: Simulado / L-System clássico"): o andaime (tronco, verticilos, estilo do bonsai) vem da gramática da espécie e a copa cresce ano a ano por **colonização do espaço** (Runions et al. 2007: pontos de atração num envelope com a forma da espécie, raio de percepção, distância de morte) com **luz por sombra em voxels** e alocação de Borchert-Honda (Palubicki et al. 2009). Cada gema tem destino (cresce, dorme, vira flor ou morre); galhos sombreados **secam e caem** (autopoda); o tronco engrossa todo ano (modelo do cano / Leonardo, mais anéis anuais); nos bonsais há **poda de formação** periódica. O slider de idade mostra a estrutura daquele ano (com "ano X de Y"). A samambaia continua só L-System.
- Motor L-System com regras paramétricas, estocásticas e condicionais, passo final de "decomposição" (pontas → folhas/flores) e regras juvenis.
- PRNG determinística (`cyrb128` → `sfc32`) com fluxos separados por finalidade: mesma seed + espécie = mesma planta.
- Esqueleto de nós → galhos como **tubos contínuos** (Catmull-Rom + *parallel transport*), **colar** nas junções, **regra de Leonardo** para os raios.
- **Casca procedural** no shader (v3): sulcada, em placas, lisa com lenticelas ou estriada, com variante, escala, profundidade, paleta e musgo definidos pela seed; madeira jovem lisa e verde, madeira velha rachada e mais escura.
- **Idade da planta** (slider): muda → árvore, com crescimento das pontas, engrossamento secundário da madeira, folhas juvenis e floração na maturidade.
- Folhas, pétalas, agulhas, orbes e frutos instanciados; vento no shader; sombras, bloom, neblina, céu em gradiente; tema noturno no salgueiro.
- Seletor de espécie em três grupos (**Realistas** / **Raras** / **Bonsais**). Modo **Jardim** com as 14 espécies e a mesma seed em três fileiras (bonsais na frente, realistas no meio e raras atrás), com LOD menor e rótulos que não se sobrepõem, câmera que acompanha o crescimento, painel com parâmetros derivados da seed, regras e palavra gerada.

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): como tudo funciona por dentro.
- [docs/ESPECIES.md](docs/ESPECIES.md): as 14 espécies, regras, parâmetros da seed e como cada uma é simulada.
- [docs/HISTORICO.md](docs/HISTORICO.md): histórico de versões.
- [docs/ROADMAP.md](docs/ROADMAP.md): limitações conhecidas e próximos passos.
