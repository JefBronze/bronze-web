import Menu from '@/components/Menu'
import ThemeToggle from '@/components/ThemeToggle'
import Ticker, { type TickItem } from '@/components/Ticker'
import Bastidores from '@/components/sections/Bastidores'
import Bomba from '@/components/sections/Bomba'
import Fora from '@/components/sections/Fora'
import Mercado from '@/components/sections/Mercado'
import Mini from '@/components/sections/Mini'
import Motor from '@/components/sections/Motor'
import Eletrico from '@/components/sections/Eletrico'
import Parana from '@/components/sections/Parana'
import Pato from '@/components/sections/Pato'
import Quem from '@/components/sections/Quem'
import Petroleo from '@/components/sections/Petroleo'
import Preco from '@/components/sections/Preco'
import Tendencias from '@/components/sections/Tendencias'
import Pulso from '@/components/sections/Pulso'
import Link from 'next/link'
import { BRONZE_URL } from '@/components/ui'
import { BBL_LITERS, cmoSlotNow, curtailStats, termicaStats, FLAG_NAME, flagNow } from '@/lib/derive'
import { dec, ddmm, fmt, hhmm, monthLabel, pct } from '@/lib/format'
import { getObservatory } from '@/lib/observatory'

// The page is rebuilt in the background at most every 5 minutes; each source also keeps its own cache (lib/sources).
export const revalidate = 300

const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '14389796085').replace(/\D/g, '')
const SECTIONS = ['pulso', 'preco', 'pato', 'quem', 'mercado', 'minigeracao', 'petroleo', 'bomba', 'motor', 'eletrico', 'parana', 'fora', 'tendencias', 'bastidores']
// Titles for the menu, in page order (same words as each section's kicker).
const TITLES = [
  'Pulso · ao vivo',
  'O preço da energia no Brasil',
  'A curva do pato',
  'Quem gera',
  'Mercado livre e geração distribuída',
  'Minigeração sob controle',
  'Petróleo, em reais',
  'Na bomba',
  'O motor por dentro',
  'O motor elétrico por dentro',
  'Demanda ociosa no Paraná',
  'Lá fora',
  'Tendências',
  'Bastidores',
]

