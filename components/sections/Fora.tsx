import { area, line, stack, x as sx } from '@/lib/chart'
import { brDate, dec, fmt, hhmm, hhmmText } from '@/lib/format'
import type { Observatory } from '@/lib/observatory'
import type { Caiso } from '@/lib/sources/abroad'
import { Kicker, Lido, Metodo, ParaVoce, Stamp, Swatch } from '../ui'

const MTL = 'America/Toronto'
const minutes = (hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

function caisoSeries(c: Caiso) {
  const hid = c['Large Hydro'].map((v, i) => v + c['Small hydro'][i])
  const oth = c.Geothermal.map((v, i) => v + c.Biomass[i] + c.Biogas[i] + c.Coal[i] + c.Other[i])
  return [
    { key: 'gas', values: c['Natural Gas'], fill: 'var(--c6)', label: 'gás' },
    { key: 'imp', values: c.Imports, fill: 'var(--c5)', label: 'importação' },
    { key: 'hid', values: hid, fill: 'var(--c1)', label: 'hidro' },
    { key: 'nuc', values: c.Nuclear, fill: 'var(--c4)', label: 'nuclear' },
    { key: 'bat', values: c.Batteries, fill: 'var(--c2)', label: 'baterias' },
    { key: 'eol', values: c.Wind, fill: 'var(--c3)', label: 'eólica' },
    { key: 'sol', values: c.Solar, fill: 'var(--sol)', label: 'solar' },
    { key: 'oth', values: oth, fill: 'var(--c3)', label: 'geotérmica, biomassa' },
  ]
}

function renShare(c: Caiso, i: number) {
  const ren = c.Wind[i] + Math.max(0, c.Solar[i]) + c.Geothermal[i] + c.Biomass[i] + c.Biogas[i] + c['Small hydro'][i]
  const tot = caisoSeries(c).reduce((s, x) => s + Math.max(0, x.values[i]), 0)
  return Math.round((100 * ren) / tot)
}

export default function Fora({ o }: { o: Observatory }) {
  const hq = o.hq
  const n = hq.mw.length
  const hqTicks = [0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n - 1]
  const c = o.caiso
  const last = c.time.length - 1
  const x0 = (minutes(c.time[0]) / 1440) * 720
  const x1 = (minutes(c.time[last]) / 1440) * 720
  const series = caisoSeries(c)
  const yMax = Math.max(45_000, Math.ceil(Math.max(...c.time.map((_, i) => series.reduce((s, x) => s + Math.max(0, x.values[i]), 0))) / 5000) * 5000)
  const bands = stack(series, x0, x1, 20, 200, yMax)
  const bat = c.Batteries[last]
  const hydroNuc = c['Large Hydro'][last] + c['Small hydro'][last] + c.Nuclear[last]
  const noon = c.time.indexOf('12:00')
  const gw = (mw: number) => dec(mw / 1000, 1)

  return (
    <section className="sec" id="fora" aria-labelledby="fora-h">
      <div className="wrap">
        <Kicker n={10}>Lá fora</Kicker>
        <h2 className="h2" id="fora-h">O que outras redes fazem com o mesmo problema.</h2>
        <p className="lede">Duas referências que o laboratório escuta: o Québec, que atravessa a ponta de inverno pagando o consumidor para reduzir carga, e a Califórnia, que atravessa o pôr do sol com baterias.</p>
        <Lido>
          A Hydro-Québec pedia {fmt(hq.now)} MW às {hhmmText(hq.asOf, MTL)} de Montréal — o Brasil pede {dec(o.carga.sinNow / hq.now, 1)} vezes isso, mas o Québec passa de 40 GW nos dias mais frios do inverno. Na Califórnia, às {c.time[last].replace(':', 'h')},{' '}
          {bat >= 0 ? `as baterias entregavam ${gw(bat)} GW${bat > hydroNuc ? ' — mais do que a hidrelétrica e a nuclear juntas' : ''}.` : `as baterias carregavam ${gw(-bat)} GW.`}
          {noon >= 0 && ` Ao meio-dia, o solar sozinho era ${gw(c.Solar[noon])} GW${c.Batteries[noon] < 0 ? ` e carregava ${gw(-c.Batteries[noon])} GW nas baterias` : ''}.`}
        </Lido>
        <div className="g2e">
          <div className="inst">
            <div className="instl">
              <span>Hydro-Québec · demanda · 24 h</span>
              <span>MW</span>
            </div>
            <svg className="svg" viewBox="0 0 720 160" role="img" aria-label={`Demanda do Québec nas últimas 24 horas; agora ${fmt(hq.now)} MW.`}>
              <path d={area(hq.mw, 0, 720, 20, 120, 14000, 20000)} fill="var(--c2)" opacity={0.12} />
              <path d={line(hq.mw, 0, 720, 20, 120, 14000, 20000)} fill="none" stroke="var(--c2)" strokeWidth={1.5} />
              <text className="axl" x={0} y={12}>14–20 GW</text>
              <text className="axl" x={720} y={12} textAnchor="end">{`Montréal ${dec(o.weather.Montréal, 1)} °C`}</text>
              <line x1={0} y1={120} x2={720} y2={120} stroke="var(--line)" />
              {hqTicks.map((i, k) => (
                <text key={k} className="ax" x={sx(i, 0, n - 1, 0, 720)} y={136} textAnchor={k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}>
                  {k === 4 ? `${hhmm(hq.t[i], MTL)} Montréal` : hhmm(hq.t[i], MTL)}
                </text>
              ))}
            </svg>
            <Stamp status={o.status.hq} source="Hydro-Québec demande" when={`${hhmm(hq.asOf, MTL)} Montréal`} cadence="15 min">
              <span className="badge">{hq.lastPeak ? `sem evento de ponta · último em ${brDate(hq.lastPeak)}` : 'sem evento de ponta'}</span>
            </Stamp>
            <Metodo>Demanda total (donnees.hydroquebec.com), de 15 em 15 minutos. Os eventos de ponta (dezembro a março) são publicados no mesmo portal e disparam a resposta da demanda do laboratório (seção 11).</Metodo>
          </div>
          <div className="inst">
            <div className="instl">
              <span>CAISO · Califórnia · geração por fonte</span>
              <span>hoje</span>
            </div>
            <svg className="svg" viewBox="0 0 720 250" role="img" aria-label={`Geração por fonte na Califórnia hoje até ${c.time[last]}; baterias ${gw(bat)} GW.`}>
              {bands.map((b, i) => (
                <path key={b.key} d={b.d} fill={series[i].fill} opacity={b.key === 'oth' ? 0.5 : 0.85} />
              ))}
              <line x1={0} y1={200} x2={720} y2={200} stroke="var(--line)" />
              <line x1={x1} y1={10} x2={x1} y2={200} stroke="var(--ink)" strokeDasharray="3 3" />
              {['00:00', '06:00', '12:00', '18:00', '24:00 hora local'].map((t, i) => (
                <text key={t} className="ax" x={i * 180} y={216} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{t}</text>
              ))}
              <text className="axl" x={0} y={12}>{`0–${yMax / 1000} GW`}</text>
              <text className="axa" x={x1} y={240} textAnchor={x1 > 400 ? 'end' : 'start'}>{`agora ${c.time[last]} · baterias ${gw(bat)} GW`}</text>
            </svg>
            <div className="legend">
              {series.filter((s) => s.key !== 'oth').map((s) => (
                <span key={s.key}>
                  <Swatch color={s.fill} />
                  {s.label}
                </span>
              ))}
            </div>
            <Stamp status={o.status.caiso} source="CAISO Today's Outlook" when={`${c.time[last]} hora local`} cadence="5 min" />
            <Metodo>
              caiso.com/outlook, CSV de 5 em 5 minutos, hora da Califórnia. As bandas empilham só valores positivos; baterias carregando aparecem como consumo e ficam fora da pilha. Renováveis agora {renShare(c, last)} %{noon >= 0 ? `, ao meio-dia ${renShare(c, noon)} %` : ''} (eólica, solar, geotérmica, biomassa, biogás, PCH).
            </Metodo>
          </div>
        </div>
        <ParaVoce label={null}>Por que importa para o Brasil: resposta da demanda e baterias são o que o SIN vai precisar nas pontas de fim de tarde, quando o solar some e a carga fica — o mesmo horário em que o custo marginal sobe na seção 2.</ParaVoce>
      </div>
    </section>
  )
}
