# Análise do código (revisão geral)

Revisão de `lsystem-core.mjs`, `style-engine.mjs`, `v8-engine.mjs`, `flower-engine.mjs`, `plant-worker.mjs` e `index.html`. A suíte de capturas (`scripts/verify-v8.mjs`, `capture-flowers`, `check-realism`) **não foi rodada**. A conferência foi feita com um hash de esqueleto, raios e folhas montado no Node, com a seed `lindenmayer`, as 8 espécies e os dois modos de crescimento.

## O que faz sentido

A arquitetura serve bem à ideia de uma seed que gera um bonsai único e reproduzível:

- PRNG inteira (`cyrb128` → `sfc32`) com fluxos separados por finalidade. Mexer numa parte não desloca as outras.
- O L-System define o caráter da espécie e a simulação (Runions 2007 + Palubicki 2009) decide como a copa ocupa o espaço.
- A montagem pesada roda no worker. A thread principal só monta malhas, e os raios por idade vão para uma textura float. É barato: O(N) por quadro.
- O estilo fica separado da espécie, o que evita multiplicar gramáticas.

## Bugs encontrados e corrigidos

| # | Onde | Problema | Correção |
|---|---|---|---|
| 1 | `buildSkeletonPackage` + `applyGenomeToPlant` | O genoma era aplicado **3 vezes** em `P` e 2 em `W`. Com os genes ativos, o matiz andava 3× o gene (±105°), o ângulo ficava `ram³` no painel e `W.G` ficava `vigor²`, depois de os raios já terem sido normalizados. | Cada alvo (P, W, BK) recebe o genoma uma vez, com uma trava `_genomeApplied`. |
| 2 | `buildSkeletonPackage` → `update(age)` | **A árvore desenhada não era a de `rFull`.** O shader recalcula os raios com `computeRadii + enforceDesignRadii + capRoots`. Três ajustes só existiam em `rFull` e nunca chegavam à GPU: `sideBranchScale` (galho ≤ 60% do tronco fora do estilo tradicional), `applyLoad` (o pai aguenta a folhagem) e o ×1.12 do olmo moyogi. As juntas e a folhagem eram assentadas por `rFull`, então ficavam dentro da casca ou soltas. `check-realism` e `compare-mass` mediam `rFull`, isto é, uma árvore que ninguém via. Diferença medida: no pinheiro-negro, 98% dos nós (até 4×); fora do estilo padrão, 45–85% dos nós (de 0,12× a 2,2×). | O worker calcula `W.radMul = rFull / raio_do_shader` em 100% e o `update()` multiplica. Em idade 1 o desenho é `rFull`; nas idades intermediárias a escala é a mesma, proporcional. `?raios=legado` desenha como antes, para comparar. |
| 3 | `applyGravitySag` | Só o próprio nó descia; filhos e folhas ficavam no lugar. O galho virava zigue-zague e as folhas ficavam no ar. | O deslocamento é acumulado da base para as pontas e aplicado à subárvore e às instâncias. |
| 4 | `growSim` / sombra com física | Com `growPhysics`, a sombra era uma linha de 1 voxel com o peso já dividido por (2q+1)², mais uma segunda linha apontando **para** o sol. A sombra ficava ~(2q+1)² mais fraca e no lado errado. | A mesma pirâmide do modo padrão, inclinada para longe do sol. |
| 5 | Pedras | As raízes desviavam das pedras no worker, e depois `seatStones` (na thread principal) movia as pedras. As raízes podiam atravessar pedra. | `seatStonesInSoil` roda no worker antes de `deflectRoots`. |
| 6 | `generate()` | Duas gerações seguidas (slider, troca de espécie, hashchange) podiam pôr **duas árvores na cena**. | Token de geração: a chamada antiga desiste. |
| 7 | Workers | O jardim usava `taskId` 0,1,2… e o modo de uma planta usava `taskSeq` 1,2,3… nos mesmos workers. Uma resposta podia ir para a promessa errada. Erro de carga do worker deixava "Gerando…" para sempre. | Contador único e listener de `error`. |
| 8 | `disposePlant` | Vazava a textura de raios e os buffers de `instanceMatrix`/`instanceColor` a cada regeneração. | `InstancedMesh.dispose()` e `uRad.dispose()`. |
| 9 | Exportação glTF | A posição do tubo é o **centro do anel**, e o raio vem do shader. O glTF saía sem madeira (anéis colapsados no eixo) e com todas as folhas, inclusive as juvenis mortas e as não nascidas. | `bakeForExport`: tubos, juntas e folhagem assados na idade atual, sem vento, em GLB. As folhas saem por instâncias (`EXT_mesh_gpu_instancing`), com a cor média no material para visualizadores sem cor por instância. |
| 10 | `enforceDesignRadii` por quadro | `childrenOf` + `trunkChain` alocavam N arrays por planta a cada quadro do crescimento (8 plantas no jardim). | Topologia em cache (`WeakMap`); `trunkChain` iterativa (a recursão podia estourar a pilha em cadeias longas). |
| 11 | Link × tela | O link arredonda os genes a 3 casas e a tela usava o valor cheio. | `mergeGenome` arredonda o overlay. |
| 12 | Thread principal | `assemblePlant` rodava `sp.build(P)` de novo só para o texto do painel. | Usa `pkg.defDisplay`. |
| 13 | Vento | `lsSway` com `y < 0`: a cascata abaixo do vaso não balançava. | Usa a distância vertical à base. |

