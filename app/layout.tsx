import type { Metadata, Viewport } from 'next'
import { Fragment_Mono, Source_Sans_3, Source_Serif_4 } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './observatory.css'

// Self-hosted through next/font: the CSP only allows font-src 'self'.
const sans = Source_Sans_3({ subsets: ['latin', 'latin-ext'], weight: ['400', '600'], variable: '--font-sans', display: 'swap' })
const serif = Source_Serif_4({ subsets: ['latin', 'latin-ext'], weight: 'variable', style: ['normal', 'italic'], axes: ['opsz'], variable: '--font-serif', display: 'swap' })
const mono = Fragment_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-mono', display: 'swap' })

const SITE_URL = 'https://bronze-engenharia.com.br'
const TITLE = 'Bronze Engenharia de Energia — observatório de energia, com dados'
const DESCRIPTION =
  'Instrumentos ligados a dados públicos do setor elétrico e de combustíveis no Brasil: carga do SIN, custo marginal, três faturas de um mesmo MWh, mercado livre e geração distribuída, petróleo em reais e preços na bomba. Engenharia registrada no Paraná, CREA-PR 194835/D.'

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FBFAF8' },
    { media: '(prefers-color-scheme: dark)', color: '#161513' },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }] },
  openGraph: { type: 'website', locale: 'pt_BR', url: SITE_URL, siteName: 'Bronze Engenharia de Energia', title: TITLE, description: DESCRIPTION },
  alternates: { canonical: '/' },
}

// Applies a saved theme before first paint (no flash). Without a saved choice the system setting wins via CSS.
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
