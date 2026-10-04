// Numbers the page states in words, computed from the readings (never typed by hand).
import { quantile, type Pt } from './chart'
import { hhmm, isoDay } from './format'
import type { Observatory } from './observatory'
import { MOTIVOS, type Motivo, type Termica } from './sources/geracao'
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

/** The Grupo A reference case used in sections 2c and 5b. */
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

// ---------- the duck curve (section 3) -------------------------------------------------------------------

/** Itaipu's installed capacity, MW (ITAIPU Binacional: 20 units × 700 MW). The yardstick for the evening ramp. */
export const ITAIPU_MW = 14_000

/** Net load = load − wind − solar (solar here includes rooftop MMGD). What the dispatchable fleet must serve. */
export function netLoad(carga: number[], eol: number[], sol: number[], mmgd?: number[]): number[] {
  return carga.map((c, i) => c - eol[i] - sol[i] - (mmgd?.[i] ?? 0))
}

/** Midday trough, evening peak and the fastest 3-hour climb of the hourly net load, and how much of the climb hydro took. */
export function duckStats(b: Observatory['balanco']) {
  const net = netLoad(b.carga, b.eol, b.sol)
  const range = (a: number, z: number) => Array.from({ length: z - a + 1 }, (_, i) => a + i)
  const troughH = range(9, 15).reduce((a, h) => (net[h] < net[a] ? h : a))
  const peakH = range(16, 22).reduce((a, h) => (net[h] > net[a] ? h : a))
  let fast = { from: troughH, mw: 0 }
  for (let h = troughH; h + 3 <= peakH; h++) if (net[h + 3] - net[h] > fast.mw) fast = { from: h, mw: net[h + 3] - net[h] }
  const ramp = net[peakH] - net[troughH]
  return {
    net,
    troughH,
    trough: net[troughH],
    peakH,
    peak: net[peakH],
    ramp,
    fast,
    /** Minutes the fastest 3-hour climb takes to add one Itaipu. */
    itaipuMin: fast.mw > 0 ? Math.round((ITAIPU_MW / fast.mw) * 180) : null,
    hydroShare: ramp > 0 ? (b.hid[peakH] - b.hid[troughH]) / ramp : 0,
    solarMax: Math.max(...b.sol),
  }
}

export const CUT_REASON: Record<string, string> = {
  ENE: 'sobra de energia',
  CNF: 'confiabilidade',
  REL: 'limite da rede',
  PAR: 'parecer de acesso',
}

/** Last closed month of constrained-off cuts: total, by source and reason, Nordeste share, and the share of what could have been generated. */
export function curtailStats(o: Observatory) {
  const row = o.curtail.at(-1)!
  const sum = (r: Record<string, number>) => Object.values(r).reduce((s, v) => s + v, 0)
  const eol = sum(row.eol.cut)
  const sol = sum(row.sol.cut)
  const total = eol + sol
  const reasons: Record<string, number> = {}
  for (const f of [row.eol, row.sol]) for (const [k, v] of Object.entries(f.cut)) reasons[k] = (reasons[k] ?? 0) + v
  return {
    m: row.m,
    eol,
    sol,
    total,
    ne: (row.eol.cutNE + row.sol.cutNE) / total,
    lostShare: total / (total + row.eol.gen + row.sol.gen),
    reasons,
    months: o.curtail.map((r) => ({ m: r.m, eol: sum(r.eol.cut), sol: sum(r.sol.cut) })),
  }
}

// ---------- who generates (section 4) ---------------------------------------------------------------------

export const MOTIVO_NAME: Record<Motivo, string> = {
  inflex: 'inflexibilidade',
  merito: 'ordem de custo',
  uc: 'partida e parada',
  eletrica: 'restrição elétrica',
  seguranca: 'segurança energética',
  outros: 'outros',
}
export const MOTIVO_FILL: Record<Motivo, string> = {
  inflex: 'var(--c4)',
  merito: 'var(--c2)',
  uc: 'var(--dj)',
  eletrica: 'var(--c5)',
  seguranca: 'var(--c6)',
  outros: 'var(--line)',
}

export type Usina = Observatory['usinas']['plants'][number] & {
  /** Average MW over yesterday, null when the ONS file was not read. */
  med: number | null
  /** Thermal plants: the reason with the most MWh yesterday, null when it did not run. */
  motivo: Motivo | null
}

export function usinasDia(o: Observatory): Usina[] {
  const byCeg = new Map((o.termicas?.plants ?? []).filter((t) => t.ceg).map((t) => [t.ceg, t]))
  return o.usinas.plants.map((p) => {
    const mwh = o.usinaDia ? (o.usinaDia.mwh[p.ceg] ?? 0) : null
    const t = byCeg.get(p.ceg)
    const motivo = t && t.mwh > 0 ? MOTIVOS.reduce((a, m) => (t.byMotivo[m] > t.byMotivo[a] ? m : a)) : null
    return { ...p, med: mwh === null ? null : mwh / 24, motivo }
  })
}

/** Yesterday's thermal fleet: total, share per reason, and the plants that ran above the marginal cost of their subsystem. */
export function termicaStats(o: Observatory) {
  const t = o.termicas
  if (!t) return null
  const total = t.plants.reduce((s, p) => s + p.mwh, 0)
  const byMotivo = Object.fromEntries(MOTIVOS.map((m) => [m, t.plants.reduce((s, p) => s + p.byMotivo[m], 0)])) as Record<Motivo, number>
  const cvu = (p: Termica) => (p.cod && o.cvu ? (o.cvu.byCod[p.cod] ?? null) : null)
  const cmo = o.cmoTermicas
  const cmoMed = cmo ? (Object.fromEntries(CMO_SUBS.map((s) => [s, cmo.bySub[s].reduce((a, v) => a + v, 0) / cmo.bySub[s].length])) as Record<Sub, number>) : null
  const withCvu = t.plants.map((p) => ({ ...p, cvu: cvu(p) }))
  // Ran mostly by inflexibility although its variable cost is above the marginal cost of its subsystem.
  const caras = cmoMed ? withCvu.filter((p) => p.cvu !== null && p.cvu > (cmoMed[p.sub as Sub] ?? Infinity) && p.byMotivo.inflex > p.mwh / 2) : []
  return { day: t.day, total, byMotivo, top: withCvu.slice(0, 10), caras, carasMwh: caras.reduce((s, p) => s + p.mwh, 0), cmoMed }
}

export type Gatilho = Observatory['gatilho']['meses'][number]

/** VU = PLD × (1 − GSF): the cost of the hydro deficit in R$/MWh that sets the flag (negative when hydro is in surplus). */
export function vu(g: Pick<Gatilho, 'gsf' | 'pld'>): number {
  return g.pld * (1 - g.gsf)
}
