import { a4Parts, aclBill, bill, A4_CASE } from '@/lib/derive'
import { dec, fmt } from '@/lib/format'
import type { Observatory } from '@/lib/observatory'
import Bills from '../Bills'
import { BRONZE_URL, Kicker, Lido, Metodo, ParaVoce, Todo } from '../ui'

export default function Mercado({ o }: { o: Observatory }) {
  const { acl, gd } = o
  const pc = (v: number) => Math.round(v * 100)
  const [lowP, , highP] = acl.precos
  const bills = [bill(o, 'Cativo', a4Parts(o, 'verde')), aclBill(o, lowP), aclBill(o, highP)]
  const perTenYear = A4_CASE.mwh * 12 * 10
  const fioB = gd.fioB as [number, number][]
  const yearNow = Number(o.renderedAt.slice(0, 4))
  const iNow = Math.max(0, fioB.findIndex(([y]) => y === yearNow))
  const fy = (share: number) => (120 - share * 106).toFixed(1)
  // Copel B1 Fio B, derived from the REH's own SCEE table: uncredited TUSD share ÷ the law's Fio B fraction for 2026.
  const fioBShare = (1 - gd.copelB1.credTusd2026) / 0.6
  const fioBkWh = fioBShare * o.b1.tusd
  const full = (o.b1.te + o.b1.tusd) * 1000
  const credit = (o.b1.te + o.b1.tusd * gd.copelB1.credTusd2026) * 1000
  const fioPath = fioB.map(([, s], i) => `${i ? 'L' : 'M'}${i * 80} ${fy(s)}H${i * 80 + 80}`).join('')
  const rows: [string, number, string][] = [
    ['indústria', acl.share.industria, 'bar win'],
    ['comércio', acl.share.comercio, 'bar win'],
    ['Brasil', acl.share.total, 'bar me'],
  ]

  return (
    <section className="sec" id="mercado" aria-labelledby="mercado-h">
      <div className="wrap">
        <Kicker n={5}>Mercado livre e geração distribuída</Kicker>
        <h2 className="h2" id="mercado-h">Livre, cativo ou no telhado: onde a sua energia é comprada?</h2>
        <p className="lede">
          Desde 2024 qualquer consumidor de média tensão pode deixar a distribuidora e comprar energia no mercado livre (ACL), liquidado na CCEE. E {dec(gd.systems / 1e6, 1)} milhões de telhados já geram a própria. As três opções pagam o mesmo fio — o que muda é a energia.
        </p>
        <Lido label="Lido na CCEE e na ABGD">
          {pc(acl.share.total)} % de toda a energia consumida no Brasil já é comprada no mercado livre — {pc(acl.share.industria)} % na indústria, {pc(acl.share.comercio)} % no comércio. Em 2025 migraram {fmt(acl.migr[0][1] as number)} consumidores; em abril de 2026, {fmt(acl.migr[2][1] as number)}, três quartos deles pela mão de um varejista. A geração distribuída chegou a {dec(gd.gw, 1)} GW; o Paraná é o {gd.pr.rank}º estado, com {dec(gd.pr.gw, 1)} GW em {fmt(gd.pr.plants / 1000)} mil usinas.
        </Lido>
        <div className="g3">
          <div className="inst">
            <div className="instl">
              <span>5a · consumo no mercado livre · {acl.shareAsOf}</span>
              <span>% do consumo</span>
            </div>
            <div className="rows" style={{ gap: 6 }}>
              {rows.map(([n, v, cls]) => (
                <div className="row" key={n} style={{ gridTemplateColumns: '7em minmax(0,1fr) 3.5em' }}>
                  <span>{n}</span>
                  <span>
                    <span className={cls} style={{ width: `${pc(v)}%` }} />
                  </span>
                  <span>{pc(v)} %</span>
                </div>
              ))}
            </div>
            <div className="tiles two" style={{ marginTop: 18 }}>
              <div className="tile">
                <div className="tl">migrações · 2025</div>
                <div className="tv">{fmt(acl.migr[0][1] as number)}</div>
                <div className="tu">consumidores · CCEE</div>
              </div>
              <div className="tile">
                <div className="tl">1º tri 2026</div>
                <div className="tv">{fmt(acl.migr[1][1] as number)}</div>
                <div className="tu">{fmt(acl.apiSimplificada1T26)} pela adesão simplificada (API)</div>
              </div>
            </div>
            <div className="stamp">
              <span>CCEE InfoMercado · Abraceel · {acl.shareAsOf}</span>
              <span>PR: {acl.prAbr26} migrações em abr/26</span>
            </div>
            <Metodo>
              Participação por classe: CCEE/Abraceel, consumo de {acl.shareAsOf}. Migrações: boletins mensais da CCEE (InfoMercado). O portal de dados abertos da CCEE bloqueia leitura automática; estes números entram no build a partir do boletim do mês, com data. Elegibilidade: Portaria MME 50/2022 — todo o Grupo A desde 1/1/2024. Baixa tensão: a Lei 15.269/2025 (art. 15, § 17, da Lei 9.074/1995), publicada em 25/11/2025, dá prazo máximo de 24 meses para indústria e comércio (até 25/11/2027) e de 36 meses para os demais, inclusive residências (até 25/11/2028). São prazos máximos, e a abertura depende antes de plano de comunicação, tarifas separadas para os dois ambientes, regras do suprimento de última instância, um produto padrão com preço de referência e regras para a sobrecontratação das distribuidoras.
            </Metodo>
          </div>
          <div className="inst span2">
            <div className="instl">
              <span>5b · a mesma fatura A4, cativo e livre · {A4_CASE.mwh} MWh · {A4_CASE.kw} kW · Copel</span>
              <span>R$/MWh · régua de 2c</span>
            </div>
            <Bills bills={bills} />
            <div className="stamp">
              <span>fio (TUSD energia + demanda) e tributos &quot;por dentro&quot; idênticos nos três</span>
              <Todo>preço de contrato: cenários R$ {lowP} e {highP}/MWh (curva BBCE/Dcide não é pública); encargos do ACL a incluir</Todo>
            </div>
            <Metodo>
              Cativo = A4 Verde da seção 2c. Livre: a TE e a bandeira saem; entra a energia a preço de contrato (R$/MWh, antes de tributos), que o consumidor abaixo de 500 kW compra por meio de um comercializador varejista. O fio continua da Copel. ICMS, PIS e COFINS incidem igual. As diferenças entre contrato e consumo são liquidadas na CCEE ao PLD horário — o CMO da seção 2a é o seu precursor diário.
            </Metodo>
            <ParaVoce>
              Com {A4_CASE.mwh} MWh/mês, cada R$ 10/MWh de diferença no preço de contrato são R$ {fmt(perTenYear / 1000)} mil por ano. A{' '}
              <a className="bz" href={BRONZE_URL}>
                Bronze Engenharia
              </a>{' '}
              simula a migração com as suas 12 faturas antes de qualquer contrato.
            </ParaVoce>
          </div>
        </div>
        <div className="g2" style={{ marginTop: 40 }}>
          <div>
            <div className="instl">
              <span>5c · geração distribuída · ABGD / ANEEL · jan/2026</span>
              <span>Brasil</span>
            </div>
            <div className="tiles" style={{ marginTop: 12 }}>
              <div className="tile">
                <div className="tl">potência instalada</div>
                <div className="tv">{dec(gd.gw, 1)} GW</div>
                <div className="tu">{pc(gd.solarShare)} % solar · meta ABGD 2026: {gd.proj2026} GW</div>
              </div>
              <div className="tile">
                <div className="tl">sistemas</div>
                <div className="tv">{dec(gd.systems / 1e6, 2)} mi</div>
                <div className="tu">{fmt(gd.ucs / 1e6)} mi unidades com crédito · {fmt(gd.municipios)} municípios</div>
              </div>
              <div className="tile">
                <div className="tl">Paraná</div>
                <div className="tv">{dec(gd.pr.gw, 1)} GW</div>
                <div className="tu">{gd.pr.rank}º estado · {fmt(gd.pr.plants / 1000)} mil usinas</div>
              </div>
            </div>
            <div className="stamp">
              <span>ABGD · balanço jan/2026 · ANEEL (base de GD, build mensal)</span>
            </div>
          </div>
          <div className="inst">
            <div className="instl">
              <span>5d · quanto vale o kWh injetado · Lei 14.300 · Fio B</span>
              <span>% do Fio B cobrado</span>
            </div>
            <svg className="svg" viewBox="0 0 560 150" role="img" aria-label={`Rampa da cobrança do Fio B sobre a energia injetada: ${fioB.map(([y, s]) => `${y} ${pc(s)} %`).join(', ')}.`}>
              <line x1={0} y1={120} x2={560} y2={120} stroke="var(--line)" />
              <rect x={iNow * 80} y={14} width={80} height={106} fill="var(--c2)" opacity={0.1} />
              <path d={fioPath} fill="none" stroke="var(--c2)" strokeWidth={2} />
              {fioB.map(([y], i) => (
                <text key={y} className="ax" x={i * 80 + 40} y={136} textAnchor="middle">
                  {y}
                </text>
              ))}
              <text className="axl" x={0} y={12}>0–100 %</text>
              <text className="axa" x={iNow * 80 + 40} y={10} textAnchor="middle">{`${fioB[iNow][0]} · ${pc(fioB[iNow][1])} %`}</text>
            </svg>
            <div className="stamp">
              <span>Lei 14.300/2022, art. 27 · pedidos de acesso a partir de 7/1/2023</span>
              <span>
                Copel B1: Fio B = {dec(fioBShare * 100, 1)} % da TUSD (R$ {dec(fioBkWh, 3)}/kWh) · em {fioB[iNow][0]} o kWh injetado vale R$ {dec(credit / 1000, 3)} em vez de R$ {dec(full / 1000, 3)}, sem tributos
              </span>
            </div>
            <Metodo>
              Cada kWh compensado vira crédito igual à tarifa cheia menos a fração do Fio B do ano (remuneração, depreciação e operação da rede de distribuição). Para um telhado com pedido de acesso hoje: crédito = TE + TUSD − {pc(fioB[iNow][1])} % × Fio B. Os degraus 15, 30, 45, 60, 75 e 90 % (2023 a 2028) estão no art. 27; a partir de 2029 vale a regra do art. 17, definida pela ANEEL com diretrizes do CNPE, que o gráfico mostra como 100 % do Fio B por referência. Sistemas com pedido anterior a 7/1/2023 mantêm o regime antigo até 2045. Minigeração acima de 500 kW de fonte não despachável em autoconsumo remoto ou geração compartilhada paga 100 % do Fio B e 40 % do Fio A até 2028 (art. 27, § 1º). Na Copel, a {gd.copelB1.reh} credita {dec(gd.copelB1.credTusd2026 * 100, 2)} % da TUSD B1 em 2026 e {dec(gd.copelB1.credTusd2027 * 100, 2)} % em 2027; a parte não creditada é 60 % e 75 % do Fio B, o que dá Fio B = {dec(fioBShare * 100, 2)} % da TUSD nos dois anos. Com TE {dec(o.b1.te * 1000, 2)} e TUSD {dec(o.b1.tusd * 1000, 2)} R$/MWh, o crédito do kWh injetado em 2026 é TE + {dec(gd.copelB1.credTusd2026 * 100, 2)} % da TUSD.
            </Metodo>
            <ParaVoce>Telhado comercial em Curitiba: a conta de quanto o sol compensa muda a cada ano até 2029 — e muda de novo se você migrar para o livre. As duas decisões se calculam juntas.</ParaVoce>
          </div>
        </div>
      </div>
    </section>
  )
}
