import { curtailStats } from '@/lib/derive'
import { dec, monthLabel, pct } from '@/lib/format'
import type { Observatory } from '@/lib/observatory'
import { BRONZE_URL, Kicker, Lido, Metodo, ParaVoce, Todo } from '../ui'

// Section 13: where the Brazilian power sector is heading. Market opening, Open Energy and a shorter settlement
// calendar follow the themes the CCEE itself put on the table; curtailment, demand response (OpenADR) and storage /
// microgrids are the operational side. Numbers come from the other sections' data; unverified claims carry <Todo>.
export default function Tendencias({ o }: { o: Observatory }) {
  const c = curtailStats(o)
  const acl = Math.round(o.acl.share.total * 100)

  const trends: { tag: string; title: string; body: React.ReactNode; href?: string; ver?: string }[] = [
    {
      tag: 'CCEE · abertura de mercado',
      title: 'Todo consumidor no mercado livre',
      body: (
        <>
          A Lei 15.269/2025 abre o mercado livre para a baixa tensão: indústria e comércio até 25/11/2027, os demais, inclusive residências, até
          25/11/2028. Hoje {acl} % do consumo já é livre. O desafio que a CCEE põe na mesa é a jornada: comparar ofertas, migrar com segurança e
          acompanhar o contrato quando quem representa o consumidor é um varejista, sem que ninguém escolha por ele.
        </>
      ),
      href: '#mercado',
      ver: 'seção 5',
    },
    {
      tag: 'CCEE · abertura de mercado',
      title: 'Open Energy: o consumidor dono dos seus dados',
      body: (
        <>
          Para comparar ofertas e trocar de fornecedor, o consumidor precisa levar o próprio histórico de consumo, como já leva os dados bancários
          no Open Finance. Hoje a medição chega em formatos, granularidades e canais diferentes. Padronizar esses dados e permitir o
          compartilhamento autorizado é a base do Open Energy.
        </>
      ),
    },
    {
      tag: 'CCEE · redução de calendário',
      title: 'Do consumo ao dinheiro, mais rápido',
      body: (
        <>
          Entre o consumo medido e o pagamento na CCEE passam medição, contabilização e liquidação. Encurtar esse ciclo, ou ao menos mostrar antes o
          impacto financeiro, ajuda os agentes a planejar sem mexer nos prazos regulatórios. Com milhões de consumidores pequenos chegando, o volume
          de dados cresce e cada dia do calendário pesa mais.
        </>
      ),
    },
    {
      tag: 'ONS · operação',
      title: 'Curtailment: energia que sobra',
      body: (
        <>
          Em {monthLabel(c.m)}, o ONS mandou eólicas e solares deixarem de gerar {dec(c.total / 1e6, 1)} TWh, {pct(c.lostShare)} do que podiam
          produzir; {pct(c.ne)} dos cortes foram no Nordeste. Sobra energia no meio do dia e falta linha para escoar. A ANEEL discute tornar
          observável e controlável também a minigeração distribuída (CP 33/2026).
        </>
      ),
      href: '#pato',
      ver: 'seções 3 e 6',
    },
    {
      tag: 'Tendência · resposta da demanda',
      title: 'OpenADR: a rede avisa, o equipamento reage',
      body: (
        <>
          Em vez de só cortar geração, pagar para mover consumo para a hora certa. O ONS já opera um programa de resposta da demanda com grandes
          consumidores <Todo>regras atuais a confirmar</Todo>. O que falta é o padrão para automatizar em escala: OpenADR, o protocolo aberto em que
          a rede envia o aviso e carregadores, termostatos e baterias reagem sozinhos, como na Califórnia e nos desafios de inverno da Hilo, no
          Québec.
        </>
      ),
      href: '#fora',
      ver: 'seção 12',
    },
    {
      tag: 'Tendência · armazenamento',
      title: 'Baterias e microrredes',
      body: (
        <>
          Baterias e microrredes permitem a um consumidor, um condomínio ou um campus guardar a sobra do meio do dia e atravessar a ponta ou uma
          falta de energia. No Brasil o armazenamento ainda espera regulação própria e o primeiro leilão de capacidade com baterias{' '}
          <Todo>situação a confirmar</Todo>. Com os cortes crescendo e o preço horário chegando a mais consumidores pelo mercado livre, a conta
          começa a fechar.
        </>
      ),
    },
  ]

  return (
    <section className="sec" id="tendencias" aria-labelledby="tendencias-h">
      <div className="wrap">
        <Kicker n={13}>Tendências</Kicker>
        <h2 className="h2" id="tendencias-h">Para onde vai o setor elétrico brasileiro.</h2>
        <p className="lede">Seis mudanças em andamento, do jeito que a CCEE, a ANEEL e o ONS estão tratando. Onde há número, ele vem dos dados desta página.</p>
        <Lido>
          {acl} % do consumo já é comprado no mercado livre, e a baixa tensão entra até 2028. Em {monthLabel(c.m)}, {dec(c.total / 1e6, 1)} TWh de
          eólica e solar foram cortados. As duas coisas puxam na mesma direção: mais consumidores escolhendo de quem compram, e mais valor em
          consumir na hora certa.
        </Lido>

        <div className="trends">
          {trends.map((t) => (
            <article className="trend" key={t.title}>
              <p className="trend-k">{t.tag}</p>
              <h3>{t.title}</h3>
              <p>{t.body}</p>
              {t.href && (
                <a className="trend-l" href={t.href}>
                  ver na {t.ver} ↓
                </a>
              )}
            </article>
          ))}
        </div>

        <Metodo>
          Os três primeiros temas seguem os desafios que a CCEE abriu ao mercado em 2026: abertura de mercado (escolha informada e migração,
          acompanhamento do consumidor no varejo, padronização dos dados de medição) e redução de calendário (contabilização e previsibilidade
          financeira). Prazos da abertura: Lei 15.269/2025, detalhados na seção 5. Cortes: arquivos de restrição de eólica e solar do ONS (seção
          3). CP 33/2026: voto da ANEEL (seção 6). Itens marcados &quot;a confirmar&quot; ainda não foram checados na fonte primária.
        </Metodo>
        <ParaVoce>
          Vai migrar para o mercado livre, ou quer saber se armazenamento e resposta da demanda fazem sentido no seu caso? Fale com a{' '}
          <a className="bz" href={BRONZE_URL}>
            Bronze Engenharia
          </a>
          : <a href="mailto:contato@data-joule.com">contato@data-joule.com</a>.
        </ParaVoce>
      </div>
    </section>
  )
}
