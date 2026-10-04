import { describe, expect, it } from 'vitest'
import { isotonicDecreasing, quantile } from '@/lib/chart'
import { dec, fmt, hhmm, hhmmText, isoDay } from '@/lib/format'
import { parseCaiso } from '@/lib/sources/abroad'
import { parseCvu, parseTermicas, parseUsinaDia } from '@/lib/sources/geracao'
import { parseFred, parseKalshi, parsePoly } from '@/lib/sources/markets'
import { duckStats, netLoad, vu } from '@/lib/derive'
import type { Observatory } from '@/lib/observatory'
import { parseAgora, parseBalanco, parseCarga, parseCmo, type AgoraKey, type AgoraPoint } from '@/lib/sources/ons'

describe('format', () => {
  it('groups thousands with a non-breaking space and uses a decimal comma', () => {
    expect(fmt(89826)).toBe('89 826')
    expect(dec(5.2079, 4)).toBe('5,2079')
    expect(dec(1234.5, 1)).toBe('1 234,5')
  })
  it('renders Brasília time', () => {
    expect(hhmm('2026-10-02T02:30:00Z')).toBe('23:30')
    expect(hhmmText('2026-10-01T21:30:00Z')).toBe('18h30')
    expect(isoDay('2026-10-02T02:30:00Z')).toBe('2026-10-01')
  })
})

describe('chart', () => {
  it('isotonic fit removes upward blips from a survival curve', () => {
    expect(isotonicDecreasing([0.9, 0.8, 0.85, 0.5])).toEqual([0.9, 0.825, 0.825, 0.5])
  })
  it('quantile interpolates the 50 % crossing', () => {
    expect(quantile([[90, 0.8], [92, 0.6], [94, 0.4]], 0.5)).toBeCloseTo(93)
  })
})

describe('ONS carga', () => {
  const row = (t: string, v: number | null) => ({ din_referenciautc: t, val_cargaglobal: v })
  const series = (base: number) => Array.from({ length: 30 }, (_, i) => row(new Date(Date.UTC(2026, 9, 1, 0, 30 * i)).toISOString(), base + i))
  it('drops unverified zeros and aligns the four areas', () => {
    const raw = { SECO: [...series(50000), row('2026-10-01T15:00:00.000Z', 0)], S: series(13000), NE: series(16000), N: series(10000) }
    const c = parseCarga(raw)
    expect(c.t).toHaveLength(30)
    expect(c.sinNow).toBe(50029 + 13029 + 16029 + 10029)
    expect(c.asOf).toBe('2026-10-01T14:30:00.000Z')
  })
})

describe('ONS CMO', () => {
  const day = (d: string, v: number) =>
    ['SE', 'S', 'NE', 'N'].flatMap((s) => Array.from({ length: 48 }, (_, i) => `${s};X;${d} ${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}:00;${v + i}`))
  it('takes the preferred day when complete, skipping a truncated first line', () => {
    const text = ['00:00;12.3', ...day('2026-09-30', 10), ...day('2026-10-01', 20)].join('\n')
    const c = parseCmo(text, '2026-10-01')
    expect(c.day).toBe('2026-10-01')
    expect(c.bySub.SE[47]).toBe(67)
  })
  it('falls back to the last complete day', () => {
    const text = [...day('2026-09-30', 10), 'SE;SUDESTE;2026-10-01 00:00:00;5'].join('\n')
    expect(parseCmo(text, '2026-10-01').day).toBe('2026-09-30')
  })
})

describe('FRED', () => {
  it('skips missing observations', () => {
    expect(parseFred('observation_date,DCOILBRENTEU\n2026-09-26,.\n2026-09-29,113.96\n')).toEqual([{ d: '2026-09-29', v: 113.96 }])
  })
})

describe('Kalshi', () => {
  it('keeps the nearest expiry and forces a decreasing curve', () => {
    const m = (k: number, bid: number, ask: number, close = '2026-10-02T18:30:00Z') => ({ floor_strike: k, yes_bid_dollars: bid, yes_ask_dollars: ask, close_time: close })
    const k = parseKalshi([m(90, 0.9, 0.92), m(91, 0.7, 0.72), m(92, 0.74, 0.76), m(93, 0.3, 0.32), m(94, 0.1, 0.12), m(95, 0.05, 0.06, '2026-10-09T18:30:00Z')], new Date('2026-10-02T12:00:00Z'))
    expect(k.close).toBe('2026-10-02T18:30:00Z')
    expect(k.ladder.map(([s]) => s)).toEqual([90, 91, 92, 93, 94])
    expect(k.ladder[1][1]).toBe(k.ladder[2][1])
  })
})

