import { curve, steps, x as sx } from '@/lib/chart'
import { BBL_LITERS, kalshiStats, polyRange } from '@/lib/derive'
import { brDate, dayMonth, dec, ddmm, fmt, hhmm, isoDay } from '@/lib/format'
import type { Observatory } from '@/lib/observatory'
import { Kicker, Lido, Metodo, ParaVoce, Stamp, Swatch } from '../ui'

const MONTHS: Record<string, string> = {
  January: 'janeiro', February: 'fevereiro', March: 'março', April: 'abril', May: 'maio', June: 'junho',
  July: 'julho', August: 'agosto', September: 'setembro', October: 'outubro', November: 'novembro', December: 'dezembro',
}

export default function Petroleo({ o }: { o: Observatory }) {
  const brent = o.brent.at(-1)!
  const wti = o.wti.at(-1)!
  const bbl = brent.v * o.ptax.venda
  const perL = bbl / BBL_LITERS
  const k = kalshiStats(o.kalshi.ladder)
  const kMin = Math.floor(k.median) - 6
  const kMax = kMin + 12
  const kx = (v: number) => sx(v, kMin, kMax, 0, 500)
  const kPts = o.kalshi.ladder.filter(([p]) => p >= kMin && p <= kMax)
  const kDay = dayMonth(isoDay(o.kalshi.close))
  const pr = polyRange(o.poly.high, o.poly.low)
  const pMin = 60
  const pMax = 120
  const px = (v: number) => sx(v, pMin, pMax, 0, 500)
  const month = MONTHS[o.poly.title.match(/in (\w+) \d{4}/)?.[1] ?? ''] ?? 'o mês'
  const hasK = Number.isFinite(k.median)
  const clamp = (v: number) => Math.min(500, Math.max(0, v))

  return (
    <section className="sec" id="petroleo" aria-labelledby="petroleo-h">
      <div className="wrap">
        <Kicker n={4}>Petróleo, em reais</Kicker>
        <h2 className="h2" id="petroleo-h">O barril entra em dólar e sai na bomba em real — e o que o mercado aposta para o mês.</h2>
        <p className="lede">O preço do combustível no Brasil começa aqui: Brent vezes dólar. Dois mercados de previsão apostam dinheiro em patamares do petróleo; fazem perguntas diferentes — e é por isso que ficam em dois painéis.</p>
        <Lido>
          O Brent fechou a US$ {dec(brent.v)} em {dayMonth(brent.d)}; com o dólar PTAX a R$ {dec(o.ptax.venda, 4)}, o barril vale R$ {fmt(bbl)} — R$ {dec(perL)} por litro de petróleo cru, antes de refino, mistura e impostos.
          {hasK && ` O Kalshi aposta que o WTI fecha ${kDay} perto de $${dec(k.median, 1)}, com 80 % de chance entre $${dec(k.lo80, 1)} e $${dec(k.hi80, 1)}.`}
          {pr.lo && pr.hi && ` No Polymarket, ${month} deve tocar algum valor entre $${pr.lo[0]} e $${pr.hi[0]}; $${pr.hi[0]} tem ${Math.round(pr.hi[1] * 100)} %.`}
        </Lido>
        <div className="tiles" style={{ margin: '0 0 26px 0' }}>
          <div className="tile">
            <div className="tl">Brent · spot</div>
            <div className="tv">{dec(brent.v)}</div>
            <div className="tu">US$/bbl · {dayMonth(brent.d)} · FRED · WTI {dec(wti.v)}</div>
          </div>
          <div className="tile">
            <div className="tl">dólar · PTAX venda</div>
            <div className="tv">{dec(o.ptax.venda, 4)}</div>
            <div className="tu">R$/US$ · {dayMonth(o.ptax.day)} · Banco Central</div>
          </div>
          <div className="tile">
            <div className="tl">Brent em reais</div>
            <div className="tv">{dec(perL)}</div>
            <div className="tu">R$/litro · {fmt(bbl)} R$/bbl</div>
          </div>
        </div>
        <div className="g2e">
          <div className="inst">
            <div className="instl">
              <span>Kalshi · P(fechar acima de X) · {kDay}</span>
              <span>distribuição implícita</span>
            </div>
            <svg className="svg" viewBox="0 0 500 210" role="img" aria-label={`Probabilidade de o WTI fechar acima de cada preço em ${kDay}, Kalshi; mediana ${dec(k.median, 1)} dólares.`}>
              {hasK && <rect x={kx(k.lo80)} y={20} width={kx(k.hi80) - kx(k.lo80)} height={140} fill="var(--c1)" opacity={0.1} />}
              <line x1={0} y1={90} x2={500} y2={90} stroke="var(--line)" strokeDasharray="2 4" />
              <text className="ax" x={500} y={86} textAnchor="end">50 %</text>
              <line x1={0} y1={160} x2={500} y2={160} stroke="var(--line)" />
              <path d={curve(kPts, kMin, kMax, 0, 500, 20, 160)} fill="none" stroke="var(--c1)" strokeWidth={2} />
              {hasK && <line x1={kx(k.median)} y1={20} x2={kx(k.median)} y2={160} stroke="var(--c1)" />}
              {wti.v >= kMin && wti.v <= kMax && <line x1={kx(wti.v)} y1={20} x2={kx(wti.v)} y2={160} stroke="var(--mute)" strokeDasharray="3 3" />}
              {[0, 3, 6, 9, 12].map((d, i) => (
                <text key={d} className="ax" x={i * 125} y={178} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{`$${kMin + d}`}</text>
              ))}
              {hasK && (
                <text className="axa" x={clamp(kx(k.median))} y={200} textAnchor={kx(k.median) > 330 ? 'end' : kx(k.median) < 170 ? 'start' : 'middle'}>
                  {`mediana $${dec(k.median, 1)} · faixa 80 %: $${dec(k.lo80, 1)}–$${dec(k.hi80, 1)}`}
                </text>
              )}
            </svg>
            <div className="legend">
              <span><Swatch color="var(--c1)" />P(fechar acima)</span>
              <span><Swatch color="var(--mute)" dashed />WTI spot (FRED)</span>
            </div>
            <Stamp status={o.status.kalshi} source="Kalshi KXWTI" when={o.status.kalshi.live ? `${hhmm(o.renderedAt)} BRT` : ddmm(o.status.kalshi.asOf)} cadence="2 min">
              <span>ponto médio bid/ask</span>
            </Stamp>
          </div>
          <div className="inst">
            <div className="instl">
              <span>Polymarket · P(tocar X em {month})</span>
              <span>escadas HIGH e LOW</span>
            </div>
            <svg className="svg" viewBox="0 0 500 210" role="img" aria-label={`Probabilidade de o WTI tocar cada nível durante ${month}, Polymarket.`}>
              {pr.lo && pr.hi && <rect x={px(pr.lo[0])} y={20} width={px(pr.hi[0]) - px(pr.lo[0])} height={140} fill="var(--c2)" opacity={0.12} />}
              <line x1={0} y1={90} x2={500} y2={90} stroke="var(--line)" strokeDasharray="2 4" />
              <text className="ax" x={500} y={86} textAnchor="end">50 %</text>
              <line x1={0} y1={160} x2={500} y2={160} stroke="var(--line)" />
              <path d={steps(o.poly.high.filter(([p]) => p <= pMax), pMin, pMax, 0, 500, 20, 160)} fill="none" stroke="var(--c2)" strokeWidth={2} />
              <path d={steps(o.poly.low.filter(([p]) => p >= pMin), pMin, pMax, 0, 500, 20, 160)} fill="none" stroke="var(--c2)" strokeWidth={2} strokeDasharray="5 3" />
              {wti.v >= pMin && wti.v <= pMax && <line x1={px(wti.v)} y1={20} x2={px(wti.v)} y2={160} stroke="var(--mute)" strokeDasharray="3 3" />}
              {[60, 75, 90, 105, 120].map((v, i) => (
                <text key={v} className="ax" x={i * 125} y={178} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{`$${v}`}</text>
              ))}
              {pr.lo && pr.hi && (
                <text className="axa" x={px((pr.lo[0] + pr.hi[0]) / 2)} y={200} textAnchor="middle">
                  {`faixa provável: $${pr.lo[0]}–$${pr.hi[0]} · $${pr.hi[0]} tem ${Math.round(pr.hi[1] * 100)} %`}
                </text>
              )}
            </svg>
            <div className="legend">
              <span><Swatch color="var(--c2)" />sobe até X (HIGH)</span>
              <span><Swatch color="var(--c2)" dashed />cai até X (LOW)</span>
            </div>
            <Stamp status={o.status.poly} source="Polymarket Gamma" when={o.status.poly.live ? `${hhmm(o.renderedAt)} BRT` : ddmm(o.status.poly.asOf)} cadence="2 min">
              <span>evento &quot;{o.poly.title}&quot;</span>
            </Stamp>
          </div>
        </div>
        <div className="g2e" style={{ marginTop: 14 }}>
          <Stamp status={o.status.fred} source="FRED · Brent, WTI" when={dayMonth(brent.d)} cadence="diário" />
          <Stamp status={o.status.ptax} source="BCB · PTAX" when={dayMonth(o.ptax.day)} cadence="diário" />
        </div>
        <Metodo>
          Kalshi: contratos &quot;WTI acima de X no fechamento&quot; do vencimento mais próximo; usamos o ponto médio bid/ask de cada strike, forçamos a curva a ser decrescente (ajuste isotônico) e lemos mediana e faixa de 80 % onde ela cruza 0,5, 0,9 e 0,1. Polymarket: contratos &quot;WTI toca X no mês&quot; para cima (HIGH) e para baixo (LOW); é probabilidade de toque, não distribuição do fechamento — por isso não se sobrepõe à curva do Kalshi. Spot: FRED, diário, com alguns dias de atraso; dólar: PTAX de venda do Banco Central, diário; 1 barril = {dec(BBL_LITERS, 3)} L. O &quot;Brent em reais&quot; é petróleo cru — a paridade de importação que o mercado acompanha usa gasolina e diesel prontos. Defasagem: cálculo da Abicom de {brDate(o.litro.paridade.data)}, conforme divulgado pela imprensa (o site da Abicom não permite leitura automática); atualizada à mão. Dados informativos; não é recomendação de investimento.
        </Metodo>
        <ParaVoce>
          Dono de posto ou gestor de frota: quando o Brent em reais sobe e o preço de refinaria da Petrobras fica parado, abre-se a defasagem — e cresce a chance de reajuste. Em {brDate(o.litro.paridade.data)}, a Abicom calculava a Petrobras R$ {dec(o.litro.paridade.gasolina.rl)}/L abaixo da paridade de importação na gasolina ({o.litro.paridade.gasolina.pct} %) e R$ {dec(o.litro.paridade.diesel.rl)}/L no diesel ({o.litro.paridade.diesel.pct} %). A seção 5 mostra onde isso cai no litro.
        </ParaVoce>
      </div>
    </section>
  )
}
