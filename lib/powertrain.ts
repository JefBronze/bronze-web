// Section 9d: the Geely EX5 EM-i powertrain — where the power goes in each operating mode. Road load from vehicle
// dynamics, then a power split across fuel, engine, generator (P1), battery, traction motor (P3) and wheels.
// Published values come from lib/ev.ts; the rest are example values, listed in POWERTRAIN_EXAMPLES and on the page.
import { EX5 } from './ev'
import LAYOUT from './powertrain-layout.json'

export const VEHICLE = {
  /** kg — curb weight reported for a test car (press, trim unclear) plus a 75 kg driver. */
  mass: 1782 + 75,
  cd: EX5.cd,
  /** m² — example: 0,85 × width × height (Geely publishes neither the frontal area nor the CdA). */
  area: 0.85 * (EX5.dims.width / 1000) * (EX5.dims.height / 1000),
  /** Rolling resistance coefficient — example, typical of low-rolling-resistance tyres. */
  crr: 0.009,
  rho: 1.2,
  g: 9.81,
  /** m — 235/50 R19 outer diameter (Max/Ultra size; the Pro's 18" size is not published). */
  wheelD: (2 * 235 * 0.5 + 19 * 25.4) / 1000,
}

/** Example efficiencies; Geely publishes only the E-DHT's "combined efficiency of up to 92,5 %". */
export const ETA = {
  gear: 0.97, // single reduction + differential
  motor: 0.95, // P3 + its inverter, typical mid-load point
  generator: 0.94, // P1 + its inverter
  battery: 0.97, // LFP round-trip loss split each way
  charger: 0.93, // 6,6 kW onboard charger, AC → DC
  engineBest: EX5.engine.bte, // 46,5 % claimed by Geely at the best point
}

export const POWERTRAIN_EXAMPLES = [
  `massa (${fmtKg(1782)} kg de um carro de teste da imprensa + 75 kg)`,
  'área frontal (0,85 × largura × altura)',
  'coeficiente de rolamento (0,009)',
  'rendimentos de cada etapa',
  'potência do motor a combustão no modo série (ponto de melhor rendimento)',
  'relação de redução fixa',
]

function fmtKg(n: number) {
  return n.toLocaleString('pt-BR')
}

export type RoadLoad = { aero: number; roll: number; grade: number; inertia: number; total: number }

/** Power at the wheels (W) at a speed (km/h), on a grade (%), with an acceleration (m/s²). */
export function roadLoad(kmh: number, gradePct = 0, accel = 0): RoadLoad {
  const v = kmh / 3.6
  const { mass, cd, area, crr, rho, g } = VEHICLE
  const theta = Math.atan(gradePct / 100)
  const aero = 0.5 * rho * cd * area * v ** 3
  const roll = crr * mass * g * Math.cos(theta) * v
  const grade = mass * g * Math.sin(theta) * v
  const inertia = mass * accel * v
  return { aero, roll, grade, inertia, total: aero + roll + grade + inertia }
}

export type Mode = 'ev' | 'serie' | 'paralelo' | 'regen' | 'recarga'
export const MODE_NAME: Record<Mode, string> = {
  ev: 'elétrico',
  serie: 'série',
  paralelo: 'paralelo',
  regen: 'regeneração',
  recarga: 'recarga na tomada',
}

/** Power on each link of the powertrain, kW (≥ 0; `battery` is positive when discharging, negative when charging). */
export type Flows = {
  mode: Mode
  wheels: number
  fuel: number
  engine: number
  engineToWheels: number
  engineToP1: number
  p1Elec: number
  p3Elec: number
  p3Mech: number
  battery: number
  plug: number
  losses: number
  /** Rotational speeds for the animation, rpm. */
  wheelRpm: number
  engineRpm: number
  p1Rpm: number
  p3Rpm: number
  clutch: boolean
}

/** Fixed ratios of the example gear train in the 3D model (not published): engine pinion → ring; P3 → idler → ring. */
export const RATIO = {
  engine: LAYOUT.ringR / LAYOUT.pinionR,
  p3: (LAYOUT.idlerBigR / LAYOUT.p3PinionR) * (LAYOUT.ringR / LAYOUT.idlerSmallR),
}
/** Engine power held at its efficient point in series mode (example). */
export const SERIES_ENGINE_KW = 25

export function wheelRpm(kmh: number) {
  return ((kmh / 3.6) / (Math.PI * VEHICLE.wheelD)) * 60
}

