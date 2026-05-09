import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const count = await prisma.movement.count()
    return NextResponse.json({ ok: true, movementCount: count })
  } catch (err: unknown) {
    return NextResponse.json({
      ok: false,
      error: String(err),
      stack: err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : undefined
    }, { status: 500 })
  }
}
