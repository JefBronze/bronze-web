"""Build data/usinas.json for section 4, "Quem gera" (stdlib only).

- plants: the largest plants in operation (top by capacity, plus every thermal of 300 MW or more), from ONS
  "capacidade de geração" (one row per generating unit, potência efetiva in MW), grouped by CEG.
- coordinates: Wikidata (P625), matched by name, then by an explicit item id where the names differ. Plants that
  share a site with another (GNA II, Angra 1 and 2, Maranhão III–V) take the site's coordinates. The few with no
  Wikidata location take their municipality's centroid (IBGE) and are marked approximate.
- map: IBGE state outlines (malha, qualidade mínima), projected to SVG paths and simplified.

Downloads are cached in .cache/usinas/ (git-ignored); delete it to refresh.
"""
import csv
import gzip
import io
import json
import math
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request

S3 = 'https://ons-aws-prod-opendata.s3.amazonaws.com/dataset'
UA = {'User-Agent': 'data-joule-observatorio/0.1 (+https://data-joule.com)'}
CACHE = '.cache/usinas'
os.makedirs(CACHE, exist_ok=True)

TOP_N = 40           # largest plants of any source
THERMAL_MIN_MW = 300  # plus every thermal (and nuclear) plant at least this large


def get(url, name=None, timeout=120):
    path = os.path.join(CACHE, name) if name else None
    if path and os.path.exists(path):
        return open(path, 'rb').read()
    data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()
    if data[:2] == b'\x1f\x8b':  # IBGE answers gzip without being asked
        data = gzip.decompress(data)
    if path:
        open(path, 'wb').write(data)
    return data


def norm(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'\b(usina|hidreletrica|hidroeletrica|termeletrica|termoeletrica|termica|nuclear|eolica|solar|fotovoltaica'
               r'|complexo|de|do|da|uhe|ute|ugn|us|parque|central|energia|i)\b', ' ', s)
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


# ---------- plants ---------------------------------------------------------------------------------------

TIPO = {'HIDROELÉTRICA': 'hid', 'TÉRMICA': 'ter', 'NUCLEAR': 'nuc', 'EOLIELÉTRICA': 'eol', 'FOTOVOLTAICA': 'sol'}
plants = {}
for r in csv.DictReader(io.StringIO(get(f'{S3}/capacidade-geracao/CAPACIDADE_GERACAO.csv', 'capacidade.csv').decode('utf-8-sig')), delimiter=';'):
    if r['dat_desativacao'].strip():
        continue
    ceg = r['ceg'].strip()
    key = ceg or r['nom_usina'].strip()
    p = plants.setdefault(key, {'ceg': ceg, 'ons': r['nom_usina'].strip(), 'tipo': TIPO.get(r['nom_tipousina'].strip(), 'out'),
                                'comb': r['nom_combustivel'].strip(), 'uf': r['id_estado'].strip(), 'sub': r['id_subsistema'].strip(), 'mw': 0.0})
    p['mw'] += float(r['val_potenciaefetiva'] or 0)

# Itaipu: the registry lists the 50 Hz half under Paraguay, under one CEG with the 60 Hz half; it is one plant on the border.
for p in plants.values():
    if p['ons'].startswith('ITAIPU'):
        p['ons'], p['uf'] = 'ITAIPU', 'PR'

ranked = sorted(plants.values(), key=lambda p: -p['mw'])
chosen = ranked[:TOP_N] + [p for p in ranked[TOP_N:] if p['tipo'] in ('ter', 'nuc') and p['mw'] >= THERMAL_MIN_MW]
print(len(plants), 'plants in operation;', len(chosen), 'on the map', file=sys.stderr)

# ---------- coordinates ----------------------------------------------------------------------------------

Q = """SELECT ?p ?pLabel ?alt ?coord WHERE {
  ?p wdt:P31/wdt:P279* wd:Q159719; wdt:P17 wd:Q155; wdt:P625 ?coord.
  OPTIONAL { ?p skos:altLabel ?alt FILTER(lang(?alt) in ('pt','en')) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "pt,en". }
}"""
wd = json.loads(get('https://query.wikidata.org/sparql?format=json&query=' + urllib.parse.quote(Q), 'wikidata.json'))['results']['bindings']
by_label = {}
for x in wd:
    lon, lat = map(float, x['coord']['value'][6:-1].split())
    qid = x['p']['value'].rsplit('/', 1)[1]
    for lab in (x['pLabel']['value'], x.get('alt', {}).get('value', '')):
        if lab:
            by_label.setdefault(norm(lab), (qid, lat, lon))