## Coerência com a ideia (NFT / genoma)

Este foi o ponto conceitual mais fraco.

- **O cruzamento não herdava nada.** `crossBtn` trocava a seed por `childSeed(a, b)`, e todos os parâmetros da espécie eram sorteados de novo. O filho era uma árvore aleatória; só os 9 genes vinham dos pais, e eles quase não mudam a forma. **Mutar** também trocava a seed: outra árvore inteira.
  - Agora `crossParams` faz o filho herdar os parâmetros da espécie dos dois pais. Inteiros e textos vêm de um pai; contínuos são 75/25. Os grupos ligados vêm juntos: a paleta da flor, e a direção da cascata com o alvo dela, porque a média de 10° e 350° daria 180°. O link leva `&paiA=…&paiB=…`. Mutar mexe nos genes e mantém a seed e os pais.
- **Os genes quase não faziam nada nos bonsais.** `alongamento` mexia em `P.elong`, que nenhum bonsai tem. `densidade` mudava o tamanho da folha. Agora `alongamento` escala `segLen`/`branchLen`, `densidade` escala as folhas por almofada (`padN`) e `ramificacao` também mexe no `split`.
- O visual padrão (sem genes aplicados e sem pais) **não mudou**. Pela comparação de hash, mudaram só as raízes que agora desviam das pedras sentadas e os raios do ficus (`capRoots` entra em `rFull`). As folhas não mudaram de lugar.

## Riscos que ficaram (não corrigidos, sem quebrar seeds)

Os três primeiros foram resolvidos no motor v9 (ver abaixo).

4. **Grade de luz**: começa em `y = −vs`. A copa da cascata abaixo do vaso não recebe sombra.
5. **`liftOutOfSolids`** move um nó sem mover a subárvore; pode esticar um segmento.
6. **`ficus.noStones` e `azaleia.stones: false`** são duas flags para a mesma coisa.
7. A documentação de `ARQUITETURA.md` §1–8 ainda descreve as espécies e o `index.html` monolítico da v2.

## Motor v9 (quebra as seeds de propósito)

1. **Andaime = planta clássica.** A simulação usa o mesmo fluxo `::rules` da planta que gera o envelope e reaproveita a palavra dela (o L-System não roda mais duas vezes). A captura ignora as folhas juvenis, e a raiz aérea `W` sorteia pela posição, então sai igual nos dois. Ganho medido: só 1–12% na montagem simulada (32 plantas), porque o tempo está no laço anual (`growSim`), não no L-System. A estimativa de 30–50% desta revisão estava errada.
2. **Determinismo entre navegadores.**
   - `Math.hypot` (que a especificação não fixa) foi trocado por `√(x² + y² + z²)`, que é arredondado igual em todo motor.
   - Cada planta ganha uma **impressão digital** (`treeFingerprint`): esqueleto, raios e folhagem, quantizados. Ela aparece no painel e no JSON de metadados.
   - O link leva `&motor=9`; um link de outra versão, ou sem versão (anterior ao v9), mostra um aviso até você gerar outra árvore.
   - Gravidade, fototropismo e sol também mudam a árvore; quando saem do padrão, vão no link (`grav`, `foto`, `solAz`, `solEl`) e no JSON.
   - Fica de fora: `Math.sin/cos/pow/exp/cbrt` também não são fixados. Para garantir, abra a mesma seed em Chrome, Firefox e Safari e compare a impressão digital.
3. **Flor.** `pickFlower` usa um hash por decisão (padrão, corpo, garganta, fase, variante), com o finalizador do murmur3.

Novo: botão **🧾 JSON** com os metadados (motor, impressão digital, espécie, estilo, seed, pais, genes, traços e medidas de desenho).

