# Arquitetura

Tudo vive em `index.html` (um `<script type="module">`), organizado em seções numeradas no código:

1. PRNG determinística
2. Motor L-System
3. Tartaruga 3D → esqueleto
4. Geometrias base (folha, pétala, agulhas, esfera)
5. Shaders (idade + vento + casca procedural)
6. As 5 espécies realistas · 6b. As 5 espécies exóticas (v4) · 6c. As 5 árvores raras (v5)
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
- **Regras juvenis** (`def.juvenile`): quando um ápice é reescrito, gera-se antes do sucessor um bloco `[ ... ]` com os órgãos juvenis (os `F`/`f` são descartados). Esses módulos nascem com o ápice (`t = m.t1`) e morrem em `i + juvenileLife`, que vale 1.15 por padrão (2.6 no carvalho, 2.2 no arbusto). São eles que dão folhas à muda.
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
- Jardim (v5): as 15 espécies em três fileiras (exóticas na frente, realistas no meio, raras atrás), tema `jardim` (crepúsculo), câmera mais alta, rótulos clicáveis projetados na tela (fileira da frente embaixo da planta, as de trás em cima da copa) e afastados por um passo guloso a cada quadro (ordenados por y, cada rótulo que encosta em outro desce até não encostar mais). As plantas do jardim são montadas com LOD (ver §11).

## 8. Desempenho medido

Seed `lindenmayer`, v2, Chrome headless (SwiftShader) nesta máquina, `buildPlant` repetido 3 vezes (o tempo não inclui compilação de shader nem upload para a GPU):

| Espécie | Módulos | Nós | Galhos (cadeias) | Vértices de tubo | Triângulos de tubo | Instâncias | Build total | L-System / tartaruga / tubos |
|---|---|---|---|---|---|---|---|---|
| Carvalho | 95.055 | 5.207 | 1.674 | 107.435 | 195.820 | 16.149 folhas | 210–300 ms | ~47 / ~18 / ~140 ms |
| Pinheiro | 8.015 | 2.399 | 706 | 42.174 | 76.870 | 2.619 tufos de agulhas | 35–45 ms | ~5 / ~4 / ~25 ms |
| Samambaia | 13.182 | 1.434 | 202 | 49.206 | 94.728 | 2.786 folíolos | 30–45 ms | ~5 / ~3 / ~25 ms |
| Arbusto | 12.476 | 990 | 332 | 31.122 | 57.338 | 1.762 folhas, 2.324 pétalas, 332 miolos | 30–55 ms | ~6 / ~5 / ~25 ms |
| Salgueiro | 8.815 | 1.461 | 201 | 32.270 | 61.590 | 1.142 folhas, 365 orbes | 20–30 ms | ~5 / ~2 / ~15 ms |

- Recalcular os raios para uma nova idade (`update`): 0,02–0,09 ms por planta (carvalho é o maior).
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
| 0 lisa | arbusto, salgueiro (liso / lenticelas luminosas) | fBm suave; **lenticelas**: Voronoi esticado em volta do galho (`p.z · 5`), pontinhos rebaixados em metade das células; podem emitir luz (`uGlowC`) |
| 1 sulcada | carvalho (sulcada / reticulada), salgueiro (fissurada) | cristas `smoothstep(F2−F1)` com topo levemente achatado, variação por célula, fibras longitudinais (ruído esticado ao longo do eixo); fendas escuras |
| 2 placas | pinheiro (placas largas / escamas), carvalho (escamosa) | cada célula é uma placa com altura e cor próprias; lascas internas (`fBm` com limiar) simulam camadas descascando; fendas escuras entre placas |
| 3 raque | samambaia | lisa, com estrias finas ao longo do eixo |

### Idade, cor e relevo

