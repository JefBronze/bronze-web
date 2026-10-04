'use client'

import { useEffect, useRef, useState } from 'react'

export type MenuItem = { id: string; title: string }

// Section menu in the masthead. Opens a panel under the header listing every section;
// a tap jumps to the section and closes it. Escape, a tap outside or scrolling closes it too.
export default function Menu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const off = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', off)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', off)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="tog menub" aria-expanded={open} aria-controls="secoes" onClick={() => setOpen((v) => !v)}>
        <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          {open ? <path d="M2 2l10 10M12 2 2 12" /> : <path d="M1 3h12M1 7h12M1 11h12" />}
        </svg>
        <span>Seções</span>
      </button>
      {open && (
        <nav id="secoes" className="menup" aria-label="Seções">
          <ol>
            {items.map((it, i) => (
              <li key={it.id}>
                <a href={`#${it.id}`} onClick={() => setOpen(false)}>
                  <i>{String(i + 1).padStart(2, '0')}</i>
                  <span>{it.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  )
}
