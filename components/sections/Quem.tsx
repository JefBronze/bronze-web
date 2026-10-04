import { scale, stack } from '@/lib/chart'
import { FLAG_FILL, FLAG_NAME, SUB_SHORT, MOTIVO_FILL, MOTIVO_NAME, termicaStats, usinasDia, vu, type Flag, type Usina } from '@/lib/derive'
import { dec, ddmm, fmt, monthLabel, pct } from '@/lib/format'
import type { Observatory } from '@/lib/observatory'
import { MOTIVOS } from '@/lib/sources/geracao'
import type { Sub } from '@/lib/sources/ons'
import MapaHover, { type PlantCard } from '../MapaHover'
import { BRONZE_URL, Kicker, Lido, Metodo, ParaVoce, Stamp, Swatch } from '../ui'

const TIPO_FILL: Record<string, string> = { hid: 'var(--c1)', eol: 'var(--c3)', sol: 'var(--sol)', ter: 'var(--c5)', nuc: 'var(--c5)', out: 'var(--c5)' }
const TIPO_NAME: Record<string, string> = { hid: 'hidrelétrica', ter: 'térmica', nuc: 'nuclear', eol: 'eólica', sol: 'solar' }
const gw = (mw: number, digits = 1) => dec(mw / 1000, digits)
const day = (d: string) => ddmm(`${d}T15:00:00Z`)
/** Circle area proportional to capacity. */
const radius = (mw: number) => Math.sqrt(mw) * 0.115

/** Plants named on the map: [dx, dy, anchor]. The rest carry their name in the hover title. */
const LABEL: Record<string, [number, number, 'start' | 'end']> = {
  Itaipu: [-1, 4, 'end'],
  'Belo Monte': [-1, -2, 'end'],
  Tucuruí: [1, 4, 'start'],
  Jirau: [1, 10, 'start'],
  'Ilha Solteira': [-1, 3, 'end'],
  Xingó: [1, 12, 'end'],
  'Teles Pires': [1, 4, 'start'],
  'Porto de Sergipe I': [-1, 14, 'end'],
  'GNA II': [1, -4, 'start'],
  'Angra 2': [1, 12, 'start'],
}

function plantTitle(p: Usina) {
  const gen = p.med === null ? '' : ` · ontem ${fmt(p.med)} MW médios (${pct(Math.min(1, p.med / p.mw))})`
  const mot = p.motivo ? ` · despacho: ${MOTIVO_NAME[p.motivo]}` : (p.tipo === 'ter' || p.tipo === 'nuc') && p.med !== null ? ' · parada' : ''
  const aprox = p.loc.startsWith('municipio') ? ' · posição aproximada (município)' : ''
  return `${p.nome} (${p.uf}) · ${TIPO_NAME[p.tipo] ?? p.comb.toLowerCase()} · ${fmt(p.mw)} MW${gen}${mot}${aprox}`
}

