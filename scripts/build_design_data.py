"""Build design/data2.js — everything the Direção A v2 mock-up renders — from verified inputs.

Inputs: design-data.json (live snapshot), data/fuel-2026-08.json (ANP aggregate), and constants cited inline
from Data-Joule/urpx and Data-Joule/auditoria-fatura (REH 3.472/2025) and the lab README.
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
    'pld': {'piso': 58.57, 'teto': 779.27, 'nota': 'limites PLD 2026 — a confirmar na CCEE'},
    'caiso': caiso, 'caisoTime': snap['caiso_fuel']['latest']['Time'],
    'nyiso': snap['nyiso_fuel']['latest'],
    # Copel B1 residencial convencional, REH 3.472/2025 (urpx/copel-b1-residencial-convencional.jsonld; fatura 06/2026)
    'b1': {'te': 0.27575, 'tusd': 0.36667, 'bandeira': {'verde': 0, 'amarela': 0.01885, 'vermelha1': 0.04463, 'vermelha2': 0.07877},
           'icms': 0.19, 'pis': 0.015536, 'cofins': 0.071339, 'cip': 23.78, 'refKwh': 282, 'refTotal': 275.87, 'refCalc': 275.91},
    # Copel A4, REH 3.472/2025, before tax (auditoria-fatura/bdgd_analise.md:71-73). R$/kW and R$/MWh.
    'a4': {'verde': {'demanda': 20.78, 'tusdP': 1211.56, 'tusdFP': 120.91, 'teP': 413.69, 'teFP': 257.51},
           'azul': {'demandaP': 44.93, 'demandaFP': 20.78, 'tusdE': 120.91, 'teP': 413.69, 'teFP': 257.51, 'nota': 'TUSD energia Azul assumida = TUSD FP Verde; a confirmar'}},
    # BDGD V11 Copel 2025 (auditoria-fatura/bdgd_analise.md)
    'bdgd': {'units': 11780, 'idleShare': 0.164, 'brlYear': 122.6e6, 'pct': {'p10': 0.064, 'p25': 0.098, 'p50': 0.164, 'p75': 0.271, 'p90': 0.385, 'p95': 0.461},
             'sectors': [{'n': 'Educação', 'u': 468, 'idle': 0.296, 'brl': 6.0e6}, {'n': 'Hospitais', 'u': 241, 'idle': 0.206, 'brl': 2.5e6},
                         {'n': 'Todas A4', 'u': 11780, 'idle': 0.164, 'brl': 122.6e6}, {'n': 'Varejo', 'u': 1581, 'idle': 0.127, 'brl': 12.7e6},
                         {'n': 'Supermercados', 'u': 870, 'idle': 0.117, 'brl': 8.6e6}, {'n': 'Indústria', 'u': 3722, 'idle': 0.111, 'brl': 40.8e6}]},
    # Lab tiers: point measurements 2026-06-06 (data-joule README:58-76, Strategy:1142); restore 55 s.
    'lab': {'tiers': [['T0', 10.5], ['T1', 9.0], ['T2', 7.1], ['T3', 3.8], ['T4', 0.2]], 'restoreS': 55, 'nota': 'degraus a partir de medições pontuais; sem série temporal gravada'},
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
           'nota': 'parcela Fio B da TUSD B1 Copel: a confirmar na REH 3.472'},
    # Anatomy of a litre, Paraná, Aug 2026 — Petrobras + tax constants to confirm at build time; marked in the UI.
    'litro': {'refinaria': 2.91, 'anidro': 0.68, 'pisCofins': 0.7925, 'icms': 1.57, 'nota': 'refinaria e tributos: valores de referência a confirmar (Petrobras, CONFAZ)'},
}
js = 'window.BRONZE2 = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
open('design/data2.js', 'w').write(js)
print('design/data2.js', len(js), 'bytes')
# Same object for the Next.js app: the fallback every live source degrades to (lib/snapshot.ts).
json.dump(data, open('data/snapshot.json', 'w'), ensure_ascii=False, indent=1)
print('data/snapshot.json written')
