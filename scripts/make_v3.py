"""Derive 'Direção A v3 - Capa escura' from v2: brand palette tokens + dark cover hero with data-drawn light streaks."""
import re

SRC = 'design/Direção A v2 - Observatório.dc.html'
DST = 'design/Direção A v3 - Capa escura.dc.html'
html = open(SRC, encoding='utf-8').read()

# 1. Brand palette (logo sheet): paper F4F1EB · ink 191816 · bronze 8A6737 · teal 236B7A
html = html.replace('--bg:#FBFAF8;--bg2:#F3F0EA;--ink:#1A1917', '--bg:#F4F1EB;--bg2:#ECE8E0;--ink:#191816')
html = html.replace('--acc:#1F5F6B;--acc2:#2F8191;--c1:#1F5F6B;--c2:#8A6A2B', '--acc:#236B7A;--acc2:#2E8798;--c1:#236B7A;--c2:#8A6737')
html = html.replace('--line:#E2DCD3', '--line:#DDD6CA')

# 2. Cover CSS
cover_css = '''          .root .hdr{background:#0B1219;border-bottom:1px solid rgba(255,255,255,0.08)}.root .hdr .brandname{color:#ECE6DA}.root .hdr .brandsub{color:#9AA3A8}.root .hdr a{color:#C9CFD2}.root .hdr .tog{color:#C9CFD2;border-color:rgba(255,255,255,0.2)}
          .cover{--cv-ink:#ECE6DA;--cv-mute:#9AA3A8;--cv-teal:#4FB3C6;--cv-bronze:#D8B370;background:#0B1219;background-image:radial-gradient(1100px 520px at 88% 100%,rgba(138,103,55,0.34),transparent 62%),radial-gradient(800px 420px at 8% 0%,rgba(35,107,122,0.30),transparent 60%),linear-gradient(180deg,#0B1219 0%,#101B25 55%,#17202A 100%);color:var(--cv-ink);position:relative;overflow:hidden}
          .coverin{position:relative;padding:48px 24px 36px 24px;max-width:1040px;margin:0 auto;display:grid;grid-template-columns:minmax(0,6fr) minmax(0,6fr);gap:40px;align-items:start;min-height:600px}
          .cover .lede{max-width:26em}.cover .lido{max-width:28em}
          .cvnums{justify-self:end;text-align:right;padding-top:10px}.cvnums .bignums{grid-template-columns:auto auto auto;justify-content:end;gap:32px}.cvnums .stamp{justify-content:flex-end}.cvnums .met{text-align:left}
          .lock{display:flex;gap:18px;align-items:center;margin-bottom:34px}.lockbar{width:1px;height:64px;background:var(--cv-bronze);opacity:0.7}
          .wm{font-family:"Source Serif 4",Georgia,serif;font-size:40px;letter-spacing:0.32em;line-height:1;color:var(--cv-bronze);font-weight:400}.wms{font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:var(--cv-ink);margin-top:10px;opacity:0.9}
          .cover .kick{color:var(--cv-teal)}.cover .h1{color:var(--cv-ink)}.cover .lede{color:#C9CFD2}.cover .sup{color:var(--cv-mute)}
          .cover .lido{border-left-color:var(--cv-bronze);color:var(--cv-ink)}.cover .lido b{color:var(--cv-bronze)}
          .cover .bnl,.cover .bnu{color:var(--cv-mute)}.cover .bnv{color:var(--cv-ink)}.cover .bnr{color:#C9CFD2}
          .cover .stamp{color:var(--cv-mute)}.cover .dot{background:var(--cv-teal)}.cover .badge{border-color:rgba(255,255,255,0.18);color:var(--cv-mute)}
          .cover .met{color:#C9CFD2}.cover .met summary{color:var(--cv-mute)}
          .streaks{position:absolute;left:0;right:0;bottom:0;height:70%;width:100%;pointer-events:none}
          .scrim{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(11,18,25,0.9) 0%,rgba(11,18,25,0.7) 30%,rgba(11,18,25,0.25) 50%,rgba(11,18,25,0) 62%),linear-gradient(180deg,rgba(11,18,25,0.55) 0%,rgba(11,18,25,0) 40%)}
          .cover .ax{fill:var(--cv-mute)}.cover .axl{fill:#C9CFD2}
          .hojev3{margin-top:0}
          @media (max-width:1240px){.rail{display:none}}
          @media (max-width:760px){.coverin{grid-template-columns:1fr;min-height:0}.wm{font-size:28px}.cvnums{justify-self:start;text-align:left}.cvnums .bignums{justify-content:start}.cvnums .stamp{justify-content:flex-start}}
'''
html = html.replace('          @media (max-width:900px){.rail{display:none}}', cover_css + '          @media (max-width:900px){.rail{display:none}}')

