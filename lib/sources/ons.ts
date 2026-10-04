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

export async function fetchCmo(now = new Date(), preferDay = isoDay(now)): Promise<Cmo> {
  // The whole-year file passes Next's 2 MB cache limit in the last months of the year; the last ~4 days are enough.
  const text = await getText(`https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/cmo_tm/CMO_SEMIHORARIO_${now.getUTCFullYear()}.csv`, 3600, {
    headers: { Range: 'bytes=-40000' },
    timeoutMs: 20_000,
  })
  // A suffix range starts mid-line; parseCmo skips anything without a date.
  return parseCmo(text, preferDay)
}

// ---------- balanço de energia (hourly, by source) ------------------------------------------------------

/** Hourly SIN values, MWmed. Solar includes MMGD (rooftop/small-scale); thermal includes nuclear. */
export type Balanco = { day: string; hid: number[]; ter: number[]; eol: number[]; sol: number[]; carga: number[] }
// Column positions in `id_subsistema;nom_subsistema;din_instante;val_gerhidraulica;val_gertermica;val_gereolica;val_gersolar;val_carga;val_intercambio`.
const BAL_COL = { hid: 3, ter: 4, eol: 5, sol: 6, carga: 7 } as const
type BalKey = keyof typeof BAL_COL
const BAL_KEYS = Object.keys(BAL_COL) as BalKey[]

/** The file carries a ready-made SIN row per hour (ids are space-padded; `rows` trims them). Latest complete day ≤ preferDay. */
export function parseBalanco(text: string, preferDay: string): Balanco {
  const days = new Map<string, Record<BalKey, (number | undefined)[]>>()
  for (const r of rows(text, ';')) {
    if (r[0] !== 'SIN' || !/^\d{4}-\d{2}-\d{2}/.test(r[2] ?? '')) continue
    const day = r[2].slice(0, 10)
    const h = Number(r[2].slice(11, 13))
    const d = days.get(day) ?? { hid: [], ter: [], eol: [], sol: [], carga: [] }
    for (const k of BAL_KEYS) {
      const v = Number(r[BAL_COL[k]])
      if (Number.isFinite(v)) d[k][h] = v
    }
    days.set(day, d)
  }
  const complete = [...days.entries()]
    .filter(([day, d]) => day <= preferDay && BAL_KEYS.every((k) => Array.from({ length: 24 }, (_, h) => d[k][h]).every((v) => v !== undefined)))
    .map(([day]) => day)
    .sort()
  const day = complete.at(-1)
  if (!day) throw new Error('Balanço: no complete SIN day')
  const d = days.get(day)!
  return { day, ...(Object.fromEntries(BAL_KEYS.map((k) => [k, d[k].map((v) => Math.round(v!))])) as Record<BalKey, number[]>) }
}

export async function fetchBalanco(now = new Date()): Promise<Balanco> {
  // Same trick as the CMO: the yearly file passes 3 MB by October; the tail holds the last ~3 days.
  const text = await getText(
    `https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/balanco_energia_subsistema_ho/BALANCO_ENERGIA_SUBSISTEMA_${now.getUTCFullYear()}.csv`,
    3600,
    { headers: { Range: 'bytes=-40000' }, timeoutMs: 20_000 },
  )
  return parseBalanco(text, isoDay(now))
}

// ---------- "Energia Agora": today, minute by minute ---------------------------------------------------

export const AGORA_SERIES = {
  carga: 'Carga_SIN_json',
  eol: 'Geracao_SIN_Eolica_json',
  sol: 'Geracao_SIN_Solar_json',
  hid: 'Geracao_SIN_Hidraulica_json',
  ter: 'Geracao_SIN_Termica_json',
  nuc: 'Geracao_SIN_Nuclear_json',
} as const
export type AgoraKey = keyof typeof AGORA_SERIES
const AGORA_KEYS = Object.keys(AGORA_SERIES) as AgoraKey[]
export type AgoraPoint = { instante: string; geracao?: number; carga?: number }
export type AgoraSnapshot = { Data: string } & Record<string, unknown>

/** Rooftop ÷ plant solar when the sun is too low for the measured ratio to mean anything. */
export const MMGD_RATIO_DEFAULT = 1.6

export type Agora = {
  day: string
  /** "HH:MM" Brasília, every 5 minutes from midnight to the last common reading. */
  t: string[]
  /** Load includes what MMGD serves; the plant-solar series does not include MMGD. */
  carga: number[]
  eol: number[]
  sol: number[]
  hid: number[]
  ter: number[]
  nuc: number[]
  /** Estimated: today's plant-solar profile × (MMGD ÷ plant solar) at the snapshot instant. ONS publishes no MMGD series. */
  mmgd: number[]
  mmgdRatio: number
  /** The snapshot instant, where MMGD is measured, not estimated. */
  snap: { at: string; mmgd: number }
  asOf: string
}

/** Aligns the six minute series on their common minutes, keeps one point every 5 minutes (plus the last), and estimates MMGD. */
export function parseAgora(series: Record<AgoraKey, AgoraPoint[]>, snapshot: AgoraSnapshot): Agora {
  const maps = Object.fromEntries(
    AGORA_KEYS.map((k) => [k, new Map(series[k].map((p) => [p.instante.slice(0, 16), Number(k === 'carga' ? p.carga : p.geracao)]))]),
  ) as Record<AgoraKey, Map<string, number>>
  const common = [...maps.carga.keys()].filter((t) => AGORA_KEYS.every((k) => Number.isFinite(maps[k].get(t)))).sort()
  if (common.length < 60) throw new Error('Energia Agora: too few common minutes')
  const day = common.at(-1)!.slice(0, 10)
  const last = common.at(-1)!
  const keep = common.filter((t) => t.startsWith(day) && (Number(t.slice(14, 16)) % 5 === 0 || t === last))
  const pick = (k: AgoraKey) => keep.map((t) => Math.round(maps[k].get(t)!))

  let mmgdSnap = 0
  for (const [k, v] of Object.entries(snapshot)) {
    const g = k !== 'Data' && v && typeof v === 'object' ? (v as { geracao?: { mmgd?: number } }).geracao : undefined
    mmgdSnap += g?.mmgd ?? 0
  }
  const solAt = maps.sol.get(snapshot.Data.slice(0, 16)) ?? maps.sol.get(last)!
  const mmgdRatio = solAt > 2000 && mmgdSnap > 0 ? mmgdSnap / solAt : MMGD_RATIO_DEFAULT
  const sol = pick('sol')
  return {
    day,
    t: keep.map((t) => t.slice(11, 16)),
    carga: pick('carga'),
    eol: pick('eol'),
    sol,
    hid: pick('hid'),
    ter: pick('ter'),
    nuc: pick('nuc'),
    mmgd: sol.map((v) => Math.round(v * mmgdRatio)),
    mmgdRatio,
    snap: { at: snapshot.Data, mmgd: Math.round(mmgdSnap) },
    asOf: `${last}:00-03:00`,
  }
}

export async function fetchAgora(): Promise<Agora> {
  const base = 'https://tr.ons.org.br/Content'
  const [snapshot, ...list] = await Promise.all([
    getJson<AgoraSnapshot>(`${base}/GetBalancoEnergetico/null`, 120),
    ...AGORA_KEYS.map((k) => getJson<AgoraPoint[]>(`${base}/Get/${AGORA_SERIES[k]}`, 120)),
  ])
  const series = Object.fromEntries(AGORA_KEYS.map((k, i) => [k, list[i]])) as Record<AgoraKey, AgoraPoint[]>
  return parseAgora(series, snapshot as AgoraSnapshot)
}
