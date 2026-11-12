# Arquitetura

Tudo vive em `index.html` (um `<script type="module">`), organizado em seções numeradas no código:

1. PRNG determinística
2. Motor L-System
3. Tartaruga 3D → esqueleto
4. Geometrias base (folha, pétala, agulhas, esfera)
5. Shaders (idade + vento + casca procedural)
6. Registro de espécies (vazio) · 6d. Bonsais (v6; realistas e raras saíram) (a 6b, das exóticas, saiu na v7; a 6c, das raras, saiu com o foco em bonsai)
7a. v7: crescimento simulado (`SIM-BEGIN` … `SIM-END`: `growSim`, `simScaffold`, `buildSimSkeleton`, `SIMS`)
7. Montagem (raios, tubos, instâncias)
8. Cena, luz, céu, solo
9. UI / estado

Fluxo de uma planta (`buildPlant(id, seed)`):

```
seed + espécie ─► params (PRNG) ─► gramática (axioma, regras, finalize, juvenile)
              ─► runLSystem ─► palavra (módulos com tempo de nascimento/morte)
              ─► interpret (tartaruga) ─► esqueleto de nós + listas de instâncias
              ─► computeRadii (Leonardo, idade final) ─► buildTubes ─► malha única
              ─► makeInstanced (folhas, pétalas, miolos, agulhas, orbes)
a cada quadro: idade ─► computeRadii(T) ─► textura float de raios ─► vertex shader
```

## 1. PRNG e determinismo

- `cyrb128(str)` gera 4 inteiros de 32 bits a partir da string; `sfc32` usa esses 4 como estado. `Rand` descarta os 15 primeiros valores e expõe `f()`, `range(a,b)`, `int(a,b)`, `pick(arr)`, `chance(p)`, `jit(x)` (uniforme em ±x).
- Fluxos separados, para que mudar uma parte não desloque as outras:

| Fluxo | String | Uso |
|---|---|---|
| params | `${seed}::${id}::params` | parâmetros da espécie (ângulos, razões, paletas…) |
| rules | `${seed}::${id}::rules` | escolhas estocásticas durante a reescrita |
| juvenile | `${seed}::${id}::juvenile` | folhas juvenis dos ápices |
| turtle | `${seed}::${id}::turtle` | rolagem das folhas, cores por instância, ruído da casca |
| wood | `${seed}::${id}::wood` | expoente de Leonardo e fator de crescimento secundário |
| bark | `${seed}::${id}::bark` | casca procedural: variante, escala, profundidade, paleta, musgo (v3) |
| bark-off | `${seed}::${id}::bark-off` | deslocamento do domínio do ruído da casca (v3) |

  O Arbusto usa ainda `Rand('axiom' + petalH)` para montar o axioma dos caules.
- O "DNA" exibido no painel é `cyrb128(seed + '::' + id)` em hexadecimal (32 primeiros caracteres).

## 2. Motor L-System

- **Módulo**: `{ c, p, t0, t1, die }`: símbolo, parâmetros numéricos (`F(1.2)`, `X(1,2)`), início/fim do nascimento e momento de morte (opcional).
- **Parser**: regex `([^\s(),])(?:\(([^)]*)\))?`; qualquer caractere é um símbolo.
- **Regras** (`applyRule`):
  - string fixa;
  - função `(params, rng) => string`: regras paramétricas e condicionais (ex.: `C(l): l < 0.11 → N | senão → N F(l) C(l·0.78)`);
  - lista `[{ w, s }]`: estocástica com pesos (`s` pode ser string ou função).
- **Reescrita paralela** (`rewrite`): cada módulo é substituído pelo sucessor; símbolos sem regra são copiados.
- **Tempo de desenvolvimento** (`stamp`): a iteração `i` ocupa a janela de tempo `[i, i+1]` (o axioma ocupa `[0, 1]`). Os `F` de um sucessor crescem em sequência dentro da janela (o k-ésimo `F` de `nF` ocupa `[i + k/nF, i + (k+1)/nF]`); os outros módulos recebem o tempo do `F` anterior.
- **Regra identidade**: se o sucessor tem um único módulo com o mesmo símbolo (ex.: `F(l) → F(l·1.06)` ou `D(t) → D(t−1)`), o tempo é herdado: é o mesmo entrenó, só alongado.
- **Regras juvenis** (`def.juvenile`): quando um ápice é reescrito, gera-se antes do sucessor um bloco `[ ... ]` com os órgãos juvenis (os `F`/`f` são descartados). Esses módulos nascem com o ápice (`t = m.t1`) e morrem em `i + juvenileLife`, que vale 1.15 por padrão. São eles que dão folhas à muda.
- **Finalize**: após as iterações, um último `rewrite` com as regras `finalize` converte as pontas restantes (ápices) em folhas, flores, orbes ou báculos, na janela `[done+1, done+2]`.
- Limites: se a próxima palavra passar de `MAX_MODULES = 140000`, a iteração para; `done` registra quantas rodaram. `tEnd = done + 3.0` é a idade máxima (100%).

