import { describe, expect, it } from 'vitest'
import { acChargeHours, ETA, flows, roadLoad, VEHICLE, wheelRpm } from '@/lib/powertrain'

describe('powertrain (section 9d)', () => {
  it('needs about 13–16 kW at the wheels at 100 km/h on the flat, mostly air', () => {
    const r = roadLoad(100)
    expect(r.total / 1000).toBeGreaterThan(12)
    expect(r.total / 1000).toBeLessThan(17)
    expect(r.aero).toBeGreaterThan(r.roll)
    // Air drag grows with v³: doubling speed ×8.
    expect(roadLoad(100).aero / roadLoad(50).aero).toBeCloseTo(8, 6)
  })
  it('turns the wheels at the right speed', () => {
    expect(wheelRpm(100)).toBeCloseTo((100 / 3.6 / (Math.PI * VEHICLE.wheelD)) * 60, 9)
  })
  it('in EV mode, draws from the battery a bit more than the wheels get', () => {
    const f = flows('ev', 80)
    expect(f.fuel).toBe(0)
    expect(f.battery).toBeGreaterThan(f.wheels)
    expect(f.battery * ETA.battery * ETA.motor * ETA.gear).toBeCloseTo(f.wheels, 6)
  })
  it('in series mode, the engine charges the battery when the road needs less than it makes', () => {
    const f = flows('serie', 50)
    expect(f.engineToWheels).toBe(0)
    expect(f.battery).toBeLessThan(0)
    expect(f.clutch).toBe(false)
  })
  it('in parallel mode, the engine drives the wheels through the clutch', () => {
    const f = flows('paralelo', 110)
    expect(f.clutch).toBe(true)
    expect(f.engineToWheels).toBeGreaterThan(0)
    expect(f.engineRpm).toBeGreaterThan(0)
  })
  it('regenerates into the battery and charges on AC in about 3 hours', () => {
    const r = flows('regen', 80)
    expect(r.battery).toBeLessThan(0)
    expect(r.p3Elec).toBeLessThan(0)
    expect(acChargeHours(0, 100)).toBeGreaterThan(2.5)
    expect(acChargeHours(0, 100)).toBeLessThan(3.5)
  })
})
