import { brDate, ddmm, hhmm } from '@/lib/format'
import type { Observatory, SourceKey } from '@/lib/observatory'
import { Kicker } from '../ui'

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
        <Kicker n={12}>Bastidores</Kicker>
        <h2 className="h2" id="bastidores-h">De onde vêm os números.</h2>
        <div className="colo">
          <div>
            <p className="ct">Ao vivo · lidos pelo servidor</p>
            <div className="li"><span>ONS · dados abertos (CSV)</span><span>carga, CMO, balanço, usinas, térmicas</span></div>
            <div className="li"><span>ONS · Energia Agora</span><span>minuto a minuto, hoje</span></div>
            <div className="li"><span>Arquivos mensais grandes</span><span>só o fim do arquivo é baixado</span></div>
            <div className="li"><span>FRED · BCB · Kalshi · Polymarket</span><span>petróleo, dólar, mercados</span></div>
            <div className="li"><span>Hydro-Québec · CAISO · Open-Meteo</span><span>redes de fora e clima</span></div>
            <div className="li"><span>Cada fonte com cache próprio</span><span>2 min → 6 h</span></div>
            <div className="li"><span>Fonte fora do ar</span><span>última leitura, marcada</span></div>
          </div>
          <div>
            <p className="ct">Montados antes · atualizados à mão</p>
            <div className="li"><span>ANP · preço por posto</span><span>mensal, ~75 mil postos</span></div>
            <div className="li"><span>ANEEL · BDGD · tarifas (REH)</span><span>anual</span></div>
            <div className="li"><span>CCEE · InfoMercado · InfoBandeira</span><span>mensal, copiado à mão</span></div>
            <div className="li"><span>ONS · cadastro de usinas</span><span>+ Wikidata e IBGE para o mapa</span></div>
            <div className="li"><span>ONS · cortes de eólica e solar</span><span>20–45 MB por mês</span></div>
            <div className="li"><span>Frases e gráficos</span><span>gerados dos dados, no servidor</span></div>
            <div className="li"><span>Repositório público</span><span>MIT</span></div>
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
          Curitiba e Montréal: a engenharia é do Paraná, registrada no CREA-PR, com clientes de média tensão e as bases da ANEEL e da Copel que alimentam este site. Montréal é a outra base: lá a Hydro-Québec e a Hilo publicam demanda e eventos de ponta em tempo quase real, a referência para a resposta da demanda que o Brasil ainda vai construir.
        </p>
      </div>
    </section>
  )
}
