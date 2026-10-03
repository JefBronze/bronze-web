"""Build data/intermitentes.json for section 3, "A curva do pato" (stdlib only).

- duckHist: per month, the SIN net load (carga − eólica − solar) at the midday trough and the evening ramp,
  from ONS "balanço de energia por subsistema" (hourly, MWmed; solar includes MMGD).
- balanco: the latest complete SIN day from the same file (the fallback for the live instrument).
- curtail: per month and source, the generation ONS ordered cut ("constrained-off"), in MWh, by reason
  (REL rede, CNF confiabilidade, ENE energia, PAR), plus the Nordeste share and what was actually generated.
  MWh = Σ val_geracaonaorealizadaapurada × 0,5 (half-hourly MWmed). Closed months only.

Closed months are cached in .cache/ons/ (git-ignored), so a rerun only downloads the newest month.
"""
import csv
import datetime as dt
import io
import json
import os
import sys
import urllib.request

S3 = 'https://ons-aws-prod-opendata.s3.amazonaws.com/dataset'
CACHE = '.cache/ons'
UA = {'User-Agent': 'data-joule-observatorio/0.1 (+https://data-joule.com)'}
os.makedirs(CACHE, exist_ok=True)
today = dt.date.today()


def stream(url):
    """Yield CSV rows as dicts without holding the file in memory (the wind files pass 40 MB)."""
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=300) as r:
        yield from csv.DictReader(io.TextIOWrapper(r, encoding='utf-8-sig'), delimiter=';')


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def cached(name, fn, closed):
    path = os.path.join(CACHE, name + '.json')
    if closed and os.path.exists(path):
        return json.load(open(path))
    val = fn()
    if closed:
        json.dump(val, open(path, 'w'))
    return val


# ---------- balanço: hourly SIN by source -----------------------------------------------------------------

def balanco_year(y):
    days = {}
    for r in stream(f'{S3}/balanco_energia_subsistema_ho/BALANCO_ENERGIA_SUBSISTEMA_{y}.csv'):
        if r['id_subsistema'].strip() != 'SIN':
            continue
        t = r['din_instante']
        d, h = t[:10], int(t[11:13])
        days.setdefault(d, {})[h] = {
            'hid': num(r['val_gerhidraulica']), 'ter': num(r['val_gertermica']),
            'eol': num(r['val_gereolica']), 'sol': num(r['val_gersolar']), 'carga': num(r['val_carga']),
        }
    return {d: hs for d, hs in days.items() if len(hs) == 24}


def duck_day(hs):
    net = [hs[h]['carga'] - hs[h]['eol'] - hs[h]['sol'] for h in range(24)]
    trough_h = min(range(9, 16), key=lambda h: net[h])
    peak_h = max(range(16, 23), key=lambda h: net[h])
    return net[trough_h], net[peak_h] - net[trough_h], max(hs[h]['sol'] for h in range(24))


years = list(range(2023, today.year + 1))
duck_hist, latest_day = [], None
for y in years:
    days = cached(f'balanco-{y}', lambda: balanco_year(y), closed=y < today.year)
    by_month = {}
    for d in sorted(days):
        by_month.setdefault(d[:7], []).append(duck_day({int(h): v for h, v in days[d].items()}))
        latest_day = (d, days[d])
    for m, rows in sorted(by_month.items()):
        # The file starts counting rooftop solar (MMGD) in May 2023: the solar peak jumps from ~6 to ~15 GW that month.
        # Earlier months would make the duck look deeper than it got, so the series starts there.
        if m < '2023-05' or m >= today.strftime('%Y-%m'):  # closed months only
            continue
        n = len(rows)
        duck_hist.append({
            'm': m, 'days': n,
            'trough': round(sum(r[0] for r in rows) / n), 'ramp': round(sum(r[1] for r in rows) / n),
            'solarMax': round(sum(r[2] for r in rows) / n),
        })
    print('balanço', y, len(days), 'days', file=sys.stderr)

d, hs = latest_day
hs = {int(h): v for h, v in hs.items()}
balanco = {'day': d, **{k: [round(hs[h][k]) for h in range(24)] for k in ('hid', 'ter', 'eol', 'sol', 'carga')}}

# ---------- curtailment ------------------------------------------------------------------------------------

FONTES = {'eol': 'restricao_coff_eolica_tm/RESTRICAO_COFF_EOLICA', 'sol': 'restricao_coff_fotovoltaica_tm/RESTRICAO_COFF_FOTOVOLTAICA'}


def curtail_month(fonte, y, m):
    out = {'cut': {}, 'cutNE': 0.0, 'gen': 0.0}
    for r in stream(f'{S3}/{FONTES[fonte]}_{y}_{m:02d}.csv'):
        out['gen'] += num(r['val_geracao']) * 0.5
        lost = num(r['val_geracaonaorealizadaapurada']) * 0.5
        if lost <= 0:
            continue
        why = (r['cod_razaorestricao'] or '?').strip()
        out['cut'][why] = out['cut'].get(why, 0.0) + lost
        if r['id_subsistema'].strip() == 'NE':
            out['cutNE'] += lost
    return {'cut': {k: round(v) for k, v in out['cut'].items()}, 'cutNE': round(out['cutNE']), 'gen': round(out['gen'])}


first = dt.date(today.year, today.month, 1)
months = []
for k in range(12, 0, -1):  # the 12 closed months before the current one
    mm = (first.month - 1 - k) % 12 + 1
    yy = first.year + (first.month - 1 - k) // 12
    months.append((yy, mm))

curtail = []
for y, m in months:
    row = {'m': f'{y}-{m:02d}'}
    for f in FONTES:
        row[f] = cached(f'curtail-{f}-{y}-{m:02d}', lambda: curtail_month(f, y, m), closed=True)
    curtail.append(row)
    print('curtail', row['m'], {f: sum(row[f]['cut'].values()) for f in FONTES}, file=sys.stderr)

json.dump({'builtAt': today.isoformat(), 'balanco': balanco, 'duckHist': duck_hist, 'curtail': curtail},
          open('data/intermitentes.json', 'w'), ensure_ascii=False, indent=1)
print('data/intermitentes.json written', file=sys.stderr)