# ONS name -> Wikidata item id (or its exact label), where the names differ or the plant sits inside a complex.
WD_ITEM = {
    'ITAIPU': 'Q244169',
    'GOV. BENTO MUNHOZ': 'Usina Hidrelétrica de Foz do Areia',
    'GOV. NEY BRAGA': 'Q3434883',         # Segredo
    'GOV. JOSÉ RICHA': 'Q1630139',        # Salto Caxias
    'THEODOMIRO CARNEIRO SANTIAGO (EMBORCAÇÃO)': 'Q1335053',
    'HENRY BORDEN EXTERNA': 'Q20059654',
    'LUIZ CARLOS BARRETO': 'Q10388374',   # Wikidata labels it plain "Estreito" (Rio Grande)
    'ANGRA I': 'Q740586',                 # Central Nuclear Almirante Álvaro Alberto
    'ANGRA II': 'Q740586',
    'PORTO DO PECÉM I': 'Q10388459',
    'PORTO DO PECÉM II': 'Q106548235',
    'MARANHÃO III': 'Q51882607',          # Complexo Termelétrico Parnaíba
    'MARANHÃO IV': 'Q51882607',
    'MARANHÃO V': 'Q51882607',
    'PARNAÍBA V': 'Q51882607',
    'NOVA PIRATININGA': 'Q20061650',      # same site as Piratininga
    'CANDIOTA III': 'Q10388457',          # Presidente Médici, Candiota
    'TERMO NORTE II': 'Q12005583',
    'JORGE LACERDA C': 'Q18478373',       # Complexo Jorge Lacerda
    'JORGE LACERDA B': 'Q18478373',
    'JORGE LACERDA A': 'Q18478373',
}
# Same site as another plant on this list (ONS name -> ONS name).
SAME_SITE = {'GNA II': 'GNA I'}
# No location in Wikidata: municipality centroid (IBGE code), shown as approximate.
MUNICIPIO = {
    # Estreito on the Tocantins: by name it would match the Rio Grande plant above, so pin it to its town.
    'ESTREITO': ('Estreito (MA)', '2104057'),
    'NORTE FLUMINENSE': ('Macaé', '3302403'),
    'MARLIM AZUL': ('Macaé', '3302403'),
    'NOVO TEMPO BARCARENA': ('Barcarena', '1501303'),
    'ARAUCÁRIA': ('Araucária', '4101804'),
    'BRACELL': ('Lençóis Paulista', '3526803'),
    'SUZANO': ('Ribas do Rio Pardo', '5007109'),  # unit entered operation in 2024: the Ribas do Rio Pardo mill
    'KLABIN CELULOSE': ('Ortigueira', '4117305'),
}


def wd_item(qid):
    ent = json.loads(get(f'https://www.wikidata.org/wiki/Special:EntityData/{qid}.json', f'{qid}.json'))['entities'][qid]
    v = ent['claims']['P625'][0]['mainsnak']['datavalue']['value']
    return v['latitude'], v['longitude']


def centroid(code):
    gj = json.loads(get(f'https://servicodados.ibge.gov.br/api/v3/malhas/municipios/{code}?formato=application/vnd.geo%2Bjson&qualidade=minima', f'mun-{code}.json'))
    geom = gj['features'][0]['geometry']
    rings = [geom['coordinates'][0]] if geom['type'] == 'Polygon' else [poly[0] for poly in geom['coordinates']]
    pts = [pt for ring in rings for pt in ring]
    return sum(p[1] for p in pts) / len(pts), sum(p[0] for p in pts) / len(pts)


located = {}
missing = []
for p in chosen:
    n = p['ons']
    if n in WD_ITEM and not WD_ITEM[n].startswith('Q'):
        qid, p['lat'], p['lon'] = by_label[norm(WD_ITEM[n])]
        p['loc'] = f'wikidata:{qid}'
    elif n in WD_ITEM:
        p['lat'], p['lon'] = wd_item(WD_ITEM[n])
        p['loc'] = f'wikidata:{WD_ITEM[n]}'
    elif n in MUNICIPIO:
        nome, code = MUNICIPIO[n]
        p['lat'], p['lon'] = centroid(code)
        p['loc'] = f'municipio:{nome}'
    elif norm(n) in by_label:
        qid, p['lat'], p['lon'] = by_label[norm(n)]
        p['loc'] = f'wikidata:{qid}'
    elif n not in SAME_SITE:
        missing.append(n)
        continue
    located[n] = p
for n, other in SAME_SITE.items():
    p = next((q for q in chosen if q['ons'] == n), None)
    if p and other in located:
        p['lat'], p['lon'], p['loc'] = located[other]['lat'], located[other]['lon'], located[other]['loc']
if missing:
    sys.exit(f'no location for: {missing} — add them to WD_ITEM or MUNICIPIO')

# Sanity: every point inside Brazil's bounding box.
for p in chosen:
    assert -34 < p['lat'] < 5.5 and -74 < p['lon'] < -34, (p['ons'], p['lat'], p['lon'])

# ---------- names for the page ---------------------------------------------------------------------------

