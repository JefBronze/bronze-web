import { describe, expect, it } from 'vitest'
import {
  baseRpm,
  calibratePsiF,
  clarke,
  invClarke,
  invPark,
  mtpa,
  park,
  phaseCurrents,
  sector,
  stateVoltages,
  svpwm,
  switchStates,
  torque,
  torqueEnvelope,
  torqueParts,
  type Machine,
} from '@/lib/emotor'

const base: Omit<Machine, 'psiF'> = { p: 4, Ld: 0.12e-3, Lq: 0.3e-3, Rs: 0.01, iMax: 550, vdc: 400, tPeak: 300, pPeak: 160e3, rpmMax: 16000 }
const m: Machine = { ...base, psiF: calibratePsiF(base) }

describe('electric drive (section 8)', () => {
  it('turns balanced three-phase currents into constant d and q in the rotor frame', () => {
    for (const th of [0, 0.7, 2.1, 4.4]) {
      const { alpha, beta } = clarke(phaseCurrents(100, th, Math.PI / 2))
      const { d, q } = park(alpha, beta, th)
      expect(d).toBeCloseTo(0, 6)
      expect(q).toBeCloseTo(100, 6)
    }
  })
  it('inverts its own transforms', () => {
    const { alpha, beta } = invPark(-40, 90, 1.3)
    const back = park(alpha, beta, 1.3)
    expect(back.d).toBeCloseTo(-40, 9)
    expect(back.q).toBeCloseTo(90, 9)
    const abc = invClarke(alpha, beta)
    expect(abc[0] + abc[1] + abc[2]).toBeCloseTo(0, 9)
  })
  it('modulates with SVPWM up to vdc/√3 without clipping, and the duties reproduce the reference', () => {
    const vdc = 400
    const amp = vdc / Math.sqrt(3) - 1e-6
    for (const th of [0, 0.4, 1.9, 3.3, 5.6]) {
      const d = svpwm(amp * Math.cos(th), amp * Math.sin(th), vdc)
      d.forEach((x) => expect(x).toBeGreaterThanOrEqual(0))
      d.forEach((x) => expect(x).toBeLessThanOrEqual(1))
      // Line-to-line voltages are what the duties set; the common offset cancels.
      const ref = invClarke(amp * Math.cos(th), amp * Math.sin(th))
      expect((d[0] - d[1]) * vdc).toBeCloseTo(ref[0] - ref[1], 6)
    }
    expect(sector(1, 0.1)).toBe(1)
    expect(sector(-1, -0.1)).toBe(4)
  })
  it('switches legs against a triangle carrier and applies the right voltages', () => {
    expect(switchStates([0.8, 0.5, 0.1], 0.2)).toEqual([true, true, false])
    stateVoltages([true, false, false]).forEach((v, i) => expect(v).toBeCloseTo([2 / 3, -1 / 3, -1 / 3][i], 12))
    expect(stateVoltages([true, true, true])).toEqual([0, 0, 0])
  })
  it('uses negative d current to add reluctance torque (MTPA), calibrated to the published peak torque', () => {
    const { id, iq } = mtpa(m, m.iMax)
    expect(id).toBeLessThan(0)
    expect(Math.hypot(id, iq)).toBeCloseTo(m.iMax, 6)
    const parts = torqueParts(m, m.iMax)
    expect(parts.total).toBeCloseTo(m.tPeak, 3)
    expect(parts.reluctance).toBeGreaterThan(0)
    expect(torque(m, id, iq)).toBeCloseTo(parts.total, 9)
    // MTPA beats putting all the current on q.
    expect(parts.total).toBeGreaterThan(torque(m, 0, m.iMax))
  })
  it('follows constant torque, then constant power', () => {
    const b = baseRpm(m)
    expect(torqueEnvelope(m, b / 2)).toBe(m.tPeak)
    const t = torqueEnvelope(m, 2 * b)
    expect(t).toBeCloseTo(m.tPeak / 2, 6)
  })
})

describe('operating point (section 8)', async () => {
  const { operatingPoint, vPhaseMax, mtpa: mt } = await import('@/lib/emotor')
  it('sits on MTPA at low speed and weakens the field at high speed, within both limits', () => {
    const low = operatingPoint(m, 2000, 200)
    expect(low.torque).toBeCloseTo(200, 3)
    expect(low.fieldWeakening).toBe(false)
    const ref = mt(m, low.is)
    expect(Math.abs(low.id - ref.id)).toBeLessThan(3) // the angle scan has 0,5° steps
    const high = operatingPoint(m, 14000, 100)
    expect(high.vs).toBeLessThanOrEqual(0.95 * vPhaseMax(m.vdc) + 1e-6)
    expect(high.is).toBeLessThanOrEqual(m.iMax + 1e-6)
    expect(high.id).toBeLessThan(low.id)
  })
  it('regenerates with negative torque and q current', () => {
    const r = operatingPoint(m, 4000, -150)
    expect(r.torque).toBeCloseTo(-150, 3)
    expect(r.iq).toBeLessThan(0)
    expect(r.power).toBeLessThan(0)
  })
  it('caps the torque at the envelope', () => {
    const r = operatingPoint(m, 12000, 262)
    expect(r.limited).toBe(true)
    expect(r.torque).toBeLessThan(262)
  })
})
