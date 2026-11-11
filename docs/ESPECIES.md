# As 15 espécies

5 realistas (v1–v3), 5 exóticas (v4) e 5 árvores raras (v5, no fim deste arquivo).

Cada espécie é um objeto em `SPECIES` (`index.html`, seção 6) com:

- `params(rng)`: sorteia os parâmetros a partir da seed (fluxo `params`);
- `build(P)`: devolve a gramática: `axiom`, `rules`, `finalize`, `juvenile`, `juvenileLife` e `display` (texto das regras mostrado no painel);
- `bark(P)`: `[cor da casca velha, cor da madeira jovem]`;
- `color(kind, item, P, rng)`: cor de cada folha/pétala/agulha/orbe;
- `baseWidth`, `bump` (irregularidade da casca), `leafRoll` (rolagem aleatória da folha), `wood` (madeira: `leo` = faixa do expoente de Leonardo, `G` = crescimento secundário, `tip` = raio mínimo relativo, `ring` = fração do raio que vem dos anéis, `share` = expoente de carga dos anéis, padrão 0.4).

Notação: `r.range(a,b)` = uniforme em [a,b]; `r.int(a,b)` = inteiro em [a,b]; `jit(x)` = ±x; `leafStr(size, pitch)` = `[/(0–360°) &(pitch ± 15°) L(size·0.8–1.2)]`.
O símbolo `!(x)` ainda aparece nas regras (herança da v1), mas é ignorado na v2: a espessura sai da regra de Leonardo.

Para todas: expoente de Leonardo `e = leo[0] + f·(leo[1] − leo[0])` e `G = wood.G · (0.8–1.2)`, ambos do fluxo `wood`.

---

## 🌳 Carvalho Ancestral (`carvalho`)

**Inspiração:** carvalho (*Quercus*), árvore de copa larga e ramificação **simpodial**: o ápice para de crescer e o eixo continua por ramos laterais, que se dividem em 2 ou 3. Os entrenós continuam se alongando por alguns anos.

**Gramática:**

```
ω : F(trunk) /(lean·9) +(lean) A(1)
A(s) → ~(gravity) F(s·internode) [se s < 0.5: 2 folhas L]
       { [ &(angle ± 7°) F(s·internode·0.4) A(s·lenRatio·(0.88–1.12)) ] /(div) } × k
       k = 3 com p = p3, senão 2 (estocástica); com k = 2 a rotação é 180° ± 30°, com k = 3 é div ± 15°
F(l) → F(l·elong)                                (paramétrica: entrenós alongam)
juvenil(A) → 5 × leafStr(leafSize·0.9, 35–75°)   vivem 2.6 iterações
final:  A → 5 × leafStr(leafSize, 30–80°) F(0.15) L(leafSize)
```

**Parâmetros da seed:**

| Parâmetro | Faixa | Efeito |
|---|---|---|
| `iterations` | 6–7 | gerações de ramificação |
| `angle` | 24–38° | ângulo de ramificação |
| `div` | 95–140° | divergência na tricotomia |
| `lenRatio` | 0.74–0.86 | encurtamento por geração |
| `trunk` | 2.4–3.6 | altura do tronco livre |
| `internode` | 1.5–2.1 | comprimento do entrenó |
| `p3` | 0.35–0.8 | probabilidade de 3 ramos |
| `gravity` | 0.03–0.16 | gravitropismo (copa cai) |
| `elong` | 1.03–1.08 | alongamento por iteração |
| `lean` | ±7° | inclinação do tronco |
| `leafSize` | 0.38–0.56 | tamanho da folha |
| `autumn` | 30% | variante de outono: matiz 14–44°, sat. 0.7–0.9, lum. 0.42–0.52; senão verde: 80–125°, 0.45–0.75, 0.27–0.38 |
| `barkH`, `barkL` | 18–32°, 0.17–0.27 | cor da casca |
| madeira | `leo` 2.2–2.6, `G` 0.8, `tip` 0.012, `ring` 0.55 | `baseWidth` 0.7, `bump` 0.06 |

Cor das folhas: matiz ±18° (outono) ou ±8°, sat. ±0.1, lum. ±0.07 por folha.

---

## 🌲 Pinheiro Boreal (`pinheiro`)

**Inspiração:** pinheiros e abetos (*Pinus*, *Abies*), crescimento **monopodial**: o ápice do tronco continua sempre e produz um verticilo (anel) de galhos por ano. Os galhos de baixo são os mais velhos e mais longos, o que dá a forma de cone.

**Gramática:**

