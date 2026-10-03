import { line, stack, x as sx } from '@/lib/chart'
import { ddmm, dec, fmt, hhmm, hhmmText, isoDay } from '@/lib/format'
import type { Observatory } from '@/lib/observatory'
import { AREAS, type Area } from '@/lib/sources/ons'
import { Kicker, Lido, Metodo, Stamp, Swatch } from '../ui'

const AREA_FILL: Record<Area, string> = { SECO: 'var(--c1)', S: 'var(--c2)', NE: 'var(--c3)', N: 'var(--c4)' }
const AREA_LABEL: Record<Area, string> = { SECO: 'SE/CO', S: 'S', NE: 'NE', N: 'N' }

export default function Pulso({ o }: { o: Observatory }) {
  const c = o.carga
  const n = c.t.length
  const peak = Math.max(...c.sin)
  const peakAt = c.t[c.sin.indexOf(peak)]
  const yMax = Math.max(105_000, Math.ceil(peak / 5000) * 5000 + 5000)
  const bands = stack(AREAS.map((a) => ({ key: a, values: c.byArea[a] })), 0, 720, 20, 200, yMax)
  const share = (a: Area) => Math.round((100 * c.now[a]) / c.sinNow)
  const ticks = [0, 12, 24, 36, n - 1].filter((i) => i < n)
  const twoDays = isoDay(c.t[0]) !== isoDay(c.t[n - 1])

  return (
    <section className="sec" id="pulso" aria-labelledby="pulso-h">
      <div className="wrap g2">
        <div>
          <Kicker n={1}>Pulso · ao vivo</Kicker>
          <h1 className="h1" id="pulso-h">Engenharia de energia, com dados.</h1>
          <p className="lede">
            Este site é um observatório do setor elétrico e dos combustíveis no Brasil: instrumentos ligados a dados públicos, lidos a cada poucos minutos. Cada número cita a fonte e a hora.
          </p>
          <Lido>
            Às {hhmmText(c.asOf)} em Brasília, o país pedia {fmt(c.sinNow)} MW: {share('SECO')} % no Sudeste/Centro-Oeste, {share('NE')} % no Nordeste, {share('S')} % no Sul e {share('N')} % no Norte. O pico das últimas 24 horas foi às {hhmmText(peakAt)}, com {fmt(peak)} MW.
          </Lido>
          <p className="sup">Engenharia registrada no Paraná · laboratório em Montréal · CREA-PR 194835/D</p>
        </div>
        <div className="inst">
          <div className="bignums">
            <div className="bn">
              <span className="bnl">SIN · carga agora</span>
              <span className="bnv">{fmt(c.sinNow)}<span className="bnu">MW</span></span>
            </div>
            <div className="bn">
              <span className="bnl">Sudeste / Centro-Oeste</span>
              <span className="bnv">{fmt(c.now.SECO)}<span className="bnu">MW</span></span>
            </div>
            <div className="bn">
              <span className="bnl">pico em 24 h</span>
              <span className="bnr">{fmt(peak)} MW</span>
            </div>
          </div>
          <svg className="svg" viewBox="0 0 720 240" role="img" aria-label={`Carga das últimas 24 horas no Brasil, empilhada por subsistema; agora ${fmt(c.sinNow)} MW.`}>
            {bands.map((b) => (
              <path key={b.key} d={b.d} fill={AREA_FILL[b.key]} opacity={0.75} />
            ))}
            <path d={line(c.sin, 0, 720, 20, 200, 0, yMax)} fill="none" stroke="var(--ink)" strokeWidth={1.2} />
            <text className="axl" x={0} y={12}>{`0–${yMax / 1000} GW · carga verificada por subsistema`}</text>
            <text className="axl" x={720} y={12} textAnchor="end">{`Curitiba ${dec(o.weather.Curitiba, 1)} °C`}</text>
            <line x1={0} y1={200} x2={720} y2={200} stroke="var(--line)" />
            {ticks.map((i, k) => (
              <text key={i} className="ax" x={sx(i, 0, n - 1, 0, 720)} y={216} textAnchor={k === 0 ? 'start' : k === ticks.length - 1 ? 'end' : 'middle'}>
                {k === ticks.length - 1 ? `${hhmm(c.t[i])} BRT` : hhmm(c.t[i])}
              </text>
            ))}
            {twoDays && <text className="ax" x={0} y={232}>{ddmm(c.t[0])}</text>}
            {twoDays && <text className="ax" x={720} y={232} textAnchor="end">{ddmm(c.t[n - 1])}</text>}
          </svg>
          <div className="legend">
            {AREAS.map((a) => (
              <span key={a}>
                <Swatch color={AREA_FILL[a]} />
                {AREA_LABEL[a]} {fmt(c.now[a])}
              </span>
            ))}
            <span>MW · {hhmm(c.asOf)}</span>
          </div>
          <Stamp status={o.status.ons} source="ONS carga verificada" when={`${hhmm(c.asOf)} BRT`} cadence="30 min">
            <span>apicarga.ons.org.br · 4 áreas de carga</span>
          </Stamp>
          <Metodo>
            Carga verificada por subsistema (apicarga.ons.org.br), publicada com cerca de 30 min de atraso, de meia em meia hora; as quatro áreas (SE/CO, S, NE, N) empilhadas somam o SIN. Horas em Brasília. A API devolve zero para meias-horas ainda não verificadas; esses pontos são descartados, não desenhados.
          </Metodo>
        </div>
      </div>
    </section>
  )
}
