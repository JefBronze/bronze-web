import { dec, fmt } from '@/lib/format'
import type { Observatory } from '@/lib/observatory'
import { Kicker, Lido, Metodo } from '../ui'

export default function Parana({ o }: { o: Observatory }) {
  const b = o.bdgd
  const px = (p: number) => (p / 0.5) * 560
  const sector = (n: string) => b.sectors.find((s) => s.n === n)
  const edu = sector('Educação')
  const hosp = sector('Hospitais')

  return (
    <section className="sec" id="parana" aria-labelledby="parana-h">
      <div className="wrap g2">
        <div>
          <Kicker n={6}>Demanda ociosa no Paraná</Kicker>
          <h2 className="h2" id="parana-h">Quanta demanda contratada fica sem uso?</h2>
          <p className="lede">Empresas de média tensão contratam uma potência e pagam por ela todo mês, usem ou não. A base pública da ANEEL permite medir o que sobra.</p>
          <Lido label="Lido na BDGD 2025">
            Nas {fmt(b.units)} unidades A4 da Copel, {Math.round(b.idleShare * 100)} % da demanda de pico fica sem uso num mês típico: R$ {dec(b.brlYear / 1e6, 1)} milhões por ano.
            {edu && hosp && ` Escolas deixam ${Math.round(edu.idle * 100)} %; hospitais, ${Math.round(hosp.idle * 100)} %.`}
          </Lido>
          <Metodo>
            BDGD V11 (ano-base 2025), tabela UCMT: demanda medida mês a mês, unidades A4 ativas, sem geração distribuída, pico ≥ 30 kW; meses 1 a 11 (dezembro anômalo na base). Ociosa = 1 − (demanda média mensal ÷ pico anual). Valor = kW ociosos × R$ 20,78/kW (TUSD demanda Verde, REH 3.472/2025, antes de tributos) × 12.
          </Metodo>
        </div>
        <div className="inst">
          <div className="instl">
            <span>parcela ociosa por setor · mediana</span>
            <span>R$/ano</span>
          </div>
          {b.sectors.map((s) => (
            <div className="sect" key={s.n}>
              <span>{s.n}</span>
              <span>
                <span className={s.n === 'Todas A4' ? 'bar me' : 'bar win'} style={{ width: `${Math.round((s.idle / 0.35) * 100)}%` }} />
              </span>
              <span>{dec(s.idle * 100, 1)} %</span>
              <span>{dec(s.brl / 1e6, 1)} mi</span>
            </div>
          ))}
          <div className="instl" style={{ marginTop: 22 }}>
            <span>distribuição · todas as {fmt(b.units)} unidades</span>
            <span>percentis</span>
          </div>
          <svg className="svg" viewBox="0 0 560 60" role="img" aria-label={`Percentis da parcela ociosa: p10 ${dec(b.pct.p10 * 100, 1)} %, mediana ${dec(b.pct.p50 * 100, 1)} %, p90 ${dec(b.pct.p90 * 100, 1)} %.`}>
            <line x1={0} y1={30} x2={560} y2={30} stroke="var(--line)" />
            <rect x={px(b.pct.p25)} y={18} width={px(b.pct.p75) - px(b.pct.p25)} height={24} fill="var(--c1)" opacity={0.18} />
            <line x1={px(b.pct.p50)} y1={12} x2={px(b.pct.p50)} y2={48} stroke="var(--c1)" strokeWidth={2} />
            <line x1={px(b.pct.p10)} y1={22} x2={px(b.pct.p10)} y2={38} stroke="var(--ink)" />
            <line x1={px(b.pct.p90)} y1={22} x2={px(b.pct.p90)} y2={38} stroke="var(--ink)" />
            <text className="ax" x={0} y={58}>0 %</text>
            <text className="ax" x={280} y={58} textAnchor="middle">25 %</text>
            <text className="ax" x={560} y={58} textAnchor="end">50 %</text>
          </svg>
          <div className="legend">
            <span>
              p10 {dec(b.pct.p10 * 100, 1)} % · p25 {dec(b.pct.p25 * 100, 1)} % · <b>p50 {dec(b.pct.p50 * 100, 1)} %</b> · p75 {dec(b.pct.p75 * 100, 1)} % · p90 {dec(b.pct.p90 * 100, 1)} %
            </span>
          </div>
          <div className="stamp">
            <span>ANEEL · BDGD V11 · Copel · ano-base 2025</span>
            <span>análise concluída em set/2026</span>
          </div>
        </div>
      </div>
    </section>
  )
}