/** The pop-up for one plant: capacity, yesterday's average and peak, and for thermal plants the dispatch reasons and CVU. */
function plantCard(o: Observatory, p: Usina, cmoMed: Record<Sub, number> | null): PlantCard {
  const linhas: [string, string][] = [['capacidade', `${fmt(p.mw)} MW`]]
  if (p.med !== null && o.usinaDia) {
    const pico = o.usinaDia.peak[p.ceg] ?? 0
    linhas.push([`média de ontem, ${day(o.usinaDia.day)}`, `${fmt(p.med)} MW`])
    linhas.push(['pico de ontem', `${fmt(pico)} MW`])
    linhas.push(['fator de capacidade', pct(Math.min(1, p.med / p.mw))])
  } else {
    linhas.push(['ontem', 'sem leitura do ONS agora'])
  }
  const thermal = p.tipo === 'ter' || p.tipo === 'nuc'
  const t = thermal ? o.termicas?.plants.find((x) => x.ceg === p.ceg) : undefined
  let motivos: PlantCard['motivos']
  if (thermal && o.termicas) {
    if (t && t.mwh > 0) {
      motivos = MOTIVOS.filter((m) => t.byMotivo[m] > 0).map((m) => ({ nome: MOTIVO_NAME[m], fill: MOTIVO_FILL[m], share: t.byMotivo[m] / t.mwh, mwh: `${fmt(t.byMotivo[m])} MWh` }))
    } else {
      linhas.push(['despacho', 'parada ontem'])
    }
    const cvu = t?.cod && o.cvu ? o.cvu.byCod[t.cod] : undefined
    if (cvu !== undefined) {
      const cmo = cmoMed?.[p.sub as Sub]
      linhas.push(['custo variável (CVU)', `R$ ${fmt(cvu)}/MWh`])
      if (cmo !== undefined) linhas.push([`custo marginal ${SUB_SHORT[p.sub as Sub] ?? p.sub}, mesmo dia`, `R$ ${fmt(cmo)}/MWh`])
    }
  }
  const tipo = TIPO_NAME[p.tipo] ?? p.comb.toLowerCase()
  const comb = thermal && p.comb && p.tipo !== 'nuc' ? ` · ${p.comb.toLowerCase()}` : ''
  return {
    nome: `${p.nome} (${p.uf})`,
    sub: `${tipo}${comb}`,
    linhas,
    motivos,
    nota: p.loc.startsWith('municipio') ? `Posição aproximada: centro do município de ${p.loc.slice(10)}.` : undefined,
  }
}

/**
 * Plants on the same site (GNA I and II, Angra 1 and 2, the Parnaíba complex…) share one coordinate, and some
 * neighbours sit close enough that the smaller circle covers the larger one's centre (Termo Norte II at Santo
 * Antônio). Drawn as-is, one would hide the other. Such clusters are spread on a small ring around their centre.
 */
function spreadOnce(plants: Usina[]): Usina[] {
  const n = plants.length
  const parent = plants.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(plants[i].x - plants[j].x, plants[i].y - plants[j].y)
      if (d < Math.max(radius(plants[i].mw), radius(plants[j].mw)) * 0.8 + 2) parent[find(j)] = find(i)
    }
  const groups = new Map<number, number[]>()
  plants.forEach((_, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), i]))
  const out = [...plants]
  for (const g of groups.values()) {
    if (g.length < 2) continue
    const cx = g.reduce((a, i) => a + plants[i].x, 0) / g.length
    const cy = g.reduce((a, i) => a + plants[i].y, 0) / g.length
    const ring = Math.max(...g.map((i) => radius(plants[i].mw))) + 1.5
    g.forEach((i, k) => {
      const a = Math.PI + (2 * Math.PI * k) / g.length // first (largest) to the left, the rest around
      out[i] = { ...plants[i], x: cx + ring * Math.cos(a), y: cy + ring * Math.sin(a) }
    })
  }
  return out
}

/** Spreading one cluster can push it onto a neighbour (Rio's thermal plants): repeat until nothing changes. */
function spread(plants: Usina[]): Usina[] {
  let cur = plants
  for (let k = 0; k < 6; k++) {
    const next = spreadOnce(cur)
    if (next.every((p, i) => p.x === cur[i].x && p.y === cur[i].y)) return next
    cur = next
  }
  return cur
}

