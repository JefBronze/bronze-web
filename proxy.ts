import { NextRequest, NextResponse } from 'next/server'

// Only these paths are public. Everything else gets the 404 page.
// Adding a page or a public file means adding its path here.
const ALLOWED = new Set(['/', '/favicon.svg'])

export function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname.replace(/\/+$/, '') || '/'
  if (ALLOWED.has(path)) return NextResponse.next()
  // Rewrite to a path that has no route, so Next renders app/not-found.tsx with status 404.
  return NextResponse.rewrite(new URL('/__404', req.url))
}

export const config = {
  // Next.js build assets and Vercel's analytics endpoints must stay reachable.
  matcher: ['/((?!_next/static|_next/image|_vercel).*)'],
}
