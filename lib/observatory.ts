// One call that gathers every instrument's reading for the page.
// Each live source is independent: if it fails, that instrument falls back to the committed snapshot
// (data/snapshot.json, refreshed by `npm run snapshot`) and its stamp says so. The page never renders a blank tile.
import snap from '@/data/snapshot.json'
import { isotonicDecreasing, type Pt } from './chart'
import { AREAS, fetchCarga, fetchCmo, type Area, type Carga, type Cmo, type Sub } from './sources/ons'
import { fetchFred, fetchKalshi, fetchPoly, fetchPtax, type FredSeries, type Kalshi, type Poly, type Ptax } from './sources/markets'
import { fetchCaiso, fetchHq, fetchWeather, type Caiso, type Hq, type Weather } from './sources/abroad'

export type SourceKey = 'ons' | 'cmo' | 'fred' | 'ptax' | 'kalshi' | 'poly' | 'hq' | 'caiso' | 'weather'
export type Status = { live: boolean; asOf: string }

export type Observatory = {
  renderedAt: string
  carga: Carga
  cmo: Cmo
  wti: FredSeries
  brent: FredSeries
  hh: FredSeries
  ptax: Ptax
  kalshi: Kalshi
  poly: Poly
  hq: Hq
  caiso: Caiso
  weather: Weather
  status: Record<SourceKey, Status>
  // Build-time datasets (monthly or slower); cited on the page with their own dates.
  pld: typeof snap.pld
  bandeira: typeof snap.bandeira
  b1: typeof snap.b1
  a4: typeof snap.a4
  bdgd: typeof snap.bdgd
  lab: typeof snap.lab
  fuel: typeof snap.fuel
  litro: typeof snap.litro
  acl: typeof snap.acl
  gd: typeof snap.gd
}

const HALF_HOUR = 30 * 60_000

function snapCarga(): Carga {
  const end = new Date(snap.asOf.ons).getTime()
  const n = snap.sin.length
  const t = Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * HALF_HOUR).toISOString())
  const byArea = snap.sinArea as Record<Area, number[]>
  const now = Object.fromEntries(AREAS.map((a) => [a, snap.sinBy[a]])) as Record<Area, number>
  return { t, byArea, sin: snap.sin, now, sinNow: snap.sinNow, asOf: snap.asOf.ons }
}

function snapHq(): Hq {
  const end = new Date(snap.asOf.hq).getTime()
  const n = snap.quebec.length
  const t = Array.from({ length: n }, (_, i) => new Date(end - (n - 1 - i) * 15 * 60_000).toISOString())
  return { t, mw: snap.quebec, now: snap.quebecNow, asOf: snap.asOf.hq, lastPeak: snap.hqPeakLast }
}

const FALLBACK = {
  ons: snapCarga,
  cmo: (): Cmo => ({ day: snap.cmoDay, bySub: snap.cmo as Record<Sub, number[]> }),
  fred: () => ({
    wti: [{ d: snap.asOf.fred, v: snap.wtiNow }],
    brent: [{ d: snap.asOf.fred, v: snap.brentNow }],
    hh: [{ d: snap.asOf.fred, v: snap.hhNow }],
  }),
  ptax: (): Ptax => ({ venda: snap.ptax, day: snap.ptaxDay }),
  kalshi: (): Kalshi => {
    const pts = snap.kalshi as Pt[]
    const fit = isotonicDecreasing(pts.map(([, p]) => p))
    return { close: snap.asOf.kalshi, ladder: pts.map(([k], i) => [k, fit[i]] as Pt) }
  },
  poly: (): Poly => ({ title: snap.asOf.polymarket, high: snap.polyHigh as Pt[], low: snap.polyLow as Pt[] }),
  hq: snapHq,
  caiso: (): Caiso => snap.caiso as Caiso,
  weather: (): Weather => snap.weather as Weather,
}

async function attempt<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch (e) {
    console.warn('[observatory] source failed, using snapshot:', (e as Error).message)
    return null
  }
}

export async function getObservatory(now = new Date()): Promise<Observatory> {
  const [carga, cmo, wti, brent, hh, ptax, kalshi, poly, hq, caiso, weather] = await Promise.all([
    attempt(() => fetchCarga(now)),
    attempt(() => fetchCmo(now)),
    attempt(() => fetchFred('DCOILWTICO')),
    attempt(() => fetchFred('DCOILBRENTEU')),
    attempt(() => fetchFred('DHHNGSP')),
    attempt(() => fetchPtax(now)),
    attempt(() => fetchKalshi(now)),
    attempt(fetchPoly),
    attempt(fetchHq),
    attempt(fetchCaiso),
    attempt(fetchWeather),
  ])
  const fred = wti && brent && hh ? { wti, brent, hh } : FALLBACK.fred()
  const o = {
    renderedAt: now.toISOString(),
    carga: carga ?? FALLBACK.ons(),
    cmo: cmo ?? FALLBACK.cmo(),
    ...fred,
    ptax: ptax ?? FALLBACK.ptax(),
    kalshi: kalshi ?? FALLBACK.kalshi(),
    poly: poly ?? FALLBACK.poly(),
    hq: hq ?? FALLBACK.hq(),
    caiso: caiso ?? FALLBACK.caiso(),
    weather: weather ?? FALLBACK.weather(),
  }
  const status: Record<SourceKey, Status> = {
    ons: { live: !!carga, asOf: o.carga.asOf },
    cmo: { live: !!cmo, asOf: o.cmo.day },
    fred: { live: !!(wti && brent && hh), asOf: o.brent.at(-1)!.d },
    ptax: { live: !!ptax, asOf: o.ptax.day },
    kalshi: { live: !!kalshi, asOf: kalshi ? now.toISOString() : snap.takenAt },
    poly: { live: !!poly, asOf: poly ? now.toISOString() : snap.takenAt },
    hq: { live: !!hq, asOf: o.hq.asOf },
    caiso: { live: !!caiso, asOf: o.caiso.time.at(-1)! },
    weather: { live: !!weather, asOf: weather ? now.toISOString() : snap.takenAt },
  }
  return {
    ...o,
    status,
    pld: snap.pld,
    bandeira: snap.bandeira,
    b1: snap.b1,
    a4: snap.a4,
    bdgd: snap.bdgd,
    lab: snap.lab,
    fuel: snap.fuel,
    litro: snap.litro,
    acl: snap.acl,
    gd: snap.gd,
  }
}
