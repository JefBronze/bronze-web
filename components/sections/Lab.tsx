import { scale } from '@/lib/chart'
import { dec } from '@/lib/format'
import type { Observatory } from '@/lib/observatory'
import { Kicker, Lido, Metodo, Todo } from '../ui'

export default function Lab({ o }: { o: Observatory }) {
  const tiers = o.lab.tiers as [string, number][]
  const ly = scale(0, 12, 160, 20)
  let steps = ''
  let drops = ''
  let area = 'M0 160'
  tiers.forEach(([, w], i) => {
    const x0 = i * 120
    const x1 = x0 + 110
    const y = ly(w).toFixed(1)
    steps += `M${x0} ${y}H${x1}`
    area += `L${x0} ${y}L${x1} ${y}`
    if (i < tiers.length - 1) drops += `M${x1} ${y}L${x1 + 10} ${ly(tiers[i + 1][1]).toFixed(1)}`
  })
  area += 'L590 160Z'
  const restore = `M600 ${ly(tiers.at(-1)![1]).toFixed(1)}L660 ${ly(tiers[0][1]).toFixed(1)}H720`
  const label = (w: number) => (w < 0.5 ? '~0' : w === Math.round(w) ? `~${w}` : dec(w, 1))

  return (
    <section className="sec" id="lab" aria-labelledby="lab-h">
      <div className="wrap g2r">
        <div className="inst">
          <div className="instl">
            <span>carga do nó de inferência por nível · W</span>
            <span>medições de 06/06/2026</span>
          </div>
          <svg className="svg" viewBox="0 0 720 200" role="img" aria-label={`Degraus de redução de carga: ${tiers.map(([t, w]) => `${t} ${label(w)} W`).join(', ')}; retorno em ${o.lab.restoreS} s.`}>
            <path d={area} fill="var(--c1)" opacity={0.08} />
            <path d={steps} fill="none" stroke="var(--c1)" strokeWidth={2} />
            <path d={drops} fill="none" stroke="var(--c1)" strokeDasharray="2 3" />
            <path d={restore} fill="none" stroke="var(--c2)" strokeWidth={2} strokeDasharray="5 3" />
            <line x1={0} y1={160} x2={720} y2={160} stroke="var(--line)" />
            {tiers.map(([t, w], i) => (
              <text key={t} className="ax" x={i * 120 + 55} y={178} textAnchor="middle">{`${t} · ${label(w)} W`}</text>
            ))}
            <text className="ax" x={720} y={178} textAnchor="end">{`retorno em ${o.lab.restoreS} s`}</text>
            <text className="axl" x={0} y={12}>0–12 W</text>
          </svg>
          <div className="stamp">
            <span>OpenADR 3.0 VEN · Raspberry Pi 5 ×2 · tomada inteligente</span>
            <Todo>degraus a partir de medições pontuais; a série temporal gravada entra quando exportada do VPS</Todo>
          </div>
        </div>
        <div>
          <Kicker n={11}>Laboratório OpenADR</Kicker>
          <h2 className="h2" id="lab-h">Computação consegue reduzir carga a um sinal da rede?</h2>
          <p className="lede">Em Montréal, dois Raspberry Pi 5 — um nó de inferência de IA e um gateway OpenADR 3.0 — recebem eventos de resposta da demanda e reduzem a carga em níveis medidos na tomada.</p>
          <Lido label="Medido">
            De ~{dec(tiers[0][1], 1)} W em operação normal a ~0 W no nível máximo, com retorno à operação em {o.lab.restoreS} segundos. Sinais que o gateway escuta: Hydro-Québec, ONS, NYISO, CAISO, ISO-NE. Integração com carregadores de VE via OCPP.
          </Lido>
          <Metodo>Cinco níveis: T0 normal, T1 governor conservador, T2 powersave, T3 processo suspenso, T4 corte na tomada. Potência medida por tomada inteligente. O evento se encerra sozinho ao fim da duração + 15 s. Código aberto (Apache 2.0).</Metodo>
        </div>
      </div>
    </section>
  )
}
