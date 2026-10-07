// "Lá fora": Hydro-Québec demand + peak events, CAISO fuel source; Open-Meteo for Curitiba and Montréal.
import { getJson, getText, rows } from './http'

type HqRow = { date: string; valeurs_demandetotal: number }
type HqEvent = { datedebut: string }

export type Hq = { t: string[]; mw: number[]; now: number; asOf: string; lastPeak: string | null }

export async function fetchHq(): Promise<Hq> {
  const base = 'https://donnees.hydroquebec.com/api/explore/v2.1/catalog/datasets'
  const [d, ev] = await Promise.all([
    getJson<{ results: HqRow[] }>(`${base}/demande-electricite-quebec/records?order_by=date%20desc&limit=96&where=valeurs_demandetotal%20is%20not%20null`, 300),
    // The field is `datedebut` (not `date_debut`).
    getJson<{ results: HqEvent[] }>(`${base}/evenements-pointe/records?order_by=datedebut%20desc&limit=1`, 3600),
  ])
  const r = [...d.results].reverse()
  if (r.length < 24) throw new Error('HQ: too few points')
  return { t: r.map((x) => x.date), mw: r.map((x) => x.valeurs_demandetotal), now: r.at(-1)!.valeurs_demandetotal, asOf: r.at(-1)!.date, lastPeak: ev.results[0]?.datedebut?.slice(0, 10) ?? null }
}

export const CAISO_COLS = ['Natural Gas', 'Imports', 'Large Hydro', 'Nuclear', 'Batteries', 'Wind', 'Solar', 'Geothermal', 'Biomass', 'Biogas', 'Small hydro', 'Coal', 'Other'] as const
export type CaisoCol = (typeof CAISO_COLS)[number]
export type Caiso = { time: string[] } & Record<CaisoCol, number[]>

export function parseCaiso(text: string): Caiso {
  const [hdr, ...body] = rows(text)
  const idx = (c: string) => hdr.findIndex((h) => h.toLowerCase() === c.toLowerCase())
  const filled = body.filter((r) => r.slice(1).some((v) => v !== ''))
  const out = { time: filled.map((r) => r[idx('Time')]) } as Caiso
  for (const c of CAISO_COLS) {
    const i = idx(c)
    out[c] = filled.map((r) => (i >= 0 ? Number(r[i]) || 0 : 0))
  }
  if (out.time.length < 12) throw new Error('CAISO: too few rows')
  return out
}

export async function fetchCaiso(): Promise<Caiso> {
  return parseCaiso(await getText('https://www.caiso.com/outlook/current/fuelsource.csv', 300))
}

export type Weather = { Curitiba: number; Montréal: number }

export async function fetchWeather(): Promise<Weather> {
  const get = (lat: number, lon: number) =>
    getJson<{ current: { temperature_2m: number } }>(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`, 1800).then((j) => j.current.temperature_2m)
  const [cwb, mtl] = await Promise.all([get(-25.43, -49.27), get(45.5, -73.57)])
  return { Curitiba: cwb, Montréal: mtl }
}