```
ω : F(trunk0) A(1)
A → F(internode·(0.9–1.1))
    { [ &(angle ± 6°) ~(droop) B(branchSeg) ] /(360/whorl ± 10°) } × whorl
    (cada galho é abortado com p = skip)
    /(rot) A(1)
B(l) → N(l) F(l) [ +(twigAngle ± 8°) C(l·twig) ] [ -(twigAngle ± 8°) C(l·twig) ] B(l·0.98)
C(l) : l < 0.11 → N(l)
       l ≥ 0.11 → N(l) F(l) C(l·0.78)
juvenil(A) → N(0.45)                              vive 1.15 iteração
final:  A → N(0.5) F(0.5) N(0.4) F(0.4)   B → N F   C → N F
```

`N(l)` = tufo de 26 agulhas instanciado, com comprimento lateral `needleLen`.

**Parâmetros da seed:**

| Parâmetro | Faixa | Efeito |
|---|---|---|
| `iterations` | 11–13 | número de verticilos |
| `whorl` | 4–6 | galhos por verticilo |
| `angle` | 62–82° | ângulo dos galhos com o tronco |
| `rot` | 128–146° | rotação entre verticilos |
| `internode` | 0.7–0.95 | distância entre verticilos |
| `branchSeg` | 0.42–0.55 | segmento do galho |
| `twig`, `twigAngle` | 0.42–0.6, 45–65° | raminhos laterais |
| `droop` | 0.08–0.24 | caimento dos galhos |
| `skip` | 0–0.18 | probabilidade de galho abortado |
| `trunk0` | 0.5–1.0 | tronco antes do 1º verticilo |
| `needleLen` | 0.5–0.72 | comprimento das agulhas |
| `blue` | 25% | variante azulada: matiz 170–195°, sat. 0.15–0.3; senão 100–145°, 0.35–0.6; lum. 0.18–0.27 |
| `barkH` | 12–24° | cor da casca (lum. 0.15) |
| madeira | `leo` 2.0–2.3, `G` 0.6, `tip` 0.02, `ring` 0.5 | `baseWidth` 0.5, `bump` 0.035 |

(`apical` 0.9–0.93 é sorteado e entra no `!()`, que hoje é ignorado; continua consumindo o PRNG, então removê-lo mudaria as plantas.)

---

## 🌿 Samambaia Espiral (`samambaia`)

**Inspiração:** samambaias (*Polypodiopsida*), roseta de frondes que nascem enroladas (**vernação circinada**, o "báculo") e se desenrolam. Cada fronde é pinada: a raque gera pinas, e as pinas, folíolos.

**Gramática:**

```
ω : { [ /(137.508°·i ± 12°) &(pitch_i) D(delay_i) ] } × fronds
    pitch_i = 62° − 38°·(i/fronds) ± 6°,  delay_i = ⌊(i/fronds)·(3–6)⌋
D(t) : t > 0 → D(t−1)     (atraso de brotação; regra identidade, herda o tempo)
       t = 0 → R(1)
R(s) : s < 0.22 → F(s·seg) L(leafletSize)
       senão    → &(curl) /(twist) F(s·seg) [ +(angle) Q(s·pinnaLen) ] [ -(angle) Q(s·pinnaLen) ] R(s·decay)
Q(l) : l < 0.045 → L(leafletSize·0.7)
       senão     → F(l·0.26) [ +(leafletAngle) L(ls) ] [ -(leafletAngle) L(ls) ] Q(l·0.86)
       ls = leafletSize·min(1, 3l + 0.35)
final: D → F(0.12)&(55)F(0.07)&(60)F(0.06)&(65)F(0.05)&(70)F(0.04)&(75)F(0.03)   (broto em espiral)
       R → &(25)F(h)&(40)F(h)&(55)F(0.8h)&(65)F(0.6h)&(75)F(0.4h), h = s·seg·0.5  (báculo)
       Q → L(leafletSize·0.7)
```

Sem regras juvenis: as próprias frondes são a "muda".

**Parâmetros da seed:**

| Parâmetro | Faixa | Efeito |
|---|---|---|
| `iterations` | 16–18 | comprimento das frondes |
| `fronds` | 8–13 | frondes na roseta (ângulo áureo) |
| `curl` | 3.5–7.5° | curvatura por segmento |
| `twist` | ±3° | torção da raque |
| `angle` | 58–78° | ângulo das pinas |
| `pinnaLen` | 0.36–0.52 | comprimento das pinas |
| `seg` | 0.3–0.38 | segmento da raque |
| `decay` | 0.91–0.935 | afinamento da fronde por segmento |
| `leafletAngle` | 50–72° | ângulo dos folíolos |
| `leafletSize` | 0.13–0.19 | tamanho do folíolo |
| `leafH`, `leafS`, `leafL` | 85–140°, 0.45–0.75, 0.26–0.4 | cor (a raque usa `leafH − 25°` / `leafH − 5°`) |
| madeira | `leo` 2.5–2.8, `G` 0.3, `tip` 0.18, `ring` 0.15 | `baseWidth` 0.04 (raque fina), `bump` 0 |