## 3. Tartaruga 3D e esqueleto

Estado: posição, referencial `H` (frente), `L` (esquerda), `U` (cima), tropismo, nó atual. O referencial é re-ortonormalizado a cada `F`.

| Símbolo | Ação |
|---|---|
| `F(l)` | anda `l` e cria um **nó** do esqueleto (pai = nó atual) |
| `f(l)` | anda sem criar nó |
| `+(a)` / `-(a)` | gira em torno de `U` (yaw) |
| `&(a)` / `^(a)` | gira em torno de `L` (pitch) |
| `\(a)` / `/(a)` | gira em torno de `H` (roll) |
| `\|` | meia-volta (180° em `U`) |
| `[` / `]` | empilha / desempilha o estado |
| `~(e)` | define o tropismo: após cada `F`, `H` gira em direção a `(0,-1,0)` por `e·|H×g|` (negativo = cresce para cima) |
| `L(s)` | folha |
| `K(s)` | flor: `P.petals` pétalas em volta de `H` com abertura `P.open`, segunda camada se `P.double`, miolo esférico |
| `O(s)` | orbe luminoso |
| `N(l)` | tufo de agulhas ao longo de `H` |
| `!(x)` | legado da v1 (largura por fator). **Ignorado na v2**: os raios vêm da regra de Leonardo |

Ângulos sem parâmetro usam `P.angle`. Cada nó guarda `X, Y, Z, PAR, T0, T1` em typed arrays. Se o pai nasce depois do início previsto do filho, o filho é empurrado (`t0 = T1[pai]`). Limite: `MAX_NODES = 30000`; instâncias por tipo: `MAX_INST = 45000`.

## 4. Raios: regra de Leonardo + idade

`computeRadii(sk, T, W, s, out)` roda em O(N), percorrendo os nós de trás para frente (filho tem índice maior que o pai):

1. Só existem nós com `T0 ≤ T`. Uma ponta vale `s = g` (fração já crescida do segmento, 0–1); um nó interno acumula `s = Σ s_filhos`.
2. Raio: `r = max( s^(1/e) · (1 + G·idade/tEnd) · scale + ring · idade · (s/s_max)^share , rMin · min(1, s) )`
   - `e`: expoente de Leonardo (`r^e = Σ r_filho^e`), por espécie e seed;
   - `idade = max(0, T − T1)`: há quanto tempo o nó terminou de nascer;
   - `ring`: anéis de crescimento secundário proporcionais à idade, ponderados pela "carga" `s/s_max` do nó (o tronco engrossa mais que os ramos finos);
   - normalização: calcula-se uma vez com `scale = 1`, depois `scale = (1−λ)·baseWidth/max`, `ring = λ·baseWidth/tEnd`, `rMin = baseWidth·tip`.
3. A idade do slider (`a ∈ [0,1]`) vira tempo por `T = a^0.8 · tEnd`, curva leve que espalha o crescimento ao longo do slider.

Os raios vão para uma `DataTexture` float (`RedFormat`, 1024 de largura, 1 texel por nó), atualizada só quando a idade muda. A geometria não é reconstruída.

## 5. Tubos contínuos (`buildTubes`)

