# Ficha — Azaleia Satsuki (`azaleia`)

*Rhododendron indicum*, grupo satsuki. Estilo tradicional **moyogi**. Também aceita shakan, han-kengai e kengai. O que se reconhece: tronco curto e grosso, copa em domo, flor grande na ponta do raminho, entre folhas pequenas e escuras.

Esta ficha é o piloto do processo em `docs/nova-especie.md`.

## Escolha

| Eixo | Nota | Por quê |
|---|---|---|
| Reconhecimento | 5 | A satsuki em flor é uma das silhuetas mais conhecidas do bonsai. |
| Contraste visual | 5 | Nenhuma outra espécie do jardim fecha a copa com flor grande. |
| Estilo novo | 3 | O moyogi já existe; o hábito novo é o domo de pontas floridas, não um estilo de tronco. |
| Viabilidade no motor | 4 | Flor e folha cabem na ponta do raminho. Não pede órgão novo. |
| Apelo local | 4 | Azaleia é planta de jardim no Brasil; o nome satsuki pede a ficha, mas a flor se entende sem ele. |

## Referências

Fotos públicas. A planta de exposição nem sempre é um domo: várias satsuki famosas são inclinadas e abrem a copa em nuvens. O alvo desta ficha, pedido pelo dono, é o outro hábito também real — o domo denso, um pouco irregular, com a flor sentada na massa de folhas. As fotos servem para casca, folha, tamanho da flor e a segunda cor.

