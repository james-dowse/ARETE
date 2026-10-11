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
    pathname.startsWith('/.well-known') ||
    pathname === '/sw.js' ||
    pathname.endsWith('.png') || pathname.endsWith('.svg') || pathname.endsWith('.ico') ||
    pathname.endsWith('.webmanifest') ||
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p))
  ) {
    return NextResponse.next()
  }

  // Depuis que le cookie est signé (lib/session.ts), tester sa PRÉSENCE ne
  // suffit plus. Un cookie de l'ancienne forme — l'identifiant nu, sans point —
  // passait cette garde alors que getCurrentUser() le refuse : l'utilisateur
  // atterrissait dans une application qui a l'air connectée et qui est
  // entièrement vide, sans prénom, sans séance, sans planning, et sans aucun
  // moyen d'en sortir puisqu'il n'existe pas de route de déconnexion. C'est ce
  // qui serait arrivé aux trois comptes au premier chargement après la mise en
  // production de la signature.
  //
  // Ici on ne vérifie que la FORME : la signature elle-même est contrôlée côté
  // serveur par getCurrentUser, qui seul doit porter la clé. Le proxy fait du
  // routage, pas de l'autorisation — laisser passer une forme valide mais mal
  // signée ne donne accès à rien, chaque route ayant sa propre garde.
  const uid = request.cookies.get('arete_uid')?.value
  const point = uid ? uid.lastIndexOf('.') : -1
  if (!uid || point <= 0 || point === uid.length - 1) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    const res = NextResponse.redirect(url)
    // Sans cette suppression, le cookie mort survit et le piège se referme à
    // chaque navigation : redirigé vers /login, reconnecté, puis de nouveau
    // porteur des deux cookies.
    if (uid) res.cookies.delete('arete_uid')
    return res
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
