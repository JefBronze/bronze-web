import { line, scale } from '@/lib/chart'
import { a4Parts, atSlot, b1Bill, bill, cmoSlotNow, cmoStats, flagNow, slotText, SUB_NAME, SUB_SHORT, A4_CASE, FLAG_FILL, FLAG_NAME, type Flag } from '@/lib/derive'
import { dec, ddmm, fmt, isoDay, monthLabel } from '@/lib/format'
import type { Observatory } from '@/lib/observatory'
import { CMO_SUBS, type Sub } from '@/lib/sources/ons'
import Bills from '../Bills'
import { DJ_URL, Kicker, Lido, Metodo, ParaVoce, Stamp, Swatch } from '../ui'

const SUB_STROKE: Record<Sub, string> = { SE: 'var(--c1)', S: 'var(--c2)', NE: 'var(--c3)', N: 'var(--c4)' }

function dayWord(o: Observatory) {
  const today = isoDay(o.renderedAt)
  const yesterday = isoDay(new Date(new Date(o.renderedAt).getTime() - 86_400_000))
  return o.cmo.day === today ? 'Hoje' : o.cmo.day === yesterday ? 'Ontem' : `Em ${ddmm(`${o.cmo.day}T12:00:00Z`)}`
}

export default function Preco({ o }: { o: Observatory }) {
  const now = cmoSlotNow(o)
  const st = cmoStats(o, now ?? 47)
  const allMax = Math.max(...CMO_SUBS.flatMap((s) => o.cmo.bySub[s]))
  // Scale to the day: a cheap day would otherwise be a flat line on a 0–400 axis.
  const yMax = Math.max(100, Math.ceil((allMax * 1.1) / 50) * 50)
  const y = scale(0, yMax, 190, 20)
  const xNow = now === null ? null : (now / 47) * 680
  const b1 = b1Bill(o)
  const verde = bill(o, 'A4 Verde', a4Parts(o, 'verde'))
  const azul = bill(o, 'A4 Azul', a4Parts(o, 'azul'))
  const cmoRef = st.now.SE
  const flag = flagNow(o)
  const hist = o.bandeira.hist as [string, string][]

  return (
    <section className="sec" id="preco" aria-labelledby="preco-h">
      <div className="wrap">
        <Kicker n={2}>O preço da energia no Brasil</Kicker>
        <h2 className="h2" id="preco-h">Quanto custa um MWh hoje — do modelo de despacho até três faturas diferentes.</h2>
        <Lido>
          {dayWord(o)}, o custo marginal no Sudeste{' '}
          {st.zero
            ? `fica perto de zero ${st.zero.from === 0 ? 'da meia-noite' : st.zero.from === 24 ? 'do meio-dia' : `das ${slotText(st.zero.from)}`} ${st.zero.to === 24 ? 'ao meio-dia' : `às ${slotText(st.zero.to)}`}, com o sol, e chega a R$ ${fmt(st.max)} ${atSlot(st.maxSlot)}.`
            : `vai de R$ ${fmt(st.min)} ${atSlot(st.minSlot)} a R$ ${fmt(st.max)} ${atSlot(st.maxSlot)}.`}
          {st.spread.ratio >= 1.3 && (
            <>
              {' '}
              {atSlot(st.spread.slot, true)}, o MWh no {SUB_NAME[st.spread.hi]} custa {dec(st.spread.ratio, 1)} vezes o do {SUB_NAME[st.spread.lo]}.
            </>
          )}{' '}
          Na fatura de uma casa em Curitiba, o mesmo MWh sai por R$ {fmt(b1.total)}.
        </Lido>
        <div className="g3">
          <div className="inst span2">
            <div className="instl">
              <span>2a · atacado · CMO semi-horário · {ddmm(`${o.cmo.day}T12:00:00Z`)}</span>
              <span>R$/MWh</span>
            </div>
            <svg className="svg" viewBox="0 0 680 220" role="img" aria-label={`Custo marginal de operação por subsistema, 48 meias-horas de ${o.cmo.day}.`}>
              <line x1={0} y1={y(o.pld.piso)} x2={680} y2={y(o.pld.piso)} stroke="var(--c5)" strokeDasharray="2 4" />
              <text className="ax" x={680} y={y(o.pld.piso)} dy={-3} textAnchor="end">{`piso PLD ${dec(o.pld.piso, 1)}`}</text>
              {o.pld.tetoEstrutural > yMax && <text className="ax" x={680} y={12} textAnchor="end">{`teto PLD ${fmt(o.pld.tetoEstrutural)} · fora da escala`}</text>}
              {(['N', 'NE', 'S', 'SE'] as Sub[]).map((s) => (
                <path key={s} d={line(o.cmo.bySub[s], 0, 680, 20, 190, 0, yMax)} fill="none" stroke={SUB_STROKE[s]} strokeWidth={s === 'SE' ? 2 : 1.5} />
              ))}
              {xNow !== null && (
                <>
                  <line x1={xNow} y1={20} x2={xNow} y2={190} stroke="var(--ink)" strokeDasharray="3 3" />
                  <text className="axa" x={xNow > 600 ? xNow - 4 : xNow + 4} y={32} textAnchor={xNow > 600 ? 'end' : 'start'}>agora</text>
                </>
              )}
              <line x1={0} y1={190} x2={680} y2={190} stroke="var(--line)" />
              <text className="ax" x={0} y={206}>00:00</text>
              <text className="ax" x={170} y={206} textAnchor="middle">06:00</text>
              <text className="ax" x={340} y={206} textAnchor="middle">12:00</text>
              <text className="ax" x={510} y={206} textAnchor="middle">18:00</text>
              <text className="ax" x={680} y={206} textAnchor="end">23:30 BRT</text>
              <text className="axl" x={0} y={12}>{`0–${yMax} R$/MWh`}</text>
            </svg>
            <div className="legend">
              {CMO_SUBS.map((s) => (
                <span key={s}>
                  <Swatch color={SUB_STROKE[s]} />
                  {SUB_SHORT[s]} {dec(st.now[s], 1)}
                </span>
              ))}
              <span className="badge">{now === null ? 'última meia-hora do dia' : 'meia-hora atual'}</span>
            </div>
            <Stamp status={o.status.cmo} source={`ONS · CMO_SEMIHORARIO_${o.cmo.day.slice(0, 4)}.csv`} when={ddmm(`${o.cmo.day}T12:00:00Z`)} cadence="diário">
              <span>PLD {o.pld.ano}: piso {dec(o.pld.piso)} · teto estrutural {dec(o.pld.tetoEstrutural)} · teto horário {dec(o.pld.tetoHorario)} R$/MWh ({o.pld.ato})</span>
            </Stamp>
          </div>
          <div className="inst">
            <div className="instl">
              <span>2b · bandeira do mês</span>
              <span>R$/kWh</span>
            </div>
            <div className="flags">
              {(
                [
                  ['Verde', 'verde'],
                  ['Amarela', 'amarela'],
                  ['Verm. 1', 'vermelha1'],
                  ['Verm. 2', 'vermelha2'],
                ] as const
              ).map(([n, k]) => (
                <div key={k} className={k === flag ? 'flag on' : 'flag'}>
                  <span className="flagn">{n}</span>
                  <span className="flagv">{o.b1.bandeira[k] ? dec(o.b1.bandeira[k], 5) : '0'}</span>
                </div>
              ))}
            </div>
            <svg className="svg" viewBox="0 0 300 40" role="img" aria-label={`Bandeiras de ${hist[0][0]} a ${hist.at(-1)![0]}: ${hist.map(([m, f]) => `${m} ${FLAG_NAME[f as Flag]}`).join(', ')}.`}>
              {hist.map(([m, f], i) => (
                <rect key={m} x={(i * 300) / hist.length + 0.5} y={4} width={300 / hist.length - 1} height={16} fill={FLAG_FILL[f as Flag]} opacity={0.85} />
              ))}
              <text className="ax" x={0} y={34}>{monthLabel(hist[0][0])}</text>
              <text className="ax" x={300} y={34} textAnchor="end">{monthLabel(hist.at(-1)![0])}</text>
            </svg>
            <div className="stamp">
              <span>
                {monthLabel(o.bandeira.mes)}: bandeira {FLAG_NAME[flag]} · últimos {hist.length} meses acima
              </span>
            </div>
            <Metodo>
              Acréscimos da bandeira em R$/kWh antes de tributos, fixados pela REH ANEEL 3.306/2024 e ainda vigentes. A bandeira de cada mês é a anunciada pela ANEEL no fim do mês anterior; o histórico foi conferido em notícias datadas de cada anúncio e em tabelas de distribuidoras, porque as páginas da ANEEL e da CCEE não permitem leitura automática. As faturas de 2c e 3b usam a bandeira do mês corrente.
            </Metodo>
          </div>
        </div>
        <div className="inst" style={{ marginTop: 40 }}>
          <div className="instl">
            <span>2c · três faturas, um MWh · Copel · {o.b1.reh}</span>
            <span>R$/MWh, mesma régua em 3b</span>
          </div>
          <div className="ctl">
            <span>distribuidora <b>Copel</b></span>
            <span>B1: <b>{o.b1.refKwh} kWh</b> (fatura de referência)</span>
            <span>A4: <b>{A4_CASE.mwh} MWh/mês · {A4_CASE.kw} kW · {A4_CASE.ponta * 100} % na ponta</b></span>
            <span>bandeira <b>{FLAG_NAME[flag]}</b></span>
          </div>
          <Bills bills={[b1, verde, azul]} cmo={cmoRef} />
          <div className="stamp">
            <span>Tarifas da {o.b1.reh} (revisão de 24/06/2026, efeito médio +20,51 %), tarifas de aplicação sem tributos, Tabelas 1 e 2 do anexo</span>
            <span>o modelo reproduziu a fatura real de jun/2026 (ainda na REH 3.472/2025) com diferença de R$ {dec(Math.abs(o.b1.refCalc - o.b1.refTotal))}</span>
          </div>
          <Metodo>
            Tarifas homologadas antes de tributos ({o.b1.reh}): B1 TE {dec(o.b1.te, 5)} + TUSD {dec(o.b1.tusd, 5)} R$/kWh; A4 Verde TUSD demanda {dec(o.a4.verde.demanda)} R$/kW, TUSD energia ponta {dec(o.a4.verde.tusdP)} / fora {dec(o.a4.verde.tusdFP)} R$/MWh, TE ponta {dec(o.a4.verde.teP)} / fora {dec(o.a4.verde.teFP)}; A4 Azul demanda ponta {dec(o.a4.azul.demandaP)} / fora {dec(o.a4.azul.demandaFP)} R$/kW, TUSD energia {dec(o.a4.azul.tusdE)} R$/MWh (igual na ponta e fora dela), TE como na Verde. Tributos &quot;por dentro&quot;: preço ÷ [(1 − ICMS) × (1 − PIS − COFINS)] com ICMS {dec(o.b1.icms * 100, 0)} %, PIS {dec(o.b1.pis * 100, 4)} %, COFINS {dec(o.b1.cofins * 100, 4)} %. CIP municipal na B1. Modelo em URPX (padrão aberto de tarifas da LF Energy). O tracejado marca o CMO do Sudeste na meia-hora indicada em 2a: a fatia que vem do atacado.
          </Metodo>
          <ParaVoce>
            Se a sua empresa é Grupo A (média tensão), a diferença entre Verde e Azul e a demanda que você contrata mas não usa são dinheiro recuperável. A{' '}
            <a className="dj" href={DJ_URL}>
              Data Joule
            </a>{' '}
            lê 12 faturas e devolve o valor em 5 dias úteis.
          </ParaVoce>
        </div>
      </div>
    </section>
  )
}
