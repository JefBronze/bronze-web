"""Derive 'Direção A v4 - Brasil primeiro' from v2.

Jeferson, 2026-10-02: "display energy data that matters for Brazilians; leave the international data to a
separate section — but oil prices still matter for Brazilians, Hydro-Québec doesn't."

Order: 1 Pulso (SIN by subsystem, no Québec) · 2 Preço da energia no Brasil · 3 Petróleo, em reais (Brent × PTAX,
Kalshi/Polymarket kept as 'what comes next for the pump') · 4 Na bomba · 5 Demanda ociosa PR · 6 Lá fora
(Québec + CAISO, framed as what other grids do) · 7 Laboratório OpenADR · 8 Bastidores.
"""
import re

SRC = 'design/Direção A v2 - Observatório.dc.html'
DST = 'design/Direção A v4 - Brasil primeiro.dc.html'
html = open(SRC, encoding='utf-8').read()

# ---- split into head / sections / tail -------------------------------------------------------------
first = html.index('        <section class="sec" id="pulso"')
foot = html.index('        <footer class="wrap foot">')
head, body, tail = html[:first], html[first:foot], html[foot:]
parts = re.split(r'(?=        <section class="sec" id=")', body)
sec = {re.search(r'id="([a-z]+)"', p).group(1): p for p in parts if p.strip()}

# ---- 1 · Pulso: SIN by subsystem, Québec removed ---------------------------------------------------
pulso = sec['pulso']
pulso = pulso.replace('data-screen-label="1 Pulso"', 'data-screen-label="1 Pulso · Brasil"')
pulso = pulso.replace(
    '<p class="lede serif">Este site é um observatório: instrumentos ligados a dados públicos do setor elétrico e de combustíveis, lidos a cada poucos minutos. Cada número cita a fonte e a hora.</p>',
    '<p class="lede serif">Este site é um observatório do setor elétrico e dos combustíveis no Brasil: instrumentos ligados a dados públicos, lidos a cada poucos minutos. Cada número cita a fonte e a hora.</p>')
pulso = pulso.replace(
    '<p class="lido serif"><b>Lido hoje</b>Às 23h30 em Brasília, o Brasil pedia {{ ratio }} vezes a potência do Québec — e as duas curvas subiam juntas, uma no fim da tarde quente, a outra no início da noite fria.</p>',
    '<p class="lido serif"><b>Lido hoje</b>Às 23h30 em Brasília, o país pedia {{ sinNow }} MW: {{ seShare }} % no Sudeste/Centro-Oeste, {{ neShare }} % no Nordeste, {{ sShare }} % no Sul e {{ nShare }} % no Norte. O pico do dia foi às {{ sinPeakAt }}, com {{ sinPeak }} MW.</p>')
