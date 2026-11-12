# Roadmap: limitações conhecidas e melhorias

## Próximos passos planejados (combinados com o Rafael na v7)

Os itens 1 (colonização do espaço + luz) e 2 (simulação de crescimento ano a ano) foram feitos na v7 ([ARQUITETURA §13](ARQUITETURA.md#13-crescimento-simulado-v7)). Ficaram anotados para depois:

3. ~~**Superfície única nas junções.**~~ **v8**: esferas nas forquilhas grossas (tronco e andaime, sem teto de 4000 nós) + shari/jin entalhados no raio do tubo. Não é um SDF contínuo em toda a copa.
4. ~~**Física e ambiente.**~~ **v8**: vento, sol, gravidade e fototropismo no painel (desligados no padrão para não mudar a v7). Com eles ligados, a sombra da simulação segue o sol, a copa entorta e os galhos grossos vergam. Raízes desviam de pedras e ficam dentro do vaso.
5. ~~**Folhagem melhor e mais leve.**~~ **v8**: a simulação inteira vai para Web Workers; no jardim, folhas distantes caem para 1/2, 1/4 e depois um impostor. Cachos grandes no close-up foram retirados porque inchavam a copa.
6. ~~**Seed como genoma legível.**~~ **v8**: nove genes, painel, cruzamento, mutação, hash `&genoma=`, PNG e glTF.

## Geometria e madeira

- **Superfície unificada.** Hoje cada galho é um tubo separado e o colar só esconde a emenda (o filho entra no pai). Numa junção vista de perto ainda dá para ver duas superfícies se cruzando. Caminhos: SDF dos galhos + *marching cubes* (ou *dual contouring*) com união suave (`smin`); superfícies de convolução (*blobby*/metaballs ao longo dos segmentos); ou malhar a junção como uma "ramificação" de verdade (quad-mesh de bifurcação, estilo SpeedTree).
- **Alongamento com a idade.** Os nós só aparecem; um entrenó nascido não se alonga depois (exceto o alongamento já embutido nas regras `F → F'`). Interpolar a posição dos nós no tempo deixaria o crescimento mais orgânico.
- **Folhas dentro da madeira engrossada.** Folhas e flores ficam presas à posição do eixo; quando o galho engrossa, a base delas pode entrar na casca. Solução: deslocar cada instância pelo raio atual do nó (ler `uRad` no shader de instância).
- **Iluminação do colar.** As normais são radiais ao eixo; no alargamento do colar e na base do tronco a normal real deveria inclinar (`dr/ds`). Corrigir a normal com a derivada do raio ao longo do arco.
- **Distribuição do crescimento.** `T = idade^0.8 · tEnd` é uma curva única para todas as espécies; o ideal seria uma curva por espécie (ex.: samambaia rápida, carvalho lento) e crescimento logístico.
- **Culling de folhas mortas.** Folhas juvenis mortas e órgãos não nascidos viram escala 0 no shader, mas continuam sendo processados. Compactar instâncias por idade ou usar `count` dinâmico.

## Visual

- ~~**Casca procedural (shader).**~~ **Feito na v3** (ver [ARQUITETURA](ARQUITETURA.md#9-casca-procedural-v3)). O que ficou de fora:
  - o relevo é só de normal (bump): a silhueta do galho continua lisa; deslocar vértices exigiria mais anéis/segmentos (ou tesselação);
  - o UV `v` continua do pai para o filho no colar, mas o ângulo `u` não (cada galho tem seu próprio referencial), então perto da junção os padrões dos dois tubos não se encaixam;
  - as derivadas de tela (`dFdx`/`dFdy`) usadas no bump são por bloco de 2×2 pixels e podem "escadear" em detalhes finos; o detalhe some ao longe para evitar serrilhado, mas sem filtragem de verdade;
  - o musgo só olha a normal (faces para cima); não considera umidade, lado norte nem a base do tronco;
  - o custo extra é no fragment shader (3D Voronoi 27 células + fBm); em celular pode pesar quando o tronco ocupa a tela toda.
- **Sistemas clássicos do ABOP.** Incluir exemplos de *The Algorithmic Beauty of Plants* (Prusinkiewicz & Lindenmayer) para comparação: bush 3D, árvores de Honda/Aono-Kunii, sistemas com contexto (`<`, `>`).
- Flores e folhas com mais variedade de forma (lobos do carvalho, folha composta, sépalas).

## Árvores raras (v5)

- **Sequoia** (modo clássico): os galhos de baixo não caem com a idade e a muda é um mastro nu com um tufo no topo. **Resolvido no modo simulado (v7)**: a muda é um cone cheio até o chão e os galhos de baixo secam e caem com a idade. A silhueta humana só se vê de perto (é para ser assim, mas no enquadramento padrão ela tem poucos pixels).
- **Figueira**: as raízes aéreas são retas e verticais (não se enroscam nem se fundem), descem de qualquer altura e engrossam por uma regra fora de Leonardo. Elas não "seguram" o galho (o galho não afina depois da raiz). Folhas grandes em tufos densos escondem o tronco central em algumas seeds. É a mais pesada das raras (~14 mil folhas, ~90 mil vértices).
- **Baobá**: o perfil de garrafa é um multiplicador do tubo, então o ombro do tronco pode parecer um "gargalo" que encontra galhos mais finos. A casca é lisa e uniforme, sem as cicatrizes e dobras verticais dos baobás velhos. A copa tem poucas folhas em qualquer idade (estação seca permanente).
- **Eucalipto**: a copa é rala e irregular, às vezes em tufos separados. Aos ~50% de idade a muda perde as folhas juvenis antes dos galhos terem folhas. As placas da casca são planas (não há relevo de casca descolando).
- **Dragoeiro**: o tronco é sempre único (sem a bifurcação baixa de alguns exemplares). Vistas de longe, as manchas de resina se juntam e o tronco parece avermelhado por inteiro. As folhas são fitas planas instanciadas (não há a dobra rígida para cima de cada roseta).
- **Jardim com 15**: as raras atrás aparecem parcialmente cobertas pelas realistas (baobá e dragoeiro principalmente). Os rótulos não se sobrepõem, mas podem ficar longe da planta quando são empurrados. O contador de instâncias no painel do jardim mostra o total antes do LOD.

## Bonsais (v6)

- **Estilo no axioma**: a forma (curva em S, andares, hélice) é desenhada pelo axioma, não "formada" ao longo do tempo. A animação de idade engrossa e enche a mesma estrutura, mas não mostra poda, arame nem a escolha de galhos de um bonsaísta de verdade.
- **Almofadas**: são nuvens de instâncias num domo, sem galhinhos visíveis por dentro; de perto, as do pinheiro-branco parecem tufos soltos e as do cipreste podem parecer placas. O bordo tem ~30–38 mil folhas (o mais pesado dos bonsais).
- **Madeira morta**: é só cor e relevo no shader (a forma do tronco não é escavada nem descascada); no cipreste, o shari pode ficar atrás do tronco dependendo do ângulo da câmera. O jin é um galho reto e curto.
- **Vaso**: sem furos de drenagem, carimbo ou esmalte; a terra é um disco com cor por vértice (sem pedriscos). A cascata do pinheiro-branco sai do vaso, mas nem sempre desce muito abaixo da borda.
- **Nebari**: as raízes são cordões radiais simples (sem se fundir numa base de placa contínua).
- **Jardim com 14** (v7): o rótulo mais baixo pode encostar na legenda em algumas seeds.

## Crescimento simulado (v7)

- **Calibração por espécie, à mão.** Os parâmetros (envelope, λ, limiar de autopoda, sombra) foram ajustados olhando a seed `rafael`; outras seeds dão plantas plausíveis, mas não foram todas revisadas uma a uma.
- **Sequoia velha**: a copa final é mais rala que a do modo clássico (poucos verticilos sobrevivem no topo) e a ponta do líder pode aparecer nua. **Sequoia jovem**: a folhagem fica mais densa em cima do que embaixo.
- **Pinheiro jovem**: os verticilos crescem rápido para os lados e a muda parece um arbusto largo antes de virar cone.
- **Eucalipto**: o tronco da gramática sobe primeiro e a copa só aparece depois de ~1/3 da vida (a muda é um mastro com poucas folhas); a copa adulta é menor e mais rala que a clássica.
- **Figueira**: a copa simulada tem muito menos folhas que a clássica (~1,9 mil contra ~12 mil); as raízes aéreas vêm da gramática (não da simulação).
- **Bonsais**: a poda de formação existe (a cada 2–3 anos corta o que sai do volume da almofada), mas como os raminhos só crescem em direção aos pontos dentro das almofadas, quase não há o que cortar (o contador fica perto de zero). O estilo (tronco, galhos, jin) continua vindo do axioma, não é "formado".
- **Envelope a partir da planta clássica.** Nas espécies genéricas (todas menos carvalho e sequoia), os pontos de atração saem da nuvem de folhas do L-System clássico da mesma seed; isso garante a silhueta da espécie, mas a simulação não inventa formas fora dela.
- **Luz simplificada.** Sombra propagada para baixo numa pirâmide (sem direção do sol, sem luz difusa lateral); a luz é `exp(−sombra/C)` em vez da fórmula linear de Palubicki.
- **Galhos que caem somem** (não ficam tocos nem cicatrizes); os canos deles continuam contando no raio do pai (peso `deadK`).
- **Custo.** A simulação roda na thread principal (até ~400 ms na primeira montagem do bordo no SwiftShader); o jardim simulado demora mais para montar que o clássico.

## Produto / NFT

- **Exportar**: PNG em alta resolução e glTF/GLB (com os raios "assados" para a idade escolhida), para metadados e arquivos de NFT.
- Metadados: os parâmetros e atributos derivados da seed já existem (painel); falta serializar em JSON (traits, raridade).
- Garantir determinismo entre navegadores (o PRNG é inteiro, mas `Math.pow/sin` em float podem variar no último bit; testar em Chrome/Firefox/Safari).

## Desempenho

- **FPS em GPU real.** Só foi medido em Chrome headless com SwiftShader (software). Medir em desktop e celular.
- **Celular / LOD.** O carvalho tem ~108 mil vértices de tubo e ~16 mil folhas. Reduzir segmentos radiais nos galhos finos, *impostors* para folhas distantes, limitar iterações no celular.
- Mover a montagem (L-System + tubos, ~200 ms no carvalho) para um Web Worker, para não travar a UI ao gerar.
