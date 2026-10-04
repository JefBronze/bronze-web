// ONS open data per plant: hourly generation (geracao-usina-2), thermal generation by dispatch reason
// (geracao-termica-despacho-2) and the weekly variable cost of each thermal plant (cvu-usitermica).
// The first two are monthly files that grow every day (~2.3 MB and ~1.1 MB per day); only the tail is read.
import { getTail, getText, rows } from './http'

const S3 = 'https://ons-aws-prod-opendata.s3.amazonaws.com/dataset'

/** Months to try, newest first: early in a month, yesterday may still be in last month's file. */
function months(now: Date): string[] {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const prev = new Date(Date.UTC(y, m - 1, 1))
  return [`${y}_${String(m + 1).padStart(2, '0')}`, `${prev.getUTCFullYear()}_${String(prev.getUTCMonth() + 1).padStart(2, '0')}`]
}

/** The latest day before `today` with all 24 hours, from rows keyed by "YYYY-MM-DD HH:MM:SS". */
function lastFullDay(hoursByDay: Map<string, Set<number>>, today: string): string | null {
  return [...hoursByDay.entries()].filter(([d, hs]) => d < today && hs.size === 24).map(([d]) => d).sort().at(-1) ?? null
}

async function firstWith<T>(now: Date, load: (ym: string) => Promise<T | null>): Promise<T> {
  for (const ym of months(now)) {
    const v = await load(ym)
    if (v) return v
  }
  throw new Error('no complete day in the last two monthly files')
}

// ---------- generation per plant -------------------------------------------------------------------------

export type UsinaDia = {
  day: string
  /** MWh generated over the day, by CEG (Itaipu's two halves share one CEG and are summed). */
  mwh: Record<string, number>
  /** Peak hourly MW of the day, by CEG. */
  peak: Record<string, number>
}

/** `din_instante;id_subsistema;…;nom_usina;id_ons;ceg;val_geracao`, hourly MW (= MWh in the hour). */
export function parseUsinaDia(text: string, today: string, cegs?: Set<string>): UsinaDia | null {
  const hours = new Map<string, Set<number>>()
  const perDay = new Map<string, Map<string, number[]>>()
  for (const r of rows(text, ';')) {
    const t = r[0]
    if (!/^\d{4}-\d{2}-\d{2} \d{2}/.test(t ?? '') || r.length < 12) continue
    const day = t.slice(0, 10)
    const h = Number(t.slice(11, 13))
    ;(hours.get(day) ?? hours.set(day, new Set()).get(day)!).add(h)
    const ceg = r[10]
    if (!ceg || ceg === '-' || (cegs && !cegs.has(ceg))) continue
    const v = Number(r[11])
    if (!Number.isFinite(v)) continue
    const d = perDay.get(day) ?? perDay.set(day, new Map()).get(day)!
    const arr = d.get(ceg) ?? d.set(ceg, Array(24).fill(0)).get(ceg)!
    arr[h] += v
  }
  const day = lastFullDay(hours, today)
  if (!day) return null
  const d = perDay.get(day) ?? new Map<string, number[]>()
  const mwh: Record<string, number> = {}
  const peak: Record<string, number> = {}
  for (const [ceg, arr] of d) {
    mwh[ceg] = Math.round(arr.reduce((s, v) => s + v, 0))
    peak[ceg] = Math.round(Math.max(...arr))
  }
  return { day, mwh, peak }
}

export async function fetchUsinaDia(today: string, cegs: Set<string>, now = new Date()): Promise<UsinaDia> {
  return firstWith(now, async (ym) =>
    parseUsinaDia(await getTail(`${S3}/geracao_usina_2_ho/GERACAO_USINA-2_${ym}.csv`, 2_700_000, 3600), today, cegs),
  )
}

// ---------- thermal generation by dispatch reason --------------------------------------------------------

/**
 * Verified generation splits into these parts, which add up to the total (checked against val_verifgeracao):
 * merit order above the inflexible level, inflexibility, electrical constraint, energy security (garantia energética
 * and generation out of merit order), unit commitment, and the rest (loss replacement, export, power reserve, substitution).
 */
export const MOTIVOS = ['inflex', 'merito', 'uc', 'eletrica', 'seguranca', 'outros'] as const
export type Motivo = (typeof MOTIVOS)[number]
const COL: Record<Motivo, number[]> = {
  merito: [26], // val_verifordemdemeritoacimadainflex
  inflex: [27], // val_verifinflexibilidade
  eletrica: [30], // val_verifrazaoeletrica
  seguranca: [31, 32], // val_verifgarantiaenergetica, val_verifgfom
  outros: [33, 34, 36, 38], // reposição de perdas, exportação, reserva de potência, substituição
  uc: [39], // val_verifunitcommitment
}

