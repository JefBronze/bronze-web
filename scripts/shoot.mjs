// Visual check of a running build through the Chrome DevTools protocol (no extra dependencies).
//   node scripts/shoot.mjs <url> <out-dir> [light|dark] [width]
// Writes one PNG per section (scrolled into view) and prints layout boxes for the masthead and the "hoje" strip.
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [url = 'http://127.0.0.1:3000/', out = '.', scheme = 'light', width = '1440'] = process.argv.slice(2)
const W = Number(width)
const H = 1100
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9300 + Math.floor(Math.random() * 500)
const SECTIONS = ['pulso', 'preco', 'pato', 'mercado', 'petroleo', 'bomba', 'motor', 'parana', 'fora', 'lab', 'bastidores']

mkdirSync(out, { recursive: true })
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`, `--user-data-dir=/tmp/shoot-${PORT}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {}
    await sleep(200)
  }
  throw new Error('Chrome did not start')
}

const ws = new WebSocket(await target())
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id
    pending.set(n, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)))
    ws.send(JSON.stringify({ id: n, method, params }))
  })
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < 600 })
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] })
await send('Page.navigate', { url })
await sleep(2500)
await evaluate('document.fonts.ready.then(() => true)')

const boxes = await evaluate(`JSON.stringify(Object.fromEntries(['.hdr', '.hoje', '.track', '#pulso', '.rail'].map((s) => {
  const el = document.querySelector(s); if (!el) return [s, null]
  const r = el.getBoundingClientRect(); const cs = getComputedStyle(el)
  return [s, { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), display: cs.display }]
})))`)
console.log('boxes', boxes)
console.log('overflowX', await evaluate('document.documentElement.scrollWidth > innerWidth ? document.documentElement.scrollWidth : false'))

const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  const file = join(out, `${scheme}-${W}-${name}.png`)
  writeFileSync(file, Buffer.from(data, 'base64'))
  return file
}
console.log(await shot('top'))
for (const s of SECTIONS) {
  await evaluate(`(() => { const el = document.getElementById('${s}'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 60); return true })()`)
  await sleep(250)
  console.log(await shot(s))
}
ws.close()
chrome.kill()
