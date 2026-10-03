// Electric drive physics for section 8: an interior permanent-magnet synchronous machine (IPMSM) fed by a
// three-phase voltage-source inverter under field-oriented control. Pure functions, shared by the 3D scene,
// the SVG instruments and the tests. Angles in radians unless the name says deg; SI units otherwise.

export type Machine = {
  /** Pole pairs. */
  p: number
  /** Permanent-magnet flux linkage, Wb. */
  psiF: number
  /** d- and q-axis inductances, H (Lq > Ld: the rotor's flux barriers make the machine salient). */
  Ld: number
  Lq: number
  /** Stator phase resistance, Ω. */
  Rs: number
  /** Peak phase-current limit, A. */
  iMax: number
  /** DC-link voltage, V. */
  vdc: number
  /** Published peak torque (N·m) and power (W), at the motor shaft. */
  tPeak: number
  pPeak: number
  /** Maximum rotor speed, rpm. */
  rpmMax: number
}

const TAU = Math.PI * 2

// ---- three phases and the space vector -------------------------------------------------------------

/** Balanced sinusoidal phase currents of peak `amp`, electrical angle `thetaE`, advanced by `phi`. */
export function phaseCurrents(amp: number, thetaE: number, phi = 0): [number, number, number] {
  return [0, 1, 2].map((k) => amp * Math.cos(thetaE + phi - (k * TAU) / 3)) as [number, number, number]
}

/** Clarke transform, amplitude-invariant: three phase quantities → stationary α, β. */
export function clarke([a, b, c]: readonly number[]) {
  return { alpha: (2 / 3) * (a - b / 2 - c / 2), beta: (2 / 3) * (Math.sqrt(3) / 2) * (b - c) }
}

export function invClarke(alpha: number, beta: number): [number, number, number] {
  return [alpha, -alpha / 2 + (Math.sqrt(3) / 2) * beta, -alpha / 2 - (Math.sqrt(3) / 2) * beta]
}

/** Park transform: stationary α, β → rotor-fixed d, q (d aligned with the magnet's north pole at angle `theta`). */
export function park(alpha: number, beta: number, theta: number) {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return { d: alpha * c + beta * s, q: -alpha * s + beta * c }
}

export function invPark(d: number, q: number, theta: number) {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return { alpha: d * c - q * s, beta: d * s + q * c }
}

// ---- inverter: space-vector PWM --------------------------------------------------------------------

/** Sector (1–6) of the voltage vector in the α-β plane; each spans 60° between two active switching states. */
export function sector(alpha: number, beta: number): number {
  const a = ((Math.atan2(beta, alpha) % TAU) + TAU) % TAU
  return Math.floor(a / (Math.PI / 3)) + 1
}

/**
 * Leg duty cycles (0–1) for a reference voltage vector, by min–max zero-sequence injection — numerically the same
 * as classic SVPWM. Linear up to |v| = vdc/√3 (15 % more than sine PWM); clamps above that (overmodulation).
 */
export function svpwm(vAlpha: number, vBeta: number, vdc: number): [number, number, number] {
  const v = invClarke(vAlpha, vBeta)
  const offset = -(Math.max(...v) + Math.min(...v)) / 2
  return v.map((x) => Math.min(1, Math.max(0, 0.5 + (x + offset) / vdc))) as [number, number, number]
}

/** Upper-switch states of the three legs at a point of the PWM period: compare each duty with a triangle carrier (0–1). */
export function switchStates(duty: readonly number[], carrier: number): [boolean, boolean, boolean] {
  const tri = carrier < 0.5 ? carrier * 2 : 2 - carrier * 2
  return duty.map((d) => d > tri) as [boolean, boolean, boolean]
}

/** The eight switching states (upper switches a, b, c) and the phase-to-neutral voltages they apply, in units of vdc. */
export function stateVoltages(s: readonly boolean[]): [number, number, number] {
  const v = s.map((x) => (x ? 1 : 0))
  const mean = (v[0] + v[1] + v[2]) / 3
  return v.map((x) => x - mean) as [number, number, number]
}

// ---- the machine -----------------------------------------------------------------------------------

/** Electromagnetic torque: magnet torque (ψf·iq) plus reluctance torque ((Ld − Lq)·id·iq). */
export function torque(m: Machine, id: number, iq: number): number {
  return 1.5 * m.p * (m.psiF * iq + (m.Ld - m.Lq) * id * iq)
}

/** Maximum torque per ampere: the d-q current split that gives the most torque for a current magnitude `is`. */
export function mtpa(m: Machine, is: number) {
  const dL = m.Lq - m.Ld
  if (dL <= 0) return { id: 0, iq: is }
  const id = (m.psiF - Math.sqrt(m.psiF ** 2 + 8 * dL ** 2 * is ** 2)) / (4 * dL)
  return { id, iq: Math.sqrt(Math.max(0, is ** 2 - id ** 2)) }
}

/** Torque split at the MTPA point for a current magnitude: magnet and reluctance parts, N·m. */
export function torqueParts(m: Machine, is: number) {
  const { id, iq } = mtpa(m, is)
  const magnet = 1.5 * m.p * m.psiF * iq
  const reluctance = 1.5 * m.p * (m.Ld - m.Lq) * id * iq
  return { id, iq, magnet, reluctance, total: magnet + reluctance }
}