- **Maturidade** `m = clamp((T − nascimento_do_anel) / (tEnd · mat), 0, 1) · smoothstep(0.03, 0.4, r_atual / r_max)`: depende da idade do nó e da espessura. Pontas novas e galhos finos ficam com `m ≈ 0` (lisos, com a cor jovem verde da v2); madeira velha e grossa chega a `m = 1`.
- **Cor**: base = cor por vértice da v2 (verde jovem → casca, por galho). Madeira madura: `mix(base · lo, base · hi, tint)`, onde `tint` vem da altura e do id da célula, e escurece com a idade (até ×0.82). Resultado final `mix(base, madura, m)`.
- **Relevo**: altura em unidades de mundo `h · min(depth · r_atual · escala, 0.06) · m`. A profundidade das fendas é proporcional ao raio atual: o tronco fica mais sulcado conforme engrossa. A normal é perturbada pelo método de Mikkelsen (*bump mapping* sem tangentes) com `dFdx/dFdy` da altura e da posição em espaço de vista (`lsPerturb`). A iluminação e as sombras recebidas continuam as do `MeshStandardMaterial`.
- **Rugosidade**: 0.72 (jovem) → 0.95 (madura), mais áspera nas fendas; musgo = 1.
- **Musgo** (`uBk2.z`, pela seed): normal em espaço de mundo (`(normal, 0) · viewMatrix`) com `y` acima de ~0.25–0.65 (com ruído), só em madeira com `m > ~0.35`, recortado por um fBm em manchas. Cor própria (matiz da seed; no salgueiro, a cor do brilho) e relevo fofo.
- **Antisserrilhado**: `fw = |fwidth(vBk)|` (células por pixel). As bordas das fendas alargam com `fw`; a cor volta para a média entre `fw` 0.15–0.55; o relevo some antes, entre 0.1–0.45, porque as derivadas de tela são calculadas em blocos de 2×2 pixels.

### Parâmetros por espécie

