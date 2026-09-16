import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/session'

// Les avatars sont stockés en base sous forme de data URI base64
// (app/api/profile/avatar/route.ts). Les renvoyer *inline* dans les listes
// (jusqu'à 100 séances par appel de /api/workouts) dupliquait la même image
// autant de fois qu'il y avait de lignes : plusieurs mégaoctets de JSON pour
// quelques dizaines de kilo-octets d'images réelles.
//
// Les listes ne transportent donc plus qu'un booléen `hasAvatar` ; l'image
// elle-même passe par cette route, que le navigateur met en cache et ne
// télécharge qu'une fois par créateur, quel que soit le nombre de cartouches.
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Route d'image, mais elle sert une donnée de profil : réservée aux comptes
  // connectés, comme le reste de l'app.
  const viewerId = await getCurrentUserId()
  if (!viewerId) return new NextResponse(null, { status: 401 })

  const user = await prisma.invitedUser.findUnique({
    where: { id },
    select: { avatarUrl: true },
  }) as { avatarUrl: string | null } | null

  const raw = user?.avatarUrl
  if (!raw) return new NextResponse(null, { status: 404 })

  // Découpage manuel plutôt qu'une expression régulière : le contenu base64 peut
  // faire des dizaines de milliers de caractères, et `indexOf` évite d'y lancer
  // un moteur d'expressions régulières à chaque requête.
  const comma = raw.indexOf(',')
  const header = comma === -1 ? '' : raw.slice(0, comma)
  if (!header.startsWith('data:') || !header.endsWith(';base64')) {
    // Avatar déjà stocké comme URL distante : on redirige plutôt que de proxifier.
    return NextResponse.redirect(raw)
  }

  const contentType = header.slice('data:'.length, -';base64'.length) || 'image/jpeg'
  const base64 = raw.slice(comma + 1)
  const bytes = Buffer.from(base64, 'base64')
  // ETag sur la taille + un extrait du contenu : suffisant pour invalider quand
  // l'utilisateur change de photo, sans hacher plusieurs dizaines de Ko à
  // chaque requête.
  const etag = `W/"${bytes.length}-${base64.slice(-16)}"`

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.length),
      ETag: etag,
      // `private` : l'avatar n'est servi qu'aux utilisateurs connectés, il ne
      // doit pas atterrir dans un cache partagé (CDN).
      'Cache-Control': 'private, max-age=600, stale-while-revalidate=604800',
    },
  })
}