i0 = pulso.index('            <div class="inst">')
i1 = pulso.index('          </div>\n        </section>')
inst = '''            <div class="inst">
              <div class="bignums">
                <div class="bn"><span class="bnl">SIN · carga agora</span><span class="bnv mono">{{ sinNow }}<span class="bnu">MW</span></span></div>
                <div class="bn"><span class="bnl">Sudeste / Centro-Oeste</span><span class="bnv mono">{{ seNow }}<span class="bnu">MW</span></span></div>
                <div class="bn"><span class="bnl">pico do dia</span><span class="bnr mono">{{ sinPeak }} MW</span></div>
              </div>
              <svg class="svg" viewBox="0 0 720 240" role="img" aria-label="Carga das últimas 24 horas no Brasil, empilhada por subsistema">
                <sc-for list="{{ sinBands }}" as="b" hint-placeholder-count="4">
                  <path d="{{ b.d }}" fill="{{ b.fill }}" opacity="{{ b.op }}"></path>
                </sc-for>
                <path d="{{ sinLine }}" fill="none" stroke="var(--ink)" stroke-width="1.2"></path>
                <text class="axl" x="0" y="12">0–105 GW · carga verificada por subsistema</text>
                <text class="axl" x="720" y="12" text-anchor="end">Curitiba 14,8 °C</text>
                <line x1="0" y1="200" x2="720" y2="200" stroke="var(--line)"></line>
                <text class="ax" x="0" y="216">23:30</text><text class="ax" x="180" y="216" text-anchor="middle">05:30</text><text class="ax" x="360" y="216" text-anchor="middle">11:30</text><text class="ax" x="540" y="216" text-anchor="middle">17:30</text><text class="ax" x="720" y="216" text-anchor="end">23:30 BRT</text>
                <text class="ax" x="0" y="232">ontem</text><text class="ax" x="720" y="232" text-anchor="end">hoje</text>
              </svg>
              <div class="legend"><span><span class="sw" style="background:var(--c1)"></span>SE/CO {{ seNow }}</span><span><span class="sw" style="background:var(--c2)"></span>S {{ sNow }}</span><span><span class="sw" style="background:var(--c3)"></span>NE {{ neNow }}</span><span><span class="sw" style="background:var(--c4)"></span>N {{ nNow }}</span><span>MW · 23:30</span></div>
              <div class="stamp"><span class="live"><span class="dot"></span>ONS carga verificada · 23:30 BRT · 30 min</span><span>apicarga.ons.org.br · 4 áreas de carga</span></div>
              <details class="met"><summary>Método</summary><p>Carga verificada por subsistema (apicarga.ons.org.br), publicada com ~30 min de atraso, meia em meia hora; as quatro áreas (SE/CO, S, NE, N) empilhadas somam o SIN. Horas em Brasília. A API devolve zero para meias-horas ainda não verificadas; esses pontos são descartados, não desenhados.</p></details>
            </div>
'''
pulso = pulso[:i0] + inst + pulso[i1:]
sec['pulso'] = pulso

# ---- 2 · Preço (was 4): renumber ----------------------------------------------------------------------
preco = sec['preco'].replace('data-screen-label="4 O preço', 'data-screen-label="2 O preço').replace('<p class="kick">04 ·', '<p class="kick">02 ·')
for a, b in [('4a ·', '2a ·'), ('4b ·', '2b ·'), ('4c ·', '2c ·'), ('mesmo eixo de 4a', 'mesmo eixo de 2a')]:
    preco = preco.replace(a, b)
sec['preco'] = preco

