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
