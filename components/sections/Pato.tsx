import { scale } from '@/lib/chart'
import { CUT_REASON, curtailStats, duckStats, ITAIPU_MW, netLoad, slotText } from '@/lib/derive'
import { dec, ddmm, fmt, monthLabel, pct } from '@/lib/format'
import type { Observatory } from '@/lib/observatory'
import { BRONZE_URL, Kicker, Lido, Metodo, ParaVoce, Stamp, Swatch, Todo } from '../ui'

const W = 680
/** Width of the half-column charts (3b, 3c): narrower viewBox, same 11 px labels. */
const W2 = 400
const COLOR = { hid: 'var(--c1)', ter: 'var(--c4)', eol: 'var(--c3)', sol: 'var(--sol)', net: 'var(--ink)', carga: 'var(--ink2)', old: 'var(--c5)' }
const REASON_FILL: Record<string, string> = { ENE: 'var(--c2)', CNF: 'var(--c4)', REL: 'var(--c1)', PAR: 'var(--c5)' }

const f = (n: number) => n.toFixed(1)
const gw = (mw: number, digits = 1) => dec(mw / 1000, digits)
const hourText = (h: number) => slotText(h * 2)
const minuteOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** Polyline and band with explicit x positions (today's series ends wherever "now" is). */
function pathXY(xs: number[], ys: number[]) {
  return ys.map((y, i) => `${i ? 'L' : 'M'}${f(xs[i])} ${f(y)}`).join('')
}
function bandXY(xs: number[], lo: number[], hi: number[]) {
  let d = pathXY(xs, hi)
  for (let i = lo.length - 1; i >= 0; i--) d += `L${f(xs[i])} ${f(lo[i])}`
  return `${d}Z`
}

function dayWord(o: Observatory, day: string) {
  const ms = new Date(`${day}T12:00:00-03:00`).getTime()
  const today = new Date(o.renderedAt).getTime()
  const days = Math.round((today - ms) / 86_400_000)
  return days === 1 ? 'Ontem' : days === 2 ? 'Anteontem' : `Em ${ddmm(`${day}T15:00:00Z`)}`
}

function Axis({ y0, w = W, labels = true }: { y0: number; w?: number; labels?: boolean }) {
  return (
    <>
      <line x1={0} y1={y0} x2={w} y2={y0} stroke="var(--line)" />
      {labels &&
        ['00:00', '06:00', '12:00', '18:00', '24:00'].map((t, i) => (
          <text key={t} className="ax" x={(i * w) / 4} y={y0 + 16} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>
            {t}
          </text>
        ))}
    </>
  )
}

export default function Pato({ o }: { o: Observatory }) {
  const b = o.balanco
  const d = duckStats(b)
  const c = curtailStats(o)
  const a = o.agora

  // ---- 3a: today live over the full day before (D-2) --------------------------------------------------
  const top = 24
  const bot = 220
  const yMax = Math.ceil((Math.max(...b.carga, ...(a?.carga ?? [])) * 1.08) / 10_000) * 10_000
  const y = scale(0, yMax, bot, top)
  const xMin = (m: number) => (m / 1440) * W
  const xsHour = b.carga.map((_, h) => xMin(h * 60 + 30))
  const oldNet = d.net.map(y)
  const live = a
    ? (() => {
        const xs = a.t.map((t) => xMin(minuteOf(t)))
        const net = netLoad(a.carga, a.eol, a.sol, a.mmgd)
        const ren = a.carga.map((_, i) => a.eol[i] + a.sol[i] + a.mmgd[i])
        const i = a.t.length - 1
        return {
          xs,
          net,
          windTop: net.map((n, k) => n + a.eol[k]),
          xNow: xs[i],
          now: { t: a.t[i], carga: a.carga[i], eol: a.eol[i], sol: a.sol[i] + a.mmgd[i], net: net[i], ren: ren[i] / a.carga[i] },
          minNet: Math.min(...net),
        }
      })()
    : null

  // ---- 3b: who covers the ramp (D-2, stacked by source) -------------------------------------------------
  const sTop = 16
  const sBot = 170
  const sMax = Math.ceil((Math.max(...b.carga) * 1.05) / 10_000) * 10_000
  const sy = scale(0, sMax, sBot, sTop)
  const sx = (h: number) => (h / 23) * W2
  const layers = [
    { key: 'ter', name: 'térmica + nuclear', v: b.ter },
    { key: 'hid', name: 'hidrelétrica', v: b.hid },
    { key: 'eol', name: 'eólica', v: b.eol },
    { key: 'sol', name: 'solar (usinas + telhados)', v: b.sol },
  ] as const
  let base = b.carga.map(() => 0)
  const stacked = layers.map((l) => {
    const topV = base.map((v, h) => v + Math.max(0, l.v[h]))
    const p = bandXY(
      b.carga.map((_, h) => sx(h)),
      base.map(sy),
      topV.map(sy),
    )
    base = topV
    return { ...l, d: p }
  })

  // ---- 3c: the duck getting deeper (monthly) ---------------------------------------------------------
  const hist = o.duckHist
  const hTop = 16
  const hBot = 150
  const hMax = Math.ceil((Math.max(...hist.map((r) => r.ramp), ...hist.map((r) => r.trough)) * 1.1) / 10_000) * 10_000
  const hy = scale(0, hMax, hBot, hTop)
  const hx = (i: number) => (i / Math.max(1, hist.length - 1)) * W2
  const first = hist[0]
  const lastH = hist.at(-1)!
  const sameMonthLastYear = hist.find((r) => r.m === `${Number(lastH.m.slice(0, 4)) - 1}${lastH.m.slice(4)}`)

  // ---- 3d: curtailment, 12 closed months ---------------------------------------------------------------
  const cMax = Math.max(...c.months.map((m) => m.eol + m.sol))
  const cTop = 16
  const cBot = 160
  const cy = scale(0, cMax * 1.1, cBot, cTop)
  const bw = W / c.months.length
  const reasons = Object.entries(c.reasons).sort((p, q) => q[1] - p[1])

  return (
    <section className="sec" id="pato" aria-labelledby="pato-h">
      <div className="wrap">
        <Kicker n={3}>A curva do pato</Kicker>
        <h2 className="h2" id="pato-h">Ao meio-dia sobra energia; ao pôr do sol, falta. Quem cobre a rampa?</h2>
        <Lido>
          {dayWord(o, b.day)}, a carga líquida do país (a carga menos o que sol e vento entregam) caiu a {gw(d.trough)} GW {hourText(d.troughH) === 'meio-dia' ? 'ao meio-dia' : `às ${hourText(d.troughH)}`} e subiu {gw(d.ramp)} GW até as {hourText(d.peakH)}
          {d.itaipuMin ? `: no trecho mais rápido, o equivalente a uma Itaipu a cada ${d.itaipuMin} minutos` : ''}. {pct(Math.min(1, Math.max(0, d.hydroShare)))} dessa subida veio de hidrelétricas.{' '}
          {live && (
            <>
              Agora, às {live.now.t.replace(':', 'h')}, sol e vento atendem {pct(live.now.ren)} da carga.{' '}
            </>
          )}
          Em {monthLabel(c.m)}, o ONS mandou cortar {dec(c.total / 1e6, 1)} TWh de eólica e solar, {pct(c.lostShare)} do que essas usinas poderiam ter gerado, {pct(c.ne)} no Nordeste.
        </Lido>

        <div className="inst">
          <div className="instl">
            <span>3a · o pato de hoje, {live ? 'ao vivo' : 'sem sinal agora'} · SIN</span>
            <span>GW</span>
          </div>
          {live && (
            <div className="bignums bn4">
              <div className="bn">
                <span className="bnl">carga · {live.now.t}</span>
                <span className="bnv">{gw(live.now.carga)}<span className="bnu">GW</span></span>
              </div>
              <div className="bn">
                <span className="bnl">solar (usinas + telhados)</span>
                <span className="bnv">{gw(live.now.sol)}<span className="bnu">GW</span></span>
              </div>
              <div className="bn">
                <span className="bnl">eólica</span>
                <span className="bnv">{gw(live.now.eol)}<span className="bnu">GW</span></span>
              </div>
              <div className="bn">
                <span className="bnl">carga líquida</span>
                <span className="bnv">{gw(live.now.net)}<span className="bnu">GW</span></span>
              </div>
            </div>
          )}
          <svg className="svg" viewBox={`0 0 ${W} 250`} role="img" aria-label={`Carga e carga líquida do SIN${live ? ` hoje até ${live.now.t}` : ''}, sobre a curva completa de ${b.day}.`}>
            <text className="axl" x={0} y={12}>{`0–${yMax / 1000} GW`}</text>
            {[0.25, 0.5, 0.75].map((k) => (
              <line key={k} x1={0} y1={y(yMax * k)} x2={W} y2={y(yMax * k)} stroke="var(--line)" strokeDasharray="1 4" />
            ))}
            {/* the full day before, for shape */}
            <path d={pathXY(xsHour, b.carga.map(y))} fill="none" stroke={COLOR.old} strokeWidth={1} />
            <path d={pathXY(xsHour, oldNet)} fill="none" stroke={COLOR.old} strokeWidth={2.5} strokeDasharray="5 4" />
            <text className="ax" x={xsHour[d.troughH]} y={oldNet[d.troughH] + 16} textAnchor="middle">{`${ddmm(`${b.day}T15:00:00Z`)}`}</text>
            {live && a && (
              <>
                <path d={bandXY(live.xs, live.net.map(y), live.windTop.map(y))} fill={COLOR.eol} opacity={0.55} />
                <path d={bandXY(live.xs, live.windTop.map(y), a.carga.map(y))} fill={COLOR.sol} opacity={0.6} />
                <path d={pathXY(live.xs, a.carga.map(y))} fill="none" stroke={COLOR.carga} strokeWidth={1.5} />
                <path d={pathXY(live.xs, live.net.map(y))} fill="none" stroke={COLOR.net} strokeWidth={3} />
                <line x1={live.xNow} y1={top} x2={live.xNow} y2={bot} stroke="var(--ink)" strokeDasharray="3 3" />
                <circle cx={live.xNow} cy={y(live.now.net)} r={4} fill={COLOR.net} />
                <text className="axa" x={live.xNow > 560 ? live.xNow - 6 : live.xNow + 6} y={top + 10} textAnchor={live.xNow > 560 ? 'end' : 'start'}>
                  agora
                </text>
              </>
            )}
            {!live && (
              <>
                <path d={pathXY(xsHour, b.carga.map(y))} fill="none" stroke={COLOR.carga} strokeWidth={1.5} />
                <path d={pathXY(xsHour, oldNet)} fill="none" stroke={COLOR.net} strokeWidth={3} />
              </>
            )}
            <Axis y0={bot} />
          </svg>
          <div className="legend">
            <span><Swatch color={COLOR.carga} />carga</span>
            <span><Swatch color={COLOR.net} />carga líquida (o pato)</span>
            <span><Swatch color={COLOR.sol} />solar</span>
            <span><Swatch color={COLOR.eol} />eólica</span>
            <span><Swatch color={COLOR.old} dashed />{`dia completo, ${ddmm(`${b.day}T15:00:00Z`)}`}</span>
            {live && <span className="badge">telhados estimados</span>}
          </div>
          <Stamp status={o.status.agora} source="ONS Energia Agora · tr.ons.org.br" when={a ? a.t.at(-1)! : '—'} cadence="1 min, página a cada 5 min" />
        </div>

        <div className="g2e" style={{ marginTop: 40 }}>
          <div className="inst">
            <div className="instl">
              <span>3b · quem cobre a rampa · {ddmm(`${b.day}T15:00:00Z`)}</span>
              <span>GW</span>
            </div>
            <svg className="svg" viewBox={`0 0 ${W2} 200`} role="img" aria-label={`Geração por fonte, hora a hora, ${b.day}. A hidrelétrica vai de ${gw(b.hid[d.troughH])} GW às ${hourText(d.troughH)} a ${gw(b.hid[d.peakH])} GW às ${hourText(d.peakH)}.`}>
              <text className="axl" x={0} y={10}>{`0–${sMax / 1000} GW`}</text>
              {stacked.map((l) => (
                <path key={l.key} d={l.d} fill={COLOR[l.key]} opacity={0.8} />
              ))}
              <path d={pathXY(b.carga.map((_, h) => sx(h)), d.net.map(sy))} fill="none" stroke={COLOR.net} strokeWidth={2} strokeDasharray="5 3" />
              <line x1={sx(d.troughH)} y1={sTop} x2={sx(d.troughH)} y2={sBot} stroke="var(--ink)" strokeDasharray="2 3" />
              <line x1={sx(d.peakH)} y1={sTop} x2={sx(d.peakH)} y2={sBot} stroke="var(--ink)" strokeDasharray="2 3" />
              <text className="axa halo" x={sx(d.troughH) + 4} y={sy(d.trough) - 6}>{`${hourText(d.troughH)} · ${gw(d.trough)} GW`}</text>
              <text className="axa halo" x={sx(d.peakH) - 4} y={sTop + 10} textAnchor="end">{`${hourText(d.peakH)} · +${gw(d.ramp)} GW`}</text>
              <Axis y0={sBot} w={W2} />
            </svg>
            <div className="legend">
              {layers.map((l) => (
                <span key={l.key}><Swatch color={COLOR[l.key]} />{l.name}</span>
              ))}
              <span><Swatch color={COLOR.net} dashed />carga líquida</span>
            </div>
            <Stamp status={o.status.balanco} source={`ONS · BALANCO_ENERGIA_SUBSISTEMA_${b.day.slice(0, 4)}.csv`} when={ddmm(`${b.day}T15:00:00Z`)} cadence="horário, ~2 dias de atraso" />
          </div>

          <div className="inst">
            <div className="instl">
              <span>3c · o pato mais fundo · média do mês</span>
              <span>GW</span>
            </div>
            <svg className="svg" viewBox={`0 0 ${W2} 180`} role="img" aria-label={`Média mensal, de ${first.m} a ${lastH.m}: fundo da carga líquida de ${gw(first.trough)} para ${gw(lastH.trough)} GW; rampa de ${gw(first.ramp)} para ${gw(lastH.ramp)} GW.`}>
              <text className="axl" x={0} y={10}>{`0–${hMax / 1000} GW`}</text>
              <path d={pathXY(hist.map((_, i) => hx(i)), hist.map((r) => hy(r.trough)))} fill="none" stroke={COLOR.net} strokeWidth={2} />
              <path d={pathXY(hist.map((_, i) => hx(i)), hist.map((r) => hy(r.ramp)))} fill="none" stroke={COLOR.ter} strokeWidth={2} />
              <text className="axa halo" x={W2} y={hy(lastH.trough) + (lastH.trough >= lastH.ramp ? -6 : 14)} textAnchor="end">{`fundo ${gw(lastH.trough)}`}</text>
              <text className="axa halo" x={W2} y={hy(lastH.ramp) + (lastH.ramp > lastH.trough ? -6 : 14)} textAnchor="end">{`rampa ${gw(lastH.ramp)}`}</text>
              <line x1={0} y1={hBot} x2={W2} y2={hBot} stroke="var(--line)" />
              <text className="ax" x={0} y={hBot + 16}>{monthLabel(first.m)}</text>
              <text className="ax" x={W2} y={hBot + 16} textAnchor="end">{monthLabel(lastH.m)}</text>
            </svg>
            <div className="legend">
              <span><Swatch color={COLOR.net} />fundo da carga líquida (9h–15h)</span>
              <span><Swatch color={COLOR.ter} />rampa até o pico (16h–22h)</span>
            </div>
            <div className="stamp">
              <span>
                {sameMonthLastYear
                  ? `${monthLabel(lastH.m)} contra ${monthLabel(sameMonthLastYear.m)}: fundo ${gw(sameMonthLastYear.trough)} → ${gw(lastH.trough)} GW, rampa ${gw(sameMonthLastYear.ramp)} → ${gw(lastH.ramp)} GW`
                  : `${hist.length} meses, mesmo arquivo do ONS`}
              </span>
            </div>
          </div>
        </div>

        <div className="inst" style={{ marginTop: 40 }}>
          <div className="instl">
            <span>3d · energia jogada fora · cortes de eólica e solar ordenados pelo ONS</span>
            <span>GWh por mês</span>
          </div>
          <div className="bignums">
            <div className="bn">
              <span className="bnl">{monthLabel(c.m)} · eólica + solar</span>
              <span className="bnv">{dec(c.total / 1e6, 2)}<span className="bnu">TWh</span></span>
            </div>
            <div className="bn">
              <span className="bnl">do que poderiam gerar</span>
              <span className="bnv">{pct(c.lostShare)}</span>
            </div>
            <div className="bn">
              <span className="bnl">no Nordeste</span>
              <span className="bnv">{pct(c.ne)}</span>
            </div>
          </div>
          <svg className="svg" viewBox={`0 0 ${W} 190`} role="img" aria-label={`Corte mensal de eólica e solar, ${c.months[0].m} a ${c.m}, em GWh: ${c.months.map((m) => `${m.m} ${fmt((m.eol + m.sol) / 1000)}`).join(', ')}.`}>
            {c.months.map((m, i) => (
              <g key={m.m}>
                <rect x={i * bw + 4} y={cy(m.eol)} width={bw - 8} height={cBot - cy(m.eol)} fill={COLOR.eol} opacity={0.85} />
                <rect x={i * bw + 4} y={cy(m.eol + m.sol)} width={bw - 8} height={cy(m.eol) - cy(m.eol + m.sol)} fill={COLOR.sol} opacity={0.85} />
                {(i === 0 || i === c.months.length - 1 || m.m.endsWith('-01')) && (
                  <text className="ax" x={i * bw + bw / 2} y={cBot + 16} textAnchor="middle">{monthLabel(m.m)}</text>
                )}
              </g>
            ))}
            <text className="axa" x={W - bw / 2} y={cy(c.eol + c.sol) - 6} textAnchor="middle">{fmt(c.total / 1000)}</text>
            <line x1={0} y1={cBot} x2={W} y2={cBot} stroke="var(--line)" />
          </svg>
          <div className="legend">
            <span><Swatch color={COLOR.eol} />eólica</span>
            <span><Swatch color={COLOR.sol} />solar</span>
          </div>
          <div className="reasons" aria-label={`Motivos do corte em ${monthLabel(c.m)}`}>
            {reasons.map(([k, v]) => (
              <span key={k} style={{ flexGrow: v }}>
                <i style={{ background: REASON_FILL[k] ?? 'var(--c5)' }} />
                {k} · {CUT_REASON[k] ?? k} · {pct(v / c.total)}
              </span>
            ))}
          </div>
          <Stamp status={{ live: true, asOf: c.m }} source="ONS · RESTRICAO_COFF_EOLICA / _FOTOVOLTAICA" when={monthLabel(c.m)} cadence="mensal, meses fechados" />
          <Metodo>
            <p>
              <b>Carga líquida</b> é a carga menos a geração eólica e solar: o que hidrelétricas, térmicas e nucleares precisam atender. Ao meio-dia o sol derruba essa curva (a barriga do pato); quando ele se põe, ela sobe de uma vez (o pescoço). Na Califórnia, onde o nome nasceu, a rampa é coberta por gás e baterias; no Brasil, quase toda por hidrelétricas.
            </p>
            <p>
              3a usa o painel Energia Agora do ONS, minuto a minuto, desenhado a cada 5 minutos. A série solar desse painel cobre só as usinas; a geração em telhados (MMGD) aparece apenas como valor do instante. A curva de telhados de hoje é <b>estimada</b>: o perfil das usinas multiplicado pela razão telhado ÷ usina medida no último instante ({dec(a?.mmgdRatio ?? 0, 2)} agora; {fmt(a?.snap.mmgd ?? 0)} MW medidos). Por isso a linha tracejada do dia completo, do arquivo de balanço do ONS, que já soma os telhados ao solar, serve de referência.
            </p>
            <p>
              3b e 3c usam o balanço de energia por subsistema (horário, MW médios); térmica inclui nuclear. Fundo = menor carga líquida entre 9h e 15h; rampa = maior valor entre 16h e 22h menos o fundo; média dos dias do mês. A comparação com Itaipu usa {fmt(ITAIPU_MW)} MW de capacidade instalada.
            </p>
            <p>
              3d soma, para cada meia-hora com restrição, a geração não realizada apurada pelo ONS (referência menos verificada) em todas as usinas eólicas e solares despachadas pelo ONS; MWh = MW médios × 0,5 h. Motivos: <b>ENE</b>, sobra de energia no sistema; <b>CNF</b>, confiabilidade elétrica; <b>REL</b>, limite de rede (indisponibilidade externa). Pela Lei 15.269/2025 e a Portaria MME 140/2026, só cortes de REL e CNF entram no ressarcimento; o corte por sobra de energia fica com o gerador. A geração distribuída também passou a sofrer cortes em 2026, ainda sem regra de compensação <Todo>conferir data e ato</Todo>.
            </p>
          </Metodo>
          <ParaVoce>
            Tem usina eólica ou solar, ou uma carteira de geração distribuída? O ONS publica os cortes usina por usina, e a mesma conta de 3d separa o
            que foi por rede ou confiabilidade (ressarcível) do que foi por sobra de energia. Para ver os números da sua usina, fale com a{' '}
            <a className="bz" href={BRONZE_URL}>Bronze Engenharia</a>: <a href="mailto:contato@data-joule.com">contato@data-joule.com</a>.
          </ParaVoce>
        </div>
      </div>
    </section>
  )
}