# ---- 3 · Livre, cativo ou no telhado? (ACL · CCEE · GD) — new, Jeferson 2026-10-02 ------------------------
sec['mercado'] = '''        <section class="sec" id="mercado" data-screen-label="3 Livre, cativo ou no telhado">
          <div class="wrap">
            <p class="kick">03 · Mercado livre e geração distribuída</p>
            <h2 class="h2 serif">Livre, cativo ou no telhado: onde a sua energia é comprada?</h2>
            <p class="lede serif">Desde 2024 qualquer consumidor de média tensão pode deixar a distribuidora e comprar energia no mercado livre (ACL), liquidado na CCEE. E 3,9 milhões de telhados já geram a própria. As três opções pagam o mesmo fio — o que muda é a energia.</p>
            <p class="lido serif"><b>Lido na CCEE</b>{{ aclTotalPct }} % de toda a energia consumida no Brasil já é comprada no mercado livre — {{ aclIndPct }} % na indústria, {{ aclComPct }} % no comércio. Em 2025 migraram {{ migr2025 }} consumidores; em abril de 2026, {{ migrAbr }}, três quartos deles pela mão de um varejista. A geração distribuída chegou a {{ gdGw }} GW; o Paraná é o 3º estado, com {{ gdPrGw }} GW em {{ gdPrPlants }} mil usinas.</p>
            <div class="g3">
              <div class="inst">
                <div class="instl"><span>3a · consumo no mercado livre · {{ aclAsOf }}</span><span>% do consumo</span></div>
                <div class="rows" style="gap:6px">
                  <div class="row" style="grid-template-columns:7em minmax(0,1fr) 3.5em"><span>indústria</span><span><span class="bar win" style="display:block;width:{{ aclIndPct }}%"></span></span><span>{{ aclIndPct }} %</span></div>
                  <div class="row" style="grid-template-columns:7em minmax(0,1fr) 3.5em"><span>comércio</span><span><span class="bar win" style="display:block;width:{{ aclComPct }}%"></span></span><span>{{ aclComPct }} %</span></div>
                  <div class="row" style="grid-template-columns:7em minmax(0,1fr) 3.5em"><span>Brasil</span><span><span class="bar me" style="display:block;width:{{ aclTotalPct }}%"></span></span><span>{{ aclTotalPct }} %</span></div>
                </div>
                <div class="tiles" style="grid-template-columns:1fr 1fr;margin-top:18px">
                  <div class="tile"><div class="tl">migrações · 2025</div><div class="tv mono">{{ migr2025 }}</div><div class="tu">consumidores · CCEE</div></div>
                  <div class="tile"><div class="tl">1º tri 2026</div><div class="tv mono">{{ migr1T }}</div><div class="tu">{{ migrApi }} pela adesão simplificada (API)</div></div>
                </div>
                <div class="stamp"><span>CCEE InfoMercado · Abraceel · {{ aclAsOf }}</span><span>PR: 70 migrações em abr/26</span></div>
                <details class="met"><summary>Método</summary><p>Participação por classe: CCEE/Abraceel, consumo de nov/2025. Migrações: boletins mensais da CCEE (InfoMercado). A CCEE bloqueia leitura automática do portal de dados abertos; estes números entram no build a partir do boletim PDF do mês, com data. Elegibilidade: Portaria MME 50/2022 — todo o Grupo A desde 1/1/2024; baixa tensão em consulta pública <span class="todo">(calendário a confirmar)</span>.</p></details>
              </div>
              <div class="inst" style="grid-column:span 2">
                <div class="instl"><span>3b · a mesma fatura A4, cativo e livre · 50 MWh · 118 kW · Copel</span><span>R$/MWh · mesmo eixo de 2c</span></div>
                <div class="bills">
                  <sc-for list="{{ aclBills }}" as="bill" hint-placeholder-count="3">
                    <div class="bill">
                      <div class="billh"><span class="billn serif">{{ bill.name }}</span><span class="billt">R$ {{ bill.total }}/MWh</span></div>
                      <svg class="svg" viewBox="0 0 300 120" role="img" aria-label="Fatura decomposta">
                        <sc-for list="{{ bill.segs }}" as="s" hint-placeholder-count="5">
                          <rect x="{{ s.x }}" y="30" width="{{ s.w }}" height="60" fill="{{ s.fill }}" opacity="{{ s.op }}"></rect>
                        </sc-for>
                        <line x1="0" y1="90" x2="300" y2="90" stroke="var(--ink)"></line>
                        <text class="ax" x="0" y="110">0</text><text class="ax" x="300" y="110" text-anchor="end">1 000 R$/MWh</text>
                      </svg>
                      <sc-for list="{{ bill.segs }}" as="s" hint-placeholder-count="5">
                        <div class="seg"><span><i style="{{ s.istyle }}"></i>{{ s.name }}</span><span class="mono">{{ s.v }}</span></div>
                      </sc-for>
                    </div>
                  </sc-for>
                </div>
                <div class="stamp"><span>fio (TUSD energia + demanda) idêntico nos três; tributos "por dentro" idênticos</span><span class="todo">preço de contrato: cenários R$ 150 e 250/MWh — a curva BBCE/Dcide não é pública; encargos ACL (ESS/EER, CCEE) a incluir</span></div>
                <details class="met"><summary>Método</summary><p>Cativo = A4 Verde da seção 2c. Livre: a TE e a bandeira saem; entra a energia a preço de contrato (R$/MWh, antes de tributos), que o consumidor abaixo de 500 kW compra por um comercializador varejista. O fio continua da Copel. ICMS, PIS e COFINS incidem igual. A liquidação das diferenças entre contrato e consumo é feita na CCEE ao PLD horário — o CMO da seção 2a é o seu precursor diário.</p></details>
                <p class="pv"><b>Para você.</b> Com 50 MWh/mês, cada R$ 10/MWh de diferença no preço de contrato são R$ 6 mil por ano. A <a href="#dj" style="color:var(--dj)">Data Joule</a> simula a migração com as suas 12 faturas antes de qualquer contrato.</p>
              </div>
            </div>
            <div class="g2" style="margin-top:40px">
              <div>
                <div class="instl"><span>3c · geração distribuída · ABGD / ANEEL · jan/2026</span><span>Brasil</span></div>
                <div class="tiles" style="margin-top:12px">
                  <div class="tile"><div class="tl">potência instalada</div><div class="tv mono">{{ gdGw }} GW</div><div class="tu">99 % solar · meta ABGD 2026: 50 GW</div></div>
                  <div class="tile"><div class="tl">sistemas</div><div class="tv mono">{{ gdSystems }} mi</div><div class="tu">7 mi unidades com crédito · 5 565 municípios</div></div>
                  <div class="tile"><div class="tl">Paraná</div><div class="tv mono">{{ gdPrGw }} GW</div><div class="tu">3º estado · {{ gdPrPlants }} mil usinas</div></div>
                </div>
                <div class="stamp"><span>ABGD · balanço jan/2026 · ANEEL (base de GD, build mensal)</span></div>
              </div>
              <div class="inst">
                <div class="instl"><span>3d · quanto vale o kWh injetado · Lei 14.300 · Fio B</span><span>% do Fio B cobrado</span></div>
                <svg class="svg" viewBox="0 0 560 150" role="img" aria-label="Rampa da cobrança do Fio B sobre a energia injetada, 2023 a 2029">
                  <line x1="0" y1="120" x2="560" y2="120" stroke="var(--line)"></line>
                  <path d="{{ fioBSteps }}" fill="none" stroke="var(--c2)" stroke-width="2"></path>
                  <rect x="{{ fioBNowX }}" y="14" width="80" height="106" fill="var(--c2)" opacity="0.10"></rect>
                  <text class="ax" x="40" y="136" text-anchor="middle">2023</text><text class="ax" x="120" y="136" text-anchor="middle">2024</text><text class="ax" x="200" y="136" text-anchor="middle">2025</text><text class="ax" x="280" y="136" text-anchor="middle">2026</text><text class="ax" x="360" y="136" text-anchor="middle">2027</text><text class="ax" x="440" y="136" text-anchor="middle">2028</text><text class="ax" x="520" y="136" text-anchor="middle">2029</text>
                  <text class="axl" x="0" y="12">0–100 %</text>
                  <text class="axa" x="280" y="12" text-anchor="middle">2026 · 60 %</text>
                </svg>
                <div class="stamp"><span>Lei 14.300/2022, art. 27 · sistemas conectados após jan/2023</span><span class="todo">parcela Fio B da TUSD Copel B1: a confirmar</span></div>
                <details class="met"><summary>Método</summary><p>Cada kWh injetado vira crédito igual à tarifa cheia menos a fração do Fio B do ano. Para um telhado conectado hoje: crédito = TE + TUSD − 60 % × Fio B; em 2029, − 100 %. Sistemas anteriores a 7/1/2023 mantêm o regime antigo até 2045. O valor em R$/kWh entra quando a parcela Fio B da REH 3.472 for conferida.</p></details>
                <p class="pv"><b>Para você.</b> Telhado comercial em Curitiba: a conta de quanto o sol compensa muda a cada ano até 2029 — e muda de novo se você migrar para o livre. As duas decisões se calculam juntas.</p>
              </div>
            </div>
          </div>
        </section>

'''

