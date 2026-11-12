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
- **Flor.** Terminal, no broto do ano, entre as folhas da ponta. Época: fim da primavera (o nome satsuki é o quinto mês). Funil de cinco pétalas. Uma mesma planta pode trazer uma segunda cor ou flor listrada; a seed sorteia isso.
- **Fruto.** Cápsula seca, depois da flor. O modelo mostra a planta em flor e não desenha a cápsula.
- **Casca.** Lisa, com descamações finas, marrom-avermelhada a marrom-acinzentada. O tronco tem movimento, sem nó que pareça um calo.

## Paleta

- Casca: marrom-avermelhado, claro nas lascas, mais escuro no fundo.
- Folha: verde-escuro, pouco saturado, com verniz.
- Flor: a seed escolhe rosa, magenta, branco ou mescla (rosa, magenta e branco na mesma copa). Com probabilidade, parte das flores sai na segunda cor, ou pétalas alternadas ficam pálidas (a listra).
- Vaso: redondo ou oval, esmalte na cor complementar da flor.

## Realismo

Os critérios de `docs/nova-especie.md` valem todos. O que é próprio da azaleia:

- A flor e o centro só existem numa ponta viva, com folha no mesmo nó, no pai ou num filho.
- O símbolo `E` da gramática não espalha um domo de flores no ar. No simulado ele nem gera geometria; o vestir é que põe a flor na ponta.
- Cada pétala e cada folha é sentada na casca do segmento do nó, com o giro em volta do raminho, para várias flores caberem na mesma ponta sem sair do galho.

## Aceite

Conferido nesta implementação:

- As 12 seeds moyogi acima caem nas faixas da tabela.
- `node scripts/compare-mass.mjs` mantém a azaleia acima do `main` em base, volume, folhagem e galhos (a folhagem subiu porque a flor passou a ser instância ancorada, e o piso de 90% continua folgado).
- `node scripts/check-realism.mjs --seeds 50` cobre os quatro estilos. Órfão, botânica, cano, carga, vaso, junta e solo têm de ficar em zero.
- A grade de 12 seeds e o lado a lado com a Asahi-no-izumi acompanham o PR.

## Revisão do dono

Pendente. Limitações conhecidas, para a revisão e não como desculpa:

- A foto de referência é uma árvore aberta e inclinada. O moyogi do modelo é o domo pedido na ficha. O lado a lado compara flor, folha, casca e a segunda cor, não a silhueta.
- A listra é pétala sim, pétala não, não uma faixa desenhada no meio da pétala.
- A cápsula não é modelada.
- Nos estilos que não são o tradicional, o axioma é o do estilo; as flores continuam só na ponta viva, mas o contorno deixa de ser o domo do moyogi.
- O modo clássico (`cresc=classico`) desenha uma flor por símbolo `E` da gramática. O caminho do produto é o simulado.