SMALL = {'de', 'da', 'do', 'das', 'dos', 'e'}
DISPLAY = {
    'THEODOMIRO CARNEIRO SANTIAGO (EMBORCAÇÃO)': 'Emborcação',
    'GOV. BENTO MUNHOZ': 'Foz do Areia',
    'GOV. NEY BRAGA': 'Segredo',
    'GOV. JOSÉ RICHA': 'Salto Caxias',
    'LUIZ CARLOS BARRETO': 'Estreito (L. C. Barreto)',
    'HENRY BORDEN EXTERNA': 'Henry Borden',
    'ANGRA I': 'Angra 1',
    'ANGRA II': 'Angra 2',
}


def pretty(n):
    if n in DISPLAY:
        return DISPLAY[n]
    out = []
    for i, w in enumerate(n.split()):
        lw = w.lower()
        if re.fullmatch(r'[ivx]+', lw) or re.fullmatch(r'[A-Z]{2,4}', w) and w in ('GNA', 'UTE'):
            out.append(w.upper())
        elif lw in SMALL and i:
            out.append(lw)
        else:
            out.append(lw[:1].upper() + lw[1:])
    return ' '.join(out)


# ---------- map --------------------------------------------------------------------------------------------

LON0, LAT0, LAT_REF = -74.2, 5.4, -15.0
K = 16.0  # px per degree of latitude
KX = K * math.cos(math.radians(LAT_REF))


def proj(lon, lat):
    return (lon - LON0) * KX, (LAT0 - lat) * K


def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    dx, dy = x1 - x0, y1 - y0
    den = math.hypot(dx, dy) or 1e-9
    i, dmax = 0, 0.0
    for j in range(1, len(pts) - 1):
        d = abs(dy * pts[j][0] - dx * pts[j][1] + x1 * y0 - y1 * x0) / den
        if d > dmax:
            i, dmax = j, d
    if dmax <= tol:
        return [pts[0], pts[-1]]
    return simplify(pts[: i + 1], tol)[:-1] + simplify(pts[i:], tol)


UF_CODE = {11: 'RO', 12: 'AC', 13: 'AM', 14: 'RR', 15: 'PA', 16: 'AP', 17: 'TO', 21: 'MA', 22: 'PI', 23: 'CE', 24: 'RN', 25: 'PB', 26: 'PE',
           27: 'AL', 28: 'SE', 29: 'BA', 31: 'MG', 32: 'ES', 33: 'RJ', 35: 'SP', 41: 'PR', 42: 'SC', 43: 'RS', 50: 'MS', 51: 'MT', 52: 'GO', 53: 'DF'}
gj = json.loads(get('https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=minima&intrarregiao=UF', 'br-uf.json'))
ufs = []
for f in gj['features']:
    code = int(f['properties']['codarea'])
    geom = f['geometry']
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    d = ''
    for poly in polys:
        pts = [proj(*pt) for pt in poly[0]]
        # A closed ring starts and ends on the same point: split it at the farthest point and simplify each half.
        far = max(range(len(pts)), key=lambda j: math.dist(pts[0], pts[j]))
        ring = simplify(pts[: far + 1], 0.6)[:-1] + simplify(pts[far:], 0.6)
        if len(ring) < 4:
            continue
        d += 'M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in ring) + 'Z'
    ufs.append({'uf': UF_CODE[code], 'd': d})
W, H = proj(-34.6, -33.9)


def inside(lon, lat, ring):
    hit = False
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        if (y0 > lat) != (y1 > lat) and lon < x0 + (lat - y0) * (x1 - x0) / (y1 - y0):
            hit = not hit
    return hit


# Every plant must sit in the state ONS lists it under, give or take a river's width (border dams such as Itaipu).
uf_rings = {}
for f in gj['features']:
    geom = f['geometry']
    polys = [geom['coordinates']] if geom['type'] == 'Polygon' else geom['coordinates']
    uf_rings[UF_CODE[int(f['properties']['codarea'])]] = [poly[0] for poly in polys]
for p in chosen:
    rings = uf_rings[p['uf']]
    if any(inside(p['lon'], p['lat'], r) for r in rings):
        continue
    gap = min(math.dist((p['lon'], p['lat']), pt) for r in rings for pt in r)
    if gap > 0.25:
        sys.exit(f"{p['ons']} ({p['loc']}) is {gap:.2f}° outside {p['uf']}")
out_plants = []
for p in chosen:
    x, y = proj(p['lon'], p['lat'])
    out_plants.append({'ceg': p['ceg'], 'ons': p['ons'], 'nome': pretty(p['ons']), 'tipo': p['tipo'], 'comb': p['comb'], 'uf': p['uf'], 'sub': p['sub'],
                       'mw': round(p['mw']), 'x': round(x, 1), 'y': round(y, 1), 'loc': p['loc']})
json.dump({'map': {'w': round(W), 'h': round(H), 'ufs': ufs}, 'plants': out_plants,
           'total': {t: round(sum(p['mw'] for p in plants.values() if p['tipo'] == t)) for t in ('hid', 'ter', 'nuc', 'eol', 'sol')}},
          open('data/usinas.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('data/usinas.json written;', sum(len(u['d']) for u in ufs) // 1000, 'kB of outline', file=sys.stderr)
