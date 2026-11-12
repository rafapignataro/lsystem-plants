# Roadmap: limitações conhecidas e melhorias

## Próximos passos planejados (combinados com o Rafael na v7)

Os itens 1 (colonização do espaço + luz) e 2 (simulação de crescimento ano a ano) foram feitos na v7 ([ARQUITETURA §13](ARQUITETURA.md#13-crescimento-simulado-v7)). Ficaram anotados para depois:

3. ~~**Superfície única nas junções.**~~ **v8**: esferas nas forquilhas grossas (tronco e andaime, sem teto de 4000 nós). No junípero e no cipreste a madeira morta é o veio contínuo do shader, como na v7. Não é um SDF contínuo em toda a copa.
4. ~~**Física e ambiente.**~~ **v8**: vento, sol, gravidade e fototropismo no painel (desligados no padrão para não mudar a v7). Com eles ligados, a sombra da simulação segue o sol, a copa entorta e os galhos grossos vergam. Raízes desviam de pedras e ficam dentro do vaso.
5. ~~**Folhagem melhor e mais leve.**~~ **v8**: a simulação inteira vai para Web Workers. No enquadramento do jardim a copa fica cheia (no máximo metade das folhas, desenhadas maiores). O impostor só aparece quando a planta ocupa menos de ~40 px. Cachos grandes no close-up foram retirados porque inchavam a copa.
6. ~~**Seed como genoma legível.**~~ **v8**: nove genes, painel, cruzamento, mutação, hash `&genoma=`, PNG e glTF.

## Geometria e madeira

- **Superfície unificada.** Hoje cada galho é um tubo separado e o colar só esconde a emenda (o filho entra no pai). Numa junção vista de perto ainda dá para ver duas superfícies se cruzando. Caminhos: SDF dos galhos + *marching cubes* (ou *dual contouring*) com união suave (`smin`); superfícies de convolução (*blobby*/metaballs ao longo dos segmentos); ou malhar a junção como uma "ramificação" de verdade (quad-mesh de bifurcação, estilo SpeedTree).
- **Alongamento com a idade.** Os nós só aparecem; um entrenó nascido não se alonga depois (exceto o alongamento já embutido nas regras `F → F'`). Interpolar a posição dos nós no tempo deixaria o crescimento mais orgânico.
- **Folhas dentro da madeira engrossada.** Folhas e flores ficam presas à posição do eixo; quando o galho engrossa, a base delas pode entrar na casca. Solução: deslocar cada instância pelo raio atual do nó (ler `uRad` no shader de instância).
- **Iluminação do colar.** As normais são radiais ao eixo; no alargamento do colar e na base do tronco a normal real deveria inclinar (`dr/ds`). Corrigir a normal com a derivada do raio ao longo do arco.
- **Distribuição do crescimento.** `T = idade^0.8 · tEnd` é uma curva única para todas as espécies; o ideal seria uma curva por espécie e crescimento logístico.
- **Culling de folhas mortas.** Folhas juvenis mortas e órgãos não nascidos viram escala 0 no shader, mas continuam sendo processados. Compactar instâncias por idade ou usar `count` dinâmico.

## Visual

- ~~**Casca procedural (shader).**~~ **Feito na v3** (ver [ARQUITETURA](ARQUITETURA.md#9-casca-procedural-v3)). O que ficou de fora:
  - o relevo é só de normal (bump): a silhueta do galho continua lisa; deslocar vértices exigiria mais anéis/segmentos (ou tesselação);
  - o UV `v` continua do pai para o filho no colar, mas o ângulo `u` não (cada galho tem seu próprio referencial), então perto da junção os padrões dos dois tubos não se encaixam;
  - as derivadas de tela (`dFdx`/`dFdy`) usadas no bump são por bloco de 2×2 pixels e podem "escadear" em detalhes finos; o detalhe some ao longe para evitar serrilhado, mas sem filtragem de verdade;
  - o musgo só olha a normal (faces para cima); não considera umidade, lado norte nem a base do tronco;
  - o custo extra é no fragment shader (3D Voronoi 27 células + fBm); em celular pode pesar quando o tronco ocupa a tela toda.
- **Sistemas clássicos do ABOP.** Incluir exemplos de *The Algorithmic Beauty of Plants* (Prusinkiewicz & Lindenmayer) para comparação: bush 3D, árvores de Honda/Aono-Kunii, sistemas com contexto (`<`, `>`).
- Flores e folhas com mais variedade de forma (folha composta, sépalas).

## Bonsais (v6)

- **Estilo no axioma**: a forma (curva em S, andares, hélice) é desenhada pelo axioma, não "formada" ao longo do tempo. A animação de idade engrossa e enche a mesma estrutura, mas não mostra poda, arame nem a escolha de galhos de um bonsaísta de verdade.
- **Almofadas**: são nuvens de instâncias num domo, sem galhinhos visíveis por dentro; de perto, as do pinheiro-branco parecem tufos soltos e as do cipreste podem parecer placas. O bordo tem ~30–38 mil folhas (o mais pesado dos bonsais).
- **Madeira morta**: é só cor e relevo no shader (a forma do tronco não é escavada nem descascada); no cipreste, o shari pode ficar atrás do tronco dependendo do ângulo da câmera. O jin é um galho reto e curto.
- **Vaso**: sem furos de drenagem, carimbo ou esmalte; a terra é um disco com cor por vértice (sem pedriscos). A cascata do pinheiro-branco sai do vaso, mas nem sempre desce muito abaixo da borda.
- **Nebari**: as raízes são cordões radiais simples (sem se fundir numa base de placa contínua).
- **Jardim**: o rótulo mais baixo pode encostar na legenda em algumas seeds. O contador de instâncias no painel mostra o total antes do LOD.

## Crescimento simulado (v7)

- **Calibração por espécie, à mão.** Os parâmetros (envelope, λ, limiar de autopoda, sombra) foram ajustados olhando seeds de referência; outras seeds dão plantas plausíveis, mas não foram todas revisadas uma a uma.
- **Bonsais**: a poda de formação existe (a cada 2 anos no bordo, 3 nos outros; um bonsai novo sem `SIMS` próprio usa 3), mas como os raminhos só crescem em direção aos pontos dentro das almofadas, quase não há o que cortar (o contador fica perto de zero). O estilo (tronco, galhos, jin) continua vindo do axioma, não é "formado".
- **Envelope a partir da planta clássica.** Os pontos de atração saem da nuvem de folhas do L-System clássico da mesma seed; isso garante a silhueta da espécie, mas a simulação não inventa formas fora dela.
- **Luz simplificada.** Sombra propagada para baixo numa pirâmide (sem direção do sol, sem luz difusa lateral); a luz é `exp(−sombra/C)` em vez da fórmula linear de Palubicki.
- **Galhos que caem somem** (não ficam tocos nem cicatrizes); os canos deles continuam contando no raio do pai (peso `deadK`).
- **Custo.** A simulação roda na thread principal (até ~400 ms na primeira montagem do bordo no SwiftShader); o jardim simulado demora mais para montar que o clássico.

## Produto / NFT

- **Exportar**: PNG em alta resolução e glTF/GLB (com os raios "assados" para a idade escolhida), para metadados e arquivos de NFT.
- Metadados: os parâmetros e atributos derivados da seed já existem (painel); falta serializar em JSON (traits, raridade).
- Garantir determinismo entre navegadores (o PRNG é inteiro, mas `Math.pow/sin` em float podem variar no último bit; testar em Chrome/Firefox/Safari).

## Desempenho

- **FPS em GPU real.** Só foi medido em Chrome headless com SwiftShader (software). Medir em desktop e celular.
- **Celular / LOD.** Reduzir segmentos radiais nos galhos finos, *impostors* para folhas distantes, limitar iterações no celular.
- A montagem pesada já vai para um Web Worker (`plant-worker.mjs`).