/**
 * Picks the magnet flux so that the MTPA torque at the current limit equals the published peak torque, for an
 * assumed saliency Lq/Ld. Manufacturers do not publish ψf, Ld, Lq; this keeps the example consistent with what they do publish.
 */
export function calibratePsiF(m: Omit<Machine, 'psiF'>): number {
  let lo = 0.01
  let hi = 1
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (torqueParts({ ...m, psiF: mid }, m.iMax).total < m.tPeak) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Peak torque envelope at the shaft: constant torque up to the base speed, constant power above it (field weakening). */
export function torqueEnvelope(m: Machine, rpm: number): number {
  const w = (rpm * TAU) / 60
  const base = baseRpm(m)
  return rpm <= base ? m.tPeak : m.pPeak / w
}

export function baseRpm(m: Machine): number {
  return (m.pPeak / m.tPeak) * (60 / TAU)
}

/** Electrical frequency of the stator currents, Hz, at a rotor speed in rpm. */
export function electricalHz(m: Machine, rpm: number): number {
  return (m.p * rpm) / 60
}

/** Peak phase back-EMF (V) from the magnets at a rotor speed: e = ωe·ψf. */
export function backEmf(m: Machine, rpm: number): number {
  return ((m.p * rpm * TAU) / 60) * m.psiF
}

/** The largest phase voltage (peak) the inverter can apply in the linear SVPWM range. */
export function vPhaseMax(vdc: number): number {
  return vdc / Math.sqrt(3)
}

/** Speed (rpm) at which the magnets' back-EMF alone reaches the inverter's voltage limit (above it, field weakening is mandatory). */
export function emfLimitRpm(m: Machine): number {
  return (vPhaseMax(m.vdc) / m.psiF) * (60 / TAU) / m.p
}

// ---- operating point under current and voltage limits ----------------------------------------------

/** Steady-state stator voltages (d, q, magnitude; peak phase volts) for given currents at a rotor speed. */
export function voltages(m: Machine, id: number, iq: number, rpm: number) {
  const we = (m.p * rpm * TAU) / 60
  const vd = m.Rs * id - we * m.Lq * iq
  const vq = m.Rs * iq + we * (m.Ld * id + m.psiF)
  return { vd, vq, vs: Math.hypot(vd, vq) }
}

export type OperatingPoint = {
  rpm: number
  /** Torque actually delivered (N·m; negative when braking/regenerating). */
  torque: number
  id: number
  iq: number
  is: number
  /** Current angle beyond the q axis, rad (0 = all on q; larger = more negative id). */
  beta: number
  vd: number
  vq: number
  vs: number
  /** Mechanical power at the shaft, W. */
  power: number
  /** True when the voltage limit, not the current, sets id (field weakening). */
  fieldWeakening: boolean
  /** True when the requested torque was more than the machine can give at this speed. */
  limited: boolean
}

/**
 * The smallest stator current that delivers `tReq` at `rpm` within the current limit and the inverter's voltage limit
 * (95 % of vdc/√3, a margin for the controller). Scans the current angle; for each, finds the current by bisection.
 * Below base speed this lands on MTPA; above it, the voltage limit pushes id negative: field weakening.
 */
export function operatingPoint(m: Machine, rpm: number, tReq: number): OperatingPoint {
  const sign = tReq < 0 ? -1 : 1
  const vmax = 0.95 * vPhaseMax(m.vdc)
  const betaMtpa = (() => {
    const { id, iq } = mtpa(m, m.iMax)
    return Math.atan2(-id, iq)
  })()
  let target = Math.min(Math.abs(tReq), torqueEnvelope(m, rpm))
  for (let tries = 0; tries < 60; tries++) {
    let best: OperatingPoint | null = null
    for (let k = 0; k <= 170; k++) {
      const beta = (k / 170) * (Math.PI / 2) * 0.98
      let lo = 0
      let hi = m.iMax
      if (torque(m, -hi * Math.sin(beta), hi * Math.cos(beta)) < target) continue
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2
        if (torque(m, -mid * Math.sin(beta), mid * Math.cos(beta)) < target) lo = mid
        else hi = mid
      }
      const id = -hi * Math.sin(beta)
      const iq = sign * hi * Math.cos(beta)
      const v = voltages(m, id, iq, rpm)
      if (v.vs > vmax) continue
      if (!best || hi < best.is) {
        best = {
          rpm,
          torque: sign * target,
          id,
          iq,
          is: hi,
          beta,
          ...v,
          power: sign * target * ((rpm * TAU) / 60),
          fieldWeakening: beta > betaMtpa + 0.02,
          limited: target < Math.abs(tReq) - 1e-6,
        }
      }
    }
    if (best) return best
    target *= 0.97
  }
  const v = voltages(m, 0, 0, rpm)
  return { rpm, torque: 0, id: 0, iq: 0, is: 0, beta: 0, ...v, power: 0, fieldWeakening: false, limited: true }
}
