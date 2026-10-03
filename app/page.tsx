import ThemeToggle from '@/components/ThemeToggle'
import Bastidores from '@/components/sections/Bastidores'
import Bomba from '@/components/sections/Bomba'
import Fora from '@/components/sections/Fora'
import Lab from '@/components/sections/Lab'
import Mercado from '@/components/sections/Mercado'
import Parana from '@/components/sections/Parana'
import Petroleo from '@/components/sections/Petroleo'
import Preco from '@/components/sections/Preco'
import Pulso from '@/components/sections/Pulso'
import { DJ_URL } from '@/components/ui'
import { BBL_LITERS, cmoSlotNow } from '@/lib/derive'
import { dec, ddmm, fmt, hhmm } from '@/lib/format'
import { getObservatory } from '@/lib/observatory'

// The page is rebuilt in the background at most every 5 minutes; each source also keeps its own cache (lib/sources).
export const revalidate = 300

const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '14389796085').replace(/\D/g, '')
const SECTIONS = ['pulso', 'preco', 'mercado', 'petroleo', 'bomba', 'parana', 'fora', 'lab', 'bastidores']

export default async function Page() {
  const o = await getObservatory()
  const cmoSE = o.cmo.bySub.SE[cmoSlotNow(o) ?? 47]
  const brentL = (o.brent.at(-1)!.v * o.ptax.venda) / BBL_LITERS

  return (
    <>
      <a className="skip" href="#pulso">Pular para o conteúdo</a>
      <header className="hdr">
        <div className="wrap hdrin">
          <a className="brand" href="#pulso">
            <span className="brandname serif">Bronze Engenharia</span>
            <span className="brandsub">de Energia</span>
          </a>
          <ThemeToggle />
        </div>
      </header>
      <div className="hoje" aria-label="Leituras de agora">
        <div className="ticker">
          <div className="track">
            {/* Two identical groups: the track slides by exactly one group, so the loop has no seam.
                The copy is hidden from assistive tech and the tab order. */}
            {[false, true].map((copy) => (
              <div className="tgroup" key={String(copy)} aria-hidden={copy || undefined}>
                {[
                  ['#pulso', 'SIN', `${fmt(o.carga.sinNow)} MW`],
                  ['#preco', 'CMO SE/CO', `R$ ${dec(cmoSE, 1)}/MWh`],
                  ['#preco', 'Bandeira', 'amarela · jun/26'],
                  ['#mercado', 'Mercado livre', `${Math.round(o.acl.share.total * 100)} % do consumo`],
                  ['#mercado', 'Geração distribuída', `${dec(o.gd.gw, 1)} GW`],
                  ['#petroleo', 'Brent', `R$ ${dec(brentL)}/L`],
                  ['#petroleo', 'Dólar', `R$ ${dec(o.ptax.venda, 4)}`],
                  ['#bomba', 'Gasolina Curitiba', `R$ ${dec((o.fuel.curitiba as Record<string, number>).GASOLINA)}/L`],
                  ['#bomba', 'Etanol Curitiba', `R$ ${dec((o.fuel.curitiba as Record<string, number>).ETANOL)}/L`],
                ].map(([href, label, value]) => (
                  <a key={label} href={href} tabIndex={copy ? -1 : undefined}>
                    <i>{label}</i>
                    <b>{value}</b>
                  </a>
                ))}
                <span>
                  <i>lido</i>
                  <b>{ddmm(o.renderedAt)} · {hhmm(o.renderedAt)} BRT</b>
                </span>
              </div>
            ))}
          </div>
        </div>
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
        <Mercado o={o} />
        <Petroleo o={o} />
        <Bomba o={o} />
        <Parana o={o} />
        <Fora o={o} />
        <Lab o={o} />
        <Bastidores o={o} />
      </main>
      <footer className="foot wrap">
        <span>Bronze Engenharia de Energia</span>
        <span className="sep">·</span>
        <span>CNPJ 19.824.419/0001-96</span>
        <span className="sep">·</span>
        <span>CREA-PR 194835/D</span>
        <span className="sep">·</span>
        <span>Curitiba · Montréal</span>
        <span className="sep">·</span>
        <a href={`https://wa.me/${WHATSAPP}`}>WhatsApp</a>
        <span className="sep">·</span>
        <a href="mailto:contato@data-joule.com">contato@data-joule.com</a>
        <span className="sep">·</span>
        <a className="dj" href={DJ_URL}>Data Joule</a>
      </footer>
    </>
  )
}