function Mapa({ o, plants }: { o: Observatory; plants: Usina[] }) {
  const { w, h, ufs } = o.usinas.map
  const order = spread([...plants].sort((a, b) => b.mw - a.mw))
  const cmoMed = termicaStats(o)?.cmoMed ?? null
  const cards = order.map((p) => plantCard(o, p, cmoMed))
  return (
    <MapaHover cards={cards}>
    <svg className="svg mapa" viewBox={`0 0 ${w} ${h}`} role="group" aria-label={`Mapa do Brasil com as ${plants.length} maiores usinas e as térmicas de 300 MW ou mais, em tamanho proporcional à capacidade.`}>
      {ufs.map((u) => (
        <path key={u.uf} d={u.d} fill="var(--bg2)" stroke="var(--line)" strokeWidth={0.8} />
      ))}
      {/* Small plants are 2–3 px wide: larger invisible targets, under every visible circle so a drawn circle always wins. */}
      {order.map((p, i) => (
        <circle key={`hit-${p.ceg || p.nome}`} data-plant={i} cx={p.x} cy={p.y} r={Math.max(radius(p.mw), 7)} fill="transparent" />
      ))}
      {order.map((p, i) => {
        const r = radius(p.mw)
        const thermal = p.tipo === 'ter' || p.tipo === 'nuc'
        const color = thermal ? (p.motivo ? MOTIVO_FILL[p.motivo] : 'var(--c5)') : TIPO_FILL[p.tipo]
        const share = p.med === null ? null : Math.min(1, p.med / p.mw)
        return (
          <g key={p.ceg || p.nome} data-plant={i} tabIndex={0} aria-label={plantTitle(p)}>
            <circle cx={p.x} cy={p.y} r={r} fill={color} fillOpacity={0.14} stroke={color} strokeWidth={1} strokeDasharray={thermal && !p.motivo ? '2 2' : undefined} />
            {share !== null && share > 0 && <circle cx={p.x} cy={p.y} r={r * Math.sqrt(share)} fill={color} fillOpacity={0.9} />}
          </g>
        )
      })}
      {order
        .filter((p) => LABEL[p.nome])
        .map((p) => {
          const [dx, dy, anchor] = LABEL[p.nome]
          const r = radius(p.mw)
          return (
            <text key={`l-${p.nome}`} className="axa halo" x={p.x + dx * (r + 3)} y={p.y + dy} textAnchor={anchor}>
              {p.nome}
            </text>
          )
        })}
    </svg>
    </MapaHover>
  )
}