export type Termica = {
  nome: string
  ceg: string
  /** cod_usinaplanejamento: the key into the CVU file. */
  cod: string
  sub: string
  comb: string
  mwh: number
  byMotivo: Record<Motivo, number>
  /** Generation that was programmed but cut (constrained-off), MWh. */
  cortada: number
}

export type TermicasDia = {
  day: string
  /** SIN, MW per hour per reason. */
  hourly: Record<Motivo, number[]>
  plants: Termica[]
}

const zeros = () => Object.fromEntries(MOTIVOS.map((m) => [m, 0])) as Record<Motivo, number>

export function parseTermicas(text: string, today: string): TermicasDia | null {
  const hours = new Map<string, Set<number>>()
  const days = new Map<string, { hourly: Record<Motivo, number[]>; plants: Map<string, Termica> }>()
  for (const r of rows(text, ';')) {
    const t = r[0]
    if (!/^\d{4}-\d{2}-\d{2} \d{2}/.test(t ?? '') || r.length < 45) continue
    const day = t.slice(0, 10)
    const h = Number(t.slice(11, 13))
    ;(hours.get(day) ?? hours.set(day, new Set()).get(day)!).add(h)
    const d =
      days.get(day) ??
      days.set(day, { hourly: Object.fromEntries(MOTIVOS.map((m) => [m, Array(24).fill(0)])) as Record<Motivo, number[]>, plants: new Map() }).get(day)!
    const key = r[6] || r[4]
    const p = d.plants.get(key) ?? d.plants.set(key, { nome: r[4], ceg: r[6], cod: r[5], sub: r[2], comb: r[44], mwh: 0, byMotivo: zeros(), cortada: 0 }).get(key)!
    for (const m of MOTIVOS) {
      const v = COL[m].reduce((s, c) => s + (Number(r[c]) || 0), 0)
      d.hourly[m][h] += v
      p.byMotivo[m] += v
    }
    p.mwh += Number(r[24]) || 0
    p.cortada += Number(r[40]) || 0
  }
  const day = lastFullDay(hours, today)
  if (!day) return null
  const d = days.get(day)!
  const round = (o: Record<Motivo, number>) => Object.fromEntries(MOTIVOS.map((m) => [m, Math.round(o[m])])) as Record<Motivo, number>
  const plants = [...d.plants.values()]
    .map((p) => ({ ...p, mwh: Math.round(p.mwh), cortada: Math.round(p.cortada), byMotivo: round(p.byMotivo) }))
    .filter((p) => p.mwh > 0)
    .sort((a, b) => b.mwh - a.mwh)
  const hourly = Object.fromEntries(MOTIVOS.map((m) => [m, d.hourly[m].map(Math.round)])) as Record<Motivo, number[]>
  return { day, hourly, plants }
}

export async function fetchTermicas(today: string, now = new Date()): Promise<TermicasDia> {
  return firstWith(now, async (ym) =>
    parseTermicas(await getTail(`${S3}/geracao_termica_despacho_2_ho/GERACAO_TERMICA_DESPACHO-2_${ym}.csv`, 1_400_000, 3600), today),
  )
}

// ---------- CVU ------------------------------------------------------------------------------------------

export type Cvu = { from: string; to: string; semana: string; byCod: Record<string, number> }

/** `dat_iniciosemana;dat_fimsemana;…;nom_semanaoperativa;cod_usinaplanejamento;…;val_cvu`. The operative week containing `day`. */
export function parseCvu(text: string, day: string): Cvu {
  const weeks = new Map<string, Cvu>()
  for (const r of rows(text, ';')) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r[0] ?? '') || r.length < 11) continue
    const w = weeks.get(r[0]) ?? weeks.set(r[0], { from: r[0], to: r[1], semana: r[5], byCod: {} }).get(r[0])!
    const v = Number(r[10])
    if (r[6] && Number.isFinite(v)) w.byCod[r[6]] = v
  }
  const pick = [...weeks.values()].filter((w) => w.from <= day).sort((a, b) => a.from.localeCompare(b.from)).at(-1)
  if (!pick) throw new Error('CVU: no week')
  return pick
}

export async function fetchCvu(day: string): Promise<Cvu> {
  const text = await getText(`${S3}/cvu_usitermica_se/CVU_USINA_TERMICA_${day.slice(0, 4)}.csv`, 6 * 3600, { timeoutMs: 20_000 })
  return parseCvu(text, day)
}
