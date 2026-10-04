# Plano — seção "Minigeração sob controle"

Rascunho de 03/10/2026. Nada foi construído ainda; este documento é para decidir.

## Por que esta seção

O objetivo é chamar a atenção de comercializadoras de geração distribuída como a GEDISA e a NEX Energy. As duas operam frotas de usinas remotas ou compartilhadas e vendem créditos a consumidores: a NEX diz ter mais de 150 usinas e 5 mil clientes, e a GEDISA tem mais de 55 usinas em 27 distribuidoras.

Essas usinas são quase todas **minigeração (75 kW a 5 MW)**. É exatamente o grupo que a ANEEL quer tornar observável e controlável pelas distribuidoras:

| Consulta | O que propõe | Situação |
|---|---|---|
| CP ANEEL 9/2026 | Plano de gestão de excedentes na rede de distribuição; admite **corte físico** de GD em cenários críticos, quando acabarem os recursos convencionais | Contribuições encerradas em 06/06/2026; sem decisão |
| CP ANEEL 33/2026 | Revisão do Módulo 3 do PRODIST: comunicação permanente, telemetria e **comando remoto** de cerca de 70 mil instalações, mais de 33 GW (cerca de 68 mil minigerações, 13 GW, e 1 500 usinas Tipo III, 20 GW). Minigeração existente teria 6 meses para se adequar | **Aberta até 09/11/2026** |

O ONS já acionou duas vezes o plano emergencial para usinas Tipo III: 07/06/2026 (cerca de 1 GW, 10h às 14h) e 23/08/2026 (11h às 13h30). A minigeração ainda não foi cortada.

A lição registrada da conversa com a GEDISA vale aqui: valor futuro imaginado não convenceu. A seção mostra uma **exposição em reais, calculada com dados públicos**, e uma data concreta (o fim da CP 33/2026).

## O que já existe no site e não deve ser repetido

A seção 3, "A curva do pato", já tem a curva líquida do SIN, os cortes de eólica e solar por motivo (ENE, CNF, REL) e um parágrafo explicando o plano emergencial e a CP 9/2026. A seção 5 trata de geração distribuída em números nacionais.

A seção nova não reexplica a curva do pato. Ela cita a seção 3 e responde a uma pergunta só: **quanto a minigeração perderia se fosse cortada como as usinas Tipo III já são.**

## A seção (proposta: nova seção 6, logo depois de "Mercado livre e geração distribuída")

Pergunta do título: *"A minigeração ainda não é cortada. Se fosse, quanto perderia?"*

**"Lido hoje"**, gerado dos dados: quantos dias dos últimos 12 meses o ONS cortou eólica e solar por sobra de energia, o maior corte de um dia, e o que uma usina de 1 MWp teria deixado de gerar se fosse cortada nesses mesmos dias e horas.

**6a · Onde está a minigeração.** Barras por distribuidora: potência instalada de minigeração (75 kW–5 MW) e quanto dela está em autoconsumo remoto ou geração compartilhada, o modelo das comercializadoras. Destaque para as distribuidoras onde o plano emergencial já atua.

**6b · Os dias em que sobrou energia.** Calendário dos últimos 12 meses, um quadrado por dia, colorido pela energia cortada por sobra (ENE) nos dados do ONS. Marcas nos dois acionamentos do plano emergencial. Mostra que o problema tem estação e horário.

**6c · A calculadora de exposição.** O visitante escolhe distribuidora, potência da usina (kWp) e um cenário. A resposta é energia perdida por ano (MWh) e receita perdida (R$), com o detalhe da conta aberto.

Cenários, todos explicitamente hipotéticos:
- **Como o plano emergencial hoje:** corte total da injeção nos dias e janelas em que o plano foi acionado (2 dias até agora).
- **Nos dias de sobra de energia:** corte das 10h às 14h em todo dia em que o ONS cortou mais de um limiar de ENE (por exemplo 5 GWh no dia).
- **Limitação parcial:** injeção limitada a 50 % da potência nas mesmas janelas, como em conexões flexíveis.

Valor do crédito perdido: tarifa homologada da distribuidora (REH) menos a parcela do Fio B não compensada no ano (Lei 14.300). Para a Copel o site já tem esse número (R$ 0,639/kWh em 2026); para as demais, a tabela da REH de cada uma.

**"Para você" (o convite):** *"Opera uma frota de minigeração? A CP 33/2026 recebe contribuições até 9 de novembro. Calculamos a exposição da sua frota, usina por usina, com uma usina analisada de graça."* Link para a Bronze e contato@data-joule.com. Nenhuma empresa é citada pelo nome na página.

## Dados

