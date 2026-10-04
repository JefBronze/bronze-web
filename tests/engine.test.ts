import { describe, expect, it } from 'vitest'
import { cycleMs, displacement, ENGINE, ottoEfficiency, pistonDrop, pressure, strokeAt, valveLift, volume } from '@/lib/engine'

describe('engine (section 7)', () => {
  it('is one 250 cm³ cylinder with a 12:1 compression ratio', () => {
    expect(displacement / 1000).toBeCloseTo(250, 0)
    expect(volume(180) / volume(0)).toBeCloseTo(12, 6)
  })
  it('moves the piston from top to bottom dead centre and back', () => {
    expect(pistonDrop(0)).toBeCloseTo(0, 9)
    expect(pistonDrop(180)).toBeCloseTo(ENGINE.stroke, 9)
    expect(pistonDrop(360)).toBeCloseTo(0, 9)
  })
  it('opens each valve only in its own stroke', () => {
    expect(valveLift(90, 'in')).toBeCloseTo(ENGINE.lift)
    expect(valveLift(270, 'in') + valveLift(270, 'ex') + valveLift(450, 'ex')).toBe(0)
    expect(valveLift(630, 'ex')).toBeCloseTo(ENGINE.lift)
    expect(strokeAt(400)).toBe('combustao')
    expect(strokeAt(-30)).toBe('escape')
  })
  it('peaks after ignition and gives the textbook Otto efficiency', () => {
    expect(pressure(360)).toBe(ENGINE.pPeak)
    expect(pressure(359)).toBeLessThan(30)
    expect(ottoEfficiency).toBeCloseTo(0.63, 2)
    expect(cycleMs(2000)).toBe(60)
  })
})
