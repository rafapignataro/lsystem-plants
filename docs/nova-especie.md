# Como entra uma espécie nova

Este é o processo combinado para acrescentar um bonsai ao jardim. A ordem é fixa: escolher, fichar com foto real, exigir o realismo físico, implementar até a ficha fechar, e só então o dono revê. Cor e efeito podem ser estilizados. A planta não pode fazer o que uma árvore de verdade não faz.

## 1. Escolha

A candidata leva nota de 1 a 5 em cinco eixos. A nota não é um ranking público; serve para descartar o que não se sustenta.

| Eixo | O que se pergunta |
|---|---|
| Reconhecimento | Uma pessoa que já viu a planta a reconhece sem legenda? |
| Contraste visual | Ela se separa das espécies que já estão no jardim (silhueta, folha, flor, casca)? |
| Estilo novo | Ela pede um hábito que o jardim ainda não tem, ou reforça um que já existe com uma biologia diferente? |
| Viabilidade no motor | Dá para construir com a gramática, a simulação e os tubos que já existem, sem um sistema novo? |
| Apelo local | Faz sentido para quem vê o jardim no Brasil (nome, flor, presença em coleção)? |

Soma baixa ou um zero em viabilidade encerra a candidata. A que passa ganha uma ficha, não um lugar no código.

## 2. Ficha, a partir de foto real

Dez a vinte fotos de plantas reais, com link público (Wikimedia Commons, jardim botânico, página de bonsai). A ficha fica em `docs/especies/<id>.md`, no modelo `docs/especies/_modelo.md`.

Números, não adjetivos. Cada alvo é uma faixa medida nas fotos e conferida na planta gerada:

- altura do tronco dividida pelo diâmetro da base;
- altura do primeiro galho, em fração da altura;
- envergadura da copa dividida pela altura;
- quantidade de galhos principais e de almofadas;
- tamanho da folha em relação ao ramo, e da flor ou do fruto em relação à folha;
- quantidade de flor ou fruto na planta adulta.

Botânica que o motor tem de respeitar: filotaxia, força da dominância apical, onde nascem flor e fruto, estação, casca. E uma paleta (casca, folha, flor ou fruto, vaso).

## 3. Realismo físico, sem exceção

`scripts/check-realism.mjs` roda em pelo menos 50 seeds, em toda espécie e em todo estilo compatível. Uma falha cita espécie, estilo, seed e o elemento. A tolerância não se afrouxa para a espécie passar; o motor é que muda.

- **Nada flutua.** Cada folha, agulha, flor, fruto e almofada tem a âncora na superfície do segmento a que pertence, dentro de uma tolerância pequena. A origem de cada galho liga na superfície do pai. Órfão tem de ser zero.
- **Flor e fruto só onde a botânica permite.** Na azaleia, a flor fica na ponta do raminho, entre as folhas.
- **Modelo de cano.** O raio do filho não passa o raio do pai na junção. Ao longo de um galho o raio não aumenta da base para a ponta; a única exceção é o alargamento do nebari. A carga de folhagem e de galho que um segmento sustenta, dividida pela seção, fica abaixo do limite, para uma almofada grande não pendurar de um raminho capilar.
- **Nada atravessa o vaso, o suporte ou a mesa, e nada flutua acima do solo.** Tronco e raízes tocam a terra.
- **Junção contínua.** Não há vão entre o começo do filho e a superfície do pai.

## 4. Aceite da implementação

A espécie só segue para a revisão quando tudo isto é verdade:

- as medidas de `measureDesign` e do esqueleto caem nas faixas da ficha;
- `scripts/compare-mass.mjs` passa (a base e o volume do tronco não ficam abaixo de 99,5% do `main`, e a folhagem e os galhos não caem de 90%);
- o realismo passa em 50 seeds ou mais, em todos os estilos compatíveis;
- uma grade de 12 seeds, de frente, em que cada árvore é plausível;
- um lado a lado com uma foto de referência da ficha.

## 5. Revisão do dono

O dono vê a ficha, a grade e o lado a lado. Sem o aceite dele a espécie não entra no jardim como pronta. Ajuste fino de cor pode acontecer aqui. Mudança de hábito volta para a ficha.
