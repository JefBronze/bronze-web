"""Derive site-ready marks from the master monogram (Identidade Visual/bronze-b-monogram.svg).

Outputs (brand/):
  bronze-mark.svg      master geometry, colour → currentColor (header at ≥ 40 px, OG card, print)
  bronze-icon.svg      square canvas, hairlines ×6, nodes kept (header mark 24–40 px, app icon)
  bronze-icon-min.svg  square canvas, B + spine + nodes only (favicon 16–32 px)
  favicon.svg          icon-min on the paper tile with the brand bronze, for the browser tab
and design/Marca - tamanhos.html, a size test page.
"""
import re, pathlib

SRC = pathlib.Path('/Users/jeferson/Documents/Projects/BronzeEngenharia/Identidade Visual/bronze-b-monogram.svg')
OUT = pathlib.Path('brand'); OUT.mkdir(exist_ok=True)
BRONZE = '#8A6737'

src = SRC.read_text()
paths = re.findall(r'<path[^>]*/>', src)
# master geometry lives in viewBox 138 116 380 460 with a translate(-25 0); content x 161..496 (after shift), y 146..562.
# Square canvas around the B incl. construction: x 160..500 → 340 wide; y 130..570 → 440 tall → use 460×460 box centred.
SQUARE = 'viewBox="100 94 460 460"'  # (330±230, 324±230) after the -25 shift → in untransformed coords: cx 355, cy 324 → 125..585? keep translate and compute below


def recolour(p):
    return p.replace(f'fill="{BRONZE}"', 'fill="currentColor"').replace(f'stroke="{BRONZE}"', 'stroke="currentColor"')


def scale_stroke(p, k, floor):
    def rep(m):
        w = float(m.group(1)) * k
        return f'stroke-width="{max(w, floor):.1f}"'
    return re.sub(r'stroke-width="([^"]*)"', rep, p)


def wrap(body, viewbox, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" {viewbox} role="img" aria-label="{title}">'
            f'<g transform="translate(-25 0)">{body}</g></svg>\n')


# 0. master, recoloured
master = re.sub(r'(fill|stroke)="#8A6737"', r'\1="currentColor"', src)
(OUT / 'bronze-mark.svg').write_text(master)

# geometry in transformed coords: B spine at x=220 (→195), right edge 521 (→496); top 146, bottom 562.
# centre ≈ (345, 354) in transformed space → untransformed (370, 354). Square 480 → viewBox x 130..610, y 114..594.
sq = 'viewBox="130 114 480 480" width="480" height="480"'

# 1. icon: every hairline ×6 (min 5), keep everything
icon = ''.join(recolour(scale_stroke(p, 6, 5)) for p in paths)
(OUT / 'bronze-icon.svg').write_text(wrap(icon, sq, 'Bronze'))

# 2. icon-min: filled B (7), spine (8) and the three nodes (9,10,11); spine thickened
keep = [7, 8, 9, 10, 11]
icon_min = ''.join(recolour(scale_stroke(paths[i], 2.2, 10)) for i in keep)
(OUT / 'bronze-icon-min.svg').write_text(wrap(icon_min, sq, 'Bronze'))

# 2b. icon-bold: icon-min with the B outline stroked (+9 units) so the thin Didone strokes survive 16–24 px
bold_b = recolour(paths[7]).replace('fill="currentColor"', 'fill="currentColor" stroke="currentColor" stroke-width="9" stroke-linejoin="round"')
icon_bold = bold_b + ''.join(recolour(scale_stroke(paths[i], 2.2, 12)) for i in [8, 9, 10, 11])
(OUT / 'bronze-icon-bold.svg').write_text(wrap(icon_bold, 'viewBox="160 124 440 440" width="440" height="440"', 'Bronze'))

# 3. favicon: icon-bold in brand bronze on the paper tile, tight padding
fav = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
       f'<rect width="64" height="64" rx="12" fill="#F4F1EB"/>'
       f'<svg x="5" y="5" width="54" height="54" viewBox="160 124 440 440" color="{BRONZE}"><g transform="translate(-25 0)">{icon_bold}</g></svg></svg>\n')
(OUT / 'favicon.svg').write_text(fav)

# 4. size test page: one <symbol> per variant, referenced with <use> (keeps the page small enough for a data: URL)
variants = {'icon': ('bronze-icon.svg', sq.split(' width')[0]), 'min': ('bronze-icon-min.svg', sq.split(' width')[0]),
            'bold': ('bronze-icon-bold.svg', 'viewBox="160 124 440 440"'), 'fav': ('favicon.svg', 'viewBox="0 0 64 64"')}
symbols = ''
for key, (name, vb) in variants.items():
    s = (OUT / name).read_text().strip()
    inner = re.sub(r'^(<\?xml[^>]*>\s*)?<svg[^>]*>', '', s)[:-len('</svg>')]
    symbols += f'<symbol id="{key}" {vb}>{inner}</symbol>'
sizes = [16, 24, 32, 48, 96, 240]
rows = ''
for key, (name, vb) in variants.items():
    ratio = 380 / 460 if key == 'mark' else 1
    for bg, col in [('#F4F1EB', BRONZE), ('#0B1219', '#D8B370')]:
        cells = ''.join(f'<div class="cell"><svg width="{s * ratio:.0f}" height="{s}"><use href="#{key}"/></svg><span>{s}</span></div>' for s in sizes)
        rows += f'<div class="row" style="background:{bg};color:{col}"><b>{name}</b>{cells}</div>'
html = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Marca · tamanhos</title>
<style>body{{margin:0;font:13px "Fragment Mono",monospace}}.row{{display:flex;align-items:flex-end;gap:36px;padding:28px 32px;border-bottom:1px solid rgba(128,128,128,.25)}}
.row b{{width:170px;font-weight:400;opacity:.7;align-self:center}}.cell{{display:flex;flex-direction:column;align-items:center;gap:8px}}.cell svg{{display:block}}.cell span{{opacity:.55;font-size:11px}}</style></head>
<body><svg width="0" height="0" style="position:absolute">{symbols}</svg>{rows}</body></html>'''
pathlib.Path('design/Marca - tamanhos.html').write_text(html)
print('wrote', [p.name for p in OUT.iterdir()], 'and design/Marca - tamanhos.html')
