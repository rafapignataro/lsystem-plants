# Roadmap: limitações conhecidas e melhorias

## Geometria e madeira

- **Superfície unificada.** Hoje cada galho é um tubo separado e o colar só esconde a emenda (o filho entra no pai). Numa junção vista de perto ainda dá para ver duas superfícies se cruzando. Caminhos: SDF dos galhos + *marching cubes* (ou *dual contouring*) com união suave (`smin`); superfícies de convolução (*blobby*/metaballs ao longo dos segmentos); ou malhar a junção como uma "ramificação" de verdade (quad-mesh de bifurcação, estilo SpeedTree).
- **Alongamento com a idade.** Os nós só aparecem; um entrenó nascido não se alonga depois (exceto o alongamento já embutido nas regras `F → F'`). Interpolar a posição dos nós no tempo deixaria o crescimento mais orgânico.
- **Folhas dentro da madeira engrossada.** Folhas e flores ficam presas à posição do eixo; quando o galho engrossa, a base delas pode entrar na casca. Solução: deslocar cada instância pelo raio atual do nó (ler `uRad` no shader de instância).
- **Iluminação do colar.** As normais são radiais ao eixo; no alargamento do colar e na base do tronco a normal real deveria inclinar (`dr/ds`). Corrigir a normal com a derivada do raio ao longo do arco.
- **Distribuição do crescimento.** `T = idade^0.8 · tEnd` é uma curva única para todas as espécies; o ideal seria uma curva por espécie (ex.: samambaia rápida, carvalho lento) e crescimento logístico.
- **Culling de folhas mortas.** Folhas juvenis mortas e órgãos não nascidos viram escala 0 no shader, mas continuam sendo processados. Compactar instâncias por idade ou usar `count` dinâmico.

## Visual

- **Casca procedural (shader).** Hoje a casca é cor por vértice + pequenas ondulações. Proposta:
  - UV do tubo: comprimento de arco ao longo do galho (`v`) e ângulo em volta (`u`), contínuo através do colar;
  - ruído fBm + Voronoi esticado ao longo do eixo para sulcos e placas;
  - tipos por espécie e seed: carvalho sulcado, pinheiro em placas, salgueiro e arbusto lisos, samambaia com raque verde lisa;
  - a seed escolhe a variante, profundidade dos sulcos, escala e paleta;
  - a idade do nó controla a aparência: jovem = liso e verde, velho = rachado e escuro;
  - normal perturbada a partir da altura no fragment shader (`onBeforeCompile` no `MeshStandardMaterial`, mantendo sombras);
  - opcional: musgo nas faces viradas para cima da madeira velha, pela seed.
- **Sistemas clássicos do ABOP.** Incluir exemplos de *The Algorithmic Beauty of Plants* (Prusinkiewicz & Lindenmayer) para comparação: bush 3D, árvores de Honda/Aono-Kunii, sistemas com contexto (`<`, `>`).
- Flores e folhas com mais variedade de forma (lobos do carvalho, folha composta, sépalas).

## Produto / NFT

- **Exportar**: PNG em alta resolução e glTF/GLB (com os raios "assados" para a idade escolhida), para metadados e arquivos de NFT.
- Metadados: os parâmetros e atributos derivados da seed já existem (painel); falta serializar em JSON (traits, raridade).
- Garantir determinismo entre navegadores (o PRNG é inteiro, mas `Math.pow/sin` em float podem variar no último bit; testar em Chrome/Firefox/Safari).

## Desempenho

- **FPS em GPU real.** Só foi medido em Chrome headless com SwiftShader (software). Medir em desktop e celular.
- **Celular / LOD.** O carvalho tem ~108 mil vértices de tubo e ~16 mil folhas. Reduzir segmentos radiais nos galhos finos, *impostors* para folhas distantes, limitar iterações no celular.
- Mover a montagem (L-System + tubos, ~200 ms no carvalho) para um Web Worker, para não travar a UI ao gerar.