- **Eixo principal**: em cada nó, o filho que continua o mesmo tubo é o de maior `dot(dir_filho, dir_nó) + 0.25·(r_filho/r_nó)²`. Cada outro filho inicia uma nova **cadeia** `[junção, filho, principal(filho), …, ponta]`. Os filhos da raiz sempre iniciam cadeias.
- **Curva**: Catmull-Rom uniforme pelos nós da cadeia. Nas cadeias que saem de um pai, o ponto fantasma antes da junção fica na direção do eixo do pai, então o galho sai tangente e curva para fora (forquilha suave). Nas cadeias da raiz, o ponto fantasma é o reflexo do primeiro nó.
- **Anéis**: subdivisões por segmento 3, 2 ou 1 conforme a espessura relativa (`r/r_max > 0.12`, `> 0.03`); o primeiro segmento ganha +3 anéis concentrados perto da junção (`f^1.8`). Segmentos radiais: 12 / 9 / 7 / 5 / 4 para `r/r_max > 0.3 / 0.12 / 0.04 / 0.015 / resto`. Um anel de raio zero fecha a ponta.
- **Referencial sem torção**: tangente por diferença central dos centros dos anéis; normal transportada por projeção (*parallel transport*); binormal = T × N.
- **Atributos por vértice**: `position` (centro do anel), `normal` (direção radial), `aCp` (centro do anel anterior), `aB` (nascimento do anel e do anterior), `aN` (nó A, nó B, fração), `aCol` (nó pai do colar, comprimento de arco desde a junção), `aBump` (irregularidade), `color`, `aBk` (coordenadas da casca, v3: ver seção 9).
- Índices `Uint16` ou `Uint32` conforme o número de vértices. Tudo numa malha só, com `castShadow`/`receiveShadow`.

### Vertex shader dos galhos (`CHUNKS.branch`)

- `T = uGrowth^0.8 · uTend`.
- Se `T ≥ nascimento do anel`: `r = mix(raio(nóA), raio(nóB), fração)` lido da textura com `texelFetch`.
- **Colar**: `rp` = raio do nó pai (ou `1.8·r` para cadeias da raiz, que vira o alargamento da base); `w = exp(−arco / (1.5·rp))`; `r = mix(r, clamp(0.88·rp, r, 2.8·r), w)`. O filho nasce dentro do pai: todo ponto a menos de `0.88·rp` do centro da junção está dentro do cilindro do pai.
- Se o anel ainda não nasceu: ele colapsa na frente de crescimento (entre o anel anterior e o próprio), com raio 0, formando a ponta cônica.
- Posição final: `centro + normal·r·aBump + vento(centro)`.
- Cor: `mix(corJovem, corDaCasca, smoothstep(0.012, 0.2, r / rMax))`: madeira fina é verde e escurece/vira casca ao engrossar.
- O mesmo patch é aplicado num `MeshDepthMaterial` (`customDepthMaterial`), então as sombras acompanham crescimento e vento.
- O vertex shader também passa ao fragment `vBk` (domínio da casca) e `vMt = (maturidade pela idade do nó, raio atual)` (v3).

## 6. Instâncias: folhas, flores, agulhas, orbes

- Geometrias base: folhas como lâminas paramétricas (`sheet`, perfis `oval`, `lance`, `petal`, com dobra na nervura e curvatura), tufo de 26 agulhas cruzadas, icosaedro para miolos e orbes.
- Cada item vira uma matriz (base `X = H×U`, `Y = H`, `Z = U`, escala) num `InstancedMesh`, com `instanceColor` por item (cor da espécie + variação seedada).
- **Ciclo de vida**: atributo `aLife = (nascimento, morte)`. Escala = `smoothstep(nasc, nasc+0.6, T) · (1 − smoothstep(morte, morte+0.6, T))`. Pétalas e miolos têm atraso extra de 0.2 (as flores abrem depois); folhas, 0.05. Folhas juvenis morrem quando o novo crescimento assume.
- Vento: `lsSway(p)`, deslocamento senoidal proporcional a `(altura/H)²`, aplicado ao centro do anel (galhos) e à origem da instância (folhas), para que folhas e galhos se movam juntos.
- Orbes usam `MeshBasicMaterial` com cor HDR (> 1) para acionar o bloom. As folhas do salgueiro têm `emissive`.

## 7. Cena e UI

- `WebGLRenderer` com sombras `PCFSoftShadowMap` (mapa 2048), tone mapping ACES, `EffectComposer` (RenderPass → UnrealBloomPass → OutputPass) com render target HalfFloat e MSAA 4×.
- Temas `day` / `night` (céu em gradiente, neblina, luzes, bloom); o salgueiro usa `night` e uma `PointLight` com a cor da luz.
- Escala: cada planta é normalizada para a altura-alvo da espécie (`height`), considerando a largura (`max(altura, 0.75·largura)`).
- Enquadramento: `frame()` ajusta a câmera ao bounding box e desloca a projeção (`setViewOffset`) para não ficar atrás do painel (no desktop, à direita; no celular, para cima). "Câmera segue" aproxima a câmera na muda e afasta conforme a planta cresce.
- Jardim: os bonsais registrados (`ALL`) em fileiras de até 4, sem vaga vazia, tema `jardim` (crepúsculo), câmera um pouco mais alta, rótulos clicáveis projetados na tela (fileira da frente embaixo do vaso, as de trás em cima da copa) e afastados por um passo guloso a cada quadro (ordenados por y, cada rótulo que encosta em outro desce até não encostar mais). As plantas do jardim são montadas com LOD (ver §11).

