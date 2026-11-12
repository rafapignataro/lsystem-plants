# 🌿 Bonsai Garden

Bonsais 3D gerados por **sistemas de Lindenmayer (L-Systems)** em **Three.js**, com uma *seed* (texto) que define cada planta de forma única e determinística.

**Página ao vivo:** https://rafapignataro.github.io/lsystem-plants/

## Visão

A ideia original (do Rafael, anos atrás) era usar o formalismo do biólogo Aristid Lindenmayer para gerar plantas e transformá-las em **NFTs**: cada pessoa recebe uma *seed*, e a seed altera as partes do sistema (probabilidades das regras, ângulos, proporções, cores, idade…), de modo que cada pessoa tenha uma planta totalmente diferente, mas sempre reproduzível a partir da mesma seed.

Este repositório é a POC dessa ideia, agora só com **bonsais**: um motor L-System genérico, uma tartaruga 3D, geometria contínua de galhos com regra de Leonardo, casca procedural e animação de crescimento da muda até a planta formada. Desde a v7, a copa pode ser **simulada ano a ano** (colonização do espaço, sombra, autopoda, poda de formação). Na **v8**, o foco é o **motor**: junções contínuas, ambiente interativo, genoma legível com cruzamento, folhagem em cachos e export NFT (PNG/glTF). As espécies realistas e raras saíram; o motor continua genérico para o próximo bonsai.

## Como rodar

Arquivos principais: `index.html`, `v8-engine.mjs`, `joint-worker.mjs`. Sem build. O Three.js (r170) vem do jsDelivr via *importmap* (precisa de internet).

- Abra `index.html` direto no navegador, **ou**
- sirva a pasta: `python3 -m http.server 8000` e acesse `http://localhost:8000/`.
- Verificação headless (opcional): `npm i playwright && npx playwright install chromium && node scripts/verify-v8.mjs`.

## Parâmetros de URL

| Parâmetro | Onde | Exemplo | Efeito |
|---|---|---|---|
| `especie` | hash | `#especie=junipero` | bonsais: `bordo`, `pinheiro_branco`, `cipreste`, `junipero`, `olmo_chines`, `ficus`, `azaleia`, `pinheiro_negro`; ou `jardim` (todos juntos). Espécie desconhecida (inclusive as realistas, as raras e as exóticas removidas) abre o primeiro bonsai (`bordo`) |
| `cresc` | hash | `#especie=junipero&cresc=classico` | modo de crescimento: sem o parâmetro = **Simulado** (padrão, v7); `classico` = L-System clássico (idêntico à v6 para os bonsais que ficaram) |
| `seed` | hash | `#especie=bordo&seed=rafael` | seed (qualquer texto) |
| `genoma` | hash | `#especie=bordo&seed=rafael&genoma=vigor:1.1,ramificacao:0.95` | genes v8 (opcional; omitir = só da seed) |
| `age` | query | `?age=0.3` | abre sem animação, na idade dada (0–1) |
| `nogrow` | query | `?nogrow` | abre sem animação de crescimento, em 100% |
| `norotate` | query | `?norotate` | desliga a auto-rotação |

Exemplos: `https://rafapignataro.github.io/lsystem-plants/?age=0.5#especie=bordo&seed=lindenmayer` · `https://rafapignataro.github.io/lsystem-plants/#especie=junipero&seed=rafael&cresc=classico` · `https://rafapignataro.github.io/lsystem-plants/#especie=cipreste&seed=rafael` · `https://rafapignataro.github.io/lsystem-plants/#especie=jardim&seed=rafael`

O botão **🔗 Copiar link** gera o link da planta atual.

## Funcionalidades

