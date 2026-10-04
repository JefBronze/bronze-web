import { brDate, ddmm, hhmm } from '@/lib/format'
import type { Observatory, SourceKey } from '@/lib/observatory'
import { Kicker, Todo } from '../ui'

const MTL = 'America/Toronto'

export default function Bastidores({ o }: { o: Observatory }) {
  const s = o.status
  const at = (k: SourceKey) => (s[k].live ? `${hhmm(o.renderedAt)} BRT` : `snapshot · ${ddmm(s[k].asOf)}`)
  const sources: [string, string, boolean][] = [
    ['ONS · carga verificada', `${hhmm(o.carga.asOf)} BRT`, s.ons.live],
    ['ONS · CMO semi-horário', ddmm(`${o.cmo.day}T12:00:00Z`), s.cmo.live],
    ['ONS · Energia Agora', o.agora ? `${o.agora.t.at(-1)} BRT` : 'sem sinal', s.agora.live],
    ['ONS · balanço de energia', ddmm(`${o.balanco.day}T15:00:00Z`), s.balanco.live],
    ['ONS · restrição de eólica e solar', o.curtail.at(-1)!.m, true],
    ['ONS · geração por usina', o.usinaDia ? ddmm(`${o.usinaDia.day}T15:00:00Z`) : 'sem sinal', s.usinas.live],
    ['ONS · térmicas por motivo', o.termicas ? ddmm(`${o.termicas.day}T15:00:00Z`) : 'sem sinal', s.termicas.live],
    ['ONS · CVU semanal', o.cvu ? ddmm(`${o.cvu.from}T15:00:00Z`) : 'sem sinal', s.cvu.live],
    ['CCEE · InfoBandeira', o.gatilho.meses.at(-1)!.m, true],
    ['Wikidata · IBGE · posições e mapa', 'build', true],
    ['FRED · Brent, WTI, Henry Hub', brDate(o.brent.at(-1)!.d), s.fred.live],
    ['BCB · PTAX', brDate(o.ptax.day), s.ptax.live],
    ['Kalshi · KXWTI', at('kalshi'), s.kalshi.live],
    ['Polymarket · Gamma API', at('poly'), s.poly.live],
    ['Hydro-Québec · demande', `${hhmm(o.hq.asOf, MTL)} Montréal`, s.hq.live],
    ['CAISO · fuel source', `${o.caiso.time.at(-1)} hora local`, s.caiso.live],
    ['Open-Meteo', at('weather'), s.weather.live],
    ['ANP · preços por posto', o.fuel.month, true],
    ['CCEE · InfoMercado', o.acl.shareAsOf, true],
    ['ANEEL · BDGD V11', '2025', true],
  ]

  return (
    <section className="sec" id="bastidores" aria-labelledby="bastidores-h">
      <div className="wrap">
        <Kicker n={14}>Bastidores</Kicker>
        <h2 className="h2" id="bastidores-h">Como isto é feito.</h2>
        <div className="colo">
          <div>
            <p className="ct">Método</p>
            <div className="li"><span>Next.js · React Server Components</span><span>render no servidor</span></div>
            <div className="li"><span>Gráficos em SVG escrito à mão</span><span>sem biblioteca</span></div>
            <div className="li"><span>Motores 3D (seções 9 e 10): Blender + three.js</span><span>carregados só ao chegar lá</span></div>
            <div className="li"><span>Fontes auto-hospedadas</span><span>CSP estrita</span></div>
            <div className="li"><span>Cada fonte com cache próprio</span><span>2 min → 6 h</span></div>
            <div className="li"><span>Fonte fora do ar</span><span>última leitura, marcada</span></div>
            <div className="li"><span>Repositório público</span><span>MIT</span></div>
          </div>
          <div className="budget">
            <p className="ct">Orçamento · medido no build</p>
            <div><div className="bv">≥ 95</div><div className="bl">Lighthouse, nas quatro notas · meta</div></div>
            <div><div className="bv">179 kB</div><div className="bl">JavaScript no cliente (gzip): o runtime do Next.js e do React; os gráficos chegam prontos do servidor, sem JS</div></div>
            <div><div className="bv">0</div><div className="bl">cookies · rastreadores de terceiros</div></div>
            <Todo>verificação automática no CI: a ligar</Todo>
          </div>
          <div>
            <p className="ct">Fontes · última leitura</p>
            {sources.map(([name, when, live]) => (
              <div className="li" key={name}>
                <span>{name}</span>
                <span className={live ? 'mono' : 'mono stale'}>{when}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="why">
          Por que Curitiba e Montréal: a engenharia é registrada no Paraná, onde estão os clientes de média tensão e as bases da ANEEL; o laboratório fica em Montréal, onde a Hydro-Québec publica demanda e eventos de ponta em tempo quase real.
        </p>
      </div>
    </section>
  )
}
