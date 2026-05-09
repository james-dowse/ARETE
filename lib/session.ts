import { cookies } from 'next/headers'
import { prisma } from './prisma'

export const SESSION_COOKIE = 'arete_uid'

export async function getCurrentUser() {
  const jar = await cookies()
  const uid = jar.get(SESSION_COOKIE)?.value
  if (!uid) return null
  try {
    return await prisma.invitedUser.findUnique({ where: { id: uid } })
  } catch {
    return null
  }
}

export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser()
  return user?.id ?? null
}
