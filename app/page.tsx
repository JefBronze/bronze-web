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
        <div className="wrap hojein">
          <a href="#pulso"><i>SIN</i><b>{fmt(o.carga.sinNow)} MW</b></a>
          <a href="#preco"><i>CMO SE/CO</i><b>R$ {dec(cmoSE, 1)}/MWh</b></a>
          <a href="#preco"><i>Bandeira</i><b>amarela · jun/26</b></a>
          <a href="#mercado"><i>Mercado livre</i><b>{Math.round(o.acl.share.total * 100)} % do consumo</b></a>
          <a href="#petroleo"><i>Brent</i><b>R$ {dec(brentL)}/L</b></a>
          <a href="#petroleo"><i>Dólar</i><b>R$ {dec(o.ptax.venda, 4)}</b></a>
          <a href="#bomba"><i>Gasolina Curitiba</i><b>R$ {dec((o.fuel.curitiba as Record<string, number>).GASOLINA)}/L</b></a>
          <span><i>lido</i><b>{ddmm(o.renderedAt)} · {hhmm(o.renderedAt)} BRT</b></span>
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
