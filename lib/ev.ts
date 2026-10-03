// Geely EX5 EM-i Pro (Brazil), the vehicle of section 8. Every published number cites its source (verified 2026-10-03);
// P = primary (Geely Brasil, Geely global, Inmetro), S = secondary (press, databases). What is not published is marked
// as an example value, chosen to be consistent with what is.
import { calibratePsiF, type Machine } from './emotor'

export const EX5 = {
  name: 'Geely EX5 EM-i Pro',
  price: 199_990, // R$, list price; launch promotions from R$ 189.990 (P: Geely Brasil release, 15/04/2026)
  launch: '2026-04-15',
  /** Traction motor P3: permanent-magnet synchronous, hairpin ("X-Pin") winding, oil-spray cooled. */
  motor: { kw: 160, nm: 262 }, // P: Geely Brasil ("160 kW e 262 Nm"); winding and cooling S: 42how
  engine: { litres: 1.5, cyl: 4, valves: 16, kw: 73, nm: 125, bte: 0.465 }, // P: Geely global (73 kW / 125 N·m); BTE 46,5 % S: Gasgoo citing Geely
  system: { cv: 262, nm: 380, zeroTo100: 7.8 }, // P: Geely Brasil
  edrive: { name: 'E-DHT 11 em 1', gears: 1, eff: 0.925 }, // P: Geely Brasil ("eficiência combinada de até 92,5 %"); one speed S: ithome, Gasgoo
  battery: { chem: 'LFP', kwh: 18.4 }, // P: Geely Brasil (Pro and Max)
  charge: { dcKw: 30, dc3080min: 20, acKw: 6.6 }, // DC P: Geely Brasil; AC S: autopapo, autoo
  cd: 0.288, // P: geely.com model page
  dims: { length: 4740, width: 1900, height: 1680, wheelbase: 2750, tankL: 60 }, // P: Geely Brasil
  /** Inmetro PBEV 2026 (table of 25/08/2026), row "Geely EX5 EM-i MAX / PRO". */
  inmetro: { cityKmL: 14.6, roadKmL: 13.3, combinedKmL: 14.0, evCityKmLe: 39.0, evRoadKmLe: 34.0, mjPerKm: 0.55, evRangeKm: 65, rating: 'A' },
} as const

/**
 * Inmetro's electric "km/L equivalente": 1 litre of E22 test petrol = 28,99 MJ (Portaria Inmetro nº 169/2023, Annex E,
 * Table 1) = 8,053 kWh, counted at the plug ("de fonte externa ao veículo"). The published km/L values are already adjusted
 * for real use, so kWh/100 km derived from them can be multiplied straight by the tariff. Derived here, not published.
 */
export const KWH_PER_LEQ = 28.99 / 3.6
export const evKwhPer100 = (kmLe: number) => (100 / kmLe) * KWH_PER_LEQ

export const SOURCES = {
  geelyBrasil: 'https://www.geelybrasil.com.br/geely-ex5-em-i-suv-super-hibrido-plug-in-chega-ao-brasil',
  geelyGlobal: 'https://global.geely.com/en/news/2025/geely-auto-launch-geely-ex5-em-i',
  inmetro: 'https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/veiculos-automotivos-pbe-veicular',
  gasgoo: 'https://autonews.gasgoo.com/articles/ev/geely-auto-launches-new-super-hybrid-tech-nordthor-em-i-70035034',
  portaria169: 'https://www.in.gov.br/en/web/dou/-/portaria-n-169-de-3-de-maio-de-2023-485619287',
}

/**
 * Electrical parameters of the example machine. Published: peak torque and power. Example values (not published by
 * any manufacturer): pole pairs, DC-link voltage, current limit, inductances, maximum speed. ψf is then calibrated so
 * that maximum-torque-per-ampere at the current limit gives exactly the published 262 N·m.
 */
const base: Omit<Machine, 'psiF'> = {
  p: 4,
  Ld: 0.06e-3,
  Lq: 0.14e-3,
  Rs: 0.012,
  iMax: 620,
  // DC link after the E-DHT's SiC boost converter (Geely publishes that the boost exists, not its voltage).
  vdc: 400,
  tPeak: EX5.motor.nm,
  pPeak: EX5.motor.kw * 1000,
  rpmMax: 16000,
}
export const MACHINE: Machine = { ...base, psiF: calibratePsiF(base) }

/** Which values on the page are example values, for the Método text. */
export const EXAMPLE_PARAMS = ['pares de polos (4)', 'tensão do barramento CC depois do elevador (400 V)', 'corrente máxima (620 A de pico)', 'indutâncias Ld e Lq', 'rotação máxima (16 000 rpm)', 'geometria das chapas']
