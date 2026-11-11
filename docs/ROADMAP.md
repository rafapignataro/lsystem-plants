# Roadmap: limitações conhecidas e melhorias

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

## Espécies exóticas (v4)

- **Cristal**: os prismas se cruzam nas junções (não há união de sólidos) e todo entrenó ganha ponta, inclusive os internos. A transmissão custa um passe extra de renderização e, no SwiftShader, os minerais claros (cristal de rocha, quartzo rosa) parecem foscos/esbranquiçados; falta testar em GPU real. O cristal "engrossa" com a idade pela regra de Leonardo, o que é uma escolha artística (cristal de verdade não tem crescimento secundário).
- **Medusa**: a ondulação é só deslocamento de vértice: as normais não são recalculadas (luz aproximada), os tentáculos podem se atravessar e não há física. Os primeiros segmentos ligam o centro do sino à borda (parecem canais radiais vistos de baixo). Transparência sem ordenação por fragmento: babados e sino podem ter erros de ordem de desenho. A opção "Vento" não afeta a medusa. Aparece uma faixa clara horizontal no topo do sino (provavelmente o reflexo especular do sol; não investigado).
- **Cacto**: o atrator do tropismo é fixo (o periastro), não o planeta em movimento; o crescimento não reage à órbita ao longo do tempo. A flor "abre" por escala + rotação da pétala inteira, não por articulação de pétala. As aréolas são só cor (sem espinhos em 3D). A luz do planeta estoura quando a câmera chega muito perto.
- **Neural**: o arco dos tubos (medido nos anéis da curva) e o arco das instâncias (medido pela tartaruga) diferem um pouco, então botões e galhos podem piscar levemente fora de sincronia. As raízes não interagem com o chão (só a ponta mais baixa encosta). Algumas seeds passam de 8 mil nós (`orvalho`), com montagem de ~200 ms.
- **Coral-fungo**: os chapéus ficam no ponto do nó e podem se interpenetrar; a estipe atravessa o centro do chapéu. As lamelas usam material sem luz (`MeshBasic`). As partículas são aditivas, sem ordenação, e ignoram vento e colisão. A variante (mar/floresta) muda cores, curvatura do chapéu, partículas e cenário, mas a gramática é a mesma.
- **Jardim com 10**: pesado (0,5 fps no headless, contra ~1 fps do carvalho sozinho); os rótulos das duas fileiras se sobrepõem às vezes e a samambaia fica escondida atrás das exóticas. O tema do jardim mudou de `day` para `jardim` (crepúsculo), então as realistas aparecem com outra luz no jardim (sozinhas, continuam idênticas).
- **Câmera segue** na medusa quase não aproxima (a altura usada é a da borda do sino, que já começa alta).

## Árvores raras (v5)

- **Sequoia**: os galhos de baixo não caem com a idade. A parte nua do tronco é fixa pela seed (`bare`), então a muda também é um mastro nu com um tufo no topo (uma sequoia jovem de verdade é um cone cheio até o chão). Falta morte de galho (módulo `F` com `die`). A silhueta humana só se vê de perto (é para ser assim, mas no enquadramento padrão ela tem poucos pixels).
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
- **Jardim com 19**: as exóticas podem esconder parte dos bonsais na fileira da frente em algumas seeds; o rótulo mais baixo pode encostar na legenda.

## Produto / NFT

- **Exportar**: PNG em alta resolução e glTF/GLB (com os raios "assados" para a idade escolhida), para metadados e arquivos de NFT.
- Metadados: os parâmetros e atributos derivados da seed já existem (painel); falta serializar em JSON (traits, raridade).
- Garantir determinismo entre navegadores (o PRNG é inteiro, mas `Math.pow/sin` em float podem variar no último bit; testar em Chrome/Firefox/Safari).

## Desempenho

- **FPS em GPU real.** Só foi medido em Chrome headless com SwiftShader (software). Medir em desktop e celular.
- **Celular / LOD.** O carvalho tem ~108 mil vértices de tubo e ~16 mil folhas. Reduzir segmentos radiais nos galhos finos, *impostors* para folhas distantes, limitar iterações no celular.
- Mover a montagem (L-System + tubos, ~200 ms no carvalho) para um Web Worker, para não travar a UI ao gerar.