---

## 🌺 Arbusto Florido (`arbusto`)

**Inspiração:** arbustos floríferos multicaule, como azaleia e hibisco: vários caules desde a base, ramificação densa e flores nas pontas na maturidade.

**Gramática:**

```
ω : F(0.25) { [ /(360°·i/stems ± 20°) &(12–38°) ~(−photo) A(1) ] } × stems     (fluxo próprio 'axiom' + petalH)
A(s) → p = pBranch3            : F(s·internode) L [B] /(div) [B] /(div) [B]
       p = 1 − pBranch3 − pFlower : F(s·internode) L /(div) [B] L A(s·0.9)
       p = pFlower              : F(s·internode·0.6) L K(flowerSize·0.9)    (flor precoce)
B(s) ≡ &(angle ± 6°) F(s·internode·0.5) L A(s·lenRatio)
juvenil(A) → 3 × leafStr(leafSize, 40°)           vivem 2.2 iterações
final:  A → F(0.12) leafStr(leafSize, 70°) K(flowerSize·(0.8–1.15))
```

`K(s)` = flor: `petals` pétalas em volta do eixo com abertura `open`, segunda camada intercalada (72% do tamanho, 55% da abertura) se `double`, e um miolo amarelo emissivo.

**Parâmetros da seed:**

| Parâmetro | Faixa | Efeito |
|---|---|---|
| `iterations` | 5 (fixo) | |
| `stems` | 4–6 | caules na base |
| `angle` | 18–32° | ângulo de ramificação |
| `div` | 100–140° | divergência |
| `internode`, `lenRatio` | 0.55–0.8, 0.8–0.9 | entrenós |
| `pBranch3` | 0.5–0.7 | probabilidade de 3 ramos |
| `pFlower` | 0.05–0.15 | probabilidade de flor precoce |
| `petals` | 5–8 | pétalas por flor |
| `open` | 48–78° | abertura da flor |
| `double` | 35% | flor dobrada |
| `flowerSize` | 0.15–0.22 | tamanho da flor |
| `palette` | rosa, magenta, vermelho, coral, amarelo, lilás, azul, branco | matiz base ± 10° |
| `hueSpread` | 4–22° | variação de matiz entre pétalas |
| `leafSize`, `leafH` | 0.22–0.32, 95–135° | folhas |
| `photo` | 0.03–0.09 | fototropismo (caules sobem) |
| madeira | `leo` 2.2–2.5, `G` 0.6, `tip` 0.03, `ring` 0.4 | `baseWidth` 0.17, `bump` 0.03 |

---

## ✨ Salgueiro Lumínico (`salgueiro`)

**Inspiração:** salgueiro-chorão (*Salix babylonica*), com ramos finais longos e pendentes. É uma espécie **fantástica**: as gavinhas têm folhas e orbes bioluminescentes, e a cena é noturna, com uma luz pontual da cor do brilho.

**Gramática:**

```
ω : F(trunk) /(30) A(1)
A(s) : s > 0.4 → F(s·internode) { [ &(angle ± 6°) A(s·lenRatio·(0.9–1.1)) ] /(div ± 15°) } × (3 com p=0.6 | 2)
       s ≤ 0.4 → F(s·internode) { [ /(360°·i/tendrils ± 25°) &(25–80°) ~(gravity·(0.8–1.2)) T(tendrilSeg) ] } × tendrils
T(l) → F(l) [L]? O? [ +(20–40°) T(l·0.9) ]? T(l·0.97)
       p_folha = 0.7 (L 0.42), p_orbe = orbChance, p_bifurca = splitChance
juvenil(A) → 3 × leafStr(0.5, 40°)               vivem 1.15 iteração
final:  T → O(orbSize·1.3)   A → O(orbSize)
```

**Parâmetros da seed:**

| Parâmetro | Faixa | Efeito |
|---|---|---|
| `iterations` | 13–14 | comprimento das gavinhas |
| `trunk` | 2.6–3.6 | tronco |
| `angle` | 26–40° | ângulo de ramificação |
| `div` | 110–150° | divergência |
| `internode`, `lenRatio` | 1.6–2.1, 0.68–0.76 | estrutura |
| `tendrils` | 4–6 | gavinhas por ramo final |
| `tendrilSeg` | 0.38–0.5 | segmento da gavinha |
| `gravity` | 0.26–0.42 | gravitropismo (forte: pendentes) |
| `orbChance`, `orbSize` | 0.05–0.12, 0.07–0.11 | orbes |
| `splitChance` | 0.03–0.09 | bifurcação da gavinha |
| `glow` | ciano, violeta, magenta, esmeralda, âmbar, azul elétrico | matiz ± 8° |
| `glow2` | ±25–70° | desvio de matiz secundário (35% dos orbes; folhas usam metade) |
| `barkH` | 250–290° | casca violácea |
| madeira | `leo` 2.3–2.6, `G` 0.8, `tip` 0.015, `ring` 0.4, `share` 0.75 | `baseWidth` 0.5, `bump` 0.05 |

