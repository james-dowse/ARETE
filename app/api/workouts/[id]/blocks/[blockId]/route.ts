import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; blockId: string }> }
) {
  const { blockId } = await params
  const { instructions } = await req.json()

  const updated = await prisma.workoutBlock.update({
    where: { id: blockId },
    data: { instructions: instructions === '' ? null : instructions },
  })

  return NextResponse.json(updated)
}