# ---- 4 · Petróleo, em reais (was 2) --------------------------------------------------------------------
pet = sec['petroleo'].replace('data-screen-label="2 Petróleo e probabilidade"', 'data-screen-label="4 Petróleo, em reais"')
pet = pet.replace('<p class="kick">02 · Petróleo e probabilidade</p>', '<p class="kick">04 · Petróleo, em reais</p>')
pet = pet.replace('<h2 class="h2 serif">O que o mercado acha que o petróleo vai fazer.</h2>',
                  '<h2 class="h2 serif">O barril entra em dólar e sai na bomba em real — e o que o mercado aposta para o mês.</h2>')
pet = pet.replace('<p class="lede serif">Dois mercados de previsão apostam dinheiro em patamares de preço. Fazem perguntas diferentes — e é por isso que ficam em dois painéis.</p>',
                  '<p class="lede serif">O preço do combustível no Brasil começa aqui: Brent vezes dólar. Dois mercados de previsão apostam dinheiro em patamares do petróleo; fazem perguntas diferentes — e é por isso que ficam em dois painéis.</p>')
pet = pet.replace('<p class="lido serif"><b>Lido hoje</b>O Kalshi',
                  '<p class="lido serif"><b>Lido hoje</b>O Brent fechou a US$ {{ brentNow }}; com o dólar PTAX a R$ {{ ptax }}, o barril vale R$ {{ brentBbl }} — R$ {{ brentL }} por litro de petróleo cru, antes de refino, mistura e impostos. O Kalshi')
