# Lapidação da Direção A — "Papel"

Escolhida em 2026-10-02. Este documento é a crítica a partir de dois olhares e a lista exata do que muda da v1 (mock-up das seções 1, 2 e colofão) para a v2 (página completa, seções 1–8).

## Dois leitores

**O especialista** (engenheiro de distribuidora, pesquisador, gente da LF Energy / Hydro-Québec). Procura: precisão de termos e unidades, honestidade metodológica, fonte e hora em cada número, reprodutibilidade. Perde a confiança no primeiro deslize — uma curva de "probabilidade" que mistura objetos diferentes, um "PLD" que na verdade é CMO, um eixo de tempo ambíguo entre fusos.

**O comprador** (gerente de fábrica, dono de posto, CFO de rede de supermercados). Procura: *o que isso significa para mim*, em reais; um caminho curto para falar com alguém; sinais de confiança (CREA, método, casos); entendimento em 10 segundos no celular. Perde o interesse no primeiro gráfico sem conclusão escrita e no primeiro jargão sem tradução.

A regra da lapidação: **cada instrumento serve aos dois no mesmo espaço** — uma frase de conclusão em cima (comprador), uma nota de método embaixo (especialista), e o gráfico entre elas fala por si.

## O que a v1 faz bem (manter)

- Papel quente, serifa generosa, fios finos, números tabulares em mono. Lê-se como revista, não como SaaS.
- Dois números grandes antes do gráfico: a leitura em 2 segundos.
- Carimbo `fonte · hora · cadência` em cada bloco.
- Claro e escuro com a mesma hierarquia.

## O que muda (v1 → v2)

### Estrutura da página
1. **Faixa "Hoje"** logo abaixo do cabeçalho: seis números que uma pessoa de energia olha ao acordar — SIN (MW) · Québec (MW) · WTI (US$) · CMO SE/CO (R$/MWh) · bandeira do mês · gasolina em Curitiba (R$/L). Cada um é âncora para a sua seção. Mono, 13 px, uma linha; no celular vira rolagem horizontal.
2. **Trilho de leitura** à esquerda em telas largas: os números 01–08, o atual preenchido. Substitui o menu de âncoras no cabeçalho, que fica só com marca · EN · claro/escuro.
3. Toda seção segue o mesmo esqueleto: `número e nome` → `pergunta` (h2 serifa) → **`lido hoje`** (uma frase em itálico serifa, a conclusão) → instrumento → carimbo → **`método`** (details/summary, 2–4 linhas: fórmula, fonte com URL, cadência, ressalva) → **`para você`** (uma linha, só quando há ação possível).

### Seção 1 · Pulso
- *Lido hoje:* "Às 23h30 em Brasília, o Brasil pedia 5,1 vezes a potência do Québec." A razão SIN/Québec aparece como terceiro número, menor.
- Um único eixo de tempo (UTC por baixo), com **duas réguas locais** rotuladas BRT e EDT — o especialista vê que os pontos estão alinhados em tempo real, não em "hora local" cada um.
- Selo de evento de ponta da Hydro-Québec sempre presente, nos dois estados: "sem evento de ponta" / "evento de ponta ativo das 06h às 09h".
- Temperatura das duas cidades vira anotação no fim de cada curva (motivo visível para a forma da curva).
- Método: carga verificada ONS (≈30 min de atraso) vs demanda HQ (15 min); por que "carga" e "demanda" não são a mesma grandeza; soma dos quatro subsistemas.

### Seção 2 · Petróleo e probabilidade — a correção mais importante
A v1 põe na mesma curva dois objetos diferentes. Corrigir sem perder a ideia:
- **Painel esquerdo — Kalshi:** P(WTI fecha acima de X em 2 out), ladder de strikes com ponto médio bid/ask → é uma função de sobrevivência honesta. Mostrar a curva, a **mediana ($92,9)** e a faixa de 80 % (onde P cruza 0,9 e 0,1). Esta é a "distribuição implícita" de verdade.
- **Painel direito — Polymarket:** P(WTI *toca* X durante outubro), escadas HIGH e LOW. Não é CDF; é probabilidade de toque. Mostrar como duas escadas espelhadas e extrair a **"faixa provável do mês"**: níveis onde a probabilidade de toque passa de 50 % para os dois lados (hoje: entre $85 e $100). Texto explícito: *"objetos diferentes; não compare as curvas, compare as perguntas"*.
- Em cima dos dois: spot WTI (60 dias), Brent, Henry Hub.
- *Lido hoje:* "O Kalshi aposta que o WTI fecha o dia 2 perto de $93; o Polymarket dá 55 % para $100 ser tocado em outubro."
- Método: fonte dos ladders, ponto médio, monotonicidade forçada (ajuste isotônico), horário da leitura, "não é recomendação".

