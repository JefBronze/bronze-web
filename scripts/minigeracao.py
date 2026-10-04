"""Build data/minigeracao.json for the section "Minigeração sob controle" (stdlib only).

Question the section answers: minigeração distribuída (75 kW–5 MW) is not cut today; if it were cut the way the ONS
already cuts wind and solar plants for oversupply, how much would a plant lose?

- days: for each of the last 12 closed months, per day, the wind + solar generation the ONS ordered cut for
  oversupply (reason ENE), in MWh, and the hours of that day with ENE cuts. Source: ONS open data
  restricao_coff_eolica / restricao_coff_fotovoltaica (half-hourly, per plant): val_geracaonaorealizadaapurada × 0,5.
- yield: per region (one representative city per subsystem), hourly solar yield of 1 kWp, from Open-Meteo
  historical shortwave radiation (W/m², horizontal) × performance ratio 0,80 / 1000. A rough, stated estimate.
- exposure: per region, kWh lost per kWp per year in two scenarios:
    'emerg'    the injection is cut to zero in the windows of the activations of the ONS emergency plan for Tipo III;
    'prorata'  in every hour, the plant loses the same share that utility-scale solar lost to oversupply cuts (ENE)
               in that hour: cut / (generated + cut), SIN-wide. "Cut the way the large plants already are." 
Closed months are cached in .cache/ons/ (git-ignored).
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

FONTES = {'eol': 'restricao_coff_eolica_tm/RESTRICAO_COFF_EOLICA', 'sol': 'restricao_coff_fotovoltaica_tm/RESTRICAO_COFF_FOTOVOLTAICA'}
HOUR_MIN = 100.0  # MWh of ENE in an hour (SIN-wide) for that hour to count as an oversupply hour
PR = 0.80
REGIOES = {  # one city per subsystem; the page says which
    'SE': ('Belo Horizonte', -19.92, -43.94),
    'S': ('Curitiba', -25.43, -49.27),
    'NE': ('Petrolina', -9.39, -40.50),
    'N': ('Belém', -1.46, -48.49),
}
# Activations of the ONS "Plano Emergencial de Gestão de Excedentes de Energia na Rede de Distribuição" (Tipo III).
# Hand-kept, each with its source; add new ones here.
EMERGENCIAS = [
    {'d': '2026-06-07', 'h': [10, 14], 'mw': 1000, 'fonte': 'Poder360, 07/06/2026'},
    {'d': '2026-08-23', 'h': [11, 13.5], 'mw': None, 'fonte': 'Movimento Econômico / Portal Energia Limpa, 24/08/2026'},
]


def stream(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=300) as r:
        yield from csv.DictReader(io.TextIOWrapper(r, encoding='utf-8-sig'), delimiter=';')


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def ene_month(fonte, y, m):
    """{date: {'cut': [24 hourly MWh of ENE cuts], 'gen': [24 hourly MWh generated]}}, SIN-wide, one source and month."""
    path = os.path.join(CACHE, f'ene-v2-{fonte}-{y}-{m:02d}.json')
    if os.path.exists(path):
        return json.load(open(path))
    days = {}
    for r in stream(f'{S3}/{FONTES[fonte]}_{y}_{m:02d}.csv'):
        t = r['din_instante']
        dd = days.setdefault(t[:10], {'cut': [0.0] * 24, 'gen': [0.0] * 24})
        h = int(t[11:13])
        dd['gen'][h] += num(r['val_geracao']) * 0.5
        if (r['cod_razaorestricao'] or '').strip() == 'ENE':
            dd['cut'][h] += max(0.0, num(r['val_geracaonaorealizadaapurada'])) * 0.5
    days = {d: {k: [round(v, 1) for v in hs] for k, hs in dd.items()} for d, dd in days.items()}
    json.dump(days, open(path, 'w'))
    return days


first = dt.date(today.year, today.month, 1)
months = []
for k in range(12, 0, -1):
    mm = (first.month - 1 - k) % 12 + 1
    yy = first.year + (first.month - 1 - k) // 12
    months.append((yy, mm))
d0 = dt.date(*months[0], 1)
d1 = first - dt.timedelta(days=1)

hourly = {}  # date -> [24] MWh ENE, wind + solar
solshare = {}  # date -> [24] share of utility-scale solar cut for oversupply in that hour: cut / (generated + cut)
for y, m in months:
    for f in FONTES:
        for d, dd in ene_month(f, y, m).items():
            acc = hourly.setdefault(d, [0.0] * 24)
            for i, v in enumerate(dd['cut']):
                acc[i] += v
            if f == 'sol':
                solshare[d] = [c / (g + c) if g + c > 0 else 0.0 for c, g in zip(dd['cut'], dd['gen'])]
    print('ene', f'{y}-{m:02d}', file=sys.stderr)

alldays = [(d0 + dt.timedelta(days=i)).isoformat() for i in range((d1 - d0).days + 1)]
days = []
for d in alldays:
    hs = hourly.get(d, [0.0] * 24)
    days.append({'d': d, 'mwh': round(sum(hs)), 'h': [i for i, v in enumerate(hs) if v >= HOUR_MIN]})


def openmeteo(lat, lon):
    url = ('https://archive-api.open-meteo.com/v1/archive?'
           f'latitude={lat}&longitude={lon}&start_date={d0}&end_date={d1}'
           '&hourly=shortwave_radiation&timezone=America%2FSao_Paulo')
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        j = json.load(r)
    out = {}
    for t, w in zip(j['hourly']['time'], j['hourly']['shortwave_radiation']):
        out.setdefault(t[:10], [0.0] * 24)[int(t[11:13])] = (w or 0) * PR / 1000  # kWh per kWp in that hour
    return out


def window_kwh(y, h0, h1):
    """kWh/kWp between h0 and h1 (decimal hours), hourly values taken as uniform within the hour."""
    tot = 0.0
    for h in range(24):
        a, b = max(h, h0), min(h + 1, h1)
        if b > a:
            tot += y[h] * (b - a)
    return tot


regioes = {}
for reg, (cidade, lat, lon) in REGIOES.items():
    y = openmeteo(lat, lon)
    anual = sum(sum(v) for v in y.values())
    prorata = 0.0
    mensal = {}
    for day in days:
        yd = y.get(day['d'], [0.0] * 24)
        sh = solshare.get(day['d'], [0.0] * 24)
        lost = sum(a * b for a, b in zip(yd, sh))
        prorata += lost
        mensal[day['d'][:7]] = mensal.get(day['d'][:7], 0.0) + lost
    emerg = sum(window_kwh(y.get(e['d'], [0.0] * 24), *e['h']) for e in EMERGENCIAS)
    regioes[reg] = {'cidade': cidade, 'anual': round(anual), 'emerg': round(emerg, 2), 'prorata': round(prorata, 1),
                    'mensal': {k: round(v, 1) for k, v in mensal.items()}}
    print('regiao', reg, cidade, regioes[reg]['anual'], 'prorata', regioes[reg]['prorata'], 'emerg', regioes[reg]['emerg'], file=sys.stderr)

# share of utility-scale solar cut for oversupply, per day (for the calendar's second reading)
for day in days:
    sh = solshare.get(day['d'])
    day['sol'] = round(max(sh) * 100) if sh else 0  # worst hour of the day, % of utility solar cut

out = {
    'builtAt': today.isoformat(),
    'periodo': [d0.isoformat(), d1.isoformat()],
    'horaMin': HOUR_MIN,
    'pr': PR,
    'days': days,
    'emergencias': EMERGENCIAS,
    'regioes': regioes,
}
json.dump(out, open('data/minigeracao.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('data/minigeracao.json written', file=sys.stderr)
