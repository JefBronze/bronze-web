// The example engine of section 7: one cylinder of a 1.0 four-cylinder, four strokes, an idealized Otto cycle.
// Pure functions shared by the 3D model (client) and the server-drawn diagrams, so both show the same engine.

/** Geometry in millimetres. Bore × stroke of 72 × 61,4 mm gives 250 cm³: one cylinder of a 1.0. */
export const ENGINE = {
  bore: 72,
  stroke: 61.4,
  rod: 110,
  /** Compression ratio, typical of a flex engine. */
  r: 12,
  /** Polytropic exponent for compression and expansion (a little below the ideal-gas 1,4: heat leaves through the walls). */
  n: 1.3,
  /** Peak pressure right after ignition, bar. */
  pPeak: 60,
  /** Valve lift, mm. */
  lift: 8,
} as const

export const crankRadius = ENGINE.stroke / 2
export const area = (Math.PI * ENGINE.bore ** 2) / 4 // mm²
export const displacement = area * ENGINE.stroke // mm³
export const clearance = displacement / (ENGINE.r - 1) // mm³
/** Height of the combustion chamber above the piston at top dead centre, mm. */
export const clearanceHeight = clearance / area

/** Ideal Otto efficiency for the example engine: 1 − 1/r^(γ−1), γ = 1,4. */
export const ottoEfficiency = 1 - 1 / ENGINE.r ** 0.4

export type Stroke = 'admissao' | 'compressao' | 'combustao' | 'escape'
export const STROKES: Stroke[] = ['admissao', 'compressao', 'combustao', 'escape']
export const STROKE_NAME: Record<Stroke, string> = {
  admissao: 'admissão',
  compressao: 'compressão',
  combustao: 'combustão e expansão',
  escape: 'escape',
}
export const STROKE_TEXT: Record<Stroke, string> = {
  admissao: 'O pistão desce com a válvula de admissão aberta e puxa ar com combustível.',
  compressao: 'As duas válvulas fecham e o pistão sobe, apertando a mistura em 1/12 do volume.',
  combustao: 'A vela solta a faísca, a mistura queima e a pressão empurra o pistão para baixo: o único tempo que gera trabalho.',
  escape: 'A válvula de escape abre e o pistão sobe, expulsando os gases queimados.',
}

const deg = (a: number) => (((a % 720) + 720) % 720)

/** Which stroke a crank angle (0–720°, 0 = top dead centre at the start of intake) belongs to. */
export function strokeAt(angle: number): Stroke {
  return STROKES[Math.floor(deg(angle) / 180)]
}

/** Distance from the crank axis to the piston pin, mm (slider-crank). */
export function pinHeight(angle: number): number {
  const t = (deg(angle) * Math.PI) / 180
  const s = crankRadius * Math.sin(t)
  return crankRadius * Math.cos(t) + Math.sqrt(ENGINE.rod ** 2 - s ** 2)
}

/** How far the piston is below top dead centre, mm (0 at TDC, the stroke at BDC). */
export function pistonDrop(angle: number): number {
  return crankRadius + ENGINE.rod - pinHeight(angle)
}

/** Cylinder volume above the piston, cm³. */
export function volume(angle: number): number {
  return (clearance + area * pistonDrop(angle)) / 1000
}

/** Valve lift in mm. Simplified timing: each valve opens for its own stroke only (no overlap). */
export function valveLift(angle: number, valve: 'in' | 'ex'): number {
  const a = deg(angle)
  const start = valve === 'in' ? 0 : 540
  if (a < start || a > start + 180) return 0
  return ENGINE.lift * Math.sin(((a - start) / 180) * Math.PI)
}

/** Idealized cylinder pressure, bar: intake and exhaust near atmospheric, polytropic compression and expansion, constant-volume combustion at TDC. */
export function pressure(angle: number): number {
  const a = deg(angle)
  const v = volume(a)
  const vMax = volume(180)
  const vMin = volume(0)
  if (a < 180) return 0.95
  if (a < 360) return 0.95 * (vMax / v) ** ENGINE.n
  if (a < 540) return ENGINE.pPeak * (vMin / v) ** ENGINE.n
  // Blowdown: the exhaust valve opens and pressure falls to just above atmospheric within ~30°.
  const blow = ENGINE.pPeak * (vMin / vMax) ** ENGINE.n
  return a < 570 ? blow + (1.05 - blow) * ((a - 540) / 30) : 1.05
}

/** Milliseconds per full four-stroke cycle (two crank turns) at a given rpm. */
export function cycleMs(rpm: number): number {
  return (2 * 60_000) / rpm
}