## 8. Desempenho medido

Seed `lindenmayer`, v2, Chrome headless (SwiftShader) nesta máquina, `buildPlant` repetido 3 vezes (o tempo não inclui compilação de shader nem upload para a GPU):

| Espécie | Módulos | Nós | Galhos (cadeias) | Vértices de tubo | Triângulos de tubo | Instâncias | Build total | L-System / tartaruga / tubos |
|---|---|---|---|---|---|---|---|---|
| Carvalho | 95.055 | 5.207 | 1.674 | 107.435 | 195.820 | 16.149 folhas | 210–300 ms | ~47 / ~18 / ~140 ms |
| Pinheiro | 8.015 | 2.399 | 706 | 42.174 | 76.870 | 2.619 tufos de agulhas | 35–45 ms | ~5 / ~4 / ~25 ms |
| Samambaia | 13.182 | 1.434 | 202 | 49.206 | 94.728 | 2.786 folíolos | 30–45 ms | ~5 / ~3 / ~25 ms |
| Arbusto | 12.476 | 990 | 332 | 31.122 | 57.338 | 1.762 folhas, 2.324 pétalas, 332 miolos | 30–55 ms | ~6 / ~5 / ~25 ms |
| Salgueiro | 8.815 | 1.461 | 201 | 32.270 | 61.590 | 1.142 folhas, 365 orbes | 20–30 ms | ~5 / ~2 / ~15 ms |

- Recalcular os raios para uma nova idade (`update`): 0,02–0,09 ms por planta.
- No modo Jardim as 10 são montadas juntas (soma das linhas acima e da tabela da v4 abaixo).
- O FPS medido no headless (~1–2 fps) é limitado pela renderização por software e **não representa uma GPU real**; o FPS em GPU real ainda não foi medido (ver ROADMAP).
- v3 (casca procedural): no mesmo headless, carvalho em tela cheia passou de ~940 para ~1130 ms por quadro (+20%), e o custo cresce com a área de tronco na tela. A montagem quase não muda (só um atributo a mais).

## 9. Casca procedural (v3)

Tudo no fragment shader do `MeshStandardMaterial` dos galhos, via `onBeforeCompile` (`CHUNKS.branch.frag`), em quatro pontos do shader da Three: `color_fragment` (cor), `roughnessmap_fragment` (rugosidade), `normal_fragment_maps` (relevo) e `emissivemap_fragment` (lenticelas luminosas). O material de profundidade das sombras não muda.

### Coordenadas (UV do tubo)

- Em `buildTubes`, cada vértice ganha `aBk = (cos θ · r_final, sin θ · r_final, arco)`, onde `θ` é o ângulo do vértice no anel, `r_final` é o raio do nó a 100% da idade (interpolado entre os nós A e B) e `arco` é o comprimento ao longo do galho.
- `(cos θ, sin θ)·r` em vez de `θ`: o domínio é a própria superfície de um cilindro, sem costura em θ = 0/2π, e a distância em volta é em unidades reais (circunferência), o que mantém as células proporcionais em galhos grossos e finos.
- Usar `r_final` (fixo) e não o raio atual faz o padrão ficar preso à madeira: quando o tronco engrossa, as placas crescem junto, sem o padrão "escorrer".
- **Continuidade no colar**: `arcNode[nó]` guarda o arco acumulado em cada nó; um galho filho começa com `arco = arcNode[junção]` do pai. O comprimento do colar (`aCol.y`) continua relativo à junção. No colar e na base do tronco o raio é alargado no vertex shader; o domínio é multiplicado pelo mesmo fator (`flare`) para as células não esticarem em volta.
- No vertex shader: `vBk = (aBk.xy · flare, aBk.z) · uBkFreq`, com `uBkFreq = freq · escala_da_planta`; `freq` está em células por unidade de mundo, então o tamanho do padrão não depende da altura bruta da planta.