- **Bonsais** (v6), cada um num vaso procedural com terra e musgo, raízes de superfície (nebari) e folhagem em almofadas; o slider de idade mostra os **anos de formação**:
  - 🍁 **Bordo Japonês**: estilo moyogi, tronco liso cinza-claro em S, galhos longos e nuvens largas de folhas palmadas vermelhas (5 ou 7 lobos), fundo preto;
  - 🌲 **Pinheiro-Branco**: tronco maciço, torcido e com casca em placas, nebari exposto, almofadas horizontais de agulhas e um galho em cascata para fora do vaso oval raso;
  - 🎋 **Cipreste Hinoki**: estilo chokkan (ereto formal), andares que alternam de lado e diminuem até o topo, faixa de madeira morta (shari) na frente, vaso redondo de terracota;
  - 🌀 **Junípero**: tronco em hélice com grandes faixas de madeira morta branca em espiral e uma veia viva avermelhada, copa inclinada, galhos mortos (jin), vaso retangular sobre uma mesinha.
  - 🌸 **Azaleia Satsuki**: moyogi de tronco curto e casca marrom-avermelhada, copa em domo coberta de flores em funil de cinco pétalas (rosa, magenta, branca ou as três na mesma planta), vaso de barro sem esmalte com musgo.
  - 🌲 **Pinheiro-Negro em Cascata**: *Pinus thunbergii* em kengai; o tronco sobe pouco, dobra na borda de um vaso hexagonal fundo e quase preto e desce em zigue-zague até abaixo da base, com casca em placas cinza-escuras, almofadas de agulhas longas e um suporte alto de madeira. A brotação da cascata segue um alvo abaixo do vaso.
- **Motor v8**: junções com malha de união; vento e sol ajustáveis; genoma de 9 genes + cruzamento; exportação PNG e glTF; cachos de folhagem e LOD no jardim.
- **Crescimento simulado** (v7, padrão; botão "Crescimento: Simulado / L-System clássico"): o andaime (tronco e estilo do bonsai) vem da gramática da espécie e a copa cresce ano a ano por **colonização do espaço** (Runions et al. 2007: pontos de atração num envelope com a forma da espécie, raio de percepção, distância de morte) com **luz por sombra em voxels** e alocação de Borchert-Honda (Palubicki et al. 2009). Cada gema tem destino (cresce, dorme, vira flor ou morre); galhos sombreados **secam e caem** (autopoda); o tronco engrossa todo ano (modelo do cano / Leonardo, mais anéis anuais); há **poda de formação** periódica. O slider de idade mostra a estrutura daquele ano (com "ano X de Y"). Uma espécie sem entrada em `SIMS` continua só L-System.
- Motor L-System com regras paramétricas, estocásticas e condicionais, passo final de "decomposição" (pontas → folhas/flores) e regras juvenis.
- PRNG determinística (`cyrb128` → `sfc32`) com fluxos separados por finalidade: mesma seed + espécie = mesma planta.
- Esqueleto de nós → galhos como **tubos contínuos** (Catmull-Rom + *parallel transport*), **colar** nas junções, **regra de Leonardo** para os raios.
- **Casca procedural** no shader (v3): sulcada, em placas, lisa com lenticelas ou estriada, com variante, escala, profundidade, paleta e musgo definidos pela seed; madeira jovem lisa e verde, madeira velha rachada e mais escura.
- **Idade da planta** (slider): muda → árvore, com crescimento das pontas, engrossamento secundário da madeira, folhas juvenis e floração na maturidade.
- Folhas, pétalas, agulhas e frutos instanciados; vento no shader; sombras, bloom, neblina, céu em gradiente; cada bonsai com o seu cenário de estúdio.
- Seletor com os bonsais registrados. Modo **Bonsai Garden** com todos eles e a mesma seed, em fileiras sem vaga vazia (até 4 por fileira), com LOD menor e rótulos que não se sobrepõem, câmera que acompanha o crescimento, painel com parâmetros derivados da seed, regras e palavra gerada.

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): como tudo funciona por dentro.
- [docs/ESPECIES.md](docs/ESPECIES.md): os bonsais, regras, parâmetros da seed, como cada um é simulado e como registrar o próximo.
- [docs/HISTORICO.md](docs/HISTORICO.md): histórico de versões.
- [docs/ROADMAP.md](docs/ROADMAP.md): limitações conhecidas e próximos passos.
