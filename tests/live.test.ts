// Hits the real endpoints. Off by default (CI must not depend on third-party uptime): `LIVE=1 npm test`.
import { describe, expect, it } from 'vitest'
import { getObservatory } from '@/lib/observatory'

describe.skipIf(!process.env.LIVE)('live sources', () => {
  it('every source answers', async () => {
    const o = await getObservatory()
    console.table(Object.fromEntries(Object.entries(o.status).map(([k, s]) => [k, `${s.live ? 'live' : 'SNAPSHOT'} · ${s.asOf}`])))
    console.log({ sinNow: o.carga.sinNow, cmoDay: o.cmo.day, brent: o.brent.at(-1), ptax: o.ptax, kalshi: o.kalshi.ladder.length, poly: o.poly.high.length, hq: o.hq.now, caiso: o.caiso.time.at(-1) })
    expect(Object.values(o.status).filter((s) => !s.live)).toEqual([])
  })
})
