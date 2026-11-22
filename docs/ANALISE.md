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

1. **O andaime e o envelope usam fluxos diferentes.** `classicCloud` roda a gramática com `::rules` e `simScaffold` com `::sim-rules`. Nas regras com `jit`, o tronco simulado não é exatamente a planta que gerou o envelope. Além disso, o L-System clássico roda duas vezes por planta simulada (na nuvem e no andaime). Usar o mesmo fluxo e reaproveitar o resultado economiza ~30–50% da montagem simulada, mas muda as seeds atuais. Fazer isso junto com uma versão de motor (`v9`) no hash.
2. **Determinismo entre navegadores.** `Math.pow/sin/hypot/cbrt` não são exatos no último bit entre motores JS. Para NFT, gravar `versão do motor + hash do esqueleto` no metadado e conferir em Chrome, Firefox e Safari. O `n()` (3 casas) nas strings da gramática já ajuda.
3. **`pickFlower`** tira `u`, `u2` e `u3` de janelas sobrepostas do mesmo hash FNV (bits 0–15, 8–23 e 16–31). O padrão e a cor ficam correlacionados. Um segundo hash resolve, mas muda as cores das azaleias atuais.
4. **Grade de luz**: começa em `y = −vs`. A copa da cascata abaixo do vaso não recebe sombra.
5. **`liftOutOfSolids`** move um nó sem mover a subárvore; pode esticar um segmento.
6. **`ficus.noStones` e `azaleia.stones: false`** são duas flags para a mesma coisa.
7. A documentação de `ARQUITETURA.md` §1–8 ainda descreve as espécies e o `index.html` monolítico da v2.

## Alternativas e funcionalidades sugeridas

- **Metadados NFT (JSON)**: espécie, estilo, paleta, anos, nº de almofadas, `measureDesign` e raridade por traço (frequência de cada valor em, por exemplo, 10 mil seeds). Tudo isso já é calculado; falta serializar.
- **Nota estética (`scoreTree`)**: hoje devolve `null`. Com `measureDesign` dá para dar nota por regra (afunilamento, primeiro galho, cruzamentos, espaço negativo) e usar a nota em "seleção": gerar N seeds e mostrar as melhores.
- **Poda interativa**: clicar num galho → `TD = ano` no esqueleto simulado e voltar a simular dali. A simulação já suporta a morte de nós.
- **Superfície única nas junções**: em vez das esferas, malhar a forquilha por convolução (*skeletal implicit surfaces*) ou com quad-mesh de bifurcação. É o defeito visual mais citado no ROADMAP.
- **Folhas presas ao raio atual**: o shader de instância pode ler `uRad` do nó e empurrar a folha para a casca em qualquer idade. Hoje `seatOnBark` assenta só em 100%.
- **Testes leves**: `node scripts/hash.mjs` (criado nesta revisão) (sem navegador, ~3 s) pega quebra de determinismo sem tirar print.