t0 = pet.index('            <div class="tiles" style="margin:0 0 26px 0">')
t1 = pet.index('            <div class="g2e">')
pet = pet[:t0] + '''            <div class="tiles" style="margin:0 0 26px 0">
              <div class="tile"><div class="tl">Brent · spot</div><div class="tv mono">{{ brentNow }}</div><div class="tu">US$/bbl · 29 set · FRED · WTI {{ wtiNow }}</div></div>
              <div class="tile"><div class="tl">dólar · PTAX venda</div><div class="tv mono">{{ ptax }}</div><div class="tu">R$/US$ · 01 out · Banco Central</div></div>
              <div class="tile"><div class="tl">Brent em reais</div><div class="tv mono">{{ brentL }}</div><div class="tu">R$/litro · {{ brentBbl }} R$/bbl</div></div>
            </div>
''' + pet[t1:]
pet = pet.replace('Spot: FRED, diário. Dados informativos; não é recomendação de investimento.</p></details>',
                  'Spot: FRED, diário; dólar: PTAX de venda do BCB (olinda.bcb.gov.br), diário; 1 barril = 158,987 L. O "Brent em reais" é petróleo cru — a paridade de importação que o mercado acompanha (Abicom) usa gasolina e diesel prontos, e entra aqui no build. Dados informativos; não é recomendação de investimento.</p></details>\n'
                  '            <p class="pv"><b>Para você.</b> Dono de posto ou gestor de frota: quando o Brent em reais sobe e o preço de refinaria da Petrobras fica parado, abre-se a defasagem — e cresce a chance de reajuste. A seção 5 mostra onde ele cai no litro. <span class="todo">paridade de importação por produto: a integrar</span></p>')
sec['petroleo'] = pet

# ---- 4 · Na bomba (was 5) ----------------------------------------------------------------------------
bomba = sec['bomba'].replace('data-screen-label="5 Na bomba"', 'data-screen-label="5 Na bomba"').replace('<p class="kick">05 ·', '<p class="kick">05 ·')
for a, b in [('a margem em 5c', 'a margem em 5c')]:
    bomba = bomba.replace(a, b)
bomba = bomba.replace('Brent em reais = FRED × PTAX (BCB) para a nota de defasagem.', 'Brent em reais: seção 4.')
sec['bomba'] = bomba

# ---- 5 · Paraná (was 6) ------------------------------------------------------------------------------
sec['parana'] = sec['parana']

