# Arquitetura

Tudo vive em `index.html` (um `<script type="module">`), organizado em seções numeradas no código:

1. PRNG determinística
2. Motor L-System
3. Tartaruga 3D → esqueleto
4. Geometrias base (folha, pétala, agulhas, esfera)
5. Shaders (idade + vento)
6. As 5 espécies
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
- **Atributos por vértice**: `position` (centro do anel), `normal` (direção radial), `aCp` (centro do anel anterior), `aB` (nascimento do anel e do anterior), `aN` (nó A, nó B, fração), `aCol` (nó pai do colar, comprimento de arco desde a junção), `aBump` (irregularidade), `color`.
- Índices `Uint16` ou `Uint32` conforme o número de vértices. Tudo numa malha só, com `castShadow`/`receiveShadow`.

### Vertex shader dos galhos (`CHUNKS.branch`)

- `T = uGrowth^0.8 · uTend`.
- Se `T ≥ nascimento do anel`: `r = mix(raio(nóA), raio(nóB), fração)` lido da textura com `texelFetch`.
- **Colar**: `rp` = raio do nó pai (ou `1.8·r` para cadeias da raiz, que vira o alargamento da base); `w = exp(−arco / (1.5·rp))`; `r = mix(r, clamp(0.88·rp, r, 2.8·r), w)`. O filho nasce dentro do pai: todo ponto a menos de `0.88·rp` do centro da junção está dentro do cilindro do pai.
- Se o anel ainda não nasceu: ele colapsa na frente de crescimento (entre o anel anterior e o próprio), com raio 0, formando a ponta cônica.
- Posição final: `centro + normal·r·aBump + vento(centro)`.
- Cor: `mix(corJovem, corDaCasca, smoothstep(0.012, 0.2, r / rMax))`: madeira fina é verde e escurece/vira casca ao engrossar.
- O mesmo patch é aplicado num `MeshDepthMaterial` (`customDepthMaterial`), então as sombras acompanham crescimento e vento.

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
- Jardim: as 5 espécies em fila com rótulos clicáveis projetados na tela.

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
- No modo Jardim as 5 são montadas juntas (soma das linhas acima).
- O FPS medido no headless (~1–2 fps) é limitado pela renderização por software e **não representa uma GPU real**; o FPS em GPU real ainda não foi medido (ver ROADMAP).
