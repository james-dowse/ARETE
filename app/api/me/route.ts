import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

// L'identité ne change pas d'une navigation à l'autre : laisser le navigateur
// la garder évite un aller-retour réseau + base à chaque montage de la sidebar.
const CACHE_HEADERS = { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=600' }

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json(null, { headers: CACHE_HEADERS })
  return NextResponse.json(
    { id: user.id, email: user.email, isAdmin: isAdmin(user.email) },
    { headers: CACHE_HEADERS },
  )
}