# ---- 6 · Lá fora: Québec + CAISO (was 1-right + 3) -----------------------------------------------------
mix = sec['mix']
c0 = mix.index('              <svg class="svg" viewBox="0 0 720 250"')
c1 = mix.index('              <div class="stamp">', c0)
caiso_svg_legend = mix[c0:c1]
fora = '''        <section class="sec" id="fora" data-screen-label="7 Lá fora">
          <div class="wrap">
            <p class="kick">07 · Lá fora</p>
            <h2 class="h2 serif">O que outras redes fazem com o mesmo problema.</h2>
            <p class="lede serif">Duas referências que o laboratório escuta: o Québec, que gere a ponta de inverno pagando o consumidor para reduzir carga, e a Califórnia, que atravessa o pôr do sol com baterias.</p>
            <p class="lido serif"><b>Lido hoje</b>Hydro-Québec pedia {{ qcNow }} MW às 22h — o Brasil pede {{ ratio }} vezes isso, mas o Québec faz 40 GW no frio de janeiro. Na Califórnia, às 19h35, as baterias entregavam 10,0 GW — mais do que a hidrelétrica e a nuclear juntas.</p>
            <div class="g2e">
              <div class="inst">
                <div class="instl"><span>Hydro-Québec · demanda · 24 h</span><span>MW</span></div>
                <svg class="svg" viewBox="0 0 720 160" role="img" aria-label="Demanda do Québec nas últimas 24 horas">
                  <path d="{{ qcArea2 }}" fill="var(--c2)" opacity="0.12"></path>
                  <path d="{{ qcLine2 }}" fill="none" stroke="var(--c2)" stroke-width="1.5"></path>
                  <text class="axl" x="0" y="12">14–20 GW</text>
                  <text class="axl" x="720" y="12" text-anchor="end">Montréal 18,0 °C</text>
                  <line x1="0" y1="120" x2="720" y2="120" stroke="var(--line)"></line>
                  <text class="ax" x="0" y="136">22:30</text><text class="ax" x="180" y="136" text-anchor="middle">04:30</text><text class="ax" x="360" y="136" text-anchor="middle">10:30</text><text class="ax" x="540" y="136" text-anchor="middle">16:30</text><text class="ax" x="720" y="136" text-anchor="end">22:30 EDT</text>
                </svg>
                <div class="stamp"><span class="live"><span class="dot"></span>Hydro-Québec demande · 22:00 EDT · 15 min</span><span class="badge">sem evento de ponta · último em {{ hqPeak }}</span></div>
                <details class="met"><summary>Método</summary><p>Demanda total (donnees.hydroquebec.com), 15 min. Os eventos de ponta (dezembro a março) são publicados no mesmo portal e disparam a resposta da demanda do laboratório (seção 8).</p></details>
              </div>
              <div class="inst">
                <div class="instl"><span>CAISO · Califórnia · geração por fonte</span><span>hoje</span></div>
''' + caiso_svg_legend + '''              <div class="stamp"><span class="live"><span class="dot"></span>CAISO Today's Outlook · 19:35 PDT · 5 min</span></div>
                <details class="met"><summary>Método</summary><p>caiso.com/outlook, CSV de 5 em 5 min, hora local. As bandas empilham só valores positivos; baterias carregando aparecem como consumo. Renováveis agora {{ renShareNow }} %, ao meio-dia {{ renShareNoon }} %.</p></details>
              </div>
            </div>
            <p class="pv">Por que importa para o Brasil: resposta da demanda e baterias são o que o SIN vai precisar nas pontas de fim de tarde, quando o solar some e a carga fica — o mesmo horário em que o CMO bateu R$ 365 na seção 2.</p>
          </div>
        </section>

'''
sec['fora'] = fora

# ---- 7 · Lab, 8 · Bastidores unchanged -----------------------------------------------------------------
order = ['pulso', 'preco', 'mercado', 'petroleo', 'bomba', 'parana', 'fora', 'lab', 'bastidores']
sec['lab'] = sec['lab'].replace('data-screen-label="7 Laborat', 'data-screen-label="8 Laborat').replace('<p class="kick">07 ·', '<p class="kick">08 ·')
sec['bastidores'] = sec['bastidores'].replace('data-screen-label="8 Bastidores', 'data-screen-label="9 Bastidores').replace('<p class="kick">08 ·', '<p class="kick">09 ·')
body = ''.join(sec[k] for k in order)

# ---- hoje strip + rail ---------------------------------------------------------------------------------
head = head.replace('<a href="#pulso"><i>Québec</i><b>{{ qcNow }} MW</b></a>', '')
head = head.replace('<a href="#petroleo"><i>WTI</i><b>US$ {{ wtiNow }}</b></a>', '<a href="#petroleo"><i>Brent</i><b>R$ {{ brentL }}/L</b></a><a href="#petroleo"><i>Dólar</i><b>R$ {{ ptax }}</b></a>')
head = head.replace('<nav class="rail"><a href="#pulso">1</a><a href="#petroleo">2</a><a href="#mix">3</a><a href="#preco">4</a><a href="#bomba">5</a><a href="#parana">6</a><a href="#lab">7</a><a href="#bastidores">8</a></nav>',
                    '<nav class="rail"><a href="#pulso">1</a><a href="#preco">2</a><a href="#mercado">3</a><a href="#petroleo">4</a><a href="#bomba">5</a><a href="#parana">6</a><a href="#fora">7</a><a href="#lab">8</a><a href="#bastidores">9</a></nav>')

