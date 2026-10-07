"""Build design/data2.js — everything the Direção A v2 mock-up renders — from verified inputs.

Inputs: design-data.json (live snapshot), data/fuel-2026-08.json (ANP aggregate), and constants cited inline
from Data-Joule/urpx and Data-Joule/auditoria-fatura (REH 3.472/2025).
"""
import json

snap = json.load(open('design-data.json'))['sources']
fuel = json.load(open('data/fuel-2026-08.json'))

carga = snap['ons_carga']['data']
areas = ['SECO', 'S', 'NE', 'N']
n = min(len(carga[a]['series_last24']) for a in areas)
sin = [round(sum(carga[a]['series_last24'][i]['mw'] for a in areas)) for i in range(n)]

cmo = {k: [x['brl_mwh'] for x in v] for k, v in snap['ons_cmo']['by_subsystem'].items()}

caiso_cols = ['Natural Gas', 'Imports', 'Large Hydro', 'Nuclear', 'Batteries', 'Wind', 'Solar', 'Geothermal', 'Biomass', 'Biogas', 'Small hydro', 'Coal', 'Other']
caiso = {'time': [r['Time'] for r in snap['caiso_fuel']['series']]}
for c in caiso_cols:
    caiso[c] = [int(r[c]) for r in snap['caiso_fuel']['series']]

