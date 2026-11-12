# Bonsai Garden — espécies

O jardim registra só **bonsais**. As 5 realistas (carvalho, pinheiro boreal, samambaia, arbusto florido, salgueiro) e as 5 raras (dragoeiro, baobá, eucalipto, figueira, sequoia) saíram; o código delas continua no histórico do git. As 5 exóticas da v4 já tinham saído na v7 (ver [HISTORICO](HISTORICO.md)).

Uma espécie nova entra em três lugares de `lsystem-core.mjs`, sem mudar o motor:

1. o id em `BONSAI` (o seletor e o jardim leem `ALL`, que concatena `ORDER`, `RARE` e `BONSAI`; os dois primeiros grupos ficam vazios);
2. o objeto em `SPECIES` (bloco 6d, `Object.assign`);
3. a casca em `BARK`. Se não houver entrada em `SIMS`, o bonsai usa a simulação padrão (poda de formação a cada 3 anos; o bordo continua a cada 2).

Cada espécie é um objeto em `SPECIES` com:

- `params(rng)`: sorteia os parâmetros a partir da seed (fluxo `params`);
- `build(P)`: devolve a gramática: `axiom`, `rules`, `finalize`, `juvenile`, `juvenileLife` e `display` (texto das regras mostrado no painel);
- `bark(P)`: `[cor da casca velha, cor da madeira jovem]`;
- `color(kind, item, P, rng)`: cor de cada folha ou agulha;
- `baseWidth`, `bump` (irregularidade da casca), `leafRoll`, `wood` (`leo`, `G`, `tip`, `ring`, `share`).

Notação: `r.range(a,b)` = uniforme em [a,b]; `r.int(a,b)` = inteiro em [a,b]; `jit(x)` = ±x.
O símbolo `!(x)` ainda aparece nas regras (herança da v1), mas é ignorado: a espessura sai da regra de Leonardo.

Para todas: expoente de Leonardo `e = leo[0] + f·(leo[1] − leo[0])` e `G = wood.G · (0.8–1.2)`, ambos do fluxo `wood`.

Desde a v7 o padrão é o **crescimento simulado** (24 anos de formação, poda das almofadas). O modo clássico (`#cresc=classico`) usa só a gramática abaixo.

---

# Os bonsais

