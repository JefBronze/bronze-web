// SVG geometry for the hand-drawn instruments. Pure functions returning path strings.
// Ported from design/helpers.js (the Claude Design mock-ups) so the shapes match the approved design.

export type Pt = [number, number]

export function scale(d0: number, d1: number, r0: number, r1: number) {
  return (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)
}

export function x(v: number, d0: number, d1: number, r0: number, r1: number) {
  return scale(d0, d1, r0, r1)(v)
}

const f = (n: number) => n.toFixed(1)

export function line(values: number[], x0: number, x1: number, yTop: number, yBottom: number, yMin: number, yMax: number) {
  const sx = scale(0, values.length - 1, x0, x1)
  const sy = scale(yMin, yMax, yBottom, yTop)
  return values.map((v, i) => `${i ? 'L' : 'M'}${f(sx(i))} ${f(sy(v))}`).join('')
}

export function area(values: number[], x0: number, x1: number, yTop: number, yBottom: number, yMin: number, yMax: number) {
  return `${line(values, x0, x1, yTop, yBottom, yMin, yMax)}L${x1} ${yBottom}L${x0} ${yBottom}Z`
}

/** Band between two series (lower[i] <= upper[i]) on a shared value scale. */
export function band(lower: number[], upper: number[], x0: number, x1: number, yTop: number, yBottom: number, yMin: number, yMax: number) {
  const sx = scale(0, upper.length - 1, x0, x1)
  const sy = scale(yMin, yMax, yBottom, yTop)
  let d = upper.map((v, i) => `${i ? 'L' : 'M'}${f(sx(i))} ${f(sy(v))}`).join('')
  for (let i = lower.length - 1; i >= 0; i--) d += `L${f(sx(i))} ${f(sy(lower[i]))}`
  return `${d}Z`
}

/** Stacked bands, bottom-up; negative values are clamped to 0 (e.g. batteries charging). */
export function stack<K extends string>(series: { key: K; values: number[] }[], x0: number, x1: number, yTop: number, yBottom: number, yMax: number) {
  let base = series[0].values.map(() => 0)
  return series.map((s) => {
    const top = s.values.map((v, i) => base[i] + Math.max(0, v))
    const d = band(base, top, x0, x1, yTop, yBottom, 0, yMax)
    base = top
    return { key: s.key, d }
  })
}

/** Polyline through (price, probability) points. */
export function curve(points: Pt[], pMin: number, pMax: number, x0: number, x1: number, yTop: number, yBottom: number) {
  const sx = scale(pMin, pMax, x0, x1)
  const sy = scale(0, 1, yBottom, yTop)
  return points.map(([p, q], i) => `${i ? 'L' : 'M'}${f(sx(p))} ${f(sy(q))}`).join('')
}

/** Step curve (horizontal, then vertical) for probability ladders. */
export function steps(points: Pt[], pMin: number, pMax: number, x0: number, x1: number, yTop: number, yBottom: number) {
  const sx = scale(pMin, pMax, x0, x1)
  const sy = scale(0, 1, yBottom, yTop)
  return points.map(([p, q], i) => (i ? `H${f(sx(p))}V${f(sy(q))}` : `M${f(sx(p))} ${f(sy(q))}`)).join('')
}

/** Price at which a decreasing survival curve P(X > price) crosses q (linear interpolation). */
export function quantile(points: Pt[], q: number): number {
  for (let i = 1; i < points.length; i++) {
    const [pa, qa] = points[i - 1]
    const [pb, qb] = points[i]
    if (qa >= q && qb <= q) return qa === qb ? pa : pa + ((qa - q) / (qa - qb)) * (pb - pa)
  }
  return NaN
}

/**
 * Pool-adjacent-violators fit forcing a non-increasing sequence (survival curves must fall with price).
 * Prediction-market mid-prices are noisy; this is the "ajuste isotônico" named in the Método text.
 */
export function isotonicDecreasing(values: number[]): number[] {
  const blocks: { sum: number; n: number }[] = []
  for (const v of values) {
    blocks.push({ sum: v, n: 1 })
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1]
      const a = blocks[blocks.length - 2]
      if (a.sum / a.n >= b.sum / b.n) break
      blocks.splice(blocks.length - 2, 2, { sum: a.sum + b.sum, n: a.n + b.n })
    }
  }
  return blocks.flatMap((b) => Array.from({ length: b.n }, () => b.sum / b.n))
}