| Dado | Fonte | Acesso | Uso |
|---|---|---|---|
| Cortes por usina, meia-hora, motivo | ONS `restricao_coff_fotovoltaica` e `restricao_coff_eolica` (mensal, CSV/Parquet no S3) | Aberto, sem chave; verificado em 03/10/2026, defasagem de cerca de 1 dia | 6b, cenários de 6c |
| Perfil solar horário | Os mesmos arquivos (`val_geracaoreferencia` de usinas do subsistema) ou Open-Meteo (irradiância, sem chave) | Aberto | Energia por hora de 1 kWp em cada região |
| Minigeração por distribuidora e modalidade | ANEEL, relação de empreendimentos de GD (dados abertos) | **Portal da ANEEL bloqueia ou expira acesso por script**: baixar manualmente no navegador e processar na montagem do site | 6a, lista de distribuidoras de 6c |
| Tarifas e parcela de crédito | REH de cada distribuidora | Manual, por distribuidora; começar pelas 10 com mais minigeração | 6c |
| Acionamentos do plano emergencial | ONS e imprensa (Poder360, Abradee, Agência iNFRA) | Manual, lista curta com fonte de cada data | 6b, cenário 1 |

Regra do site mantida: o que vem da ANEEL é montado em `scripts/build_design_data.py` e entra em `data/snapshot.json`; o navegador nunca fala com essas fontes. Os cortes do ONS podem ser buscados no servidor com cache diário, como a CMO.

## O que precisa ser verificado antes de publicar

1. **O texto oficial das duas consultas.** Os números acima vêm de Agência iNFRA, Cenário Energia, TAGD e Canal Solar. O voto da ANEEL (processo 48500.002211/2026-10) não baixa por script. Ler a nota técnica da CP 33/2026 e a minuta da CP 9/2026 no navegador e citar artigo por artigo.
2. **Se a CP 9/2026 prevê compensação** pela energia cortada. Se previr, a calculadora mostra a perda líquida; hoje nenhuma fonte diz.
3. **Cobertura dos arquivos do ONS.** Uma contagem rápida do arquivo de outubro deu cerca de 4,2 GWh de solar cortado por sobra em 02/10, mas o arquivo parece cobrir só parte das usinas. Conferir contra o total que a seção 3 já mostra.
4. **Datas dos acionamentos** do plano emergencial depois de 23/08/2026.

## Cuidados

- **Não é previsão.** Todo cenário diz "se a minigeração fosse cortada como…". A etiqueta vermelha "a confirmar" fica em qualquer número que dependa de regra ainda não decidida.
- **Tom de observatório.** A página informa; o convite fica no "Para você", como nas outras seções.
- **Conflito com PRs abertos.** Os PRs #10 e #12 também inserem seções e renumeram. Esta seção entra depois deles, renumerando o que for preciso.

## Fases

1. **Verificação** (sem código): ler as duas minutas, confirmar compensação e prazos, baixar a relação de GD da ANEEL, conferir a cobertura dos arquivos do ONS.
2. **Dados:** estender o script de montagem (minigeração por distribuidora, tarifas das 10 primeiras); fonte `lib/sources/ons.ts` para os cortes de 12 meses, com testes do parser.
3. **Seção:** 6a, 6b e 6c no padrão do site (pergunta → "Lido hoje" → instrumento → carimbo → Método → "Para você"); a calculadora é o terceiro componente de cliente.
4. **Revisão e PR:** capturas claro/escuro em 1280 e 390 px, preview na Vercel, merge só com o "merge" do Jeferson.

## Fontes consultadas

- ANEEL, notícia da CP 9/2026: https://www.gov.br/aneel/pt-br/assuntos/noticias/2026/consulta-publica-propoe-aprimorar-o-tratamento-de-excedentes-de-energia
- Agência iNFRA, abertura da CP 9/2026 e os 33 GW: https://agenciainfra.com/blog/diretoria-da-aneel-abre-consulta-sobre-controle-de-gd-pelas-distribuidoras/
- Canal Solar, CP 9/2026: https://canalsolar.com.br/cortes-na-gd-aneel-consulta-publica/
- Cenário Energia, CP 33/2026: https://cenarioenergia.com.br/2026/09/08/aneel-propoe-controle-de-ate-33-gw-de-geracao-distribuida-pelas-distribuidoras/
- TAGD Advogados, CP 33/2026 (70 mil instalações, prazo 09/11): https://tagdlaw.com.br/?p=15402
- Portal Energia Limpa, segundo acionamento (23/08/2026): https://energialimpa.live/ons-ativa-plano-emergencial-por-segunda-vez-para-reduzir-geracao-excedente-no-sin/
- Poder360, primeiro acionamento: https://www.poder360.com.br/poder-energia/ons-aciona-pela-1a-vez-plano-emergencial-para-cortar-geracao-de-energia/
- NEX Energy: https://nexenergy.com.br/
- ONS, dados abertos de restrição: https://dados.ons.org.br/dataset/restricao_coff_fotovoltaica