### Seção 3 · Mix na rede
- Bandas empilhadas do dia (CAISO), eixo em hora local da Califórnia; marcador "agora"; participação renovável como número, não como dial decorativo.
- *Lido hoje:* "Às 19h35 na Califórnia, as baterias entregavam 10 GW — mais do que a hidrelétrica e a nuclear juntas."
- Alternador CAISO / NYISO como duas abas de texto, não ícones.
- Para você (sutil): "Esse mesmo tipo de sinal é o que o nosso laboratório OpenADR escuta (seção 7)."

### Seção 4 · O preço da energia no Brasil
- Nomear corretamente: **CMO** (ONS, modelo DESSEM) com a faixa piso–teto do **PLD** desenhada atrás e a legenda "PLD = CMO limitado pela faixa; o oficial é da CCEE". O especialista relaxa; o comprador entende a faixa.
- 4a com os quatro subsistemas; destaque automático da maior diferença do dia (hoje Norte vs Sul).
- 4b bandeira como tipografia, com o valor em R$/100 kWh e o histórico de 24 meses em faixa colorida. Se o histórico não estiver verificado, a faixa mostra só os meses verificados — nunca inventar.
- 4c três faturas em pilhas no mesmo eixo R$/MWh que 4a; o comprador escolhe **sua distribuidora e seu consumo** e vê sua conta decomposta. "Para você": *"Grupo A? A Data Joule lê 12 faturas e devolve o valor recuperável em 5 dias úteis."* — texto, sem botão berrante.
- Método: TE/TUSD, bandeira, ICMS/PIS/COFINS "por dentro" com a fórmula, REH da tarifa, URPX como formato.

### Seção 5 · Na bomba
- 5a ranking dos 27 estados pela razão etanol/gasolina com a linha 0,70; o estado escolhido destacado; *Lido hoje:* "Em agosto, o etanol compensou em 11 estados; no Paraná, a razão foi 0,61."
- 5b strip plot de todos os postos do município, colorido por bandeira; medianas como traços; 12 meses em linha.
- 5c anatomia do litro em pilha (refinaria · anidro · PIS/COFINS · ICMS · margem). Para você: *"Dono de posto? A anatomia do litro do seu estado, por e-mail, uma vez por mês."* (uma inscrição por e-mail é a única coleta de dado do site; opcional.)
- Método: ANP (arquivo do mês, lag de ~30 dias), medianas, por que a coluna "valor de compra" não é usada, Petrobras, constantes tributárias com citação.

### Seção 6 · Demanda ociosa no Paraná
- Beeswarm por setor com a mediana de cada setor e a linha de 16 % do estado; filtro por setor; *Lido hoje:* "Escolas deixam 30 % da demanda contratada sem uso; hospitais, 21 %."
- Método: BDGD 2025 Copel, 11 780 unidades A4 com 12 meses, REH 3.472/2025, definição de "ociosa".

### Seção 7 · Laboratório OpenADR
- Replay com scrubber (teclado: ← → espaço), escala W; marcadores T1/T2/T3 e o retorno em 55 s; abaixo, a lista dos sinais que o VEN escuta (HQ, ONS, NYISO, CAISO, ISO-NE) com um ponto que acende quando a seção 1 ou 3 mostra o mesmo sinal.
- Método: hardware, OpenADR 3.0, medição por tomada inteligente, código aberto (Apache 2.0).

### Seção 8 · Colofão
- Três colunas (método · orçamento · fontes) ficam; acrescentar **"código deste gráfico"** em cada seção (link para o arquivo no repositório) e uma linha "verificado em" com a data da última execução do CI.
- Rodapé: identidade, CREA, cidades, WhatsApp, e-mail, privacidade, Data Joule. Uma frase, antes do rodapé, que responde "por que Curitiba e Montréal": *"Engenharia registrada no Paraná; laboratório em Montréal."*

### Tipografia, cor, movimento
- Escala modular fixa: 12 · 13 · 14 · 17 · 20 · 26 · 36 · 56 px. Itálico serifa só para "lido hoje". Mono só para números, código e carimbos.
- Cores de dados (claro / escuro): petróleo `#1F5F6B`/`#6FB3BF` (Brasil, Kalshi), ocre `#8A6A2B`/`#D1A85A` (Québec, Polymarket), cinza-tinta para spot; terracota `#B5561A` reservado ao link da Data Joule. Verificar 4,5:1 nos dois temas.
- Movimento: só o ponto "ao vivo" pulsa (2 s) e o replay do laboratório roda; tudo desligado em `prefers-reduced-motion`.

### Celular (360 px)
- Faixa "Hoje" rola na horizontal; trilho de leitura some; cada instrumento mostra uma série por vez com alternador de texto; números grandes primeiro, gráfico depois; "método" recolhido.

### Acessibilidade
- `<desc>` em cada SVG com a conclusão escrita; seletores operáveis por teclado; foco visível; contraste ≥ 4,5:1.

## O que não entra
- Nenhuma foto, ícone ilustrativo, gradiente, "cards" com sombra, contadores animados, pop-up de cookie (não há cookies).
- Nenhum número sem fonte e hora. Se faltar dado verificado para um elemento (ex.: histórico de bandeiras), o elemento mostra só o que está verificado.
