# Bronze Engenharia — brief de design

Site: **bronze-engenharia.com.br** (PT-BR em `/`, EN em `/en`). Uma página longa.
Projeto Claude Design: **"Bronze Engenharia"** (separado do projeto "Data Joule").
Dados reais para os mock-ups: `design-data.json` (snapshot de 2026-10-01, ~23h BRT). Use estes números — nada de lorem ipsum.

## O que o site é

Um **observatório de energia**: uma sequência de instrumentos ao vivo, cada um respondendo uma pergunta concreta com dados públicos, cada número carimbado com fonte e horário. Lê-se como uma reportagem de dados impressa — não como um dashboard de SaaS nem como um site institucional. O "quem somos" cabe numa linha do rodapé. O bastidores (como o site é feito) é o portfólio.

Público: parceiros técnicos (distribuidoras, GEDISA, LF Energy, Hydro-Québec), clientes da Data Joule verificando quem está por trás, e engenheiros/desenvolvedores que vão olhar o código-fonte.

## Tom

- Painel de instrumentos encontra revista impressa. Sóbrio, numérico, tipográfico.
- Nenhuma foto de banco de imagens, nenhum ícone genérico, nenhum gradiente decorativo. A informação é o ornamento.
- Os gráficos são desenhados à mão em SVG (sem biblioteca de gráficos). Linhas finas, eixos discretos, anotações em texto direto no gráfico, números tabulares.
- Movimento só quando carrega significado (o traço "ao vivo" avança). Respeita `prefers-reduced-motion`.
- Cada bloco ao vivo tem um rodapé pequeno: `Fonte · última leitura HH:MM · atualiza a cada N min`. Quando a fonte cai: `sem sinal · última leitura às HH:MM` — nunca um bloco vazio.

## Tipografia e cor

- Mesma família da Data Joule: **Source Serif 4** (títulos, texto corrido), **Source Sans 3** (UI, legendas), **Fragment Mono** (números, código, carimbos de fonte). Numerais tabulares em tudo que é número.
- Fundo claro quente (`#FBFAF8`) e tinta `#1A1917`, como a Data Joule, **mais um tema escuro** (`prefers-color-scheme`).
- **Cor de destaque — pedir 3 variações para escolher:**
  1. Petróleo `#1F5F6B`
  2. Bronze `#8A6A2B`
  3. Ardósia `#3A5A8C`
  O terracota da Data Joule (`#B5561A`) fica reservado para o link à Data Joule.
- Paleta de dados (categórica, 4–7 séries: subsistemas, fontes de geração, camadas da fatura) deve funcionar nos dois temas e ser distinguível para daltônicos.

## Layout

- Larguras: 360 px → 1440 px. Coluna de leitura ~680 px; os instrumentos podem "sangrar" até ~1040 px.
- Cabeçalho mínimo: marca à esquerda, âncoras das seções, alternador PT/EN. Fixo e discreto.
- Prioridade para o design: **seções 1, 2 e 7** carregam a identidade. Pedir 2–3 direções para elas primeiro; o resto segue o sistema escolhido.

## Seções (de cima para baixo)

### 1 · Pulso (abertura)
Pergunta: *o que duas redes elétricas estão fazendo agora?*
Dados: carga do SIN (4 subsistemas somados; `ons_carga`) e demanda do Québec (`hq_demand`), 15 em 15 min.
Visual: duas curvas de área nas últimas 24 h, um eixo de tempo com duas escalas locais (Brasília / Montréal). Dois números grandes: **89 826 MW** e **17 603 MW**. Pequeno selo quando há evento de ponta da Hydro-Québec. Temperatura das duas cidades como anotação (`open_meteo`).
Título: **Engenharia de energia, com dados.** Linha de apoio: Curitiba · Montréal · CREA-PR 194835/D.

### 2 · Petróleo e probabilidade
Pergunta: *o que o mercado acha que o petróleo vai fazer?*
Dados: WTI/Brent/Henry Hub diários (`fred`); mercados de previsão: Polymarket "What will WTI hit in October 2026?" (`polymarket.ladder`, probabilidade por patamar) e Kalshi `KXWTI` (`kalshi.markets`, strikes com bid/ask).
Visual: linha do preço spot (60 dias) + **distribuição de probabilidade implícita** derivada das duas casas (CDF ajustada, mediana e faixa de 80 %), Polymarket e Kalshi sobrepostas em dois traços. Nota de rodapé: "não é recomendação de investimento".

### 3 · Mix na rede
Pergunta: *quão limpa está a rede nesta hora?*
Dados: CAISO fuel source (`caiso_fuel`, 5 min) e NYISO fuel mix (`nyiso_fuel`).
Visual: bandas empilhadas do dia + um indicador de participação renovável; alternador CAISO / NYISO. Destaque de hoje: baterias da CAISO despachando **10 GW** às 19:35.