data = {
    'takenAt': snap['ons_carga']['data']['SECO']['latest']['din_referenciautc'],
    # When each source's reading in this snapshot was published (used for the stamp when the app falls back to it).
    'asOf': {
        'ons': snap['ons_carga']['data']['SECO']['latest']['din_referenciautc'],
        'hq': snap['hq_demand']['latest']['date'],
        'fred': snap['fred']['WTI_DCOILWTICO'][-1]['d'],
        'kalshi': snap['kalshi']['markets'][0]['close'],
        'polymarket': snap['polymarket']['event'],
        'caiso': snap['caiso_fuel']['latest']['Time'],
        'cmo': snap['ons_cmo']['day'],
        'ptax': '2026-10-01',
    },
    'sinArea': {a: [round(carga[a]['series_last24'][i]['mw']) for i in range(n)] for a in areas},
    'ptax': 5.2079, 'ptaxDay': '2026-10-01',  # BCB PTAX venda, olinda.bcb.gov.br (verified 2026-10-02)
    'sin': sin, 'sinNow': round(carga['sin_mw_now']), 'sinBy': {a: round(carga[a]['latest']['val_cargaglobal']) for a in areas},
    'quebec': [x['mw'] for x in snap['hq_demand']['series_last24']], 'quebecNow': snap['hq_demand']['latest']['valeurs_demandetotal'],
    'hqPeakLast': snap['hq_demand']['peak_events_latest'][0]['datedebut'][:10],
    'weather': {k: v['temperature_2m'] for k, v in snap['open_meteo']['data'].items()},
    'wti60': [x['v'] for x in snap['fred']['WTI_DCOILWTICO']], 'wtiNow': snap['fred']['WTI_DCOILWTICO'][-1]['v'],
    'brentNow': snap['fred']['Brent_DCOILBRENTEU'][-1]['v'], 'hhNow': snap['fred']['HenryHub_DHHNGSP'][-1]['v'],
    'polyHigh': sorted([[float(l['question'].split('$')[1].split(' ')[0]), l['p_yes']] for l in snap['polymarket']['ladder'] if 'HIGH' in l['question']]),
    'polyLow': sorted([[float(l['question'].split('$')[1].split(' ')[0]), l['p_yes']] for l in snap['polymarket']['ladder'] if 'LOW' in l['question']]),
    'kalshi': [[m['strike'], round((float(m['yes_bid']) + float(m['yes_ask'])) / 2, 4)] for m in snap['kalshi']['markets'] if m['close'] == snap['kalshi']['markets'][0]['close']],
    'cmo': cmo, 'cmoNow': {k: v[-1] for k, v in cmo.items()}, 'cmoDay': snap['ons_cmo']['day'],
    # PLD 2026 limits: Despacho ANEEL nº 3.850/2025 (published 23/12/2025), via Cenário Energia and Canal Solar (consistent).
    'pld': {'ano': 2026, 'piso': 57.31, 'tetoEstrutural': 785.27, 'tetoHorario': 1611.04, 'ato': 'Despacho ANEEL nº 3.850/2025'},
    # Bandeira tarifária: surcharges REH ANEEL 3.306/2024 (gov.br/aneel); monthly flags from ANEEL announcements as reported
    # by the press and distributor tables (ANEEL/CCEE pages block automated reads). Verified 2026-10-03.
    'bandeira': {
        'vigente': 'verde', 'mes': '2026-10',
        'hist': [['2024-10', 'vermelha2'], ['2024-11', 'amarela'], ['2024-12', 'verde'], ['2025-01', 'verde'], ['2025-02', 'verde'],
                 ['2025-03', 'verde'], ['2025-04', 'verde'], ['2025-05', 'amarela'], ['2025-06', 'vermelha1'], ['2025-07', 'vermelha1'],
                 ['2025-08', 'vermelha2'], ['2025-09', 'vermelha2'], ['2025-10', 'vermelha1'], ['2025-11', 'vermelha1'], ['2025-12', 'amarela'],
                 ['2026-01', 'verde'], ['2026-02', 'verde'], ['2026-03', 'verde'], ['2026-04', 'verde'], ['2026-05', 'amarela'],
                 ['2026-06', 'amarela'], ['2026-07', 'amarela'], ['2026-08', 'amarela'], ['2026-09', 'amarela'], ['2026-10', 'verde']],
    },
    'caiso': caiso, 'caisoTime': snap['caiso_fuel']['latest']['Time'],
    'nyiso': snap['nyiso_fuel']['latest'],
    # Copel B1 residencial convencional, REH ANEEL nº 3.592/2026 (6ª revisão periódica, in force 24/06/2026–23/06/2027),
    # Tarifas de aplicação, Tabelas 1 (Grupo A) and 2 (Grupo B) of the REH annex; checked against the annex text and
    # Copel's "sem imposto" panels on 2026-10-03 (identical).
    # The model reproduced the real June 2026 bill (still under REH 3.472/2025) within R$ 0,04: refTotal/refCalc.
    'b1': {'reh': 'REH ANEEL nº 3.592/2026', 'te': 0.31085, 'tusd': 0.45717, 'bandeira': {'verde': 0, 'amarela': 0.01885, 'vermelha1': 0.04463, 'vermelha2': 0.07877},
           'icms': 0.19, 'pis': 0.015536, 'cofins': 0.071339, 'cip': 23.78, 'refKwh': 282, 'refTotal': 275.87, 'refCalc': 275.91},
    # Copel A4 (2,3–25 kV), REH ANEEL nº 3.592/2026, before tax, same source. R$/kW and R$/MWh.
    'a4': {'verde': {'demanda': 25.33, 'tusdP': 1463.39, 'tusdFP': 146.59, 'teP': 475.55, 'teFP': 295.75},
           'azul': {'demandaP': 54.13, 'demandaFP': 25.33, 'tusdE': 146.59, 'teP': 475.55, 'teFP': 295.75}},
    # BDGD V11 Copel 2025 (auditoria-fatura/bdgd_analise.md)
    'bdgd': {'units': 11780, 'idleShare': 0.164, 'brlYear': 122.6e6, 'pct': {'p10': 0.064, 'p25': 0.098, 'p50': 0.164, 'p75': 0.271, 'p90': 0.385, 'p95': 0.461},
             'sectors': [{'n': 'Educação', 'u': 468, 'idle': 0.296, 'brl': 6.0e6}, {'n': 'Hospitais', 'u': 241, 'idle': 0.206, 'brl': 2.5e6},
                         {'n': 'Todas A4', 'u': 11780, 'idle': 0.164, 'brl': 122.6e6}, {'n': 'Varejo', 'u': 1581, 'idle': 0.127, 'brl': 12.7e6},
                         {'n': 'Supermercados', 'u': 870, 'idle': 0.117, 'brl': 8.6e6}, {'n': 'Indústria', 'u': 3722, 'idle': 0.111, 'brl': 40.8e6}]},
    'fuel': {'month': fuel['month'], 'curitiba': fuel['curitiba'], 'brasil': fuel['brasil'], 'ratio': fuel['ratio_by_uf'], 'below070': fuel['uf_below_070'],
             # compact: per product, [price, brand index into brandList]
             'brandList': ['VIBRA', 'IPIRANGA', 'RAIZEN', 'BRANCA', 'OUTRA'],
             'stations': {p: [[s['v'], (['VIBRA', 'IPIRANGA', 'RAIZEN', 'BRANCA'].index(s['b']) if s['b'] in ['VIBRA', 'IPIRANGA', 'RAIZEN', 'BRANCA'] else 4)]
                              for s in fuel['curitiba_stations'] if s['p'] == p] for p in ['GASOLINA', 'ETANOL', 'DIESEL S10']},
             'brands': fuel['curitiba_brands']},
    # ACL — CCEE InfoMercado / Abraceel (nov-2025 shares; 2025 total; 1T26; abr/26). Build-time; CCEE blocks scripted access.
    'acl': {'share': {'total': 0.43, 'industria': 0.95, 'comercio': 0.47}, 'shareAsOf': 'nov/2025', 'consumers': 82000,
            'migr': [['2025', 21700], ['1T/2026', 4827], ['abr/2026', 1213]], 'apiSimplificada1T26': 3387, 'prAbr26': 70, 'varejoShareAbr26': 0.75,
            'precos': [150, 200, 250], 'nota': 'preço de contrato: cenários; curva de mercado (BBCE/Dcide) não é pública'},
    # GD — ABGD / ANEEL (jan-2026): 43,5 GW, 3,87 mi sistemas, 7 mi UCs com créditos, PR 3º com >4 GW / ~305 mil usinas. Lei 14.300 art. 27: Fio B.
    'gd': {'gw': 43.5, 'systems': 3.87e6, 'ucs': 7.0e6, 'municipios': 5565, 'solarShare': 0.99, 'proj2026': 50,
           'pr': {'gw': 4.0, 'plants': 305000, 'rank': 3},
           'fioB': [[2023, 0.15], [2024, 0.30], [2025, 0.45], [2026, 0.60], [2027, 0.75], [2028, 0.90], [2029, 1.0]],
           # Copel B1 residencial, REH ANEEL 3.592/2026 Tabela 4 (SCEE, GD II): share of the TUSD credited on compensated
           # energy is 71,84 % (24/06–31/12/2026) and 64,80 % (2027). Uncredited 28,16 % = 60 % × Fio B and 35,20 % = 75 % × Fio B,
           # so Fio B = 46,93 % of the B1 TUSD in both columns (consistent).
           'copelB1': {'reh': 'REH ANEEL nº 3.592/2026, Tabela 4', 'credTusd2026': 0.7184, 'credTusd2027': 0.6480}},
    # Anatomy of a litre, Paraná, Aug 2026 — Petrobras + tax constants to confirm at build time; marked in the UI.
    # Gasolina C in Curitiba, August 2026 (same month as the ANP pump median). Verified 2026-10-03.
    # Per-litre-of-gasolina-A items are scaled by (1 - blend) in the page; ICMS is already per litre of gasolina C.
    'litro': {
        'month': '08/2026',
        'blend': 0.32,           # anhydrous share, E32: Resolução CNPE nº 9/2026 (DOU 30/07/2026), from 2026-08-01
        'refinariaA': 2.61,      # R$/L gasolina A, Petrobras average to distributors, note of 28/05/2026 (net of the MP 1.358/2026 discount)
        'anidro': 2.4750,        # R$/L anhydrous, CEPEA/ESALQ São Paulo, Aug 2026 average (weekly indicators average 2,4751), ex-tax, ex-freight
        'pisCofinsA': 0.7925,    # R$/L gasolina A, Decreto 5.059/2004 art. 2 I (in force until 2026-09-09; Decreto 13.116 cut it to 0,16 from 10/09)
        'cideA': 0.10,           # R$/L gasolina A, Decreto 5.060/2004 art. 1 I (Decreto 8.395/2015)
        'pisCofinsAnidro': 0.1922,  # R$/L anhydrous, CEPEA Nota 2 (LC 214/2024, since 2025-05-01)
        'icms': 1.57,            # R$/L gasolina C, ad rem: Convênio ICMS 112/2025, from 2026-01-01
        # Abicom price gap versus import parity, 2026-09-28 (secondary: press coverage; abicom.com.br blocks automated reads).
        'paridade': {'data': '2026-09-28', 'gasolina': {'pct': 32, 'rl': 0.95}, 'diesel': {'pct': 102, 'rl': 3.34}},
    },
}
# Section 3, "A curva do pato": built by scripts/intermitentes.py from ONS open data (balanço + restrição constrained-off).
inter = json.load(open('data/intermitentes.json'))
data['balanco'] = inter['balanco']
data['duckHist'] = inter['duckHist']
data['curtail'] = inter['curtail']
# Section 4, "Quem gera": the largest plants with coordinates and the state outlines (scripts/usinas.py), and the
# monthly bandeira trigger read from CCEE's InfoBandeira bulletins (GSF and PLD gatilho of the DECOMP; CCEE blocks
# automated reads, so data/infobandeira.json is updated by hand after each announcement, last Friday of the month).
usinas = json.load(open('data/usinas.json'))
data['usinas'] = usinas
data['gatilho'] = {
    'meses': json.load(open('data/infobandeira.json')),
    # VU = PLD × (1 − GSF), R$/MWh: upper limit of each flag. NT 009/2023-SGM-STR/ANEEL, Tabela 2; REH 3.306/2024
    # and Submódulo 6.8 do PRORET v1.10 (REN 1.084/2024), in force since 2024-04-01. Checked against InfoBandeira 2026-09.
    'vu': {'verde': 27.48, 'amarela': 68.99, 'vermelha1': 95.05, 'vermelha2': 142.55},
    'proximo': '2026-10-30',  # ANEEL 2026 calendar: announcement of the November flag
}
# Section 6, "Minigeração sob controle": oversupply cuts per day and the exposure of a minigeração plant if it were cut
# like utility-scale solar (scripts/minigeracao.py: ONS restrição + Open-Meteo irradiance).
data['mmgd'] = json.load(open('data/minigeracao.json'))
js = 'window.BRONZE2 = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
open('design/data2.js', 'w').write(js)
print('design/data2.js', len(js), 'bytes')
# Same object for the Next.js app: the fallback every live source degrades to (lib/snapshot.ts).
json.dump(data, open('data/snapshot.json', 'w'), ensure_ascii=False, indent=1)
print('data/snapshot.json written')