# 3. Replace the Pulso section with the dark cover (section 1 keeps the same holes + two new glow paths)
start = html.index('        <section class="sec" id="pulso"')
end = html.index('        <section class="sec" id="petroleo"')
cover = '''        <section class="cover" id="pulso" data-screen-label="1 Pulso · capa">
          <svg class="streaks" viewBox="0 0 1200 420" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id="glow" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="7"></feGaussianBlur></filter>
              <filter id="glow2" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="2"></feGaussianBlur></filter>
            </defs>
            <filter id="glow3" x="-10%" y="-80%" width="120%" height="260%"><feGaussianBlur stdDeviation="22"></feGaussianBlur></filter>
            <path d="{{ coverSin }}" fill="none" stroke="#2E8798" stroke-width="40" opacity="0.22" filter="url(#glow3)"></path>
            <path d="{{ coverQc }}" fill="none" stroke="#8A6737" stroke-width="40" opacity="0.28" filter="url(#glow3)"></path>
            <sc-for list="{{ strands }}" as="s" hint-placeholder-count="14">
              <path d="{{ s.d }}" fill="none" stroke="{{ s.stroke }}" stroke-width="{{ s.w }}" opacity="{{ s.op }}" filter="{{ s.f }}"></path>
            </sc-for>
            <path d="{{ coverSin }}" fill="none" stroke="#E6FAFF" stroke-width="1.2" opacity="0.95"></path>
            <path d="{{ coverQc }}" fill="none" stroke="#FFF3DA" stroke-width="1.2" opacity="0.95"></path>
          </svg>
          <div class="scrim"></div>
          <div class="coverin">
            <div>
              <div class="lock"><span class="lockbar"></span><div><div class="wm">BRONZE</div><div class="wms">Engenharia de Energia</div></div></div>
              <p class="kick">01 · Pulso · ao vivo</p>
              <h1 class="h1 serif">Engenharia de energia, com dados.</h1>
              <p class="lede serif">Um observatório: instrumentos ligados a dados públicos do setor elétrico e de combustíveis, lidos a cada poucos minutos. As linhas de luz são as cargas do Brasil e do Québec nas últimas 24 horas.</p>
              <p class="lido serif"><b>Lido hoje</b>Às 23h30 em Brasília, o Brasil pedia {{ ratio }} vezes a potência do Québec — e as duas curvas subiam juntas, uma no fim da tarde quente, a outra no início da noite fria.</p>
              <p class="sup">Engenharia registrada no Paraná · laboratório em Montréal · CREA-PR 194835/D</p>
            </div>
            <div class="cvnums">
              <div class="bignums">
                <div class="bn"><span class="bnl">SIN · Brasil</span><span class="bnv mono">{{ sinNow }}<span class="bnu">MW</span></span></div>
                <div class="bn"><span class="bnl">Hydro-Québec</span><span class="bnv mono">{{ qcNow }}<span class="bnu">MW</span></span></div>
                <div class="bn"><span class="bnl">razão</span><span class="bnr mono">× {{ ratio }}</span></div>
              </div>
              <div class="stamp"><span class="live"><span class="dot"></span>ONS carga verificada · 23:30 BRT · 30 min</span><span>Hydro-Québec demande · 22:00 EDT · 15 min</span><span class="badge">sem evento de ponta HQ · último em {{ hqPeak }}</span></div>
              <details class="met"><summary>Método</summary><p>Brasil: carga verificada por subsistema (apicarga.ons.org.br), somada; ~30 min de atraso, meia em meia hora. Québec: demanda total (donnees.hydroquebec.com), 15 min. As duas linhas partilham o eixo de tempo em UTC (02:30 → 02:30); a azul-petróleo é o SIN (70–105 GW), a bronze é o Québec (14–20 GW). Curitiba 14,8 °C · Montréal 18,0 °C.</p></details>
            </div>
          </div>
        </section>

'''
html = html[:start] + cover + html[end:]