/** Splits the power for a mode at a speed. `brakeG` is the deceleration used for regeneration. */
export function flows(mode: Mode, kmh: number, brakeG = 0.15): Flows {
  const wRpm = mode === 'recarga' ? 0 : wheelRpm(kmh)
  const base: Flows = {
    mode, wheels: 0, fuel: 0, engine: 0, engineToWheels: 0, engineToP1: 0, p1Elec: 0, p3Elec: 0, p3Mech: 0, battery: 0, plug: 0, losses: 0,
    wheelRpm: wRpm, engineRpm: 0, p1Rpm: 0, p3Rpm: wRpm * RATIO.p3, clutch: false,
  }
  const pw = roadLoad(kmh).total / 1000
  const engineMax = EX5.engine.kw
  const motorMax = EX5.motor.kw
  const fromBus = (elec: number) => elec / ETA.battery // battery terminal power for a bus demand

  if (mode === 'ev') {
    const p3Mech = Math.min(motorMax, pw / ETA.gear)
    const p3Elec = p3Mech / ETA.motor
    const battery = fromBus(p3Elec)
    return { ...base, wheels: p3Mech * ETA.gear, p3Mech, p3Elec, battery, losses: battery - p3Mech * ETA.gear }
  }
  if (mode === 'serie') {
    const p3Mech = Math.min(motorMax, pw / ETA.gear)
    const p3Elec = p3Mech / ETA.motor
    const engine = SERIES_ENGINE_KW
    const p1Elec = engine * ETA.generator
    const surplus = p1Elec - p3Elec // > 0 charges the battery
    const battery = surplus >= 0 ? -surplus * ETA.battery : fromBus(-surplus)
    const fuel = engine / ETA.engineBest
    return {
      ...base, wheels: p3Mech * ETA.gear, fuel, engine, engineToP1: engine, p1Elec, p3Elec, p3Mech, battery,
      engineRpm: 2600, p1Rpm: 2600, losses: fuel + Math.max(0, battery) - p3Mech * ETA.gear - Math.max(0, -battery),
    }
  }
  if (mode === 'paralelo') {
    const need = pw / ETA.gear
    const engineToWheels = Math.min(engineMax, need)
    const assist = need - engineToWheels // P3 adds the rest beyond the engine's power
    const charge = assist > 0 ? 0 : Math.min(10, engineMax - engineToWheels) // spare engine power charges the battery through P1
    const engine = engineToWheels + charge
    const p1Elec = charge * ETA.generator
    const p3Mech = Math.min(motorMax, assist)
    const p3Elec = p3Mech / ETA.motor
    const net = p1Elec - p3Elec
    const battery = net >= 0 ? -net * ETA.battery : fromBus(-net)
    const fuel = engine / ETA.engineBest
    const eRpm = wRpm * RATIO.engine
    return {
      ...base, wheels: (engineToWheels + p3Mech) * ETA.gear, fuel, engine, engineToWheels, engineToP1: charge, p1Elec, p3Elec, p3Mech, battery,
      engineRpm: eRpm, p1Rpm: eRpm, clutch: true, losses: fuel + Math.max(0, battery) - (engineToWheels + p3Mech) * ETA.gear - Math.max(0, -battery),
    }
  }
  if (mode === 'regen') {
    // Braking power from the deceleration, minus what the air and the tyres already take; P3 recovers it as a generator.
    const brake = Math.max(0, (VEHICLE.mass * brakeG * VEHICLE.g * (kmh / 3.6)) / 1000 - pw)
    const p3Mech = Math.min(motorMax, brake * ETA.gear)
    const p3Elec = p3Mech * ETA.motor
    const battery = -p3Elec * ETA.battery
    return { ...base, wheels: -brake, p3Mech: -p3Mech, p3Elec: -p3Elec, battery, losses: brake + battery }
  }
  // recarga: AC through the onboard charger into the battery.
  const plug = EX5.charge.acKw
  const battery = -plug * ETA.charger
  return { ...base, plug, battery, losses: plug + battery }
}

/** Hours to charge from `fromPct` to `toPct` on AC (constant power; LFP keeps most of the curve flat). */
export function acChargeHours(fromPct = 0, toPct = 100) {
  return ((toPct - fromPct) / 100) * EX5.battery.kwh / (EX5.charge.acKw * ETA.charger)
}
