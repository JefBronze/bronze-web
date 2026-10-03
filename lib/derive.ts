// Numbers the page states in words, computed from the readings (never typed by hand).
import { quantile, type Pt } from './chart'
import { hhmm, isoDay } from './format'
import type { Observatory } from './observatory'
import { CMO_SUBS, type Sub } from './sources/ons'

// ---------- bills ----------------------------------------------------------------------------------------

export type SegKind = 'te' | 'fio' | 'dem' | 'band' | 'tax' | 'cip'
export const SEG_FILL: Record<SegKind, string> = { te: 'var(--c1)', fio: 'var(--c2)', dem: 'var(--c3)', band: 'var(--sol)', tax: 'var(--c4)', cip: 'var(--c5)' }
export type Seg = { name: string; v: number; kind: SegKind }
export type Bill = { name: string; total: number; segs: Seg[] }

/** Adds ICMS + PIS/COFINS "por dentro" (and the municipal CIP for B1) to pre-tax parts, all in R$/MWh. */
export function bill(o: Observatory, name: string, parts: Seg[], cipKwh?: number): Bill {
  const gross = (1 - o.b1.icms) * (1 - o.b1.pis - o.b1.cofins)
  const pre = parts.reduce((s, p) => s + p.v, 0)
  const segs: Seg[] = [...parts, { name: 'tributos', v: pre / gross - pre, kind: 'tax' }]
  if (cipKwh) segs.push({ name: 'CIP', v: (o.b1.cip / cipKwh) * 1000, kind: 'cip' })
  return { name, total: segs.reduce((s, p) => s + p.v, 0), segs }
}

export type Flag = 'verde' | 'amarela' | 'vermelha1' | 'vermelha2'
export const FLAG_NAME: Record<Flag, string> = { verde: 'verde', amarela: 'amarela', vermelha1: 'vermelha 1', vermelha2: 'vermelha 2' }
export const FLAG_FILL: Record<Flag, string> = { verde: 'var(--c3)', amarela: 'var(--sol)', vermelha1: 'var(--c4)', vermelha2: '#5E1F17' }

/** The flag in force this month, and its surcharge as a bill segment (none when green: it adds nothing). */
export function flagNow(o: Observatory): Flag {
  return o.bandeira.vigente as Flag
}
function flagSeg(o: Observatory): Seg[] {
  const f = flagNow(o)
  const v = o.b1.bandeira[f] * 1000
  return v > 0 ? [{ name: `bandeira ${FLAG_NAME[f]}`, v, kind: 'band' }] : []
}

/** The Grupo A reference case used in sections 2c and 3b. */
export const A4_CASE = { mwh: 50, kw: 118, ponta: 0.1 }

export function a4Parts(o: Observatory, modal: 'verde' | 'azul'): Seg[] {
  const { mwh, kw, ponta: pp } = A4_CASE
  const band = flagSeg(o)
  if (modal === 'verde') {
    const v = o.a4.verde
    return [
      { name: 'energia (TE)', v: pp * v.teP + (1 - pp) * v.teFP, kind: 'te' },
      { name: 'fio (TUSD energia)', v: pp * v.tusdP + (1 - pp) * v.tusdFP, kind: 'fio' },
      { name: 'demanda', v: (kw * v.demanda) / mwh, kind: 'dem' },
      ...band,
    ]
  }
  const a = o.a4.azul
  return [
    { name: 'energia (TE)', v: pp * a.teP + (1 - pp) * a.teFP, kind: 'te' },
    { name: 'fio (TUSD energia)', v: a.tusdE, kind: 'fio' },
    { name: 'demanda P + FP', v: (kw * (a.demandaP + a.demandaFP)) / mwh, kind: 'dem' },
    ...band,
  ]
}

export function b1Bill(o: Observatory): Bill {
  return bill(
    o,
    'B1 residencial',
    [
      { name: 'energia (TE)', v: o.b1.te * 1000, kind: 'te' },
      { name: 'fio (TUSD)', v: o.b1.tusd * 1000, kind: 'fio' },
      ...flagSeg(o),
    ],
    o.b1.refKwh,
  )
}

