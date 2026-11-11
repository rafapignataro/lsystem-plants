# As 5 espécies

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