# 4. Move the "Hoje" strip below the cover (it reads better as the first thing after the picture)
hoje_start = html.index('        <div class="hoje">')
hoje_end = html.index('        <nav class="rail">')
hoje = html[hoje_start:hoje_end]
html = html[:hoje_start] + html[hoje_end:]
html = html.replace('        <section class="sec" id="petroleo"', hoje + '        <section class="sec" id="petroleo"', 1)

# 5. Extra holes for the streaks (y ranges chosen so the two trails cross like the reference image)
html = html.replace(
    '            sources: sources\n',
    '            coverSin: C.smooth(D.sin, -40, 1240, 60, 300, 70000, 105000, 0.9), coverQc: C.smooth(D.quebec, -40, 1240, 180, 420, 14000, 20000, 0.9),\n'
    '            strands: (function () { var out = []; var mk = function (vals, yMin, yMax, top, bot, col, colHi) {\n'
    '              [[-30, 0.10, 1], [-18, 0.18, 1], [-9, 0.30, 1.2], [0, 0.85, 3.2, "url(#glow2)", colHi], [8, 0.32, 1.2], [18, 0.18, 1], [30, 0.10, 1]].forEach(function (k) {\n'
    '                out.push({ d: C.smooth(vals, -40, 1240, top + k[0], bot + k[0], yMin, yMax, 0.9), stroke: k[4] || col, w: String(k[2]), op: String(k[1]), f: k[3] || "none" }); }); };\n'
    '              mk(D.sin, 70000, 105000, 60, 300, "#4FB3C6", "#7FD3E2"); mk(D.quebec, 14000, 20000, 180, 420, "#D8B370", "#F0D39A"); return out; })(),\n'
    '            sources: sources\n')

# 6. Brand marks (brand/*.svg, currentColor) inlined: icon-min in the masthead, icon in the cover lockup, favicon in <head>
import pathlib
def inline_svg(name, cls):
    s = pathlib.Path('brand', name).read_text().strip()
    s = re.sub(r'^<svg[^>]*>', f'<svg class="{cls}" viewBox="%s" aria-hidden="true">' % re.search(r'viewBox="([^"]*)"', s).group(1), s)
    return s.replace(' />', '></path>').replace('/>', '></path>')
html = html.replace('<div class="brand"><span class="brandname serif">Bronze Engenharia</span>',
                    '<div class="brand"><span class="hmark">' + inline_svg('bronze-icon-min.svg', 'msvg') + '</span><span class="brandname serif">Bronze Engenharia</span>')
html = html.replace('<div class="lock"><span class="lockbar"></span>',
                    '<div class="lock"><span class="lockmark">' + inline_svg('bronze-icon.svg', 'msvg') + '</span>')
html = html.replace('        <script src="./helpers.js"></script>',
                    '        <link rel="icon" type="image/svg+xml" href="./favicon.svg" />\n        <script src="./helpers.js"></script>')
html = html.replace('          .hojev3{margin-top:0}',
                    '          .hmark{display:inline-flex;align-items:center;margin-right:10px;color:#D8B370}.hmark .msvg{height:24px;width:auto;display:block}\n'
                    '          .lockmark{display:inline-flex;color:var(--cv-bronze)}.lockmark .msvg{height:96px;width:auto;display:block}\n'
                    '          .lock{align-items:center;gap:14px}\n'
                    '          .hojev3{margin-top:0}')
open(DST, 'w', encoding='utf-8').write(html)
print(DST, len(html), 'bytes')
