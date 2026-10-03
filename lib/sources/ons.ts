// ONS: carga verificada (apicarga) and CMO semi-horário (open-data S3 CSV).
import { getJson, getText, rows } from './http'
import { isoDay } from '../format'

export const AREAS = ['SECO', 'S', 'NE', 'N'] as const
export type Area = (typeof AREAS)[number]

type CargaRow = { din_referenciautc: string; val_cargaglobal: number | null }

export type Carga = {
  /** UTC ISO timestamps of the shared 48 half-hours, oldest first. */
  t: string[]
  byArea: Record<Area, number[]>
  sin: number[]
  now: Record<Area, number>
  sinNow: number
  asOf: string
}

/** Keep verified half-hours only (the API publishes 0 for half-hours not yet verified) and align the four areas. */
export function parseCarga(raw: Record<Area, CargaRow[]>): Carga {
  const series = {} as Record<Area, Map<string, number>>
  for (const a of AREAS) {
    series[a] = new Map(
      raw[a].filter((r) => (r.val_cargaglobal ?? 0) > 0).map((r) => [new Date(r.din_referenciautc).toISOString(), r.val_cargaglobal as number]),
    )
  }
  const common = [...series.SECO.keys()].filter((t) => AREAS.every((a) => series[a].has(t))).sort()
  const t = common.slice(-48)
  if (t.length < 24) throw new Error('ONS carga: too few verified half-hours')
  const byArea = Object.fromEntries(AREAS.map((a) => [a, t.map((k) => Math.round(series[a].get(k)!))])) as Record<Area, number[]>
  const sin = t.map((_, i) => AREAS.reduce((s, a) => s + byArea[a][i], 0))
  const now = Object.fromEntries(AREAS.map((a) => [a, byArea[a][t.length - 1]])) as Record<Area, number>
  return { t, byArea, sin, now, sinNow: sin[sin.length - 1], asOf: t[t.length - 1] }
}

export async function fetchCarga(now = new Date()): Promise<Carga> {
  const today = isoDay(now)
  const d0 = isoDay(new Date(now.getTime() - 2 * 86_400_000))
  const raw = {} as Record<Area, CargaRow[]>
  await Promise.all(
    AREAS.map(async (a) => {
      const j = await getJson<CargaRow[] | { cargaVerificada?: CargaRow[] }>(
        `https://apicarga.ons.org.br/prd/cargaverificada?dat_inicio=${d0}&dat_fim=${today}&cod_areacarga=${a}`,
        600,
      )
      raw[a] = Array.isArray(j) ? j : (j.cargaVerificada ?? [])
    }),
  )
  return parseCarga(raw)
}

export const CMO_SUBS = ['SE', 'S', 'NE', 'N'] as const
export type Sub = (typeof CMO_SUBS)[number]

export type Cmo = {
  day: string
  /** 48 half-hour values per subsystem, R$/MWh, 00:00 → 23:30 Brasília. */
  bySub: Record<Sub, number[]>
}

/**
 * The CSV is `id_subsistema;nom_subsistema;din_instante;val_cmo`, Brasília local time, appended daily.
 * Picks `preferDay` if it is complete, otherwise the latest complete day not after it.
 */
export function parseCmo(text: string, preferDay: string): Cmo {
  const byDay = new Map<string, Record<string, (number | undefined)[]>>()
  for (const r of rows(text, ';')) {
    const [sub, , instante, val] = r
    if (!instante || !/^\d{4}-\d{2}-\d{2}/.test(instante)) continue
    const day = instante.slice(0, 10)
    const [hh, mm] = instante.slice(11, 16).split(':').map(Number)
    const slot = hh * 2 + (mm >= 30 ? 1 : 0)
    const v = Number(val.replace(',', '.'))
    if (!Number.isFinite(v)) continue
    const d = byDay.get(day) ?? {}
    ;(d[sub] ??= Array(48).fill(undefined))[slot] = v
    byDay.set(day, d)
  }
  const complete = [...byDay.entries()]
    .filter(([day, d]) => day <= preferDay && CMO_SUBS.every((s) => d[s]?.every((v) => v !== undefined)))
    .map(([day]) => day)
    .sort()
  const day = complete.at(-1)
  if (!day) throw new Error('CMO: no complete day')
  const d = byDay.get(day)!
  return { day, bySub: Object.fromEntries(CMO_SUBS.map((s) => [s, d[s] as number[]])) as Record<Sub, number[]> }
}

export async function fetchCmo(now = new Date()): Promise<Cmo> {
  // The whole-year file passes Next's 2 MB cache limit in the last months of the year; the last ~4 days are enough.
  const text = await getText(`https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/cmo_tm/CMO_SEMIHORARIO_${now.getUTCFullYear()}.csv`, 3600, {
    headers: { Range: 'bytes=-40000' },
    timeoutMs: 20_000,
  })
  // A suffix range starts mid-line; parseCmo skips anything without a date.
  return parseCmo(text, isoDay(now))
}