Árvores **em miniatura e formadas por anos de poda**, cada uma num vaso. A forma não sai só de uma regra "natural" de crescimento: o axioma já desenha o **estilo** (a curva do tronco, os andares, a hélice), como um bonsaísta faria com arame, e as regras ramificam os galhos até virarem **almofadas de folhagem**. Cada espécie tem fluxos de RNG próprios (`seed::<id>::…`). Os ganchos estão em [ARQUITETURA §12](ARQUITETURA.md#12-bonsais-v6).

Comum aos bonsais:

- **Nebari** (raízes de superfície): `nebari(r, k, len, w)` gera `k` cordões `[ /(360°/k·i ± jit) &(90°) F(len) /(±40°) +(±25°) F(len) Q(w) ]` que saem quase na horizontal da base. `Q(w)` dá um peso extra à ponta da raiz na regra de Leonardo, então as raízes ficam grossas e a base do tronco alarga (o raio da base continua sendo `baseWidth`).
- **Almofada** `Z(rx, ry, n, s)`: `n` folhas/tufos de agulha distribuídos num domo achatado de raio `rx` e altura `ry`, viradas para cima (`padUp`). Cada folha nasce com um atraso aleatório de até 0,7 da vida do módulo, então a almofada "enche" aos poucos. `pad(P, k)` escala raio por `k`, altura por `√k` e número de folhas por `k²`.
- **`_(k)`** nivela a direção da tartaruga (k = 1: horizontal): é o "arame" que deixa os galhos planos.
- **Vaso procedural** (`makePot`): superelipse (`n = 2` redondo/oval, `n = 7` retangular de cantos arredondados), com borda, barriga, afunilamento e pés; a terra é um disco com um monte suave e musgo por ruído de valor (cores por vértice). O junípero tem uma mesinha de madeira escura. O vaso se ajusta ao tamanho da copa (`skExtent`).
- **Idade = anos de formação**: `years` vem da seed; o slider mostra "N de M anos de formação". Aos 25% é uma muda fina com almofadas pequenas (folhas juvenis), aos 100% o tronco engrossou (crescimento secundário) e as almofadas estão cheias.
- O disco de chão padrão some (o vaso é o chão), e cada bonsai tem um cenário: `preto`, `estudio`, `terracota`, `zen`.

## 🍁 Bonsai de Bordo Japonês (`bordo`)

**Ideia:** *Acer palmatum* em **moyogi** (ereto informal). O tronco é uma sequência de segmentos curvados por `&(curva · cos(2π·ciclos·k/n + φ))`, o que dá um S suave; casca lisa cinza-clara. Os galhos alternam de lado (180° ou 90° ± 28°), saem quase horizontais e ramificam em dicotomias até as almofadas largas de folhas palmadas vermelhas.

```
ω : nebari × raízes   { &(curva·cos(…)) F(L·(1 − 0.3k/n)) [ /(yaw) &(abertura) ~(queda) B(Lg·(1 − k/2n)) ] } × n   ^(curva/2) B(0.45·Lg)
B(s) → F(0.8s) [ +(split) B(ratio·s) ] [ −(split) B(ratio·s) ] /(±30°) ^(4°) B(cont·s)     (s < 0.24 → almofada 0.9)
final: B → Z   ·   juvenil: B → Z pequena
```

| Parâmetro | Faixa |
|---|---|
| `years` | 15–40 |
| `segs` / `segLen` | 6–7 · 0.7–0.85 |
| `curve` / `cycles` | 22–32° · 0.9–1.2 |
| `roots` / `rootW` | 4–6 · 6–12 |
| `branchLen` / `bAngle` / `split` | 1.45–1.8 · 72–86° · 30–42° |
| `ratio` / `cont` | 0.62–0.7 · 0.72–0.8 |
| `padR` / `padH` / `padN` | 0.44–0.54 · 0.24–0.3 · 22–28 |
| `lobes` | 5 (65%) ou 7 (35%) |
| `leafH` (vermelho) | −8 a 4 |

Vaso oval raso quase preto. Cenário `preto` (fundo preto, luz de estúdio).

**Crescimento simulado (v7):** Bonsai (vale para os bonsais do registro): 24 anos de formação. Andaime = estilo completo da gramática (nebari, tronco, galhos, jin); cada almofada `Z` e cada ponta `B` viram gema. Os raminhos crescem para dentro do volume da almofada clássica (pontos de atração em volta das folhas dela), com sombra fraca (o bonsaísta mantém as almofadas abertas) e **poda de formação** a cada 2 anos no bordo (3 nos outros): o que sai do volume é cortado.

## 🌲 Bonsai de Pinheiro-Branco (`pinheiro_branco`)

**Ideia:** *Pinus parviflora*. Tronco **maciço e torcido**: cada segmento gira para um plano de curva aleatório (`/(60–130°)`), e um `tube.bump` só no tronco cria sulcos e nós torcidos (`1 + gnarl·(0,55·sin(3θ + 2,1·arco + φ) + 0,45·sin(5θ − 1,4·arco))`, mais forte perto da base). Casca em placas cinza (tipo 2). Galhos nivelados por `_(0.8)` terminam em almofadas horizontais e finas de tufos de agulha. No 2º segmento sai a **cascata**: um galho que vai para fora, nivelado, e cai por gravitropismo para além da borda do vaso.

```
ω : nebari × raízes   { /(60–130°) &(curva) F } × n   + galhos [ /(180° ± 40°) &(ângulo) _(0.8) ^(4°) B(L) ]
     no 2º segmento: [ /(+90°) &(80°) _(0.9) F(0.5) ~(queda) C(0) ]     ápice: domo + Z(1.3)
B(s) → F(0.75s) _(0.5) [ +(split) B(0.55s) ] [ −(split) B(0.55s) ] B(0.72s)     (s < 0.36 → Z)
C(j) → F(0.55) [ ±50° _(1) D(0.45) ] C(j+1)     (j = cascata → Z(1.1))
D → F(0.25) Z(0.7)
```

| Parâmetro | Faixa |
|---|---|
| `years` | 30–80 |
| `segs` / `segLen` / `bend` | 5–6 · 0.5–0.62 · 18–30° |
| `gnarl` | 0.1–0.18 |
| `roots` / `rootW` | 6–8 · 10–20 |
| `branchLen` / `bAngle` / `split` | 1.25–1.6 · 80–94° · 34–46° |
| `cascade` / `cascDroop` | 3–4 · 0.18–0.26 |
| `padR` / `padH` / `padN` | 0.42–0.52 · 0.08–0.11 · 30–38 |

Vaso oval largo e raso, marrom-acinzentado, com bastante musgo. Cenário `estudio` (cinza-claro).

**Crescimento simulado (v7):** Bonsai: ver o bordo (poda a cada 3 anos). A cascata vem do andaime.

## 🎋 Bonsai de Cipreste Hinoki (`cipreste`)

**Ideia:** *Chamaecyparis obtusa* em **chokkan** (ereto formal). Tronco reto e afinando (13–16 segmentos quase sem desvio). A parte de baixo (`bare`) não tem galhos; acima, cada segmento recebe um galho nivelado que **alterna de lado** (180° ± 22°, com um passo extra de 70° a cada 4) e **encurta até o topo** (`0.3 + Lmax·(1 − u)^0.9`), formando a silhueta triangular em andares. As folhas são escamas serrilhadas (`hinoki`) em almofadas densas.

**Shari:** uma faixa de madeira morta branca na frente da parte baixa do tronco, pelo shader de madeira morta (`LS_DEAD`): cobre `shari` da volta, sobe até `shariH` da altura e pode girar levemente (`shariTwist`).

```
ω : nebari × 5   { F(L·(1 − 0.3k/n)) [ /(lado += 180° ± 22°) &(ângulo) _(0.85) B(0.3 + Lmax·(1 − u)^0.9) ] } × n   F(0.25) Z(0.9)
B(s) → F(0.6s) _(0.6) [ +(split) B(0.5s) ] [ −(split) B(0.5s) ] B(0.68s)     (s < 0.34 → Z(0.75 + s))
```

| Parâmetro | Faixa |
|---|---|
| `years` | 20–50 |
| `segs` / `segLen` | 13–16 · 0.42–0.5 |
| `bare` | 0.16–0.24 |
| `Lmax` / `bAngle` / `split` | 1.3–1.7 · 86–98° · 32–42° |
| `padR` / `padH` / `padN` | 0.44–0.54 · 0.3–0.38 · 40–48 |
| `shari` / `shariH` / `shariTwist` | 10–16% da volta · 30–45% da altura · 0–0.12 rad/unid. |

Vaso redondo e fundo de terracota com musgo. Cenário `terracota` (fundo marrom-avermelhado, luz dramática).

**Crescimento simulado (v7):** Bonsai: ver o bordo (poda a cada 3 anos). Os andares e o shari vêm do andaime.

## 🌀 Bonsai de Junípero (`junipero`)

**Ideia:** *Juniperus* de montanha. O tronco é uma **hélice**: giro constante `/(roll)` + curva `&(bend)` em cada segmento; um `tube.bump` no tronco acrescenta caneluras torcidas. A maior parte da volta é **madeira morta** (shari) branca/prateada, numa faixa que gira em espiral junto com o tronco; o que sobra é a **veia viva** fina, marrom-avermelhada. Os galhos só saem da metade de cima e têm tropismo (`$`) para um ponto ao lado, então a copa densa verde-escura **inclina** para um lado. 2–3 **jin** (galhos mortos, `J`) saem nus e inteiros brancos.

```
ω : nebari × 5   { /(roll) &(bend) F } × n    (k = 2: $(0.05·lean))
     k ≥ 0.45n: [ J /(yaw + 60°) &(55°) F F F ] (jin, k par)   [ /(yaw += 120° ± 50°) &(55°) $(0.12·lean) B(L) ]
     ápice: $(0.1·lean) F(0.3) B(0.6) Z(1.2)
B(s) → F(0.7s) [ +(split) B(0.58s) ] [ −(split) B(0.58s) ] /(±40°) B(0.72s)     (s < 0.3 → Z)
```

**Madeira morta (shader):** no ângulo do tubo `θ` e no arco `a`, `sp = θ − torção·a − fase`; a faixa é `cos(sp + ruído) > cos(π·cobertura)`. Só aparece em madeira com raio relativo acima de um mínimo (galhos finos ficam vivos) e com maturidade (a muda não tem madeira morta; ela "aparece" com os anos de formação). Cor osso com veios ao longo da espiral e rachaduras finas, e uma borda escura onde a casca viva enrola.

| Parâmetro | Faixa |
|---|---|
| `years` | 40–120 |
| `segs` / `segLen` | 8–10 · 0.5–0.6 |
| `roll` / `bend` | 45–70° · 18–28° |
| `dead` / `twist` | 58–72% da volta · 0.9–1.6 rad/unid. |
| `jins` | 2–3 |
| `lean` | 0.6–1.0 |
| `branchLen` / `split` | 0.75–0.95 · 34–46° |
| `padR` / `padH` / `padN` | 0.3–0.38 · 0.2–0.26 · 16–20 |

Vaso retangular marrom (superelipse `n = 7`) sobre uma mesinha escura. Cenário `zen`.

**Crescimento simulado (v7):** Bonsai: ver o bordo (poda a cada 3 anos). A hélice, o shari e os jin vêm do andaime.

## 🍃 Bonsai de Olmo Chinês (`olmo_chines`)

**Ideia:** *Ulmus parvifolia* em **hokidachi** (vassoura). O tronco é reto — três `F` quase sem `&` nem `/` — e perto de um terço da altura se abre em três anéis curtos (externo, médio, interno) mais um líder. Cada galho sai em leque e, depois de um trecho reto, `~(-lift)` curva para o céu: o tropismo age a cada `F`, então vários segmentos curtos fecham um domo. A ramificação é dicotômica, com um terceiro ramo para cima de vez em quando, e termina em folhas serrilhadas pequenas e uma almofada miúda, arejada o bastante para o desenho dos ramos aparecer na borda.

```
ω : nebari × raízes   tronco reto F × 3
     anel externo × 8 a &(outerA)   F(0.065)   anel médio × 7 a &(midA)   F(0.05)   anel interno × 5 a &(innerA)   líder
     galho: ~(0) F F ~(-lift) [ ±split B ] F F ^(sobe) B
B(s) → F F [ ±(split) B(side·s) ] [ ^(12°) B ] B(cont·s)     (s < tip → folhas + Z pequena)
```

**Casca:** lisa, que descasca em manchas macias de cinza, bege e laranja (shader `fx: 'olmo'`), sem placas nem madeira morta. Os ramos finos ficam na cor jovem.

| Parâmetro | Faixa |
|---|---|
| `years` | 20–55 |
| `segLen` | 0.22–0.26 |
| `spokesA` / `outerA` | 8 · 44–54° |
| `arm` / `lift` | 1.22–1.42 · 0.20–0.28 |
| `split` | 22–30° |
| `padN` / `leafS` | 5–7 · 0.028–0.038 |

Vaso oval raso, esmaltado, creme ou cinza-claro conforme a seed, com musgo. Cenário `estudio`.

**Crescimento simulado (v7):** andaime é o hokidachi inteiro; raminhos curtos enchem a casca do domo e a tesoura corta o que sai dele a cada 3 anos.

## 🪴 Bonsai de Ficus (`ficus`)

**Ideia:** *Ficus retusa* (figueira-ginseng) em **moyogi** (ereto informal). O tronco é grosso e musculoso, de casca lisa cinza com lenticelas; a curva é a mesma do bordo, `&(curva · cos(2π·ciclos·k/n + φ))`. O nebari não usa o helper compartilhado: são 6–8 dedos de cinco segmentos, quase na horizontal, com peso `Q` para engrossar, saindo de um colo curto (`F(0.04)`, o nó 1, de onde a raiz aérea mede a fração do tronco). Dos galhos baixos descem raízes aéreas `W(seg, atraso, fração)` até o musgo. A copa é um conjunto de almofadas arredondadas de folhas ovais pequenas, verde-escuras e brilhantes.

```
ω : F(0.04)  nebari × raízes (5 F quase horizontais + Q)   tronco { &(curva·cos(…)) F } × n
     a partir do 2º segmento, espiral áurea: [ /(137° ± 16°) &(abertura) B(L) ]
     no primeiro andar, um segundo galho do lado oposto
     raízes aéreas nos galhos baixos: F W(0.2, atraso, fração do tronco)
     ápice: F B
B(s) → F(0.42s) _(0.22) [ +(split) ^(6°) B(0.55s) ] [ −(split) ^(6°) B(0.55s) ] ^(16°) B(0.68s)
       (s < 0.28 → almofada)
```

`tube.bump` deixa o tronco quase liso (um flare curto na base e um músculo suave) e engrossa o nebari no colo, afinando até a ponta. A folha é uma lâmina oval/obovada levemente côncava, com verniz (`leafCoat`). O vaso é oval raso, de esmalte azul-turquesa, com musgo e sem pedras (elas cairiam fora do vaso baixo).

| Parâmetro | Faixa |
|---|---|
| `years` | 12–40 |
| `segs` / `segLen` | 6–7 · 0.48–0.56 |
| `curve` / `cycles` | 14–24° · 0.85–1.15 |
| `roots` / `rootLen` / `rootW` | 6–8 · 1.15–1.42 · 22–32 |
| `aerials` | 4–5 |
| `branchLen` / `bAngle` | 0.62–0.84 · 42–54° |
| `padR` / `padH` / `padN` | 0.56–0.7 · 0.32–0.42 · 72–96 |
| `flare` / `muscle` | 0.05–0.12 · 0.04–0.08 |

Vaso oval raso de esmalte azul-turquesa sobre musgo. Cenário `estudio`.

**Crescimento simulado (v7):** Bonsai, com poda a cada 2 anos e o andaime um pouco mais cedo, para a copa já estar enchendo no meio da formação. O estilo (nebari, tronco, raízes aéreas) vem da gramática; as almofadas enchem de raminhos com mais folhas ovais por gema.

## 🌸 Bonsai de Azaleia Satsuki (`azaleia`)

**Ideia:** *Rhododendron indicum* em estilo **moyogi** (ereto informal). O tronco é curto, com uma curva leve em S, afinado da base para o ápice, nebari na terra e casca marrom-avermelhada lisa com descamações pequenas. Os galhos são curtos e saem em espiral; o comprimento segue o contorno de um domo (mais longo no meio, mais curto embaixo e no ápice) e cada entrenó leva uma almofada de folhas, de modo que a copa fecha num monte compacto.

As flores são funis pequenos de **cinco pétalas** (`E`), agrupadas em almofadas arredondadas que cobrem quase toda a copa. Folhinhas verde-escuras aparecem entre elas e dão volume. A seed escolhe a paleta — rosa, magenta, branca ou **mescla** (as três na mesma planta, traço conhecido da satsuki). Elas só abrem nos estágios finais (`bloomAt` no clássico; no simulado, a partir de cerca de dois terços dos anos de formação). No simulado as flores são instâncias colocadas junto às folhas vivas da casca da copa, em almofadas, com um vão mínimo, então não flutuam. A planta não recebe pedras soltas: o vaso é o chão.

```
ω : nebari curto × roots   tronco { /(±) &(curve·cos) F [ /(yaw) &(ângulo→fecha no topo) ~(−0.02) B ] } × segs   ápice B
B(s) → F(0.26s) Z [ +(split) ^ B(ratio·s) ] [ −(split) ^ B(ratio·s) ] ^(lift) B(cont·s)     (s < 0.12 → Z + E)
final: B → Z + E(flR, flH, flN, flowerSize)
juvenil: B → Z pequeno, sem flores
```

| Parâmetro | Faixa |
|---|---|
| `years` | 18–45 |
| `segs` / `segLen` | 4–5 · 0.11–0.14 |
| `curve` | 22–32° |
| `branchLen` / `bAngle` / `split` | 0.28–0.38 · 64–76° · 28–40° |
| `flowerSize` / `open` / `flN` | 0.015–0.021 · 36–44° · 11–14 |
| `palette` | rosa, magenta, branco ou mescla |
| `pot` | redondo ou retangular, barro sem esmalte, com musgo |

**Crescimento simulado (v7):** poda a cada 3 anos, com o envelope colado na copa clássica. Um passo extra veste a casca da copa com almofadas de funis pequenos só depois do ano 16 de 24. Aos 40% da idade a estrutura e as folhas já existem e as flores ainda não.

## 🌲 Bonsai de Pinheiro-Negro em Cascata (`pinheiro_negro`)

**Ideia:** *Pinus thunbergii* em **kengai** (cascata plena). O tronco sobe pouco acima da terra, arqueia sobre a borda e cai ao lado do vaso, em zigue-zague suave, até **abaixo da base**. A casca é áspera, em placas cinza-escuras. As agulhas são longas, rígidas e verde-escuro, em almofadas ao longo da queda, com um ápice pequeno recuado acima do vaso. O vaso é hexagonal, fundo e sem esmalte, quase preto, e fica num suporte alto de madeira para a cascata ter para onde cair.

```
ω : nebari × 5–7   /(az) F(rise) [ ápice recuado ] &(bend1) F &(bend2) F [ almofada do joelho ]
     ~(droop) $(pull) &(bend3) F C(0)     alvo (P.attractor) abaixo do vaso
C(j) → _(0) +(±zig) &(abre/fecha) F(fall) [ almofada na parte de fora ] C(j+1)     (j = cascade → almofada da ponta)
```

`_(0)` reorienta o referencial sem mudar a direção, então o `+` é um zigue-zague horizontal enquanto o tronco já cai. O passo par abre a queda e o ímpar fecha, e o conjunto permanece ao lado do vaso. `~` e `$` puxam o tronco para baixo, em direção ao alvo.

| Parâmetro | Faixa |
|---|---|
| `years` | 45–100 |
| `cascade` | 6 segmentos |
| `bend1` / `len2` | 52–58° · 0.7–0.82 (o arco que passa a borda) |
| `zig` / `fall` | 12–18° · 0.52–0.62 |
| `droop` | 0.03–0.06 |
| `roots` | 5–7 |
| `padR` / `padH` / `padN` | 0.22–0.3 · 0.055–0.08 · 22–30 |

Vaso hexagonal fundo, sem esmalte, quase preto, sobre um suporte alto. Cenário `estudio`. O enquadramento inclui o que fica abaixo do vaso.

**Crescimento simulado:** o andaime é o kengai inteiro. As almofadas brotam para dentro da nuvem clássica, inclusive abaixo do vaso. Um alvo (`P.attractor`) puxa a brotação para baixo em vez da colonização só para cima, e a poda de formação (a cada 3 anos) segura as almofadas. A raiz do nebari continua no vaso; a cascata não é tratada como raiz.