### Ruído

- `lsH3`: hash 3D sem textura; `lsN`: value noise 3D trilinear com suavização; `lsF`: fBm de 4 oitavas.
- `lsVor`: Voronoi 3D (27 células), devolve `F1`, `F2` e um id aleatório da célula. `F2 − F1` é a distância até a borda: perto de 0 é fenda, longe é crista/placa.
- O eixo do galho é comprimido (`p.z · stretch`, `stretch < 1`) para alongar as células ao longo do galho; um *domain warp* com `lsN` deixa as bordas irregulares.
- `uSeedOff` (fluxo `bark-off`) desloca o domínio, então cada seed tem um padrão diferente.

### Tipos (`uBk.x`)

| Tipo | Usado em | Altura `h` (0 = fundo da fenda, 1 = topo) |
|---|---|---|
| 0 lisa | bordo | fBm suave; **lenticelas**: Voronoi esticado em volta do galho (`p.z · 5`), pontinhos rebaixados em metade das células; podem emitir luz (`uGlowC`) |
| 1 sulcada | cipreste, junípero | cristas `smoothstep(F2−F1)` com topo levemente achatado, variação por célula, fibras longitudinais (ruído esticado ao longo do eixo); fendas escuras |
| 2 placas | pinheiro-branco | cada célula é uma placa com altura e cor próprias; lascas internas (`fBm` com limiar) simulam camadas descascando; fendas escuras entre placas |
| 3 estriada | livre (nenhum bonsai atual) | lisa, com estrias finas ao longo do eixo |

### Idade, cor e relevo

- **Maturidade** `m = clamp((T − nascimento_do_anel) / (tEnd · mat), 0, 1) · smoothstep(0.03, 0.4, r_atual / r_max)`: depende da idade do nó e da espessura. Pontas novas e galhos finos ficam com `m ≈ 0` (lisos, com a cor jovem verde da v2); madeira velha e grossa chega a `m = 1`.
- **Cor**: base = cor por vértice da v2 (verde jovem → casca, por galho). Madeira madura: `mix(base · lo, base · hi, tint)`, onde `tint` vem da altura e do id da célula, e escurece com a idade (até ×0.82). Resultado final `mix(base, madura, m)`.
- **Relevo**: altura em unidades de mundo `h · min(depth · r_atual · escala, 0.06) · m`. A profundidade das fendas é proporcional ao raio atual: o tronco fica mais sulcado conforme engrossa. A normal é perturbada pelo método de Mikkelsen (*bump mapping* sem tangentes) com `dFdx/dFdy` da altura e da posição em espaço de vista (`lsPerturb`). A iluminação e as sombras recebidas continuam as do `MeshStandardMaterial`.
- **Rugosidade**: 0.72 (jovem) → 0.95 (madura), mais áspera nas fendas; musgo = 1.
- **Musgo** (`uBk2.z`, pela seed): normal em espaço de mundo (`(normal, 0) · viewMatrix`) com `y` acima de ~0.25–0.65 (com ruído), só em madeira com `m > ~0.35`, recortado por um fBm em manchas. Cor própria (matiz da seed) e relevo fofo.
- **Antisserrilhado**: `fw = |fwidth(vBk)|` (células por pixel). As bordas das fendas alargam com `fw`; a cor volta para a média entre `fw` 0.15–0.55; o relevo some antes, entre 0.1–0.45, porque as derivadas de tela são calculadas em blocos de 2×2 pixels.

### Parâmetros por espécie

Os valores estão em `BARK` (`lsystem-core.mjs`) e em [ESPECIES.md](ESPECIES.md). O painel mostra a variante, a escala, a profundidade e o musgo.


## 10. Espécies exóticas (v4, removidas na v7)

As 5 exóticas (cristal, medusa, cacto, neural, coral-fungo) e o que só elas usavam saíram na v7: efeitos `LS_FX_*` de medusa/neural/cacto/cristal/coral, o modo de fragment `own`, o atributo `aFxI`, as geometrias `shard`/`frill`/`cap`/`gill`, os símbolos `P` e `X` da tartaruga, as opções de tubo `straight`/`R`/`S`/`point`/`noCollar`/`ribs`, a luz `glow`, os cenários `gruta`/`abismo`/`deserto`/`vazio`/`floresta` e o `RoomEnvironment`. Ficaram os ganchos genéricos: `fx` com fragmento de casca, `tube.bump`, `float`, `tags`, `extra`/`tick`, `theme` e o símbolo `$` (tropismo para um ponto). O código completo continua no commit `7a1a60b` (v4) e em qualquer versão até a v6.