Achado: na **azaleia**, a simulação não faz nenhum broto (`grown = 0`, também na `main`). O andaime já é a planta inteira, e só o `dress` acrescenta folhas e flores. A copa simulada da azaleia é a clássica com outro tempo.

## Alternativas e funcionalidades sugeridas

- **Raridade por traço**: o JSON de metadados já existe (v9). Falta a frequência de cada valor em, por exemplo, 10 mil seeds.
- **Nota estética (`scoreTree`)**: hoje devolve `null`. Com `measureDesign` dá para dar nota por regra (afunilamento, primeiro galho, cruzamentos, espaço negativo) e usar a nota em "seleção": gerar N seeds e mostrar as melhores.
- **Poda interativa**: clicar num galho → `TD = ano` no esqueleto simulado e voltar a simular dali. A simulação já suporta a morte de nós.
- **Superfície única nas junções**: em vez das esferas, malhar a forquilha por convolução (*skeletal implicit surfaces*) ou com quad-mesh de bifurcação. É o defeito visual mais citado no ROADMAP.
- **Folhas presas ao raio atual**: o shader de instância pode ler `uRad` do nó e empurrar a folha para a casca em qualquer idade. Hoje `seatOnBark` assenta só em 100%.
- **Testes leves**: `node scripts/hash.mjs` (criado nesta revisão) (sem navegador, ~3 s) pega quebra de determinismo sem tirar print.

## A verificar depois

O que ficou sem conferência visual nas revisões do #16 e do #17 (os prints foram bloqueados pela permissão da sessão), mais as pendências abertas.

**Visual (abrir no navegador)**
- [ ] **Grossura dos galhos (`W.radMul`, #16):** comparar a página normal com `?raios=legado`, sobretudo:
  - [ ] pinheiro-negro (kengai): até 4× nos raminhos;
  - [ ] bordo em shakan e pinheiro-branco em chokkan: galhos laterais mais finos;
  - [ ] olmo em moyogi: o ×1.12.

  Se algum ficar pesado, calibrar `LOAD_MAX` (`applyLoad`) ou o teto de 4× do `radMul`.
- [ ] **Juntas e folhagem:** com os raios novos, as esferas das forquilhas e as folhas não podem sair da casca nem entrar nela.
- [ ] **Gravidade:** com o controle de gravidade ligado, o galho verga inteiro e as folhas acompanham.
- [ ] **Sol fora do padrão:** a sombra da simulação cai para o lado oposto ao sol.
- [ ] **Pedras:** as raízes passam em volta, não por dentro.
- [ ] **Cascata:** a parte abaixo do vaso balança com o vento.
- [ ] **Flores da azaleia (v9):** as cores e os padrões mudaram de lugar; ver se a mistura de padrões continua bonita.

**Exportação e metadados**
- [ ] Abrir o **GLB** num visualizador, por exemplo Blender ou gltf-viewer: madeira com volume, folhas mortas ausentes, folhagem por instância. Se o visualizador não ler cor por instância, a folhagem sai com a cor média.
- [ ] Baixar o **🧾 JSON**, abrir o `link` dele e conferir que a impressão digital é a mesma.

**Link e versão**
- [ ] Abrir um link antigo (`#especie=bordo&seed=rafael`): deve aparecer "Link sem versão do motor". Gerar outra árvore: o aviso some.
- [ ] Copiar o link com gravidade ou sol fora do padrão e reabrir: mesma árvore e mesma impressão digital.
- [ ] Cruzar dois pais, copiar o link e reabrir: o mesmo filho, com `paiA`/`paiB`.

**Determinismo entre navegadores**
- [ ] Abrir a mesma seed no Chrome, Firefox e Safari, desktop e celular, e comparar a impressão digital do painel. `Math.sin/cos/pow/exp/cbrt` ainda podem variar no último bit. Se a impressão divergir, a saída é trocar essas funções por versões próprias, determinísticas, nos trechos que decidem a forma.

**Pendências de motor**
- [ ] **Azaleia:** a simulação não faz nenhum broto (`grown = 0`); a copa simulada é a clássica com outro tempo. Decidir se ela deve crescer de verdade (ponta da gramática mais cedo, gemas nos raminhos) ou se fica assim.
- [ ] Os itens 4–7 de "Riscos que ficaram", acima: grade de luz abaixo do vaso, `liftOutOfSolids`, as duas flags de pedra e a ARQUITETURA desatualizada.
- [ ] Rodar `node scripts/hash.mjs` antes e depois de cada mudança no motor. Se o hash mudar sem querer, subir `ENGINE_VERSION`.
