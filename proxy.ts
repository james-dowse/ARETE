import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Garde d'authentification : toute page exige le cookie de session.
// Sans lui → redirection vers /login. Empêche l'usage anonyme (et donc les
// séances orphelines). Les API gardent leur propre contrôle (voir lib/authz).
const PUBLIC_PATHS = new Set(['/login', '/offline'])
const PUBLIC_PREFIXES = ['/invite']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Assets, API et pages publiques : laisser passer
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/sw.js' ||
    pathname.endsWith('.png') || pathname.endsWith('.svg') || pathname.endsWith('.ico') ||
    pathname.endsWith('.webmanifest') ||
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  const uid = request.cookies.get('arete_uid')?.value
  if (!uid) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
