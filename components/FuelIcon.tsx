// Small fuel marks for thermal plants, from the ONS dispatch file's fuel column (nom_combustivel).
// Server-rendered SVG in the text colour; the name shows on hover (<title>) and is read by screen readers.

export type Fuel = 'gas' | 'oleo' | 'carvao' | 'bio' | 'nuc' | 'res'

export const FUEL_NAME: Record<Fuel, string> = {
  gas: 'gás natural',
  oleo: 'óleo',
  carvao: 'carvão',
  bio: 'biomassa',
  nuc: 'nuclear',
  res: 'resíduos industriais',
}

export function fuelOf(comb: string | undefined): Fuel | null {
  const c = (comb ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  if (!c) return null
  if (c.includes('nuclear')) return 'nuc'
  if (c.includes('carvao')) return 'carvao'
  if (c.includes('gas')) return 'gas' // includes "multi-combustível gás/diesel"
  if (c.includes('oleo') || c.includes('diesel')) return 'oleo'
  if (c.includes('biomassa')) return 'bio'
  if (c.includes('residuo')) return 'res'
  return null
}

const SHAPE: Record<Fuel, React.ReactNode> = {
  gas: <path d="M6 .8c.4 2.2-.9 3.4-1.8 4.6C3.4 6.4 2.9 7.3 2.9 8.3a3.1 3.1 0 0 0 6.2 0c0-1.5-.8-2.4-1.4-3.3-.2.9-.7 1.5-1.3 1.7.6-1.9.5-4.2-.4-5.9Z" />,
  oleo: <path d="M6 1.1S2.7 5 2.7 7.6a3.3 3.3 0 0 0 6.6 0C9.3 5 6 1.1 6 1.1Z" />,
  carvao: <path d="M1.6 8.2 2.8 4.4 5.9 2.8l3.6 1.1 1.1 3.6-2.4 2.5H4Z" />,
  bio: (
    <>
      <path d="M1.8 10.2C1.6 5.3 4.6 1.9 10.4 1.7c.2 5.5-3.3 8.5-8.6 8.5Z" />
      <path d="M2.4 9.6 7.4 4.6" stroke="var(--bg)" strokeWidth={0.9} fill="none" />
    </>
  ),
  nuc: (
    <>
      <circle cx={6} cy={6} r={1.3} />
      <g fill="none" stroke="currentColor" strokeWidth={0.9}>
        <ellipse cx={6} cy={6} rx={5} ry={1.9} />
        <ellipse cx={6} cy={6} rx={5} ry={1.9} transform="rotate(60 6 6)" />
        <ellipse cx={6} cy={6} rx={5} ry={1.9} transform="rotate(-60 6 6)" />
      </g>
    </>
  ),
  res: <path d="M6 1.2 10.2 3.6v4.8L6 10.8 1.8 8.4V3.6Z M6 4.2 4.4 5.1v1.8L6 7.8l1.6-.9V5.1Z" fillRule="evenodd" />,
}

export default function FuelIcon({ fuel }: { fuel: Fuel }) {
  return (
    <svg className="fuel" viewBox="0 0 12 12" width={12} height={12} fill="currentColor" role="img" aria-label={FUEL_NAME[fuel]}>
      <title>{FUEL_NAME[fuel]}</title>
      {SHAPE[fuel]}
    </svg>
  )
}
