import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/session'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json(null)
  return NextResponse.json({ id: user.id, email: user.email })
}
