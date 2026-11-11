# 🌱 Jardim L-System

Plantas 3D geradas por **sistemas de Lindenmayer (L-Systems)** em **Three.js**, com uma *seed* (texto) que define cada planta de forma única e determinística.

**Página ao vivo:** https://rafapignataro.github.io/lsystem-plants/

## Visão

A ideia original (do Rafael, anos atrás) era usar o formalismo do biólogo Aristid Lindenmayer para gerar plantas e transformá-las em **NFTs**: cada pessoa recebe uma *seed*, e a seed altera as partes do sistema (probabilidades das regras, ângulos, proporções, cores, idade…), de modo que cada pessoa tenha uma planta totalmente diferente, mas sempre reproduzível a partir da mesma seed.

Este repositório é a POC dessa ideia: 10 espécies (5 realistas e 5 exóticas), um motor L-System genérico, uma tartaruga 3D, geometria contínua de galhos com regra de Leonardo, casca procedural e animação de crescimento da muda até a planta adulta.

## Como rodar

É um único arquivo, `index.html`, sem build. O Three.js (r170) é carregado do jsDelivr via *importmap*, então precisa de internet.

- Abra `index.html` direto no navegador, **ou**
- sirva a pasta: `python3 -m http.server 8000` e acesse `http://localhost:8000/`.

## Parâmetros de URL

| Parâmetro | Onde | Exemplo | Efeito |
|---|---|---|---|
| `especie` | hash | `#especie=carvalho` | realistas: `carvalho`, `pinheiro`, `samambaia`, `arbusto`, `salgueiro`; exóticas: `cristal`, `medusa`, `cacto`, `neural`, `coral`; ou `jardim` (as 10 juntas) |
| `seed` | hash | `#especie=pinheiro&seed=rafael` | seed (qualquer texto) |
| `age` | query | `?age=0.3` | abre sem animação, na idade dada (0–1) |
| `nogrow` | query | `?nogrow` | abre sem animação de crescimento, em 100% |
| `norotate` | query | `?norotate` | desliga a auto-rotação |

Exemplos: `https://rafapignataro.github.io/lsystem-plants/?age=0.5#especie=carvalho&seed=lindenmayer` · `https://rafapignataro.github.io/lsystem-plants/#especie=medusa&seed=rafael`

O botão **🔗 Copiar link** gera o link da planta atual.

## Funcionalidades

- 5 espécies **realistas**: 🌳 Carvalho Ancestral, 🌲 Pinheiro Boreal, 🌿 Samambaia Espiral, 🌺 Arbusto Florido, ✨ Salgueiro Lumínico.
- 5 espécies **exóticas** (v4), cada uma com cenário próprio e animação em loop:
  - 💎 **Árvore de Cristal**: fractal determinístico a 60°/90°, prismas facetados de vidro (transmissão, IOR, dispersão), mineral pela seed;
  - 🪼 **Medusa Flutuante**: de cabeça para baixo, sino translúcido que pulsa, tentáculos que ondulam no vertex shader;
  - 🌵 **Cacto Gravitacional**: costelas em espiral de Fibonacci, braços com tropismo para um planeta em órbita, flores que abrem quando ele passa;
  - 🧠 **Raiz Neural**: soma com dendritos para cima e axônio que vira raiz, pulsos de luz correndo pelo esqueleto;
  - 🍄 **Coral-Fungo Bioluminescente**: chapéus empilhados com lamelas luminosas, bolhas (coral) ou esporos (fungo).
- Motor L-System com regras paramétricas, estocásticas e condicionais, passo final de "decomposição" (pontas → folhas/flores) e regras juvenis.
- PRNG determinística (`cyrb128` → `sfc32`) com fluxos separados por finalidade: mesma seed + espécie = mesma planta.
- Esqueleto de nós → galhos como **tubos contínuos** (Catmull-Rom + *parallel transport*), **colar** nas junções, **regra de Leonardo** para os raios.
- **Casca procedural** no shader (v3): sulcada, em placas, lisa com lenticelas ou estriada, com variante, escala, profundidade, paleta e musgo definidos pela seed; madeira jovem lisa e verde, madeira velha rachada e mais escura.
- **Idade da planta** (slider): muda → árvore, com crescimento das pontas, engrossamento secundário da madeira, folhas juvenis e floração na maturidade.
- Folhas, pétalas, agulhas e orbes instanciados; vento no shader; sombras, bloom, neblina, céu em gradiente; tema noturno no salgueiro.
- Seletor de espécie em dois grupos (**Realistas** / **Exóticas**). Modo **Jardim** com as 10 espécies e a mesma seed (exóticas na frente, realistas atrás), câmera que acompanha o crescimento, painel com parâmetros derivados da seed, regras e palavra gerada.

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): como tudo funciona por dentro.
- [docs/ESPECIES.md](docs/ESPECIES.md): as 10 espécies, regras e parâmetros da seed.
- [docs/HISTORICO.md](docs/HISTORICO.md): histórico de versões.
- [docs/ROADMAP.md](docs/ROADMAP.md): limitações conhecidas e próximos passos.