# ---- renderVals additions ------------------------------------------------------------------------------
tail = tail.replace(
    '            sources: sources\n',
    '            sinBands: C.stack([{ key: "SECO", values: D.sinArea.SECO }, { key: "S", values: D.sinArea.S }, { key: "NE", values: D.sinArea.NE }, { key: "N", values: D.sinArea.N }], 0, 720, 20, 200, 105000).map(function (b) { return { d: b.d, fill: { SECO: "var(--c1)", S: "var(--c2)", NE: "var(--c3)", N: "var(--c4)" }[b.key], op: "0.75" }; }),\n'
    '            sinLine: C.line(D.sin, 0, 720, 20, 200, 0, 105000),\n'
    '            seNow: C.fmt(D.sinBy.SECO), sNow: C.fmt(D.sinBy.S), neNow: C.fmt(D.sinBy.NE), nNow: C.fmt(D.sinBy.N),\n'
    '            seShare: Math.round(100 * D.sinBy.SECO / D.sinNow), sShare: Math.round(100 * D.sinBy.S / D.sinNow), neShare: Math.round(100 * D.sinBy.NE / D.sinNow), nShare: Math.round(100 * D.sinBy.N / D.sinNow),\n'
    '            sinPeak: C.fmt(Math.max.apply(null, D.sin)), sinPeakAt: (function () { var i = D.sin.indexOf(Math.max.apply(null, D.sin)); var h = (23.5 + i * 0.5) % 24; return (Math.floor(h) < 10 ? "0" : "") + Math.floor(h) + "h" + (h % 1 ? "30" : "00"); })(),\n'
    '            ptax: C.dec(D.ptax, 4), brentBbl: C.dec(D.brentNow * D.ptax, 0), brentL: C.dec(D.brentNow * D.ptax / 158.987),\n'
    '            qcArea2: C.area(D.quebec, 0, 720, 20, 120, 14000, 20000), qcLine2: C.line(D.quebec, 0, 720, 20, 120, 14000, 20000),\n'
    '            aclTotalPct: Math.round(D.acl.share.total * 100), aclIndPct: Math.round(D.acl.share.industria * 100), aclComPct: Math.round(D.acl.share.comercio * 100), aclAsOf: D.acl.shareAsOf,\n'
    '            migr2025: C.fmt(D.acl.migr[0][1]), migr1T: C.fmt(D.acl.migr[1][1]), migrAbr: C.fmt(D.acl.migr[2][1]), migrApi: C.fmt(D.acl.apiSimplificada1T26),\n'
    '            aclBills: [bill("A4 Verde · cativo", [["energia (TE)", pp * v.teP + (1 - pp) * v.teFP, "te"], ["fio (TUSD energia)", pp * v.tusdP + (1 - pp) * v.tusdFP, "fio"], ["demanda", kw * v.demanda / mwh, "dem"], ["bandeira amarela", D.b1.bandeira.amarela * 1000, "band"]])].concat([D.acl.precos[0], D.acl.precos[2]].map(function (pr) { return bill("Livre · contrato R$ " + pr, [["energia contratada", pr, "te"], ["fio (TUSD energia)", pp * v.tusdP + (1 - pp) * v.tusdFP, "fio"], ["demanda", kw * v.demanda / mwh, "dem"]]); })),\n'
    '            gdGw: C.dec(D.gd.gw, 1), gdSystems: C.dec(D.gd.systems / 1e6, 2), gdPrGw: C.dec(D.gd.pr.gw, 1), gdPrPlants: C.fmt(D.gd.pr.plants / 1000),\n'
    '            fioBSteps: D.gd.fioB.map(function (f, i) { var y = (120 - f[1] * 106).toFixed(1); return (i ? "L" : "M") + (i * 80) + " " + y + "H" + (i * 80 + 80); }).join(""), fioBNowX: "240",\n'
    '            sources: sources\n')

out = head + body + tail
assert 'id="mix"' not in out and out.count('<section') == 9
open(DST, 'w', encoding='utf-8').write(out)
print(DST, len(out), 'bytes')
