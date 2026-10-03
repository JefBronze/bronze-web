import type { ReactNode } from 'react'
import type { Status } from '@/lib/observatory'

/** Source line under an instrument. A source that failed shows its last good reading, marked as such. */
export function Stamp({ status, source, when, cadence, children }: { status?: Status; source: string; when: string; cadence?: string; children?: ReactNode }) {
  const live = status?.live ?? true
  return (
    <div className="stamp">
      <span className={live ? 'live' : 'live stale'}>
        <span className={live ? 'dot' : 'dot off'} aria-hidden="true" />
        {live ? `${source} · ${when}${cadence ? ` · ${cadence}` : ''}` : `${source} · sem sinal agora · última leitura ${when}`}
      </span>
      {children}
    </div>
  )
}

export function Lido({ label = 'Lido hoje', children }: { label?: string; children: ReactNode }) {
  return (
    <p className="lido">
      <b>{label}</b>
      {children}
    </p>
  )
}

export function Metodo({ children }: { children: ReactNode }) {
  return (
    <details className="met">
      <summary>Método</summary>
      <p>{children}</p>
    </details>
  )
}

export function ParaVoce({ children, label = 'Para você.' }: { children: ReactNode; label?: string | null }) {
  return (
    <p className="pv">
      {label && <b>{label}</b>} {children}
    </p>
  )
}

/** Red mono tag for anything not yet verified against its primary source. */
export function Todo({ children }: { children: ReactNode }) {
  return <span className="todo">{children}</span>
}

export function Kicker({ n, children }: { n: number; children: ReactNode }) {
  return (
    <p className="kick">
      {String(n).padStart(2, '0')} · {children}
    </p>
  )
}

export function Swatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return <span className={dashed ? 'sw dash' : 'sw'} style={dashed ? { color } : { background: color }} aria-hidden="true" />
}

/** The audit service lives on Bronze Engenharia's site (Data Joule is the observatory). */
export const BRONZE_URL = 'https://www.bronze-engenharia.com.br'
