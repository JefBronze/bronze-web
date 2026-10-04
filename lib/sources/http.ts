// Server-side fetch with a timeout, a polite User-Agent and Next's data cache.
// Every source goes through here; nothing is fetched from the browser (CSP connect-src 'self').

const UA = 'data-joule-observatorio/0.1 (+https://data-joule.com)'

export async function getText(url: string, revalidate: number, init: { headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, ...init.headers },
    signal: AbortSignal.timeout(init.timeoutMs ?? 12_000),
    next: { revalidate },
  })
  if (!res.ok && res.status !== 206) throw new Error(`${res.status} ${url}`)
  return res.text()
}

export async function getJson<T>(url: string, revalidate: number, timeoutMs?: number): Promise<T> {
  return JSON.parse(await getText(url, revalidate, { timeoutMs })) as T
}

/** Minimal CSV splitter for the comma/semicolon files the sources publish (no quoted separators in them). */
export function rows(text: string, sep = ','): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')))
}

/** Next's data cache refuses responses over 2 MB; long tails are fetched in chunks below that. */
const CHUNK = 1_500_000

/**
 * The last `bytes` of a file, fetched backwards in cacheable chunks (HTTP Range) and decoded once, so a multi-byte
 * character split between two chunks survives. The first line is usually partial; parsers skip lines they can't read.
 */
export async function getTail(url: string, bytes: number, revalidate: number, timeoutMs = 20_000): Promise<string> {
  const parts: Uint8Array[] = []
  let end: number | null = null // inclusive last byte of the next chunk; null = end of file
  let got = 0
  while (got < bytes) {
    const size = Math.min(CHUNK, bytes - got)
    const range: string = end === null ? `bytes=-${size}` : `bytes=${Math.max(0, end - size + 1)}-${end}`
    const res: Response = await fetch(url, { headers: { 'User-Agent': UA, Range: range }, signal: AbortSignal.timeout(timeoutMs), next: { revalidate } })
    if (res.status !== 206) throw new Error(`${res.status} ${url} (${range})`)
    const buf = new Uint8Array(await res.arrayBuffer())
    parts.unshift(buf)
    got += buf.byteLength
    const start: number = Number(/bytes (\d+)-/.exec(res.headers.get('content-range') ?? '')?.[1] ?? 0)
    if (start === 0) break
    end = start - 1
  }
  const all = new Uint8Array(got)
  let at = 0
  for (const p of parts) {
    all.set(p, at)
    at += p.byteLength
  }
  return new TextDecoder().decode(all)
}