Os orbes usam cor HDR (×1.3–2.4) para acionar o bloom; as folhas têm emissivo da cor do brilho.

---

## Casca procedural (v3)

Definida em `BARK[espécie](P, rng)` com o fluxo `${seed}::${id}::bark` (novo na v3, então a forma e as cores das folhas de cada seed não mudaram). Detalhes do shader em [ARQUITETURA.md](ARQUITETURA.md#9-casca-procedural-v3).

Campos: `type` (0 lisa, 1 sulcada, 2 placas, 3 raque), `stretch` (compressão do eixo: menor = células mais compridas), `crack` (largura da transição fenda → crista), `freq` (células por unidade de mundo), `depth` (profundidade relativa ao raio), `fbm` (quantidade de ruído fino), `lent` (lenticelas), `glow` (brilho das lenticelas), `hi`/`lo` (multiplicadores RGB da cor da casca nas cristas e nas fendas, com ±6–10% pela seed), `moss` (quantidade de musgo, 0 = sem), `mossH` (matiz do musgo), `mat` (fração de `tEnd` para a casca amadurecer).

| Espécie | Variantes (sorteio uniforme) | Escala `freq` | `stretch` | `crack` | `depth` | Musgo |
|---|---|---|---|---|---|---|
| Carvalho | sulcada (tipo 1) | 8–11 | 0.12–0.18 | 0.16–0.24 | 0.12–0.2 | 60% das seeds, 0.5–1, matiz 70–105° |
| | reticulada (tipo 1) | 7–9 | 0.28–0.38 | 0.2–0.3 | | |
| | escamosa (tipo 2) | 7–9 | 0.28–0.38 | 0.12–0.18 | | |
| Pinheiro | placas largas (tipo 2) | 3.5–5 | 0.35–0.5 | 0.1–0.15 | 0.12–0.2 | 30%, 0.3–0.7, matiz 60–90° |
| | escamas (tipo 2) | 7–10 | 0.6–0.8 | 0.12–0.18 | | |
| Samambaia | raque estriada (tipo 3) | 18–26 | 1 | n/a | 0.05 | não |
| Arbusto | lisa (tipo 0, `lent` 0.35) / lenticelada (tipo 0, `lent` 1) | 10–14 | 1 | n/a | 0.06–0.1 | não |
| Salgueiro | lisa (tipo 0, `lent` 0.4) | 6–9 | 1 | 0.1–0.16 | 0.06 | 35%, 0.3–0.6, matiz do brilho |
| | lenticelas luminosas (tipo 0, `lent` 1, `glow` 2.2) | 6–9 | 1 | | 0.06 | |
| | fissurada (tipo 1) | 5–7 | 0.15–0.25 | | 0.08–0.12 | |

Paletas: carvalho `hi` ≈ (1.45, 1.38, 1.3), `lo` ≈ (0.3, 0.28, 0.28); pinheiro `hi` = (k, 0.72k, 0.55k) com k = 1.6–2.4 (placas avermelhadas), `lo` = (0.35, 0.32, 0.32); arbusto `hi` ≈ 1.12, `lo` = (0.6, 0.55, 0.5); salgueiro `hi` ≈ (1.2, 1.15, 1.25), `lo` = (0.45, 0.42, 0.5); samambaia `hi` = (1.1, 1.1, 1.05), `lo` = (0.85, 0.85, 0.8).


---

# As 5 espécies exóticas (v4)

Mesmo motor das realistas, com os ganchos descritos em [ARQUITETURA §10](ARQUITETURA.md#10-espécies-exóticas-v4). Fluxos de RNG próprios (`seed::<id>::params`, `rules`, `turtle`, `wood`, `bark`, `fx`), então nada muda nas realistas.

## 💎 Árvore de Cristal (`cristal`)

**Ideia:** um "fractal mineral". Cristais não crescem por escolha, crescem por simetria, então a gramática é **determinística** (nenhuma regra estocástica): a seed só escolhe parâmetros.

```
ω : { [ /(360/c·i + 30°) &(30|60°) A(0.5) ] } × c   { [ /(yaw) &(90°) f(d) ^(90°−tilt) X(s) ] } × lascas   A(1)
A(s) → F(s·len) { [ &(60°|90°) A(s·ratio) ] /(120°|90°) } × (3|4)  /(60°|45°) A(s·apex)      (s < 0.1 → F)
final: A → F(s·len·0.6)
```

- Simetria `hexagonal` (3 filhos a 60°, giro de 120°, prisma de 6 faces) ou `cúbica` (4 filhos a 90°, giro de 90°, prisma de 5 ou 6 faces).
- Tubo `straight`: cada entrenó é um prisma reto separado (sem Catmull-Rom nem colar), com ponta piramidal de 1.8–2.8× o raio.
- **Mineral** (seed): ametista, esmeralda, quartzo rosa, citrino, safira, cristal de rocha ou obsidiana arco-íris (opaca, com iridescência). Cada um define cor, transmissão, IOR, dispersão e distância de atenuação.
- Lascas `X` espalhadas na base (10–18), 3–6 cristais laterais.

| Parâmetro | Faixa |
|---|---|
| `iterations` | 4 |
| `ratio` | hex 0.56–0.66 · cúbica 0.45–0.55 |
| `apex` | 0.7–0.85 |
| `len` | 1.6–2.2 |
| `cluster` | 3–6 |
| `point` | 1.8–2.8 |

## 🪼 Medusa Flutuante (`medusa`)

**Ideia:** uma planta de cabeça para baixo. O "solo" dela é o sino, e os galhos pendem.

```
ω : { [ /(360/n·i) &(90°) f(rim) &(flare) ~(g) T(seg) ] } × n    { [ /(…) &(166°) M(armSeg) ] } × braços
T(l) → F(l) ±(0–curl°) O? T(l·0.985)         (O com p = beads: nematocisto luminoso)
M(l) → F(l) /(37°) [ &(75°) L ] [ ^(75°) L ] M(l·0.97)   (braço oral com babados)
final: T → O (ponta brilhante), M → L
```

- Um entrenó por iteração (20–26): os tentáculos crescem em linha com a idade; o sino escala de 30% a 100% e pulsa (`max(0, sin(ωt))²`), e a planta toda boia (`float = 0.14`, sobe e desce devagar).
- Sino: superfície paramétrica com borda em 8–16 lóbulos, canais radiais e borda emissivos com fresnel, 4 gônadas luminosas dentro; neve marinha em volta.
- Ondulação no vertex shader pela distância à raiz no esqueleto (ver ARQUITETURA §10). Paleta: lunar, rosa abissal, âmbar, violeta, verde ácido ou azul elétrico, com matiz secundário de ±30–70°.

| Parâmetro | Faixa |
|---|---|
| `tentacles` | 12–22 |
| `arms` | 3–5 |
| `rim` / `bellH` | 1.5–2.1 / 0.55–0.95 |
| `flare` | 58–80° |
| `gravity` | 0.03–0.08 |
| `beads` | 0.08–0.25 |
| `wave` / `amp` / `pulse` | 0.7–1.3 / 0.05–0.09 / 1.4–2.2 |

## 🌵 Cacto Gravitacional (`cacto`)

**Ideia:** um cacto colunar que sente a gravidade de um planetinha. Os braços se curvam para cima (gravitropismo negativo) **e** para o ponto onde o planeta passa mais perto (periastro da órbita).

```
ω : !(1) C(0)
C(k) → F(seg) [ /(?) &(armAngle) ~(−up) $(att) B(1) ]? /(137.5°) C(k+1)     (braço com p = pArm; k = segs → Z)
B(l) → F(l·seg·0.8) [ +(55°) $(att) B(l·0.7) ]? B(l·0.9)                       (l < 0.5 → Z)
final: C, B, Z → coroa de 3 flores K
```

- Tubo com **costelas** (8, 13 ou 21: números de Fibonacci) que giram em espiral pelo arco, e estrangulamento entre gomos. Aréolas brancas desenhadas no shader nas cristas.
- **Planeta**: gigante gasoso, anelado, gelo, lava ou violeta anelado (textura de faixas seedada, luz pontual própria). Órbita elíptica (excentricidade 0.25–0.45, inclinação 12–32°, período 14–22 s, sentido pela seed).
- **Flores**: 14–22 pétalas em duas camadas, cor pela seed. Ficam em botão e só abrem (e brilham) quando o planeta passa perto.

| Parâmetro | Faixa |
|---|---|
| `segs` (gomos do tronco) | 5–7 |
| `iterations` | segs + 2–3 |
| `ribs` | 8 · 13 · 21 |
| `spiral` | ±0.05–0.12 rad por unidade |
| `pArm` / `armAngle` | 0.55–0.85 / 72–88° |
| `up` / `att` | 0.1–0.18 / 0.1–0.2 |

## 🧠 Raiz Neural (`neural`)

**Ideia:** um neurônio que é planta. O soma é a semente; os dendritos são a copa; o axônio é o caule que desce e vira raiz.

```
ω : [ &(180°) X(axonSegs) ]  { [ /(137.5°·i) &(12–80°) D(1) ] } × dend
D(s) → p = pSplit : F(s·dLen) [ +(dAngle) D(s·decay) ] [ −(dAngle) D(s·decay) ]
       senão      : F(s·dLen) /(±60°) &(±14°) O? D(s·0.93)          (s < 0.22 → F O: espinha dendrítica)
X(k) → F(axonLen) O? X(k−1)   |   X(0) → R(1)                         (O: nós de Ranvier, se sorteado)
R(s) → F(s) ~(rootGrav) { [ &(rootAngle) R(s·rootRatio) ] /(120°) } × 3   (s < 0.3 → botão sináptico O)
```

- `tags`: os nós da subárvore do axônio ganham etiqueta 1. Os pulsos de luz **saem** do soma pelo axônio e **chegam** ao soma pelos dendritos (como o sinal de verdade). Os botões sinápticos e nós de Ranvier piscam quando o pulso passa; o soma pisca no ritmo do trem de pulsos.
- `float = 0`: a ponta mais baixa das raízes encosta no chão.

| Parâmetro | Faixa |
|---|---|
| `dend` | 5–8 |
| `dAngle` / `decay` / `pSplit` | 26–42° / 0.8–0.86 / 0.55–0.8 |
| `axonSegs` / `axonLen` | 5–7 / 0.75–0.95 |
| `rootAngle` / `rootGrav` | 38–58° / 0.04–0.12 |
| `speed` / `spacing` / `width` | 2.2–3.8 / 5–9 / 0.35–0.55 |
| cor | ciano, violeta, magenta, âmbar, verde sináptico, azul |

## 🍄 Coral-Fungo Bioluminescente (`coral`)

**Ideia:** trocar folhas por chapéus. Um símbolo novo, `P(r)`, desenha um chapéu (domo com a borda virada) e lamelas radiais por baixo, que brilham.

```
ω : !(1) F(0.45) { [ /(360/estipes·i) S(1) ] } × estipes
S(s) → p = pBranch : F(s·seg) P(s·cap)? [ +(angle) S(s·0.82) ] /(137.5°) S(s·capDecay)
       senão       : F(s·seg) P(s·cap·0.85)? /(137.5°) S(s·capDecay)
final: S → F P (chapéu do topo, um pouco maior)
```

- A seed escolhe a **variante**: *coral do fundo do mar* (tons azulados/violeta/rosa coral, chapéus quase planos, bolhas subindo, cenário `abismo`) ou *fungo da floresta* (laranja/âmbar/ferrugem/dourado, chapéus abaulados, esporos dourados, cenário `floresta`).
- Os chapéus inclinam um pouco na direção do ramo (`capTilt = 0.35`). A estipe usa a casca da v3 (lisa com lenticelas luminosas).

| Parâmetro | Faixa |
|---|---|
| `stems` | 2–4 |
| `iterations` | 6–7 |
| `pBranch` / `angle` | 0.55–0.8 / 28–45° |
| `cap` / `capDecay` / `pCap` | 0.5–0.72 / 0.8–0.88 / 0.35–0.6 |
| `dome` | mar 0.04–0.1 · floresta 0.22–0.34 |
| `gills` | 28–44 |

---

# As 5 árvores raras (v5)

Árvores **reais e incomuns**, no espírito das realistas (nada de fantasia). Usam o mesmo motor e os ganchos da v4, mais três novidades descritas em [ARQUITETURA §11](ARQUITETURA.md#11-árvores-raras-v5): perfil do tronco por gancho (`tube.bump`), raízes aéreas que viram troncos (`W`) e frutos pendentes (`Y`). Fluxos de RNG próprios (`seed::<id>::…`), então as 10 espécies anteriores não mudam.

## 🐉 Dragoeiro de Socotra (`dragoeiro`)

**Ideia:** *Dracaena cinnabari*. A planta jovem é um caule único com uma roseta; depois cada ponta se divide **em duas**, em planos alternados (giro de 90°), por muitas gerações. Como todas as pontas têm a mesma idade, elas chegam juntas à mesma altura e formam o guarda-chuva denso. As folhas (rígidas, em fita, com quilha) só existem nas pontas.

```
ω : !(1) F(tronco) A(1)
A(s) → /(90° ± 12°) ~(−up) F(s·entrenó) [ &(ângulo) A(s·razão) ] [ ^(ângulo) A(s·razão) ]
final: A → F(0.12) + roseta de N folhas em espiral áurea (137,5°), inclinação 8°→78°
juvenil: A → roseta (80% das folhas)
```

- `~(−up)` é um tropismo leve para cima, que fecha a copa em cúpula.
- **Sangue de dragão** (seed, 55%): escorridos de resina vermelho-escura no shader da casca (`LS_FX_DRAGOEIRO`), em ferimentos espalhados e em filetes verticais finos abaixo deles. Só aparecem na madeira madura. A intensidade também vem da seed.
- Casca lisa cinza-clara, quase sem lenticelas. Cenário `arido`.

| Parâmetro | Faixa |
|---|---|
| `iterations` (dicotomias) | 7–8 (128–256 pontas) |
| `trunk` | 2.6–3.6 |
| `angle` | 30–40° |
| `ratio` | 0.80–0.86 |
| `up` | 0.08–0.14 |
| `leaves` por roseta | 16–24 |
| `leafLen` | 0.75–1.0 |
| `sap` / `sapAmt` | 55% · 0.6–1 |

## 🪵 Baobá (`baoba`)

**Ideia:** *Adansonia*. O tronco é uma garrafa maciça e a copa é curta e retorcida, como raízes viradas para cima. Duas coisas fazem o tronco engordar tanto:

1. **Leonardo exagerado:** expoente `e` de 1,20–1,32 (nas realistas, ~2–2,6). Com `e` baixo, o pai fica muito mais grosso que a soma dos filhos, e o crescimento secundário (`G = 1,5`) engrossa mais quem é mais velho (o tronco).
2. **Perfil de garrafa no tubo** (`tube.bump`, só na cadeia do tronco): `f = arco / altura do tronco`, `(1 + 0,15·e^(−f/0,05) + barriga·sin(π·f/0,9)) · (1 − 0,5·((f − 0,72)/0,28)^1,3)`, mais ondulações suaves em θ. Base levemente alargada, barriga no meio e um ombro que fecha para encontrar os galhos.

```
ω : !(1) F(h/6)×6 C
C → { [ /(360°/n·i ± 20°) &(ângulo ± 10°) ~(−0.04) B(1) ] } × n          (n = 4–7 galhos)
B(s) → F(s·len) /(±70°) &(±retorcimento) F(s·len/2) [ &(35°) B(s·razão) ] [ ^(25°) B(s·razão) ]
       s < 0.3 → F  L L L (com prob.)  Y (fruto, com prob.)
juvenil: C, B → folhas (a muda tem folhas antes de ter copa)
```

- **Frutos** (seed, 70%): `Y(s)` pendura uma cápsula ovalada com cabinho comprido (geometria `fruit`, origem no ponto de inserção, sempre para baixo).
- Casca lisa acinzentada com dobras largas. Folhas poucas (copa quase nua, como na estação seca). Cenário `savana`.

| Parâmetro | Faixa |
|---|---|
| `iterations` | 4–5 |
| `trunkH` | 4.2–5.4 |
| `bulge` (barriga) | 0.20–0.40 |
| `limbs` | 4–7 |
| `angle` | 50–72° |
| `gnarl` (retorcimento) | 20–34° |
| `ratio` | 0.60–0.68 |
| `leafP` | 0.35–0.7 |
| `fruits` / `fruitP` | 70% · 0.25–0.45 |

## 🌈 Eucalipto Arco-Íris (`eucalipto`)

**Ideia:** *Eucalyptus deglupta*. Tronco alto, reto e liso. A casca descasca em faixas: a camada nova é verde-viva e, com o tempo, amadurece para laranja, roxo, azul e vinho. Como cada placa descasca numa época diferente, o tronco mostra todas as cores ao mesmo tempo.

```
ω : !(1) A(0)
A(k) → F(entrenó·(1 − k/4n)) [ &(ângulo) ~(−0.03) B(1 − 0.5·u) ]? /(137.5°) A(k+1)    (galho só se k ≥ n·bare)
A(n) → B(0.85)
B(s) → F(s·bLen) L? [ +(35°) B(0.6s) ] [ −(30°) B(0.55s) ]? /(90° ± 30°) ^(6°) B(0.8s)     (s < 0.14 → folhas pendentes)
juvenil: A → 4 folhas (a muda tem folhas no ápice)
```

**Casca nova (`LS_FX_EUCALIPTO`, no shader de casca da v3):**

- Placas = Voronoi em `(xy·célula, z·alongamento)` com warp de ruído. `alongamento` pequeno → faixas longas; maior → placas.
- Cada placa tem um id `v.z`. Tempo de cor da placa: `idade = clamp(maturidade_do_nó · velocidade · (0,6 + 0,8·v.z), 0, 1)`; estágio: `idade · 4 · fract(1,618·v.z + espalhamento·ruído)`. Madeira nova é toda verde; madeira velha mistura todos os estágios. Placas com `fract` baixo "descascaram há pouco" e voltam a ser verdes.
- Cor = mistura entre `uPal[estágio]` e `uPal[estágio+1]`, com fibras finas verticais e bordas escuras e finas onde a placa descola.
- **Paleta** (seed): `clássica`, `tropical`, `fria` ou `outono` (5 cores cada, uniform `uPal[5]`). **Padrão** (seed): `faixas longas` (0,06–0,10), `faixas` (0,12–0,18) ou `placas` (0,22–0,32).

| Parâmetro | Faixa |
|---|---|
| `iterations` | 19–20 |
| `n` (entrenós do tronco) | 13–15 |
| `bare` (fração sem galhos) | 0.50–0.62 |
| `pB` | 0.6–0.85 |
| `angle` | 55–72° |
| `bLen` | 1.1–1.4 |
| `speed` (maturação da cor) | 3.5–5 |
| `cell` · `warp` · `spread` | 1.1–1.6 · 0.5–1.1 · 0.8–1.6 |

## 🌳 Figueira-de-Bengala (`figueira`)

**Ideia:** *Ficus benghalensis*. Galhos quase horizontais soltam **raízes aéreas** que descem até o chão. Quando a raiz toca o solo, ela engrossa com a idade e vira um tronco secundário, e uma árvore vira um pequeno bosque.

```
ω : { /(137.5°) F(tronco/n) [ &(ângulo − 2i) ~(0.005) B(1 − 0.06i) ] } × n   F(0.3) { [ &(40°) C(0.9) ] } × 3–4
B(s) → F(seg) W(0.5)? [ ^(60°) C(0.35 + 0.3s) ] [ ±45° B(0.7s) ]? /(±30°) B(0.9s)      (s < 0.35 → C(0.45))
C(s) → F(0.8s) L [ +(35°) C(0.68s) ] [ −(35°) C(0.68s) ] /(90°) C(0.6s)               (copa; s < 0.18 → folhas)
```

- **`W(seg)`**: a tartaruga cria uma cadeia vertical de nós do ponto atual até `y = 0`, com um leve tremor. Ela nasce depois do módulo e desce ao longo de `rootDrop` = 1,4 iteração (o slider de idade mostra a raiz descendo).
- **Engrossamento:** quando a ponta chega ao chão, o raio da raiz cresce de 0 até `f · raio do tronco` ao longo do resto da vida da planta (`f`: 45% das raízes ficam com 25–42% do tronco e o resto com 6–16%, sorteado pela seed). Esse raio **não** passa pela regra de Leonardo: na árvore real a raiz é um caminho de carga próprio até o chão, e somar o peso dela no galho incharia o tronco principal.
- `tube.bump` alarga a base de todos os troncos perto do chão (`1 + 0,9·e^(−y/0,3)`, com 5 lobos).
- Folhas largas, ovais, coriáceas, em copa densa.

| Parâmetro | Faixa |
|---|---|
| `iterations` | 7–8 |
| `trunk` | 2.4–3.0 |
| `limbs` | 5–7 |
| `limbAngle` | 72–84° |
| `seg` | 0.85–1.1 |
| `pRoot` (raiz por segmento) | 0.25–0.4 |
| `pSide` | 0.2–0.35 |
| `leafSize` | 0.42–0.55 |

## 🌲 Sequoia Gigante (`sequoia`)

**Ideia:** *Sequoiadendron giganteum*. Tronco altíssimo com sapopemas na base, nu até bem alto, casca fibrosa avermelhada e sulcada, e copa estreita, de cônica a arredondada. Uma **silhueta humana de 1,8 m** ao pé do tronco dá a escala. Ela é proporcional à altura real sorteada pela seed (70–95 m).

```
ω : !(1) A(0)
A(k) → F(entrenó·(1 − 0.3k/n)) { [ /(360°/p·i ± 30°) &(ângulo) B(L(u), 0) ] } × p? /(137.5°) A(k+1)    (só para k ≥ n·bare)
L(u) = √(1 − u^(1 + 2·round)) · min(1, 0.55 + 3u)          u = posição relativa na copa
B(l, j) → ~(j < 2 ? caimento : −ponta) N F(l·seg) [ ±50° ramo com N ] … B(0.86l, j+1)     (galho cai e depois sobe)
juvenil: A → tufo de agulhas em cone
```

- Sapopemas: `tube.bump` na cadeia do tronco: `1 + butt·e^(−arco/buttH)·(½ + ½cos(lobos·θ + …))^1,5` + estrias finas.
- Casca tipo 1 (sulcada) com alongamento 0,06–0,10, fendas profundas e tom vermelho-ferrugem.
- O painel mostra a `Altura real (m)` e a linha de escala nas regras.

| Parâmetro | Faixa |
|---|---|
| `iterations` | 27–29 |
| `n` | 24–26 |
| `bare` | 0.42–0.55 |
| `per` (galhos por nó) | 3–4 |
| `angle` | 72–92° |
| `droop` / `upturn` | 0.06–0.14 / 0.05–0.12 |
| `round` | 0.4–1.0 |
| `butt` / `buttH` / `lobes` | 0.45–0.8 / 1.2–2.0 / 5–8 |
| `realH` | 70–95 m |
