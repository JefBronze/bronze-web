'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type TickItem = { href?: string; label: string; value: string; tip: string }

const GUTTER = 16
const MAX_W = 320

// The "Hoje" strip. Each reading explains itself: hover (mouse), focus (keyboard) or a first tap (touch)
// opens a short note; a second tap, or the note's link, goes to the section. The note lives outside the
// moving track: a transformed ancestor would otherwise carry and clip a position:fixed child.
export default function Ticker({ items }: { items: TickItem[] }) {
  const [open, setOpen] = useState<{ i: number; left: number; top: number; width: number } | null>(null)
  const closeTimer = useRef<number | undefined>(undefined)
  const tipRef = useRef<HTMLDivElement>(null)
  const tapped = useRef<number | null>(null) // item explained by the last tap (touch only)
  const inTip = useRef(false) // a press inside the note must not let the item's blur close it

  const show = useCallback((i: number, el: HTMLElement) => {
    window.clearTimeout(closeTimer.current)
    const r = el.getBoundingClientRect()
    const width = Math.min(MAX_W, window.innerWidth - 2 * GUTTER)
    const left = Math.max(GUTTER, Math.min(r.left, window.innerWidth - width - GUTTER))
    setOpen({ i, left, top: r.bottom + 8, width })
  }, [])
  const hideSoon = useCallback(() => {
    window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(null), 150)
  }, [])

  useEffect(() => {
    if (!open) {
      tapped.current = null
      return
    }
    const off = (e: Event) => {
      const t = e.target as Node
      if (tipRef.current?.contains(t) || (t as Element).closest?.('.ticker [data-tip]')) return
      setOpen(null)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null)
    const gone = () => setOpen(null)
    document.addEventListener('pointerdown', off)
    document.addEventListener('keydown', esc)
    window.addEventListener('scroll', gone, { passive: true })
    window.addEventListener('resize', gone)
    return () => {
      document.removeEventListener('pointerdown', off)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', gone)
      window.removeEventListener('resize', gone)
    }
  }, [open])

  const cur = open ? items[open.i] : null

  return (
    <>
      <div className={open ? 'ticker held' : 'ticker'}>
        <div className="track">
          {/* Two identical groups: the track slides by exactly one group, so the loop has no seam.
              The copy is hidden from assistive tech and the tab order. */}
          {[false, true].map((copy) => (
            <div className="tgroup" key={String(copy)} aria-hidden={copy || undefined}>
              {items.map((it, i) => {
                const common = {
                  'data-tip': '',
                  'aria-describedby': !copy && open?.i === i ? 'tick-tip' : undefined,
                  onPointerEnter: (e: React.PointerEvent<HTMLElement>) =>
                    e.pointerType === 'mouse' && show(i, e.currentTarget),
                  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => e.pointerType === 'mouse' && hideSoon(),
                  onFocus: (e: React.FocusEvent<HTMLElement>) => show(i, e.currentTarget),
                  onBlur: () => !inTip.current && hideSoon(),
                }
                const body = (
                  <>
                    <i>{it.label}</i>
                    <b>{it.value}</b>
                  </>
                )
                return it.href ? (
                  <a
                    key={it.label}
                    href={it.href}
                    tabIndex={copy ? -1 : undefined}
                    {...common}
                    onClick={(e) => {
                      // Touch has no hover: the first tap explains, the second navigates.
                      const touch = !matchMedia('(hover: hover)').matches
                      if (touch && tapped.current !== i) {
                        e.preventDefault()
                        tapped.current = i
                        show(i, e.currentTarget)
                      }
                    }}
                  >
                    {body}
                  </a>
                ) : (
                  <span key={it.label} tabIndex={copy ? -1 : 0} {...common} onClick={(e) => show(i, e.currentTarget)}>
                    {body}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      {cur && open && (
        <div
          id="tick-tip"
          role="tooltip"
          ref={tipRef}
          className="ticktip"
          style={{ left: open.left, top: open.top, width: open.width }}
          onPointerEnter={() => window.clearTimeout(closeTimer.current)}
          onPointerDown={() => {
            inTip.current = true
            window.setTimeout(() => (inTip.current = false), 600)
          }}
          onPointerLeave={(e) => e.pointerType === 'mouse' && hideSoon()}
        >
          <span className="ticktip-k">{cur.label}</span>
          <p>{cur.tip}</p>
          {cur.href && (
            <a href={cur.href} onClick={() => setOpen(null)}>
              ver seção ↓
            </a>
          )}
        </div>
      )}
    </>
  )
}