export default function Quem({ o }: { o: Observatory }) {
  const plants = usinasDia(o)
  const ts = termicaStats(o)
  const g = o.gatilho.meses.at(-1)!
  const gVu = vu(g)
  const lim = o.gatilho.vu
  const flag = g.cor as Flag
  const ontem = o.usinaDia?.day ?? ts?.day ?? null

  // Largest plant, and the big hydro that ran furthest below its size (Belo Monte in the dry season).
  const big = plants[0]
  const idle = plants
    .filter((p) => p.tipo === 'hid' && p.mw >= 3000 && p.med !== null)
    .reduce<Usina | null>((a, p) => (!a || p.med! / p.mw < a.med! / a.mw ? p : a), null)
  const list = plants.slice(0, 12)
  const listMax = list[0].mw

  // ---- 4b: the thermal fleet hour by hour, by reason ------------------------------------------------------
  const W2 = 400
  const H = 200
  const hourly = o.termicas?.hourly
  const hMax = hourly ? Math.ceil((Math.max(...hourly.inflex.map((_, i) => MOTIVOS.reduce((s, m) => s + hourly[m][i], 0))) * 1.15) / 2000) * 2000 : 1
  const bands = hourly ? stack(MOTIVOS.map((m) => ({ key: m, values: hourly[m] })), 0, W2, 16, H - 24, hMax) : []
  const topMax = ts ? Math.max(...ts.top.map((p) => p.mwh)) : 1

  // ---- 4c: the trigger chart (GSF × PLD) -------------------------------------------------------------------
  const AW = 680
  const AH = 300
  const gx = scale(0.55, 1.1, 0, AW)
  const pMax = 500
  const py = scale(0, pMax, AH - 28, 12)
  const curve = (limVu: number) => {
    const pts: string[] = []
    for (let k = 0; k <= 110; k++) {
      const gsf = 0.55 + k * 0.005
      const p = gsf >= 0.999 ? pMax : Math.min(pMax, limVu / (1 - gsf))
      pts.push(`${gx(gsf).toFixed(1)} ${py(p).toFixed(1)}`)
    }
    return pts
  }
  // Region between two limits: upper boundary left to right, then the lower one back.
  const region = (lo: number | null, hi: number | null) => {
    const top = hi === null ? [`0 ${py(pMax)}`, `${AW} ${py(pMax)}`] : curve(hi)
    const bottom = lo === null ? [`0 ${py(0)}`, `${AW} ${py(0)}`] : curve(lo)
    return `M${top.join('L')}L${[...bottom].reverse().join('L')}Z`
  }
  const regions: [Flag, number | null, number | null][] = [
    ['verde', null, lim.verde],
    ['amarela', lim.verde, lim.amarela],
    ['vermelha1', lim.amarela, lim.vermelha1],
    ['vermelha2', lim.vermelha1, null],
  ]
  const meses = o.gatilho.meses

  return (
    <section className="sec" id="quem" aria-labelledby="quem-h">
      <div className="wrap">
        <Kicker n={4}>Quem gera</Kicker>
        <h2 className="h2" id="quem-h">De onde veio a energia ontem, por que as térmicas ligaram e o que decide a cor da bandeira.</h2>
        <Lido>
          {ontem && big.med !== null && idle ? (
            <>
              Em {day(ontem)}, {big.nome} gerou em média {gw(big.med)} GW, {pct(big.med / big.mw)} do que pode; {idle.nome} usou só {gw(idle.med!)} dos seus {gw(idle.mw)} GW.{' '}
            </>
          ) : null}
          {ts && (
            <>
              As térmicas geraram {fmt(ts.total / 1000)} GWh. Desse total, {pct(ts.byMotivo.inflex / ts.total)} veio de usinas inflexíveis, que o dono declarou que precisam rodar por contrato de combustível ou limite técnico, seja qual for o preço; só {pct(ts.byMotivo.merito / ts.total)} veio de usinas ligadas por serem baratas o bastante
              {ts.caras.length > 0 ? `. ${ts.caras.length} térmicas geraram custando mais que o custo marginal da sua região` : ''}.{' '}
            </>
          )}
          A bandeira de {monthLabel(g.m)} é {FLAG_NAME[flag]}. Ela sai de uma conta: com as hidrelétricas entregando {pct(g.gsf)} da sua garantia física (GSF) e o PLD a R$ {fmt(g.pld)},{' '}
          {gVu > 0 ? `o custo do risco hidrológico ficou em R$ ${dec(gVu)}/MWh` : 'o custo do risco hidrológico ficou em zero'},{' '}
          {flag === 'verde' ? `abaixo dos R$ ${dec(lim.verde)} que acionariam a amarela` : `acima dos R$ ${dec(lim.verde)} que encerram a verde`}.
        </Lido>

        <div className="g3">
          <div className="inst span2">
            <div className="instl">
              <span>4a · as maiores usinas · {ontem ? `geração de ${day(ontem)}` : 'capacidade'}</span>
              <span>círculo = capacidade</span>
            </div>
            <Mapa o={o} plants={plants} />
            <div className="legend">
              <span><Swatch color="var(--c1)" />hidrelétrica</span>
              <span><Swatch color="var(--c4)" />térmica por inflexibilidade</span>
              <span><Swatch color="var(--c2)" />térmica por custo</span>
              <span><Swatch color="var(--dj)" />partida e parada</span>
              <span><Swatch color="var(--c5)" dashed />térmica parada</span>
              <span className="badge">miolo cheio = geração de ontem · passe o mouse ou toque numa usina</span>
            </div>
            <Stamp status={o.status.usinas} source="ONS · capacidade de geração + GERACAO_USINA-2" when={ontem ? day(ontem) : '—'} cadence="diário, D-1" />
          </div>
          <div className="inst">
            <div className="instl">
              <span>as 12 maiores</span>
              <span>GW · ontem / capacidade</span>
            </div>
            <ol className="ranking">
              {list.map((p) => (
                <li key={p.ceg || p.nome} title={plantTitle(p)}>
                  <span className="rk-n">
                    {p.nome} <i>{p.uf}</i>
                  </span>
                  <span className="rk-v">{p.med === null ? gw(p.mw) : `${gw(p.med)} / ${gw(p.mw)}`}</span>
                  <span className="rk-bar">
                    <span style={{ width: `${(p.mw / listMax) * 100}%`, borderColor: TIPO_FILL[p.tipo] }}>
                      {p.med !== null && <span style={{ width: `${Math.min(100, (p.med / p.mw) * 100)}%`, background: p.tipo === 'ter' || p.tipo === 'nuc' ? (p.motivo ? MOTIVO_FILL[p.motivo] : 'transparent') : TIPO_FILL[p.tipo] }} />}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="g2e" style={{ marginTop: 40 }}>
          <div className="inst">
            <div className="instl">
              <span>4b · as térmicas de ontem, por motivo{ts ? ` · ${day(ts.day)}` : ''}</span>
              <span>MW</span>
            </div>
            {hourly ? (
              <svg className="svg" viewBox={`0 0 ${W2} ${H}`} role="img" aria-label={`Geração térmica despachada pelo ONS, hora a hora, por motivo do despacho. Inflexibilidade: ${pct(ts!.byMotivo.inflex / ts!.total)} do total.`}>
                <text className="axl" x={0} y={10}>{`0–${fmt(hMax)} MW`}</text>
                {bands.map((b) => (
                  <path key={b.key} d={b.d} fill={MOTIVO_FILL[b.key]} opacity={0.85} />
                ))}
                <line x1={0} y1={H - 24} x2={W2} y2={H - 24} stroke="var(--line)" />
                {['00h', '06h', '12h', '18h', '23h'].map((t, i) => (
                  <text key={t} className="ax" x={(i * W2) / 4} y={H - 8} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>
                    {t}
                  </text>
                ))}
              </svg>
            ) : (
              <p className="nosignal">Sem sinal do arquivo de despacho térmico do ONS agora.</p>
            )}
            {ts && (
              <div className="legend">
                {MOTIVOS.filter((m) => ts.byMotivo[m] > 0).map((m) => (
                  <span key={m}>
                    <Swatch color={MOTIVO_FILL[m]} />
                    {MOTIVO_NAME[m]} {pct(ts.byMotivo[m] / ts.total)}
                  </span>
                ))}
              </div>
            )}
            <Stamp status={o.status.termicas} source="ONS · GERACAO_TERMICA_DESPACHO-2" when={ts ? day(ts.day) : '—'} cadence="diário, D-1" />
          </div>
          <div className="inst">
            <div className="instl">
              <span>as 10 térmicas que mais geraram</span>
              <span>MWh · CVU R$/MWh</span>
            </div>
            {ts && (
              <ol className="ranking">
                {ts.top.map((p) => (
                  <li key={p.ceg || p.nome}>
                    <span className="rk-n">
                      {p.nome} <i>{p.sub}</i>
                    </span>
                    <span className={ts.cmoMed && p.cvu !== null && p.cvu > (ts.cmoMed[p.sub as keyof typeof ts.cmoMed] ?? Infinity) ? 'rk-v hot' : 'rk-v'}>
                      {fmt(p.mwh)} · {p.cvu === null ? 's/ CVU' : fmt(p.cvu)}
                    </span>
                    <span className="rk-bar">
                      <span style={{ width: `${(p.mwh / topMax) * 100}%`, display: 'flex', border: 0 }}>
                        {MOTIVOS.filter((m) => p.byMotivo[m] > 0).map((m) => (
                          <span key={m} style={{ width: `${(p.byMotivo[m] / p.mwh) * 100}%`, background: MOTIVO_FILL[m] }} />
                        ))}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <Stamp status={o.status.cvu} source="ONS · CVU_USINA_TERMICA" when={o.cvu ? `${day(o.cvu.from)}–${day(o.cvu.to)}` : '—'} cadence="semanal">
              {ts?.cmoMed && <span>em vermelho: CVU acima do custo marginal médio do subsistema no mesmo dia, {day(ts.day)}</span>}
            </Stamp>
          </div>
        </div>

        <div className="inst" style={{ marginTop: 40 }}>
          <div className="instl">
            <span>4c · como isso vira bandeira · GSF × PLD, mês a mês desde {monthLabel(meses[0].m)}</span>
            <span>PLD R$/MWh</span>
          </div>
          <svg className="svg" viewBox={`0 0 ${AW} ${AH}`} role="img" aria-label={`Gatilho das bandeiras: GSF previsto no eixo horizontal, PLD previsto no vertical. ${monthLabel(g.m)}: GSF ${dec(g.gsf)}, PLD R$ ${fmt(g.pld)}, bandeira ${FLAG_NAME[flag]}.`}>
            {regions.map(([f, lo, hi]) => (
              <path key={f} d={region(lo, hi)} fill={FLAG_FILL[f]} opacity={0.16} />
            ))}
            {[lim.verde, lim.amarela, lim.vermelha1].map((l) => (
              <path key={l} d={`M${curve(l).join('L')}`} fill="none" stroke="var(--ink2)" strokeWidth={0.6} strokeDasharray="2 3" />
            ))}
            <line x1={gx(1)} y1={py(0)} x2={gx(1)} y2={py(pMax)} stroke="var(--line)" />
            <text className="ax halo" x={gx(1) - 4} y={py(pMax) + 12} textAnchor="end">GSF = 1: hidrelétricas na garantia física →</text>
            <path d={meses.map((m, i) => `${i ? 'L' : 'M'}${gx(m.gsf).toFixed(1)} ${py(m.pld).toFixed(1)}`).join('')} fill="none" stroke="var(--ink2)" strokeWidth={0.8} opacity={0.6} />
            {meses.map((m, i) => (
              <g key={m.m}>
                <title>{`${monthLabel(m.m)}: GSF ${dec(m.gsf)}, PLD R$ ${dec(m.pld)} → bandeira ${FLAG_NAME[m.cor as Flag]} (InfoBandeira nº ${m.n})`}</title>
                <circle cx={gx(m.gsf)} cy={py(m.pld)} r={i === meses.length - 1 ? 6 : 4} fill={FLAG_FILL[m.cor as Flag]} stroke="var(--bg)" strokeWidth={1.2} />
              </g>
            ))}
            <text className="axa halo" x={gx(g.gsf) + 9} y={py(g.pld) + 4}>{monthLabel(g.m)}</text>
            <text className="axa halo" x={gx(meses[0].gsf) + 7} y={py(meses[0].pld) - 6}>{monthLabel(meses[0].m)}</text>
            <line x1={0} y1={py(0)} x2={AW} y2={py(0)} stroke="var(--line)" />
            {[0.6, 0.7, 0.8, 0.9, 1.0, 1.1].map((v) => (
              <text key={v} className="ax" x={gx(v)} y={AH - 10} textAnchor={v === 1.1 ? 'end' : 'middle'}>
                {dec(v, 1)}
              </text>
            ))}
            {[100, 200, 300, 400].map((v) => (
              <text key={v} className="ax" x={2} y={py(v) - 2}>
                {v}
              </text>
            ))}
            <text className="axl" x={AW} y={AH - 10 - 14} textAnchor="end">GSF previsto (geração hidráulica ÷ garantia física)</text>
          </svg>
          <div className="legend">
            {(['verde', 'amarela', 'vermelha1', 'vermelha2'] as Flag[]).map((f) => (
              <span key={f}>
                <Swatch color={FLAG_FILL[f]} />
                {FLAG_NAME[f]}
              </span>
            ))}
            <span className="badge">próximo anúncio: {day(o.gatilho.proximo)}</span>
          </div>
          <Stamp status={{ live: true, asOf: g.m }} source={`CCEE · InfoBandeira nº ${meses[0].n}–${g.n}`} when={monthLabel(g.m)} cadence="mensal, atualizado à mão" />
          <Metodo>
            <p>
              <b>4a.</b> Capacidade efetiva por unidade geradora, do cadastro do ONS, somada por usina (código CEG); as duas metades de Itaipu (50 e 60 Hz) contam como uma usina. Ficam no mapa as {o.usinas.plants.length} maiores usinas e toda térmica ou nuclear de 300 MW ou mais. A área do círculo é proporcional à capacidade; o miolo cheio, à geração média de ontem (arquivo horário de geração por usina do ONS). Posições: Wikidata; usinas no mesmo terreno de outra (GNA II, Angra 1 e 2, Maranhão III a V) usam o ponto do complexo; usinas no mesmo ponto, ou tão perto que uma cobriria a outra, aparecem lado a lado em volta dele; as poucas sem registro usam o centro do município e dizem isso ao passar o mouse. Contornos dos estados: malha do IBGE.
            </p>
            <p>
              <b>4b.</b> Geração verificada das térmicas despachadas centralizadamente pelo ONS (inclui Angra), dividida pelo motivo do despacho: <b>inflexibilidade</b>, a geração mínima declarada pelo dono da usina (contratos de combustível com consumo obrigatório, exigências técnicas); <b>ordem de custo</b>, a parte despachada porque o custo variável (CVU) estava abaixo do custo marginal; <b>partida e parada</b> (unit commitment), geração para manter a usina pronta; <b>restrição elétrica</b>, necessidade local da rede; <b>segurança energética</b>, despacho fora da ordem de custo decidido pelo CMSE para poupar água. Os motivos somam a geração verificada. CVU da semana operativa do PMO que contém o dia; custo marginal médio do mesmo dia, por subsistema.
            </p>
            <p>
              <b>4c.</b> A cor da bandeira de cada mês sai de um gatilho calculado pela CCEE e anunciado pela ANEEL na última sexta-feira do mês anterior: o GSF previsto (geração das hidrelétricas do MRE ÷ garantia física) e o PLD previsto para o mês, ambos do DECOMP. O custo de risco hidrológico é PLD × (1 − GSF); a bandeira é verde até R$ {dec(lim.verde)}/MWh, amarela até R$ {dec(lim.amarela)}, vermelha 1 até R$ {dec(lim.vermelha1)} e vermelha 2 acima disso (NT 009/2023-SGM-STR, REH ANEEL 3.306/2024, Submódulo 6.8 do PRORET aprovado pela REN 1.084/2024). As térmicas entram por dois caminhos: as despachadas por custo puxam o custo marginal e o PLD para cima; as despachadas por segurança energética podem subir a cor por uma tabela de acionamento composto, aplicada só uma vez desde 2025 (jun/2025, sem mudar a cor). O custo desse despacho fora da ordem de custo é pago pelo Encargo de Serviços do Sistema (ESS), rateado entre todos os consumidores, e não pela bandeira. Os números de cada mês vêm dos boletins InfoBandeira da CCEE, que bloqueia leitura automática; são copiados à mão depois de cada anúncio.
            </p>
          </Metodo>
          <ParaVoce>
            A térmica cara chega à sua conta por dois caminhos: a bandeira, no mês, e o que a bandeira não cobre, no reajuste anual da distribuidora. Para saber quanto
            a bandeira pesou nas suas últimas faturas, fale com a <a className="bz" href={BRONZE_URL}>Bronze Engenharia</a>: <a href="mailto:contato@data-joule.com">contato@data-joule.com</a>.
          </ParaVoce>
        </div>
      </div>
    </section>
  )
}
