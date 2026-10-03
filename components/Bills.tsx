import { SEG_FILL, type Bill } from '@/lib/derive'
import { dec, fmt } from '@/lib/format'

/** Horizontal bill stacks on a shared 0–1 000 R$/MWh axis, so bills in different sections compare by eye. */
export default function Bills({ bills, cmo }: { bills: Bill[]; cmo?: number }) {
  const W = 300
  const scale = (v: number) => (v / 1000) * W
  return (
    <div className="bills">
      {bills.map((b) => {
        let acc = 0
        return (
          <div className="bill" key={b.name}>
            <div className="billh">
              <span className="billn">{b.name}</span>
              <span className="billt">R$ {fmt(b.total)}/MWh</span>
            </div>
            <svg className="svg" viewBox="0 0 300 120" role="img" aria-label={`${b.name}: R$ ${fmt(b.total)} por MWh, decomposto em ${b.segs.map((s) => `${s.name} ${fmt(s.v)}`).join(', ')}.`}>
              {b.segs.map((s) => {
                const xx = acc
                acc += scale(s.v)
                return <rect key={s.name} x={xx.toFixed(1)} y={30} width={scale(s.v).toFixed(1)} height={60} fill={SEG_FILL[s.kind]} opacity={0.85} />
              })}
              <line x1={0} y1={90} x2={W} y2={90} stroke="var(--ink)" />
              {cmo !== undefined && (
                <>
                  <line x1={scale(cmo)} y1={22} x2={scale(cmo)} y2={98} stroke="var(--c4)" strokeDasharray="3 3" />
                  <text className="ax" x={scale(cmo) + 5} y={14}>{`CMO ${dec(cmo, 0)}`}</text>
                </>
              )}
              <text className="ax" x={0} y={110}>0</text>
              <text className="ax" x={W} y={110} textAnchor="end">1 000 R$/MWh</text>
            </svg>
            {b.segs.map((s) => (
              <div className="seg" key={s.name}>
                <span>
                  <i style={{ background: SEG_FILL[s.kind] }} />
                  {s.name}
                </span>
                <span className="mono">{fmt(s.v)}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