1. [Asahi-no-izumi, em formação desde 1985, fotografada em maio de 2009 por Cliff](https://commons.wikimedia.org/wiki/File:Satsuki_Azalea_(Rhododendron_indicum)_Asahi-no-izumi_(3561668592).jpg) — CC BY 2.0. Tronco visível, casca lisa marrom-avermelhada, flores brancas com esportes salmão na ponta dos ramos, folhas escuras entre as flores. É a foto do lado a lado. O hábito desta árvore é aberto e inclinado, não o domo.
2. [Reiko](https://commons.wikimedia.org/wiki/File:Satsuki_Azalea_(Rhododendron_indicum)_Reiko_(3561670970).jpg) — mesma série, Cliff, CC BY 2.0. Outra copa florida, flor grande em relação à folha.
3. [Osakazuki no National Arboretum, 1973–2007, foto de Ragesoss](https://commons.wikimedia.org/wiki/File:Satsuki_Azalea,_1973-2007.jpg) — agosto, sem flor. Mostra o tronco curto, a ramificação miúda e a copa densa fora da época.
4. [Categoria Rhododendron indicum](https://commons.wikimedia.org/wiki/Category:Rhododendron_indicum) — hábito da espécie, folha e flor fora do bonsai.
5. [Categoria Rhododendron bonsai](https://commons.wikimedia.org/wiki/Category:Rhododendron_bonsai) e [Rhododendron indicum bonsai](https://commons.wikimedia.org/wiki/Category:Rhododendron_indicum_bonsai) — o conjunto das satsuki de exposição.
6. [Gyoten](https://commons.wikimedia.org/wiki/File:Satsuki_Azalea_(Rhododendron)_Gyoten_(3504614437).jpg), [Korin](https://commons.wikimedia.org/wiki/File:Satsuki_Azalea_(Rhododendron)_Korin_(3505588642).jpg) e [Kozan](https://commons.wikimedia.org/wiki/File:Satsuki_Azalea_(Rhododendron)_Kozan_(3505587075).jpg) — Cliff, CC BY 2.0, mesma série do Arboreto Nacional. Tronco curto, copa florida, segunda cor.
7. [Kurume Kumiko](https://commons.wikimedia.org/wiki/File:Kurume_Azalea_(Rhododendron)_Kumiko_(3562944961).jpg) — Cliff, CC BY 2.0. Azaleia de flor miúda, para comparar o tamanho da flor com o da satsuki.
8. [Azaleia no Dawes Arboretum](https://commons.wikimedia.org/wiki/File:Azalea_bonsai_-_Dawes_Arboretum_-_DSC02982.JPG) — copa em flor vista de frente, domo irregular.
9. [Wikipedia, Rhododendron indicum](https://en.wikipedia.org/wiki/Rhododendron_indicum) — nome, flor terminal, folha perene pequena.
10. [Bonsai Empire, azalea](https://www.bonsaiempire.com/tree-species/azalea) — resumo de cultivo: pinçagem, flor na ponta, folha pequena e brilhante.

## Alvos numéricos

Faixas do modelo, medidas em 12 seeds (`realismo-0` … `realismo-11`), estilo moyogi, crescimento simulado. A planta real entra na coluna do que a foto mostra; a faixa é o que o aceite confere.

| Medida | Faixa no modelo | O que a planta real faz |
|---|---|---|
| Altura / diâmetro da base | 4,0–5,2 | Tronco curto e grosso, visível abaixo da copa. A base não desce do piso do `compare-mass`. |
| Primeiro galho (fração da altura) | 0,18–0,35 | O tronco aparece abaixo da copa. |
| Envergadura / altura | 1,05–1,55 | Domo mais largo do que alto, com lobos. |
| Galhos principais | 10–22 | Saem em andares curtos e fecham o contorno. |
| Almofadas | a copa é contínua | Não são nuvens separadas; os raminhos se tocam. |
| Folha | 0,030–0,040 no esqueleto, só na ponta | Folha pequena, verde-escura, brilhante, agrupada na ponta. |
| Flor / folha | 1,35–1,62 no comprimento da instância | Na planta a flor chega perto do dobro da folha. No modelo a flor continua maior, e a folha foi deixada grande o bastante para aparecer entre as flores. |
| Flores vivas na maturidade | 2 000–5 200 (um centro por flor) | Floração densa, uma ou duas por ponta, não um volume solto. |

## Botânica

- **Filotaxia.** Folhas alternas, apertadas na ponta do broto curto. O ramo do ano não leva folha no meio.
- **Dominância apical.** Moderada. Na satsuki a pinçagem repetida produz a ramificação miúda; o modelo faz isso com leques de raminhos na ponta, não com um eixo longo.
- **Flor.** Terminal, no broto do ano, entre as folhas da ponta. Época: fim da primavera (o nome satsuki é o quinto mês). Funil de cinco pétalas fundidas na base. Uma mesma planta pode trazer flores de padrões diferentes; a seed sorteia isso.
- **Fruto.** Cápsula seca, depois da flor. O modelo mostra a planta em flor e não desenha a cápsula.
- **Casca.** Lisa, com descamações finas, marrom-avermelhada a marrom-acinzentada. O tronco tem movimento, sem nó que pareça um calo.

## Paleta

- Casca: marrom-avermelhado, claro nas lascas, mais escuro no fundo.
- Folha: verde-escuro, pouco saturado, com verniz.
- Flor: a seed escolhe rosa, magenta, branco ou mescla. O genoma em `flower-engine.mjs` (preset `satsuki`) pinta cada flor com um padrão real: sólida, listra ou flake sobre branco, fukurin (borda branca), mancha clara na garganta, ou garganta pontilhada. A saturação fica alta; branco é branco, não cinza.
- Vaso: redondo ou oval, esmalte na cor complementar da flor.

## Realismo

Os critérios de `docs/nova-especie.md` valem todos. O que é próprio da azaleia:

- A flor e o centro só existem numa ponta viva, com folha no mesmo nó, no pai ou num filho.
- O símbolo `E` da gramática não espalha um domo de flores no ar. No simulado ele nem gera geometria; o vestir é que põe a flor na ponta.
- A flor é uma malha só (pétalas, estames, pistilo, cálice). A origem é o pedicelo, sentado na casca da ponta. A face olha para cima e ao longo do raminho. Várias flores cabem na mesma ponta pelo giro em volta da casca.

## Genoma da flor

O preset `satsuki` em `flower-engine.mjs` limita o que a seed pode sortear. Comprimentos são relativos ao comprimento da pétala (1). A largura visual da flor aberta fica perto de 3–6 cm quando a folha está em 1–3 cm, sem mudar a faixa de `flowerSize` / `leafS` da ficha (1,35–1,62 no comprimento da instância).

| Traço | Faixa |
|---|---|
| Pétalas | 5, fundidas na base num funil / sino aberto |
| Forma da árvore | simples 78%, semidobra 9%, dobra 6%, hose-in-hose 7% |
| Largura da pétala | 0,74–0,98 do comprimento |
| Ponta | redonda 62%, entalhada 24%, aguda 14% |
| Friso da margem | 0–0,045 |
| Copo ao longo / de lado | expoente 1,05–1,45 · 0,12–0,28 |
| Torção | −0,08–0,08 rad |
| Sobreposição | 0,16–0,34 |
| Abertura | 64–76° do eixo |
| Tubo | raio 0,055–0,078 · fusão 0,16–0,24 |
| Estames | 5–10, comprimento 0,88–1,14, curvados, com antera |
| Pistilo | 1,14–1,4 vezes o estame, mais longo |
| Sépalas | 0,22–0,32 do comprimento da pétala |
| Padrões | sólida, listra, flake, fukurin, mancha na garganta, pontilhado |

Cada árvore guarda quatro variantes de forma. Cor e padrão são por flor. A abertura (0 botão fechado, cálice visível; 1 flor aberta com estames estendidos) segue a idade no fim da linha do tempo, ou o botão **Ver florescer**, ou `?bloom=` / `?florescer`. As flores da mesma copa abrem com um pequeno atraso em volta do domo.

## Aceite

Conferido nesta implementação:

- As 12 seeds moyogi acima caem nas faixas da tabela.
- `node scripts/compare-mass.mjs` mantém a azaleia no mesmo nível do `main` em base, volume, folhagem e galhos. Cada flor conta como as 5 pétalas e o centro antigos, então a troca de malha não muda a massa.
- `node scripts/check-realism.mjs --seeds 50` cobre os quatro estilos. Órfão, botânica, cano, carga, vaso, junta e solo têm de ficar em zero.
- A grade de 12 seeds e o lado a lado com a Asahi-no-izumi acompanham o PR.

## Revisão do dono

Pendente. Limitações conhecidas, para a revisão e não como desculpa:

- A foto de referência é uma árvore aberta e inclinada. O moyogi do modelo é o domo pedido na ficha. O lado a lado compara flor, folha, casca e a segunda cor, não a silhueta.
- A listra, o flake, o fukurin, a mancha e o pontilhado são pintados na pétala. A garganta ainda mostra um pouco da malha onde as pétalas se encontram.
- O sombreamento de pétala é uma aproximação de translucidez (luz que atravessa e um mínimo de cor), não transmissão física.
- No jardim a flor é a malha lod: pétala com poucos triângulos e sem estames, para o quadro ficar perto do main. A árvore isolada usa a malha média. O estúdio de uma flor e as fotos de perto usam a malha cheia.
- A cápsula continua de fora. O modo clássico ainda emite uma flor por símbolo `E`.
- Nos estilos que não são o tradicional, o axioma é o do estilo; as flores continuam só na ponta viva, mas o contorno deixa de ser o domo do moyogi.