## 11. Realistas e raras (removidas)

As 5 realistas e as 5 raras saíram junto com o que só elas usavam: casca arco-íris (`LS_FX_EUCALIPTO`, `uPal`), sangue de dragão (`LS_FX_DRAGOEIRO`), silhueta humana, folhas `oak`/`bush`/`fern`/`willow`/`strap`/`euca`/`banyan` e os cenários `night`, `arido` e `savana`. Ficou o motor genérico: `tube.bump`, símbolo `W` (raiz aérea), símbolo `Y` (fruto), `fx` com fragmento de casca e madeira morta (`LS_DEAD` para qualquer espécie com `fx`), `float`, `tags`, `extra`/`tick` e `$` (tropismo). O código das espécies continua no git, até o commit anterior a este foco em bonsai.

**LOD do jardim:** `buildPlant(id, seed, { lod: true })` reduz os lados dos tubos (`R × 0,6`, mínimo 3) e, em tipos com mais de 2.500 folhas/agulhas, desenha metade delas maiores. As duas reduções acontecem **depois** de todo o consumo de RNG, então a planta do jardim é a mesma planta, só mais leve.

## 12. Bonsais (v6)

Todo gancho novo é opcional, e sem ele o caminho de código não muda. Os quatro bonsais que ficaram (bordo, pinheiro-branco, cipreste, junípero) continuam com a mesma seed: o esqueleto, os raios e a casca não mudam.

| Novidade | Onde | Como |
|---|---|---|
| `Z(rx, ry, n, s)` almofada | tartaruga | `n` instâncias do tipo `sp.padKind` (padrão `leaf`) num domo achatado em volta da posição atual; orientação para cima por `sp.padUp`; vida com atraso aleatório de até 0,7 por folha. |
| `Q(w)` peso na ponta | tartaruga + `computeRadii` | grava `[nó, w]` em `sk.tipw`; em `computeRadii`, a carga da ponta é multiplicada por `w`. Usado nas raízes do nebari para que fiquem grossas sem mudar o raio da base. |
| `J` jin | tartaruga + `tags(sk)` | marca os nós seguintes como `sk.jin`; o `tags` do junípero passa isso para o atributo `aFx.w`, e o shader pinta o galho inteiro como madeira morta. |
| `_(k)` nivelar | tartaruga | tira de `H` a componente vertical (k = 1: horizontal) e recompõe `L`/`U` com `U` para cima. É o "arame" do bonsai. |
| Vaso | `potGeo`, `soilGeo`, `makePot` | loft de superelipse (raio `a × b`, expoente `n`, borda, barriga, afunilamento, pé); terra com monte e musgo por ruído de valor (3 oitavas, eixos girados, sem padrão xadrez) em cores por vértice; mesinha opcional. O topo da terra fica em `y = 0`. |
| `ex.floor` | `buildPlant` | `extra()` pode devolver `floor` (cota do fundo do vaso/mesa); a planta é deslocada para que esse ponto fique no chão, e o vaso entra no bounding box (`points`). |
| Madeira morta | shader da casca, `LS_DEAD` (qualquer espécie com `fx`; hoje cipreste e junípero) | faixa em espiral no ângulo do tubo: `uFx = (cobertura, torção, arco máximo, fase)`, `uFx2 = (raio relativo mínimo, —, freq. dos veios, borda)`. Jin por `vFx.w`. Só em madeira madura (`vMt.x`). Ver ESPECIES. |
| Anos de formação | `syncSlider` | espécies com `years: true` mostram "N de M anos de formação" no slider (só no modo de uma espécie). |
| Folhas novas | `GEOMS` | `palm` (5 lobos), `palm7` (7 lobos), `hinoki` (escama serrilhada). |
| Cenários | `THEMES` | `preto`, `estudio`, `terracota`, `zen`. O disco de chão some para bonsais (o vaso faz o papel). |
| Jardim | `gardenRows(ALL)` | fileiras de até 4 bonsais, sem vaga vazia. A da frente leva o rótulo embaixo do vaso; as de trás, em cima da copa. |