describe('Polymarket', () => {
  it('splits the HIGH and LOW ladders', () => {
    const q = (t: string, p: number) => ({ question: `Will WTI Crude Oil (WTI) hit ${t} in October?`, outcomePrices: JSON.stringify([String(p), String(1 - p)]) })
    const p = parsePoly([{ title: 'What will WTI Crude Oil (WTI) hit in October 2026?', markets: [q('(HIGH) $100', 0.55), q('(LOW) $85', 0.58), q('(HIGH) $95', 0.85)] }])
    expect(p.high).toEqual([[95, 0.85], [100, 0.55]])
    expect(p.low).toEqual([[85, 0.58]])
  })
})

describe('CAISO', () => {
  it('reads named columns and drops empty future rows', () => {
    const hdr = 'Time,Solar,Wind,Geothermal,Biomass,Biogas,Small hydro,Coal,Nuclear,Natural Gas,Large Hydro,Batteries,Imports,Other'
    const body = Array.from({ length: 14 }, (_, i) => `${String(i).padStart(2, '0')}:00,${i},1,1,1,1,1,0,2,3,4,-1,5,0`)
    const c = parseCaiso([hdr, ...body, '14:00,,,,,,,,,,,,,'].join('\n'))
    expect(c.time).toHaveLength(14)
    expect(c.Solar[13]).toBe(13)
    expect(c.Batteries[0]).toBe(-1)
  })
})

describe('ONS balanço', () => {
  // A duck: flat load, a solar hump peaking at noon, constant wind.
  const day = (d: string, hours = 24) =>
    Array.from({ length: hours }, (_, h) => {
      const sol = h >= 6 && h <= 18 ? Math.round(40000 * Math.sin(((h - 6) / 12) * Math.PI)) : 0
      return `SIN  ;SIN;${d} ${String(h).padStart(2, '0')}:00:00;30000.5;8000;10000;${sol};90000;0`
    }).join('\n')
  const csv = `000;cut line from the range\n${day('2026-09-30')}\nNE ;NORDESTE;2026-10-01 00:00:00;1;1;1;1;1;0\n${day('2026-10-01', 20)}`
  it('trims the padded SIN id and keeps the latest complete day', () => {
    const b = parseBalanco(csv, '2026-10-03')
    expect(b.day).toBe('2026-09-30')
    expect(b.carga).toHaveLength(24)
    expect(b.hid[0]).toBe(30001)
    expect(Math.max(...b.sol)).toBe(40000)
  })
  it('finds the trough at noon and the climb to the evening', () => {
    const b = parseBalanco(csv, '2026-10-03')
    const d = duckStats(b as Observatory['balanco'])
    expect(d.troughH).toBe(12)
    expect(d.trough).toBe(90000 - 10000 - 40000)
    expect(d.peakH).toBeGreaterThanOrEqual(18)
    expect(d.ramp).toBe(40000)
    expect(netLoad([100], [10], [20], [5])).toEqual([65])
  })
})

describe('ONS Energia Agora', () => {
  const minutes = Array.from({ length: 12 * 60 + 7 }, (_, i) => `2026-10-03T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00-03:00`)
  const series = (v: (i: number) => number, key: 'geracao' | 'carga' = 'geracao'): AgoraPoint[] => minutes.map((instante, i) => ({ instante, [key]: v(i) }))
  const raw: Record<AgoraKey, AgoraPoint[]> = {
    carga: series(() => 80000, 'carga'),
    eol: series(() => 9000),
    sol: series((i) => (i > 360 ? 10000 : 0)),
    hid: series(() => 30000),
    ter: series(() => 8000),
    nuc: series(() => 1400).slice(0, -2), // nuclear lags two minutes
  }
  it('aligns on common minutes, keeps 5-minute points plus the last, and scales MMGD from the snapshot', () => {
    const a = parseAgora(raw, { Data: '2026-10-03T12:00:00-03:00', sudesteECentroOeste: { geracao: { mmgd: 9000 } }, nordeste: { geracao: { mmgd: 6000 } } })
    expect(a.day).toBe('2026-10-03')
    expect(a.t[1]).toBe('00:05')
    expect(a.t.at(-1)).toBe('12:04')
    expect(a.mmgdRatio).toBeCloseTo(1.5)
    expect(a.mmgd.at(-1)).toBe(15000)
    expect(a.snap.mmgd).toBe(15000)
  })
  it('falls back to a default ratio at night', () => {
    const a = parseAgora(raw, { Data: '2026-10-03T03:00:00-03:00', sul: { geracao: { mmgd: 0 } } })
    expect(a.mmgd[0]).toBe(0)
    expect(a.mmgdRatio).toBe(1.6)
  })
})

