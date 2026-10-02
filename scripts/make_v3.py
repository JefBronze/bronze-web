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
cover_css = '''          .cover{--cv-ink:#ECE6DA;--cv-mute:#9AA3A8;--cv-teal:#4FB3C6;--cv-bronze:#D8B370;background:#0F1821;background-image:radial-gradient(900px 420px at 85% 110%,rgba(138,103,55,0.38),transparent 60%),radial-gradient(700px 360px at 10% 0%,rgba(35,107,122,0.35),transparent 60%),linear-gradient(180deg,#0B1219 0%,#14202A 60%,#1A2129 100%);color:var(--cv-ink);position:relative;overflow:hidden}
          .coverin{position:relative;padding:56px 24px 40px 24px;max-width:1040px;margin:0 auto;display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:40px;align-items:end}
          .lock{display:flex;gap:18px;align-items:center;margin-bottom:34px}.lockbar{width:1px;height:64px;background:var(--cv-bronze);opacity:0.7}
          .wm{font-family:"Source Serif 4",Georgia,serif;font-size:40px;letter-spacing:0.32em;line-height:1;color:var(--cv-bronze);font-weight:400}.wms{font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:var(--cv-ink);margin-top:10px;opacity:0.9}
          .cover .kick{color:var(--cv-teal)}.cover .h1{color:var(--cv-ink)}.cover .lede{color:#C9CFD2}.cover .sup{color:var(--cv-mute)}
          .cover .lido{border-left-color:var(--cv-bronze);color:var(--cv-ink)}.cover .lido b{color:var(--cv-bronze)}
          .cover .bnl,.cover .bnu{color:var(--cv-mute)}.cover .bnv{color:var(--cv-ink)}.cover .bnr{color:#C9CFD2}
          .cover .stamp{color:var(--cv-mute)}.cover .dot{background:var(--cv-teal)}.cover .badge{border-color:rgba(255,255,255,0.18);color:var(--cv-mute)}
          .cover .met{color:#C9CFD2}.cover .met summary{color:var(--cv-mute)}
          .streaks{position:absolute;left:0;right:0;bottom:0;height:62%;width:100%;pointer-events:none}
          .scrim{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(11,18,25,0.94) 0%,rgba(11,18,25,0.82) 34%,rgba(11,18,25,0.35) 52%,rgba(11,18,25,0) 66%)}
          .cover .ax{fill:var(--cv-mute)}.cover .axl{fill:#C9CFD2}
          .hojev3{margin-top:0}
          @media (max-width:760px){.coverin{grid-template-columns:1fr}.wm{font-size:28px}}
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
            <path d="{{ coverSin }}" fill="none" stroke="#2E8798" stroke-width="16" opacity="0.35" filter="url(#glow)"></path>
            <path d="{{ coverSin }}" fill="none" stroke="#4FB3C6" stroke-width="3" opacity="0.8" filter="url(#glow2)"></path>
            <path d="{{ coverSin }}" fill="none" stroke="#DDF6FA" stroke-width="1" opacity="0.9"></path>
            <path d="{{ coverSin2 }}" fill="none" stroke="#4FB3C6" stroke-width="1" opacity="0.35"></path>
            <path d="{{ coverSin3 }}" fill="none" stroke="#4FB3C6" stroke-width="1" opacity="0.18"></path>
            <path d="{{ coverQc }}" fill="none" stroke="#8A6737" stroke-width="16" opacity="0.4" filter="url(#glow)"></path>
            <path d="{{ coverQc }}" fill="none" stroke="#D8B370" stroke-width="3" opacity="0.85" filter="url(#glow2)"></path>
            <path d="{{ coverQc }}" fill="none" stroke="#FFF1D6" stroke-width="1" opacity="0.9"></path>
            <path d="{{ coverQc2 }}" fill="none" stroke="#D8B370" stroke-width="1" opacity="0.35"></path>
            <path d="{{ coverQc3 }}" fill="none" stroke="#D8B370" stroke-width="1" opacity="0.18"></path>
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
            <div>
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
    '            coverSin: C.line(D.sin, 0, 1200, 40, 300, 70000, 105000), coverSin2: C.line(D.sin, 0, 1200, 52, 312, 70000, 105000), coverSin3: C.line(D.sin, 0, 1200, 66, 326, 70000, 105000),\n'
    '            coverQc: C.line(D.quebec, 0, 1200, 150, 400, 14000, 20000), coverQc2: C.line(D.quebec, 0, 1200, 162, 412, 14000, 20000), coverQc3: C.line(D.quebec, 0, 1200, 176, 426, 14000, 20000),\n'
    '            sources: sources\n')

open(DST, 'w', encoding='utf-8').write(html)
print(DST, len(html), 'bytes')
