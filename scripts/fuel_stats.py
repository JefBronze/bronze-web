"""Aggregate one month of ANP station-level prices into the small JSON the site needs.

Usage: python3 scripts/fuel_stats.py <gasolina-etanol.csv> <diesel-gnv.csv> [out.json]
Input files come from gov.br/anp ... /shpc/dsan/{YYYY}/{MM}-dados-abertos-precos-*.csv
"""
import csv, json, statistics as st, collections, sys

ge, dg = sys.argv[1], sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else 'data/fuel-latest.json'


def load(path):
    rows = []
    with open(path, encoding='utf-8-sig') as fh:
        for r in csv.DictReader(fh, delimiter=';'):
            try:
                v = float(r['Valor de Venda'].replace(',', '.'))
            except ValueError:
                continue
            rows.append((r['Estado - Sigla'], r['Municipio'], r['Produto'], v, r['Bandeira'].strip(), r['Data da Coleta']))
    return rows


R = load(ge) + load(dg)
month = max(r[5][3:] for r in R)  # MM/YYYY of the latest collection date


def median(sel):
    v = [r[3] for r in R if sel(r)]
    return (round(st.median(v), 2), len(v)) if v else (None, 0)


products = ['GASOLINA', 'GASOLINA ADITIVADA', 'ETANOL', 'DIESEL S10', 'DIESEL', 'GNV']
ufs = sorted({r[0] for r in R})

ratio = []
for uf in ufs:
    g, ng = median(lambda r, u=uf: r[2] == 'GASOLINA' and r[0] == u)
    e, ne = median(lambda r, u=uf: r[2] == 'ETANOL' and r[0] == u)
    if g and e:
        ratio.append({'uf': uf, 'gasolina': g, 'etanol': e, 'ratio': round(e / g, 3), 'n': min(ng, ne)})
ratio.sort(key=lambda x: x['ratio'])

city = 'CURITIBA'
curitiba = {p: median(lambda r, p=p: r[2] == p and r[1] == city)[0] for p in products}
stations = [{'p': r[2], 'v': r[3], 'b': r[4]} for r in R if r[1] == city and r[2] in ('GASOLINA', 'ETANOL', 'DIESEL S10')]
brands = collections.Counter(s['b'] for s in stations)

json.dump({
    'month': month,
    'source': 'ANP · Levantamento de preços de combustíveis (dados abertos, por posto)',
    'brasil': {p: median(lambda r, p=p: r[2] == p)[0] for p in products},
    'parana': {p: median(lambda r, p=p: r[2] == p and r[0] == 'PR')[0] for p in products},
    'curitiba': curitiba,
    'curitiba_stations': stations,
    'curitiba_brands': dict(brands.most_common()),
    'ratio_by_uf': ratio,
    'uf_below_070': sum(1 for x in ratio if x['ratio'] < 0.70),
}, open(out, 'w'), ensure_ascii=False, indent=1)
print(out, month, 'ufs', len(ratio), 'curitiba stations', len(stations))