### 4 · O preço da energia no Brasil (peça central, 3 painéis, mesmo eixo R$/MWh)
Pergunta: *quanto custa um MWh hoje, do atacado até três faturas diferentes?*
- **4a Atacado, hoje** — CMO semi-horário dos 4 subsistemas (`ons_cmo.by_subsystem`), 48 meias-horas, faixa piso/teto do PLD ao fundo. Hoje: Norte **R$ 122/MWh**, Sul **R$ 47,6/MWh**.
- **4b A bandeira do mês** — a bandeira como objeto tipográfico (Verde / Amarela / Vermelha 1 / Vermelha 2) + faixa colorida dos últimos 24 meses.
- **4c Três faturas, um MWh** — escolher distribuidora (padrão Copel) e consumo; três faturas calculadas lado a lado: **B1 residencial**, **A4 Verde**, **A4 Azul**, cada uma como pilha vertical (energia · fio · encargos · bandeira · tributos) no mesmo eixo de 4a — o preço de atacado aparece como a fatia de baixo. Alternador "outras distribuidoras" vira um ranking de ~50 barras com a Copel destacada. Painel recolhível com o JSON URPX da tarifa.

### 5 · Na bomba (para donos de posto)
Pergunta: *quanto custam gasolina, etanol e diesel, de onde vem o preço, e o etanol compensa no meu estado?*
Dados: levantamento mensal da ANP por posto (~75 mil registros/mês: preço de venda, produto, bandeira, município), preço de refinaria da Petrobras, constantes de tributos (ICMS monofásico e PIS/COFINS em R$/L), PTAX do Banco Central (ao vivo).
- **5a Etanol compensa?** — a regra dos 70 % calculada por estado (mediana etanol ÷ mediana gasolina): ranking de 27 barras com a linha de 0,70. Agosto 2026: MT 0,55 · SP 0,56 · MS 0,59 · GO/PR 0,61 … RS 0,75 · AP 0,88 — o etanol compensa em 11 estados. Seletor de estado, padrão PR.
- **5b O preço na sua cidade** — seletor de município (padrão Curitiba): medianas de gasolina, aditivada, etanol, diesel S10 e GNV; todos os postos pesquisados como um strip plot colorido por bandeira (branca / Vibra / Ipiranga / Raízen). Curitiba, ago 2026: gasolina **6,89** · etanol **4,69** · diesel S10 **6,99**; bandeira branca ≈ R$ 0,15 mais barata. Linha de 12 meses por produto (a sazonalidade da safra aparece).
- **5c Anatomia do litro** — o litro de gasolina C como pilha vertical (mesmo recurso da fatura em 4c): refinaria Petrobras · etanol anidro na mistura · PIS/COFINS · ICMS monofásico · margem de distribuição + revenda. Diesel S10 como segunda pilha. Nota lateral: Brent em reais (FRED × PTAX) contra o preço Petrobras — a defasagem que todo dono de posto acompanha.

### 6 · Demanda ociosa no Paraná
Pergunta: *quanta demanda contratada fica sem uso?*
Dados: BDGD/Copel 2025, 11 780 unidades A4 (estático).
Visual: beeswarm em canvas por setor, filtro por setor. Números: **16 %** da demanda de ponta sem uso; **R$ 122 milhões/ano**; educação 30 %, hospitais 21 %.

_(Seção do laboratório OpenADR removida em out/2026: o laboratório em Montréal foi desligado.)_

### 8 · Bastidores
Pergunta: *como isto é feito?*
Conteúdo: stack (Next.js, React Server Components, SVG à mão), cache por fonte, orçamento de desempenho (Lighthouse ≥ 95, ≤ 90 KB de JS), lista de fontes com "última leitura" ao vivo, link para o repositório público (MIT), licença dos dados.
Rodapé: Bronze Engenharia de Energia · CNPJ 19.824.419/0001-96 · CREA-PR 194835/D · Curitiba · Montréal · WhatsApp · e-mail · Política de privacidade · link discreto para a Data Joule.

## Restrições técnicas que afetam o design

- Sem scripts, fontes ou imagens de terceiros (CSP estrita). Fontes auto-hospedadas.
- Seções 1–3 renderizam no servidor: o estado "inicial" do design deve ser a leitura real, não um skeleton.
- Toda cor de dado precisa existir em claro e escuro.
- Gráficos precisam de uma versão legível a 360 px (em geral: menos séries, rótulos para fora).

## Entregáveis esperados do Claude Design

1. 2–3 direções (tipografia + cor de destaque + tratamento de gráfico) aplicadas às seções 1, 2 e 7, claro e escuro.
2. Depois da escolha: a página completa, PT, desktop + 360 px, exportada como `.dc.html` para o porte para Next.js.
