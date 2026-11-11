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

## Produto / NFT

- **Exportar**: PNG em alta resolução e glTF/GLB (com os raios "assados" para a idade escolhida), para metadados e arquivos de NFT.
- Metadados: os parâmetros e atributos derivados da seed já existem (painel); falta serializar em JSON (traits, raridade).
- Garantir determinismo entre navegadores (o PRNG é inteiro, mas `Math.pow/sin` em float podem variar no último bit; testar em Chrome/Firefox/Safari).

## Desempenho

- **FPS em GPU real.** Só foi medido em Chrome headless com SwiftShader (software). Medir em desktop e celular.
- **Celular / LOD.** O carvalho tem ~108 mil vértices de tubo e ~16 mil folhas. Reduzir segmentos radiais nos galhos finos, *impostors* para folhas distantes, limitar iterações no celular.
- Mover a montagem (L-System + tubos, ~200 ms no carvalho) para um Web Worker, para não travar a UI ao gerar.
