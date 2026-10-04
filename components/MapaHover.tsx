'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/** What the pop-up shows for one plant; prepared on the server (numbers already formatted). */
export type PlantCard = {
  nome: string
  sub: string
  linhas: [string, string][]
  /** Thermal plants: yesterday's MWh by dispatch reason. */
  motivos?: { nome: string; fill: string; share: number; mwh: string }[]
  nota?: string
}

const GUTTER = 16
const MAX_W = 300

// Wraps the server-drawn map. Each plant is a <g data-plant="i" tabIndex={0}>; hover (mouse), focus (keyboard)
// or a tap (touch) opens its card next to it. The card is position:fixed and clamped to the viewport.
export default function MapaHover({ cards, children }: { cards: PlantCard[]; children: ReactNode }) {
  const [open, setOpen] = useState<{ i: number; left: number; top: number; width: number } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const show = useCallback((el: Element) => {
    const i = Number(el.getAttribute('data-plant'))
    if (!Number.isFinite(i) || !cards[i]) return
    const r = el.getBoundingClientRect()
    const width = Math.min(MAX_W, window.innerWidth - 2 * GUTTER)
    // Beside the circle, on whichever side has room; below it on narrow screens.
    const right = r.right + 10 + width <= window.innerWidth - GUTTER
    const left = window.innerWidth < 600 ? Math.max(GUTTER, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - GUTTER)) : right ? r.right + 10 : Math.max(GUTTER, r.left - 10 - width)
    const top = window.innerWidth < 600 ? r.bottom + 8 : Math.max(GUTTER, r.top + r.height / 2 - 40)
    setOpen({ i, left, top, width })
  }, [cards])

  // Keep the card inside the viewport once its height is known.
  useEffect(() => {
    const el = cardRef.current
    if (!open || !el) return
    const h = el.getBoundingClientRect().height
    const maxTop = window.innerHeight - h - GUTTER
    if (open.top > maxTop) setOpen((o) => (o ? { ...o, top: Math.max(GUTTER, maxTop) } : o))
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return
      const t = e.target as Element | null
      if (e.type === 'pointerdown' && t?.closest?.('[data-plant]')) return
      setOpen(null)
    }
    const hide = () => setOpen(null)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    window.addEventListener('scroll', hide, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
      window.removeEventListener('scroll', hide)
    }
  }, [open])

  const target = (e: { target: EventTarget | null }) => (e.target as Element | null)?.closest?.('[data-plant]') ?? null
  const card = open ? cards[open.i] : null

  return (
    <div
      ref={boxRef}
      className="mapabox"
      onPointerOver={(e) => {
        const t = target(e)
        if (t && e.pointerType === 'mouse') show(t)
      }}
      onPointerOut={(e) => {
        if (e.pointerType !== 'mouse') return
        const to = (e.relatedTarget as Element | null)?.closest?.('[data-plant]')
        if (!to) setOpen(null)
      }}
      onPointerUp={(e) => {
        const t = target(e)
        if (t && e.pointerType !== 'mouse') show(t)
      }}
      onFocus={(e) => {
        const t = target(e)
        if (t) show(t)
      }}
      onBlur={() => setOpen(null)}
    >
      {children}
      {card && open && (
        <div ref={cardRef} className="plantcard" role="tooltip" style={{ left: open.left, top: open.top, width: open.width }}>
          <span className="ticktip-k">{card.sub}</span>
          <b className="pc-n">{card.nome}</b>
          <dl>
            {card.linhas.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {card.motivos && card.motivos.length > 0 && (
            <>
              <span className="pc-bar">
                {card.motivos.map((m) => (
                  <span key={m.nome} style={{ width: `${m.share * 100}%`, background: m.fill }} />
                ))}
              </span>
              <ul className="pc-mot">
                {card.motivos.map((m) => (
                  <li key={m.nome}>
                    <i style={{ background: m.fill }} />
                    {m.nome} <span>{m.mwh}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {card.nota && <p className="pc-nota">{card.nota}</p>}
        </div>
      )}
    </div>
  )
}
