import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'

// Clés connues qui doivent toujours apparaître dans l'admin, même avant leur
// premier enregistrement (sinon leur toggle "Affiché" n'existe nulle part
// tant que personne n'a encore sauvegardé une valeur pour cette clé).
const KNOWN_KEYS = ['app_info', 'announcement', 'resources']

export async function GET() {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const contents = await prisma.siteContent.findMany({ orderBy: { key: 'asc' } })

  const missingKeys = KNOWN_KEYS.filter(k => !contents.some(c => c.key === k))
  if (missingKeys.length > 0) {
    await prisma.siteContent.createMany({
      data: missingKeys.map(key => ({ key, body: '', active: false })),
    })
    return NextResponse.json(await prisma.siteContent.findMany({ orderBy: { key: 'asc' } }))
  }

  return NextResponse.json(contents)
}
