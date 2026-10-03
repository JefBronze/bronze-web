// pt-BR number and time formatting used across the page.
// Thousands use a non-breaking space ("89 826") so a number never wraps across lines; decimals use a comma.

const NBSP = ' '

export function fmt(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
}

export function dec(n: number, digits = 2): string {
  const s = n.toFixed(digits).replace('.', ',')
  const [int, frac] = s.split(',')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return frac === undefined ? grouped : `${grouped},${frac}`
}

export function pct(share: number, digits = 0): string {
  return `${dec(share * 100, digits)} %`
}

const BRT = 'America/Sao_Paulo'

function parts(d: Date, timeZone: string) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? '00'
  return { y: get('year'), m: get('month'), d: get('day'), hh: get('hour'), mm: get('minute') }
}

/** "23:30" in the given zone (default Brasília). */
export function hhmm(iso: string | Date, timeZone = BRT): string {
  const { hh, mm } = parts(new Date(iso), timeZone)
  return `${hh}:${mm}`
}

/** "23h30" — the form used in running text. */
export function hhmmText(iso: string | Date, timeZone = BRT): string {
  const { hh, mm } = parts(new Date(iso), timeZone)
  return mm === '00' ? `${Number(hh)}h` : `${Number(hh)}h${mm}`
}

/** "01/10" */
export function ddmm(iso: string | Date, timeZone = BRT): string {
  const { d, m } = parts(new Date(iso), timeZone)
  return `${d}/${m}`
}

/** "2026-10-01" — calendar date in the zone. */
export function isoDay(iso: string | Date, timeZone = BRT): string {
  const { y, m, d } = parts(new Date(iso), timeZone)
  return `${y}-${m}-${d}`
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-09-29" -> "29 set" */
export function dayMonth(isoDate: string): string {
  const [, m, d] = isoDate.slice(0, 10).split('-')
  return `${Number(d)} ${MESES[Number(m) - 1]}`
}

/** "2026-10" -> "out/2026" */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MESES[Number(m) - 1]}/${y}`
}

/** "2026-08-06" -> "06/08/2026" */
export function brDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
