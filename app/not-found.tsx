import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Página não encontrada — Bronze Engenharia de Energia',
  robots: { index: false, follow: false },
}

export default function NotFound() {
  return (
    <main className="wrap nf">
      <p className="code">404</p>
      <h1 className="h2">Esta página não existe.</h1>
      <p className="lede">
        O observatório inteiro está em uma página só. <Link href="/">Voltar ao início</Link>.
      </p>
    </main>
  )
}
