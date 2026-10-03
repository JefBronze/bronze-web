import { x as sx } from '@/lib/chart'
import { dec } from '@/lib/format'
import type { Observatory } from '@/lib/observatory'
import { Kicker, Lido, Metodo, ParaVoce, Swatch, Todo } from '../ui'

const BRAND_FILL = ['var(--c2)', 'var(--c1)', 'var(--c4)', 'var(--c5)', 'var(--c5)'] // Vibra, Ipiranga, Raízen, branca, outras
const PRODUCTS = [
  ['GASOLINA', 'gasolina', 24],
  ['ETANOL', 'etanol', 74],
  ['DIESEL S10', 'diesel S10', 124],
] as const

function median(v: number[]) {
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export default function Bomba({ o }: { o: Observatory }) {
  const f = o.fuel
  // JSON tuples type as number[][]; each entry is [price R$/L, brand index].
  const stations = f.stations as unknown as Record<string, [number, number][]>
  const cwb = f.curitiba as Record<string, number>
  const pr = f.ratio.find((r) => r.uf === 'PR')
  const gas = stations.GASOLINA
  const whiteGap = median(gas.filter(([, b]) => b <= 2).map(([v]) => v)) - median(gas.filter(([, b]) => b === 3).map(([v]) => v))
  const nCollections = PRODUCTS.reduce((s, [p]) => s + (stations[p]?.length ?? 0), 0)
  const fx = (v: number) => sx(v, 4, 8, 80, 500)
  const mes = f.month.replace(/^(\d{2})\/(\d{4})$/, (_, m, y) => `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(m) - 1]}/${y}`)
  const L = o.litro
  const gasCwb = cwb.GASOLINA
  const parts: [string, number, string][] = [
    ['refinaria (gasolina A × 73 %)', L.refinaria * 0.73, 'var(--c6)'],
    ['etanol anidro (27 %)', L.anidro, 'var(--c3)'],
    ['PIS/COFINS', L.pisCofins, 'var(--c4)'],
    ['ICMS monofásico', L.icms, 'var(--sol)'],
  ]
  parts.push(['distribuição + revenda (derivada)', gasCwb - parts.reduce((s, p) => s + p[1], 0), 'var(--c2)'])
  let acc = 0

  return (
    <section className="sec" id="bomba" aria-labelledby="bomba-h">
      <div className="wrap">
        <Kicker n={5}>Na bomba</Kicker>
        <h2 className="h2" id="bomba-h">Quanto custam gasolina, etanol e diesel — e o etanol compensa no seu estado?</h2>
        <Lido label={`Lido em ${mes}`}>
          O etanol compensou em {f.below070} estados.{pr && ` No Paraná, a razão etanol/gasolina foi ${dec(pr.ratio)}`}
          {whiteGap > 0 ? `; em Curitiba, a bandeira branca vendeu a gasolina R$ ${dec(whiteGap)} mais barata que as três grandes.` : '.'}
        </Lido>
        <div className="g2e">
          <div className="inst">
            <div className="instl">
              <span>5a · etanol ÷ gasolina por estado · {mes}</span>
              <span>compensa abaixo de 0,70</span>
            </div>
            <div className="rows">
              {f.ratio.map((r) => (
                <div className="row" key={r.uf}>
                  <span>{r.uf}</span>
                  <span>
                    <span className={r.uf === 'PR' ? 'bar me' : r.ratio < 0.7 ? 'bar win' : 'bar'} style={{ width: `${Math.round(((r.ratio - 0.45) / 0.5) * 100)}%` }} />
                  </span>
                  <span>{dec(r.ratio)}</span>
                </div>
              ))}
            </div>
            <div className="stamp">
              <span>ANP · levantamento por posto · {mes} · mensal</span>
              <span>{nCollections} coletas em Curitiba</span>
            </div>
          </div>
          <div>
            <div className="inst">
              <div className="instl">
                <span>5b · Curitiba · todos os postos pesquisados</span>
                <span>R$/litro</span>
              </div>
              <svg className="svg" viewBox="0 0 500 170" role="img" aria-label={`Preço por posto em Curitiba, ${mes}: medianas gasolina ${dec(cwb.GASOLINA)}, etanol ${dec(cwb.ETANOL)}, diesel S10 ${dec(cwb['DIESEL S10'])} reais por litro.`}>
                {PRODUCTS.map(([key, label, y0]) => (
                  <g key={key}>
                    <text className="axl" x={0} y={y0 + 2}>{label}</text>
                    {(stations[key] ?? []).map(([v, b], i) => (
                      <circle key={i} cx={fx(v).toFixed(1)} cy={y0 + ((i * 7) % 19) - 9} r={3} fill={BRAND_FILL[b]} opacity={0.55} />
                    ))}
                    <line x1={fx(cwb[key])} y1={y0 - 12} x2={fx(cwb[key])} y2={y0 + 12} stroke="var(--ink)" strokeWidth={2} />
                  </g>
                ))}
                <line x1={80} y1={150} x2={500} y2={150} stroke="var(--line)" />
                <text className="ax" x={80} y={164}>R$ 4,00</text>
                <text className="ax" x={290} y={164} textAnchor="middle">6,00</text>
                <text className="ax" x={500} y={164} textAnchor="end">8,00</text>
              </svg>
              <div className="legend">
                <span><Swatch color="var(--c2)" />Vibra</span>
                <span><Swatch color="var(--c1)" />Ipiranga</span>
                <span><Swatch color="var(--c4)" />Raízen</span>
                <span><Swatch color="var(--c5)" />branca · outras</span>
                <span>| mediana: gasolina {dec(cwb.GASOLINA)} · etanol {dec(cwb.ETANOL)} · diesel S10 {dec(cwb['DIESEL S10'])}</span>
              </div>
            </div>
            <div className="inst" style={{ marginTop: 28 }}>
              <div className="instl">
                <span>5c · anatomia do litro · gasolina C · Curitiba</span>
                <span>R$/litro</span>
              </div>
              <svg className="svg" viewBox="0 0 500 60" role="img" aria-label={`Composição do litro de gasolina a R$ ${dec(gasCwb)}: ${parts.map(([n, v]) => `${n} ${dec(v)}`).join(', ')}.`}>
                {parts.map(([n, v, c]) => {
                  const w = (v / gasCwb) * 500
                  const x0 = acc
                  acc += w
                  return <rect key={n} x={x0.toFixed(1)} y={8} width={w.toFixed(1)} height={30} fill={c} opacity={0.85} />
                })}
                <text className="ax" x={0} y={54}>0</text>
                <text className="ax" x={500} y={54} textAnchor="end">{`R$ ${dec(gasCwb)}`}</text>
              </svg>
              {parts.map(([n, v, c]) => (
                <div className="seg" key={n}>
                  <span>
                    <i style={{ background: c }} />
                    {n}
                  </span>
                  <span className="mono">{dec(v)}</span>
                </div>
              ))}
              <div className="stamp">
                <Todo>refinaria e tributos: valores de referência, a confirmar no build (Petrobras, CONFAZ)</Todo>
              </div>
            </div>
          </div>
        </div>
        <Metodo>
          ANP, arquivo mensal por posto (cerca de 75 mil coletas, com cerca de 30 dias de atraso). Razão por estado = mediana do etanol ÷ mediana da gasolina comum; 0,70 é a regra prática para motores flex. A coluna &quot;valor de compra&quot; vem vazia em 2026, por isso a margem em 5c é derivada: preço na bomba − refinaria − anidro − PIS/COFINS − ICMS monofásico. Brent em reais: seção 4.
        </Metodo>
        <ParaVoce>Dono de posto: a anatomia do litro do seu estado, com a defasagem Petrobras–Brent, uma vez por mês, por e-mail. Sem custo.</ParaVoce>
      </div>
    </section>
  )
}