/** Free-market A4: TE and bandeira leave, contracted energy comes in; the wire (fio + demanda) stays with Copel. */
export function aclBill(o: Observatory, price: number): Bill {
  const [, fio, dem] = a4Parts(o, 'verde')
  return bill(o, `Livre · R$ ${price}`, [{ name: 'energia contratada', v: price, kind: 'te' }, fio, dem])
}

// ---------- CMO ------------------------------------------------------------------------------------------

export const SUB_NAME: Record<Sub, string> = { SE: 'Sudeste/Centro-Oeste', S: 'Sul', NE: 'Nordeste', N: 'Norte' }
export const SUB_SHORT: Record<Sub, string> = { SE: 'SE/CO', S: 'S', NE: 'NE', N: 'N' }

export function slotText(slot: number): string {
  const h = Math.floor(slot / 2)
  if (slot === 0) return 'meia-noite'
  if (slot === 24) return 'meio-dia'
  return slot % 2 ? `${h}h30` : `${h}h`
}

/** Index of the current half-hour when the CMO day is today in Brasília, else null. */
export function cmoSlotNow(o: Observatory): number | null {
  if (o.cmo.day !== isoDay(o.renderedAt)) return null
  const [h, m] = hhmm(o.renderedAt).split(':').map(Number)
  return h * 2 + (m >= 30 ? 1 : 0)
}

/** "à meia-noite", "ao meio-dia", "às 18h30" (capitalized when it opens a sentence). */
export function atSlot(slot: number, capital = false): string {
  const s = slot === 0 ? 'à meia-noite' : slot === 24 ? 'ao meio-dia' : `às ${slotText(slot)}`
  return capital ? s[0].toUpperCase() + s.slice(1) : s
}

export function cmoStats(o: Observatory, slotNow: number) {
  const se = o.cmo.bySub.SE
  const minSlot = se.indexOf(Math.min(...se))
  const maxSlot = se.indexOf(Math.max(...se))
  // Hours the Sudeste price sat at (practically) zero — the solar glut.
  const zeroSlots = se.map((v, i) => (v < 1 ? i : -1)).filter((i) => i >= 0)
  const zero = zeroSlots.length >= 2 ? { from: zeroSlots[0], to: zeroSlots.at(-1)! } : null
  // The half-hour where subsystems disagreed most. Both prices must be at least the PLD floor,
  // otherwise "9 times" is a ratio of near-zero numbers and says nothing.
  let spread = { slot: 0, hi: 'N' as Sub, lo: 'S' as Sub, ratio: 1 }
  for (let i = 0; i < 48; i++) {
    const vals = CMO_SUBS.map((s) => [s, o.cmo.bySub[s][i]] as const).filter(([, v]) => v >= o.pld.piso)
    if (vals.length < 2) continue
    const hi = vals.reduce((a, b) => (b[1] > a[1] ? b : a))
    const lo = vals.reduce((a, b) => (b[1] < a[1] ? b : a))
    const r = hi[1] / lo[1]
    if (r > spread.ratio) spread = { slot: i, hi: hi[0], lo: lo[0], ratio: r }
  }
  const now = Object.fromEntries(CMO_SUBS.map((s) => [s, o.cmo.bySub[s][slotNow]])) as Record<Sub, number>
  return { minSlot, min: se[minSlot], maxSlot, max: se[maxSlot], zero, spread, now }
}

// ---------- oil markets ----------------------------------------------------------------------------------

export function kalshiStats(ladder: Pt[]) {
  return { median: quantile(ladder, 0.5), lo80: quantile(ladder, 0.9), hi80: quantile(ladder, 0.1) }
}

/** Polymarket "touch" ladders: the month's likely range is where each side crosses 50 %. */
export function polyRange(high: Pt[], low: Pt[]) {
  const hi = [...high].filter(([, p]) => p >= 0.5).sort((a, b) => b[0] - a[0])[0] ?? null
  const lo = [...low].filter(([, p]) => p >= 0.5).sort((a, b) => a[0] - b[0])[0] ?? null
  return { hi, lo }
}

export const BBL_LITERS = 158.987