export default async function Page() {
  const o = await getObservatory()
  const cmoSE = o.cmo.bySub.SE[cmoSlotNow(o) ?? 47]
  const brentL = (o.brent.at(-1)!.v * o.ptax.venda) / BBL_LITERS
  const fuel = o.fuel.curitiba as Record<string, number>
  const cut = curtailStats(o)
  const term = termicaStats(o)
  const ticker: TickItem[] = [
    {
      href: '#pulso',
      label: 'SIN',
      value: `${fmt(o.carga.sinNow)} MW`,
      tip: 'Carga do Sistema Interligado Nacional: a potência que o Brasil inteiro está consumindo agora, somando Sudeste/Centro-Oeste, Sul, Nordeste e Norte. Dado verificado do ONS, a cada meia hora.',
    },
    {
      href: '#preco',
      label: 'CMO SE/CO',
      value: `R$ ${dec(cmoSE, 1)}/MWh`,
      tip: `Custo Marginal de Operação no Sudeste/Centro-Oeste: quanto custaria gerar mais 1 MWh nesta meia hora, segundo o modelo de despacho do ONS. Quando sobra água e sol, ele pode chegar a zero. É a base do preço de curto prazo (PLD), que não cai abaixo do piso de R$ ${dec(o.pld.piso)}/MWh.`,
    },
    {
      href: '#preco',
      label: 'Bandeira',
      value: `${FLAG_NAME[flagNow(o)]} · ${monthLabel(o.bandeira.mes)}`,
      tip: 'Bandeira tarifária: sinal mensal da ANEEL sobre o custo de gerar energia. Na verde não há acréscimo. Na amarela e nas vermelhas, cada 100 kWh da conta de luz fica mais caro, porque falta água nos reservatórios e entram usinas térmicas, mais caras.',
    },
    ...(term
      ? [
          {
            href: '#quem',
            label: 'Térmicas ontem',
            value: `${fmt(term.total / 1000)} GWh · ${pct(term.byMotivo.inflex / term.total)} inflex.`,
            tip: `Energia das usinas térmicas (gás, carvão, óleo, biomassa e nuclear) despachadas pelo ONS em ${ddmm(`${term.day}T15:00:00Z`)}. A maior parte liga por inflexibilidade, a geração mínima que o dono da usina declara (contrato de combustível, exigência técnica), e não porque é a opção mais barata: só ${pct(term.byMotivo.merito / term.total)} foi pela ordem de custo.`,
          },
        ]
      : []),
    {
      href: '#pato',
      label: 'Cortes eól.+sol.',
      value: `${dec(cut.total / 1e6, 1)} TWh · ${monthLabel(cut.m)}`,
      tip: `Energia eólica e solar que o ONS mandou deixar de gerar em ${monthLabel(cut.m)}, ${pct(cut.lostShare)} do que essas usinas poderiam ter produzido. Acontece quando sobra energia ao meio-dia, falta rede para escoar ou a operação exige folga. ${pct(cut.ne)} dos cortes foram no Nordeste.`,
    },
    {
      href: '#mercado',
      label: 'Mercado livre',
      value: `${Math.round(o.acl.share.total * 100)} % do consumo`,
      tip: `Parcela do consumo de energia do país comprada no mercado livre (ACL): empresas que negociam a energia direto com geradores e comercializadoras, fora da tarifa da distribuidora. Dado da CCEE, ${o.acl.shareAsOf}.`,
    },
    {
      href: '#mercado',
      label: 'Geração distribuída',
      value: `${dec(o.gd.gw, 1)} GW`,
      tip: 'Potência instalada em pequenas usinas junto ao consumo, quase toda solar em telhados. A energia que sobra vira crédito que abate a conta de luz (Lei 14.300). Dado da ANEEL.',
    },
    {
      href: '#petroleo',
      label: 'Brent',
      value: `R$ ${dec(brentL)}/L`,
      tip: 'Petróleo Brent, a referência internacional, convertido em reais por litro (dólares por barril × dólar ÷ 159 litros). É o óleo cru, antes de refino, impostos e margens.',
    },
    {
      href: '#petroleo',
      label: 'Dólar',
      value: `R$ ${dec(o.ptax.venda, 4)}`,
      tip: 'Dólar PTAX de venda, a cotação oficial do Banco Central. Pesa no preço do petróleo e dos combustíveis.',
    },
    {
      href: '#bomba',
      label: 'Gasolina Curitiba',
      value: `R$ ${dec(fuel.GASOLINA)}/L`,
      tip: `Preço mediano da gasolina comum nos postos de Curitiba, no levantamento da ANP de ${o.fuel.month}. Metade dos postos cobra menos que isso, metade cobra mais.`,
    },
    {
      href: '#bomba',
      label: 'Etanol Curitiba',
      value: `R$ ${dec(fuel.ETANOL)}/L`,
      tip: `Preço mediano do etanol hidratado nos postos de Curitiba (ANP, ${o.fuel.month}). Pela regra prática, compensa abastecer com etanol quando ele custa até 70 % do preço da gasolina.`,
    },
    {
      label: 'lido',
      value: `${ddmm(o.renderedAt)} · ${hhmm(o.renderedAt)} BRT`,
      tip: 'Hora em que esta página foi montada com as leituras mais recentes. Ela se atualiza sozinha a cada poucos minutos; cada instrumento mostra a hora da própria fonte.',
    },
  ]

  return (
    <>
      <a className="skip" href="#pulso">Pular para o conteúdo</a>
      <header className="hdr">
        <div className="wrap hdrin">
          <a className="brand" href="#pulso" aria-label="Data Joule — início">
            <svg className="djmark" width={24} height={24} viewBox="0 0 36 36" aria-hidden="true">
              <rect x="4" y="22" width="6" height="10" fill="var(--ink)" />
              <rect x="13" y="16" width="6" height="16" fill="var(--ink)" />
              <rect x="22" y="12" width="6" height="20" fill="var(--ink)" />
              <rect x="2" y="5" width="32" height="3" fill="var(--dj)" />
            </svg>
            <span className="djword">
              Data<span className="djus">_</span>Joule
            </span>
            <span className="brandsub">observatório de energia</span>
          </a>
          <span className="hdrr">
            <Menu items={SECTIONS.map((id, i) => ({ id, title: TITLES[i] }))} />
            <ThemeToggle />
          </span>
        </div>
      </header>
      <div className="hoje" aria-label="Leituras de agora">
        <Ticker items={ticker} />
      </div>
      <nav className="rail" aria-label="Seções">
        {SECTIONS.map((id, i) => (
          <a key={id} href={`#${id}`} aria-label={`Seção ${i + 1}`}>
            {i + 1}
          </a>
        ))}
      </nav>
      <main>
        <Pulso o={o} />
        <Preco o={o} />
        <Pato o={o} />
        <Quem o={o} />
        <Mercado o={o} />
        <Mini o={o} />
        <Petroleo o={o} />
        <Bomba o={o} />
        <Motor o={o} />
        <Eletrico o={o} />
        <Parana o={o} />
        <Fora o={o} />
        <Tendencias o={o} />
        <Bastidores o={o} />
      </main>
      <footer className="foot wrap">
        <span className="fg">
          <span>Data Joule é um projeto da</span>
          <a className="bz" href={BRONZE_URL}>Bronze Engenharia de Energia</a>
        </span>
        <span className="fg">
          <span>CNPJ 19.824.419/0001-96</span>
          <span className="sep">·</span>
          <span>CREA-PR 194835/D</span>
        </span>
        <span className="fg">Curitiba · Montréal</span>
        <span className="fg">
          <a href={`https://wa.me/${WHATSAPP}`}>WhatsApp</a>
          <span className="sep">·</span>
          <a href="mailto:contato@data-joule.com">contato@data-joule.com</a>
          <span className="sep">·</span>
          <Link href="/privacidade">Privacidade</Link>
        </span>
      </footer>
    </>
  )
}