**Desempenho (headless SwiftShader, só relativo; seed padrão, medido quando o jardim ainda tinha as outras espécies):** pinheiro-branco 1,5 fps, cipreste 1,0, junípero 2,0. Montagem: bordo ~150 ms (o mais pesado: ~30–38 mil folhas palmadas), pinheiro-branco ~50 ms, cipreste ~55–75 ms, junípero ~40 ms.

## 13. Crescimento simulado (v7)

Modo padrão (botão **Crescimento: Simulado / L-System clássico**; `#…&cresc=classico` abre o clássico). No clássico nada muda: `buildPlant` só entra na simulação com `opts.sim` e `SIMS[id]` definido. Bonsai novo em `BONSAI` sem `SIMS` próprio recebe a poda padrão (a cada 3 anos). Espécie sem simulação fica só no L-System.

**Ideia.** O L-System continua definindo o **caráter** da espécie (tronco, verticilos, dicotomia, ângulos, filotaxia, estilo do bonsai); a simulação decide **como a copa ocupa o espaço**, ano a ano. Isso resolve o que a gramática sozinha não resolve: galhos que se cruzam, folhas dentro da madeira, copas ralas ou com tufos, e o fato de a estrutura não reagir à sombra (galho de baixo nunca morria).

**Fluxo** (`buildSimSkeleton`):

1. `SIMS[id](P, rng, sp, {seed, id})` devolve `{ scaffold, cfg, ring, deadK, about, flower }`.
2. **Andaime** (`simScaffold`): roda a gramática da espécie (só as regras estruturais, poucas iterações, fluxos `::sim-rules`/`::sim-turtle`) e interpreta com a tartaruga normal em modo captura: todo símbolo não terminal listado em `syms` (nos bonsais, `Z`/`B`/`C`/`D`) vira uma **gema** com posição, direção e ordem. Entrenós longos são subdivididos (`seg`) para ter gemas axilares. O tempo do L-System vira anos (`time`). Nebari (`tipw`), jin e raízes aéreas (`boost`) passam adiante remapeados.
3. **Pontos de atração**: `sample(rng)` sorteia pontos num envelope; `markerYear(p)` diz em que ano cada ponto fica disponível (o envelope cresce com a idade). Os bonsais usam a fábrica `crownSim`: o envelope é a **nuvem de folhas da planta clássica da mesma seed** (`classicCloud`), dilatada (`dil`), e o ano de cada ponto é o nascimento de um ancestral (4 nós acima) da folha clássica mais próxima. A silhueta da gramática fica, e a simulação decide como os galhos a preenchem.
4. **Laço anual** (`growSim`, fluxo `::grow`), para `y = 0 … anos−1`:
   - nós do andaime que nascem neste ano: matam os pontos perto, criam gemas axilares (`budsOn`) e liberam as gemas capturadas;
   - **espaço** (Runions et al. 2007): cada ponto ativo vai para a gema mais próxima dentro do raio de percepção `rp` e do cone (`cone`, rad) dela (grade de hash com célula = `rp`; teste feito por célula: `simAssign`); a gema recebe a contagem e a direção média;
   - **luz** (Palubicki et al. 2009, simplificada): grade de voxels (`vox`); cada nó com folhas sombreia uma pirâmide **abaixo** dele (`q` níveis), com peso `a·b^−q` espalhado pela base `(2q+1)²` (assim a sombra ≈ área foliar acima). Luz = `exp(−sombra/C)`. A grade é atualizada incrementalmente quando folhas nascem/caem;
   - **recurso**: `Q = luz` se a gema tem espaço (senão 0); Borchert-Honda: soma de Q da ponta para a base, `v = α·Q_base` distribuído da base para as pontas com `λ` para o filho mais alinhado (continuação) e `1−λ` para os laterais, proporcional a Q;
   - **destino da gema**: `n = floor(v)` metâmeros (máx. `nMax(ordem, ano)`); sem recurso, dorme (`maxIdle` anos e morre); com `flower`, gema fraca de ordem ≥ 1 vira flor/orbe/fruto e termina o eixo; `fork` (dragoeiro) faz a ponta parar depois do broto (dicotomia);
   - **broto**: direção = anterior + `xi`·direção do espaço + tropismo (`trop`) + `bend` (ex.: plagiotropia da sequoia/pinheiro), com curvatura máxima por entrenó (`maxTurn`); cada metâmero ganha gemas laterais pela filotaxia (`alt` com divergência, `opp`, `whorl` no último nó, `plag` em plano) e folhas (`leaf.per`);
   - folhas só nos `keep` últimos nós de cada eixo (as de trás caem quando o eixo cresce);
   - **autopoda**: para cada galho lateral (base de eixo), luz média das folhas da subárvore < `shedT(ordem, ano, altura relativa)` ou sem folhas → o galho inteiro morre (`TD` = ano + 1…1,6). O limiar pode depender da idade e da altura (base da copa que sobe na sequoia, pinheiro e eucalipto);
   - **poda de formação** (bonsais, `prune.every`): corta o que está fora do volume das almofadas clássicas (grade de ocupação `pruneCell`).
