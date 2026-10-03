// Oil: FRED spot series, BCB PTAX, Kalshi KXWTI ladder, Polymarket "What will WTI hit in <month>?".
import { getJson, getText, rows } from './http'
import { isotonicDecreasing, type Pt } from '../chart'

export type FredSeries = { d: string; v: number }[]

export function parseFred(text: string, keep = 60): FredSeries {
  return rows(text)
    .slice(1)
    .filter(([d, v]) => d && v && v !== '.')
    .map(([d, v]) => ({ d, v: Number(v) }))
    .filter((r) => Number.isFinite(r.v))
    .slice(-keep)
}

export async function fetchFred(id: string): Promise<FredSeries> {
  const s = parseFred(await getText(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`, 6 * 3600))
  if (!s.length) throw new Error(`FRED ${id}: empty`)
  return s
}

export type Ptax = { venda: number; day: string }

/** PTAX is published on business days; walk back until a quote exists. */
export async function fetchPtax(now = new Date()): Promise<Ptax> {
  for (let back = 0; back < 7; back++) {
    const d = new Date(now.getTime() - back * 86_400_000)
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${mm}-${dd}-${d.getUTCFullYear()}'&$format=json`
    const j = await getJson<{ value: { cotacaoVenda: number; dataHoraCotacao: string }[] }>(url, 6 * 3600)
    const q = j.value.at(-1)
    if (q) return { venda: q.cotacaoVenda, day: q.dataHoraCotacao.slice(0, 10) }
  }
  throw new Error('PTAX: no quote in 7 days')
}

type KalshiMarket = { floor_strike?: number; yes_bid_dollars?: string | number; yes_ask_dollars?: string | number; close_time: string }

export type Kalshi = { close: string; ladder: Pt[] }

/** Nearest-expiry ladder, mid of bid/ask per strike, forced monotone (isotonic). */
export function parseKalshi(markets: KalshiMarket[], now = new Date()): Kalshi {
  const open = markets.filter((m) => new Date(m.close_time) > now && m.floor_strike != null)
  const close = open.map((m) => m.close_time).sort()[0]
  if (!close) throw new Error('Kalshi: no open market')
  const pts = open
    .filter((m) => m.close_time === close)
    .map((m) => {
      const bid = Number(m.yes_bid_dollars)
      const ask = Number(m.yes_ask_dollars)
      return [m.floor_strike as number, (bid + ask) / 2] as Pt
    })
    .filter(([, p]) => Number.isFinite(p) && p > 0)
    .sort((a, b) => a[0] - b[0])
  if (pts.length < 5) throw new Error('Kalshi: ladder too short')
  const fit = isotonicDecreasing(pts.map(([, p]) => p))
  return { close, ladder: pts.map(([k], i) => [k, Math.round(fit[i] * 1000) / 1000] as Pt) }
}

export async function fetchKalshi(now = new Date()): Promise<Kalshi> {
  const j = await getJson<{ markets: KalshiMarket[] }>('https://api.elections.kalshi.com/trade-api/v2/markets?limit=200&status=open&series_ticker=KXWTI', 120)
  return parseKalshi(j.markets, now)
}

type PolyEvent = { title: string; markets: { question: string; outcomePrices: string; closed?: boolean }[] }

export type Poly = { title: string; high: Pt[]; low: Pt[] }

/** Questions read like "Will WTI hit (HIGH) $100 in October?" / "(LOW) $85". */
export function parsePoly(events: PolyEvent[]): Poly {
  const e = events.find((x) => x.title.includes('WTI') && /hit/i.test(x.title))
  if (!e) throw new Error('Polymarket: no WTI "hit" event')
  const high: Pt[] = []
  const low: Pt[] = []
  for (const m of e.markets) {
    const strike = Number(m.question.split('$')[1]?.match(/[\d.]+/)?.[0])
    const yes = Number(JSON.parse(m.outcomePrices)[0])
    if (!Number.isFinite(strike) || !Number.isFinite(yes)) continue
    if (m.question.includes('(HIGH)')) high.push([strike, yes])
    else if (m.question.includes('(LOW)')) low.push([strike, yes])
  }
  high.sort((a, b) => a[0] - b[0])
  low.sort((a, b) => a[0] - b[0])
  if (!high.length) throw new Error('Polymarket: empty ladder')
  return { title: e.title, high, low }
}

export async function fetchPoly(): Promise<Poly> {
  const ev = await getJson<PolyEvent[]>('https://gamma-api.polymarket.com/events?limit=20&active=true&closed=false&tag_slug=oil&order=volume24hr&ascending=false', 120)
  return parsePoly(ev)
}
