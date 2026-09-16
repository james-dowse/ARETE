import { prisma } from './prisma'

// Quels utilisateurs ont une photo de profil — sans rapatrier les images.
//
// Les listes ont seulement besoin de savoir s'il faut afficher un avatar ou le
// filigrane par défaut ; lire la colonne `avatarUrl` (data URI base64) pour ça
// ferait transiter plusieurs Mo entre la base et la fonction à chaque appel.
// Cette requête ne renvoie que des identifiants.
//
// Le résultat change rarement (un changement de photo) : petit TTL mémoire,
// même principe que lib/attributes-cache.ts.
const TTL_MS = 60_000
let cached: Set<string> | null = null
let cachedAt = 0

export async function getAvatarOwnerIds(): Promise<Set<string>> {
  if (cached && Date.now() - cachedAt <= TTL_MS) return cached
  try {
    const rows = await prisma.invitedUser.findMany({
      where: { avatarUrl: { not: null } },
      select: { id: true },
    }) as { id: string }[]
    cached = new Set(rows.map(r => r.id))
    cachedAt = Date.now()
    return cached
  } catch {
    return cached ?? new Set<string>()
  }
}

export function invalidateAvatarOwners() {
  cached = null
  cachedAt = 0
}

// Recopie un objet utilisateur de liste en remplaçant l'avatar par un booléen.
export function withHasAvatar<T extends { id: string } | null | undefined>(
  user: T,
  owners: Set<string>,
): T extends null | undefined ? null : T & { hasAvatar: boolean } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!user) return null as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ...user, hasAvatar: owners.has(user.id) } as any
}