5. Saída: esqueleto com `T0/T1` (nascimento, em anos) e **`TD`** (morte) por nó, folhas com `[t0, t1]`, flores, raízes; `tEnd = anos + 1,5`. As instâncias usam os mesmos tipos e geometrias do clássico (`leaf` com o `leafKind` da espécie, `needles`, `petal`/`center` via `simFlower`, `orb`, `fruit`).

**Raios** (`computeRadiiSim`, chamado por `computeRadii` quando `W.TD` existe): igual ao Leonardo da v2 (`r = s^(1/e)·(1+G·idade)·escala + anel·idade·(s/smax)^share`), com duas diferenças: nó morto tem raio 0 (some no shader, como os não nascidos), e o galho que caiu **continua contando no pai** com peso `deadK` (0,45), então o tronco não afina quando a copa de baixo cai. Na simulação a parcela dos anéis anuais é maior (`ring` 0,6–0,88 em vez de `wood.ring`), para o tronco engrossar todo ano mesmo quando a quantidade de folhas para de crescer. Os lados e anéis dos tubos são dimensionados pelo **maior raio que o nó teve na vida** (`rTube`), porque um galho que caiu já foi grosso. A textura de raios por ano continua a mesma: o slider só escolhe o ano.

**Determinismo**: todo sorteio vem de `Rand` com fluxos próprios (`::sim`, `::grow`, `::sim-rules`, `::sim-turtle`, `::sim-inst`); a ordem de iteração é fixa (arrays, `Map` em ordem de inserção). Duas execuções dão o mesmo hash (14 × 5 seeds).

**Desempenho medido na v7, com as espécies que depois saíram** (Chrome headless + SwiftShader; montagem completa, média de 5 seeds com JIT aquecido / máximo): carvalho 169 / 229 ms; sequoia 80 / 97; pinheiro 96 / 124; arbusto 45 / 55; salgueiro 94 / 115; dragoeiro 39 / 44; baobá 22 / 27; eucalipto 88 / 141; figueira 100 / 116; bordo 190 / 256; pinheiro-branco 79 / 130; cipreste 80 / 92; junípero 52 / 77. A primeira montagem (JIT frio) fica entre ~150 e ~400 ms (bordo). Jardim daquela versão (14, com LOD): ~1,1 s simulado contra ~0,44 s clássico. Limites mantidos: `maxNodes` 20–22 mil, `MAX_INST` por tipo.

**Por espécie**: ver o parágrafo "Crescimento simulado (v7)" de cada uma em [ESPECIES](ESPECIES.md). Limitações em [ROADMAP](ROADMAP.md#crescimento-simulado-v7).

## 14. Motor v8 (engine)

A montagem pesada (L-System ou simulação) roda em `plant-worker.mjs` (`buildSkeletonPackage` em `lsystem-core.mjs`). A thread principal só monta malhas Three.js. O jardim usa 4 workers em paralelo.

Por padrão os genes são **mostrados** e não aplicados, a gravidade e o fototropismo começam em 0 e a sombra da simulação continua vertical — o visual padrão acompanha a v7. Cruzar, mutar ou mover um gene passa a aplicar o genoma (`&genoma=` no hash).

Junções: esferas só nas forquilhas grossas (tronco e andaime), com material simples de casca. No junípero e no cipreste a madeira morta é um veio longo e contínuo no shader (`LS_DEAD`): a v7 pontilhava a faixa com um seno de alta frequência. Sem furos no tubo. Raízes de superfície desviam de três pedras semeadas e, no bonsai, permanecem dentro da elipse do vaso. No jardim a folhagem fica na densidade da v7 (no máximo 1 em cada 2 folhas, desenhadas maiores); o impostor só entra quando a planta ocupa menos de ~40 px.

