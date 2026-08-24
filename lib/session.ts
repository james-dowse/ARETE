import { cache } from 'react'
import { cookies } from 'next/headers'
import { prisma } from './prisma'

export const SESSION_COOKIE = 'arete_uid'

// cache() dédoublonne l'appel sur la durée d'une requête : une page qui rend un
// layout + des composants serveur touchant tous la session ne paie qu'un seul
// aller-retour base au lieu d'un par appel.
export const getCurrentUser = cache(async () => {
  const jar = await cookies()
  const uid = jar.get(SESSION_COOKIE)?.value
  if (!uid) return null
  try {
    return await prisma.invitedUser.findUnique({ where: { id: uid } })
  } catch {
    return null
  }
})

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.id ?? null
}
