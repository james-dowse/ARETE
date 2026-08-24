import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { nextMovementId } from '@/lib/movement-id'

// Prévisualisation du prochain ID pour le formulaire de création — purement
// informatif : l'ID réel est recalculé côté serveur au moment du POST, pour
// rester correct même si deux créations se chevauchent.
export async function GET() {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = await nextMovementId()
  return NextResponse.json({ id })
}