Os valores estão em `BARK` (`index.html`) e em [ESPECIES.md](ESPECIES.md#casca-procedural-v3). O painel mostra a variante, a escala, a profundidade e o musgo.


## 10. Espécies exóticas (v4)

As 5 exóticas usam o mesmo motor (L-System → tartaruga → esqueleto → Leonardo → tubos → instâncias), mais alguns **ganchos opcionais** na definição da espécie. Quando o gancho não existe, o caminho de código é o mesmo da v3, então as 5 realistas saem **idênticas** (verificado: hash de palavra, esqueleto, raios, todos os atributos de geometria e matrizes/cores das instâncias para 4 seeds × 5 espécies, e screenshot da cena 3D pixel a pixel).

| Gancho | Para que serve | Quem usa |
|---|---|---|
| `fx` | liga `#define LS_FX` + `LS_FX_<NOME>` nos shaders do galho e das instâncias | todas as exóticas |
| `tube` | `R` (lados fixos), `S` (anéis por entrenó), `straight` (prisma reto nó a nó, sem continuar a cadeia), `point` (ponta: o anel final avança `k·raio` na tangente), `noCollar`, `ribs` (costelas) | cristal, cacto |
| `material(P)` / `instMaterial(kind, P)` / `geom(kind, P)` | material do galho, material e geometria de cada tipo de instância | todas |
| `float` | sobe a planta para que a base fique `float × altura` acima do chão | medusa (0.14), neural (0) |
| `tags(sk)` | etiqueta por nó, vira atributo `aFx` | neural (1 = subárvore do axônio) |
| `extra(ctx)` | objetos fora do L-System (sino, planeta, soma, partículas), pontos extras para o enquadramento e um `tick(t, idade, pl)` por quadro | medusa, cacto, neural, coral |
| `glow(pl)` | luz pontual colorida da cena | medusa, neural, coral |
| `theme(P)` | cenário pode depender da seed | coral (abismo ou floresta) |

**Símbolos novos da tartaruga:** `$(a)` tropismo para um ponto (`P.attractor`), `P(r)` chapéu com lamelas (gera instâncias `cap` + `gill`), `X(s)` lasca de cristal. A tartaruga também passou a acumular a distância percorrida (`arc`) e grava `arc` e o nó atual em cada instância (campos extras, não afetam as realistas).

**Shaders:** tudo atrás de `#ifdef LS_FX`.
- Galho (vertex): `vFx = (cos θ, sin θ, arco, etiqueta)`; na medusa soma `lsMedusa(p, arco)`.
- Galho (fragment, medusa/neural/cacto): substitui a casca por `lsFxCol` (cor) e `lsFxEmis` (emissão). O coral reusa a casca da v3 (tipo lisa com lenticelas luminosas); o cristal não tem fragment próprio (é `MeshPhysicalMaterial`).
- Instâncias: atributo `aFxI = (arco, etiqueta)`, `vFxI` multiplica a cor (pulso nos botões sinápticos, onda nos nematocistos, flor que abre perto do planeta).
- Sombras: os materiais de profundidade recebem o mesmo `fx`, então o deslocamento da medusa também move a sombra.

**Efeitos:**
- *Ondulação da medusa*: `d = max(arco − raio_do_sino, 0)`, `A = amp·d^1.25`, deslocamento `(sin(1.6t − k·d + 3θ), 0.25·sin(…), cos(1.25t − 0.85k·d + 3.9θ))·A`, com `θ = atan(z, x)` (cada tentáculo tem fase própria sem precisar de atributo) e um empurrão radial perto do sino sincronizado com o pulso.
- *Pulso neural*: `s = d ∓ v·t` (axônio: para fora; dendritos: para dentro), brilho `exp(−((fract(s/λ) − ½)·λ/w)²)` + um segundo trem com `λ·0.618`. O soma pisca com a mesma função avaliada em `d = 0` (no JS).
- *Flor do cacto*: `abre = 1 − smoothstep(perto, longe, |pos_flor − pos_planeta|)`; a pétala gira em torno do eixo local X por `1.25·(1 − abre)` rad (botão fechado) e escala de 0.35 a 1.15. O planeta segue uma órbita kepleriana (equação de Kepler resolvida com 5 iterações de Newton simples), acelera no periastro.
- *Costelas do cacto*: no CPU, `bump = (1 + amp·(|cos(x/2)|^1.6 − 0.6))·(1 − pinch·(1 − sin(π·f))²)`, `x = costelas·(θ + arco·espiral)`; no fragment, aréolas brancas nas cristas com espaçamento pelo arco e defasagem de 0.618 entre costelas.
- *Partículas*: `THREE.Points` com `ShaderMaterial` aditivo; cada ponto sobe (ou desce, na neve marinha) com `t = fract(tempo·vel + fase)`, balança em x/z e some nas pontas; só aparecem a partir de ~55% de idade.
- *Cristal*: `MeshPhysicalMaterial` com `transmission`, `ior`, `dispersion`, `attenuationColor`, `iridescence`, `flatShading` (facetas) e um `envMap` próprio (`RoomEnvironment` via PMREM). `scene.environment` continua nulo, para não mudar a iluminação das realistas.

**Cenários novos:** `gruta` (cristal), `abismo` (medusa, coral do mar), `deserto` (cacto), `vazio` (neural), `floresta` (fungo), `jardim` (crepúsculo, modo Jardim). Os que têm `stars` mostram um céu estrelado (`Points` fixo, sem neblina).

**Desempenho (seed `lindenmayer`, headless SwiftShader, só relativo):** carvalho 1,0 fps; cristal 2,0; medusa 3,5; cacto 3,5; neural 3,3; coral 3,0; jardim com as 10: 0,5 fps. Montagem: cristal ~20–50 ms (1,3–3,5 mil nós), medusa ~10–20 ms, cacto < 15 ms, neural 30–200 ms (1,4–8 mil nós), coral < 15 ms.

## 11. Árvores raras (v5)

Mesma regra da v4: todo gancho novo é opcional e, sem ele, o caminho de código é idêntico. As 10 espécies anteriores continuam **idênticas** (hash de palavra, esqueleto, raios, P/casca/regras/madeira, todos os atributos de geometria e matrizes/cores das instâncias para 10 espécies × 5 seeds, e screenshot pixel a pixel das 5 realistas).

| Novidade | Onde | Como |
|---|---|---|
| `tube.bump(θ, arco, anel, ehTronco, P)` | `buildTubes` | multiplica o relevo de cada vértice do anel (depois da conta antiga, então quem não tem o gancho não muda). `ehTronco` = cadeia que começa na raiz. Baobá: garrafa; sequoia: sapopemas; figueira: alargamento perto do chão. |
| `W(seg)` raiz aérea | tartaruga | cadeia vertical de nós até `y = 0`, nascendo de `max(t1 do módulo, t1 do nó) + atraso` e descendo em `sp.rootDrop` iterações. Registra `{primeiro nó, ponta, toque no chão, fração f}` em `sk.boost`. |
| Raízes engrossando | `computeRadii` | depois da passada de Leonardo, se `W.roots` existe: `r = max(r, rTronco · f · g^0,8)`, com `g` = 0 → 1 do toque no chão até o fim da vida. Fica fora de Leonardo de propósito: a raiz é um caminho de carga próprio, e somar o peso dela incharia o tronco. |
| `Y(s)` fruto | tartaruga | instância `fruit` sempre para baixo (geometria de cabinho + cápsula, origem no ponto de inserção). |
| Folhas novas | `GEOMS` | `strap` (fita estreita com quilha, dragoeiro), `euca` (lanceolada, eucalipto), `banyan` (oval larga, figueira), `fruit`. |
| Casca do eucalipto | shader da casca, `#ifdef LS_FX_EUCALIPTO` | placas de Voronoi esticadas, estágio de cor por placa a partir da maturidade do nó, paleta `uPal[5]`. Ver ESPECIES. |
| Sangue de dragão | shader da casca, `#ifdef LS_FX_DRAGOEIRO` | ferimentos (ruído grosso) + filetes verticais finos (ruído muito esticado em z), só na madeira madura, intensidade `uFx.x`. |
| Escala humana | `extra` da sequoia | silhueta (pernas, corpo, cabeça, braços) com altura `alturaDaPlanta · 1,8 / alturaReal`, ao pé do tronco; entra no bounding box. |
| Cenários | `THEMES` | `arido` (dragoeiro) e `savana` (baobá). |
| `frame(..., { ty })` | câmera | altura do alvo configurável (o jardim usa 0,22 para sobrar espaço aos rótulos). |

As duas casca-FX usam o modo `frag: 'bark'` da v4 (reusam o shader da v3 e só acrescentam um bloco antes do musgo), então a casca, o relevo e a iluminação continuam os mesmos.

**LOD do jardim:** `buildPlant(id, seed, { lod: true })` reduz os lados dos tubos (`R × 0,6`, mínimo 3) e, em tipos com mais de 2.500 folhas/agulhas, desenha metade delas 30% maiores. As duas reduções acontecem **depois** de todo o consumo de RNG (o número de anéis não muda, e as cores das folhas são sorteadas antes do corte), então a planta do jardim é a mesma planta, só mais leve. Espécies com lados fixos (`tube.R`, como cristal e cacto) não mudam.

**Desempenho (seed `lindenmayer`, headless SwiftShader, só relativo):** carvalho 0,8 fps; dragoeiro 2,8; baobá 3,8; eucalipto 2,3; figueira 1,3; sequoia 2,3. Jardim com as 15 (com LOD): 0,5 fps e 360 mil vértices de tubo, contra 0,3 fps e 414 mil do jardim da v4 com 10 espécies (mesma máquina, mesma sessão). Montagem: dragoeiro ~45 ms, baobá ~15 ms, eucalipto ~80 ms, figueira 130–230 ms (3 mil nós, 14 mil folhas), sequoia ~55–80 ms; o jardim inteiro ~640 ms.