describe('ONS geração por usina', () => {
  // Two plants; day 2 is incomplete (stops at 05h). Itaipu's halves share one CEG.
  const line = (d: string, h: number, nome: string, ceg: string, v: number) => `${d} ${String(h).padStart(2, '0')}:00:00;SE;SUDESTE;PR;PARANA;TIPO I;HIDROELÉTRICA;Hidráulica;${nome};X;${ceg};${v}`
  const csv = [
    'partial line from the range',
    ...Array.from({ length: 24 }, (_, h) => line('2026-10-01', h, 'ITAIPU 50 HZ', 'IT', 3000)),
    ...Array.from({ length: 24 }, (_, h) => line('2026-10-01', h, 'ITAIPU 60 HZ', 'IT', h === 18 ? 7000 : 5000)),
    ...Array.from({ length: 24 }, (_, h) => line('2026-10-01', h, 'OUTRA', 'OT', 10)),
    ...Array.from({ length: 6 }, (_, h) => line('2026-10-02', h, 'ITAIPU 50 HZ', 'IT', 1)),
  ].join('\n')
  it('keeps the last complete day, sums by CEG and filters', () => {
    const u = parseUsinaDia(csv, '2026-10-03', new Set(['IT']))!
    expect(u.day).toBe('2026-10-01')
    expect(u.mwh.IT).toBe(24 * 8000 + 2000)
    expect(u.peak.IT).toBe(10000)
    expect(u.mwh.OT).toBeUndefined()
  })
  it('returns null when no day is complete', () => {
    expect(parseUsinaDia(csv, '2026-10-01')).toBeNull()
  })
})

describe('ONS térmicas por motivo', () => {
  // 47 columns; only the ones the parser reads are set.
  const row = (h: number, nome: string, inflex: number, merito: number) => {
    const c = Array(47).fill('0')
    c[0] = `2026-10-02 ${String(h).padStart(2, '0')}:00:00`
    c[2] = 'SE'
    c[4] = nome
    c[5] = '13'
    c[6] = `CEG-${nome}`
    c[24] = String(inflex + merito)
    c[26] = String(merito)
    c[27] = String(inflex)
    c[44] = 'Gás'
    return c.join(';')
  }
  const csv = [...Array.from({ length: 24 }, (_, h) => row(h, 'A', 100, h >= 18 ? 50 : 0)), ...Array.from({ length: 24 }, (_, h) => row(h, 'B', 0, 0))].join('\n')
  it('splits generation by reason, drops plants that did not run', () => {
    const t = parseTermicas(csv, '2026-10-03')!
    expect(t.day).toBe('2026-10-02')
    expect(t.plants).toHaveLength(1)
    expect(t.plants[0].mwh).toBe(2400 + 300)
    expect(t.plants[0].byMotivo.merito).toBe(300)
    expect(t.hourly.inflex[0]).toBe(100)
    expect(t.hourly.merito[18]).toBe(50)
  })
})

describe('ONS CVU', () => {
  const csv = [
    'dat_iniciosemana;dat_fimsemana;ano_referencia;mes_referencia;num_revisao;nom_semanaoperativa;cod_usinaplanejamento;id_subsistema;nom_subsistema;nom_usina;val_cvu',
    '2026-09-26;2026-10-02;2026;10;0;PMO Outubro 2026;13;SE;Sudeste;ANGRA 2;20.12',
    '2026-10-03;2026-10-09;2026;10;1;PMO Outubro 2026 - Revisão 1;13;SE;Sudeste;ANGRA 2;21.5',
  ].join('\n')
  it('picks the operative week that contains the day', () => {
    expect(parseCvu(csv, '2026-10-02').byCod['13']).toBe(20.12)
    expect(parseCvu(csv, '2026-10-05').from).toBe('2026-10-03')
  })
})

describe('bandeira trigger', () => {
  it('is PLD × (1 − GSF): Sep 2026 lands in amarela, Oct 2026 in verde', () => {
    expect(vu({ gsf: 0.76, pld: 163.44 })).toBeCloseTo(39.23, 2)
    expect(vu({ gsf: 0.82, pld: 90.19 })).toBeCloseTo(16.23, 2)
  })
})
