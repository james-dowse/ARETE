import AppShell from '@/components/AppShell'
import AdminClient from './AdminClient'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) redirect('/')
  const [movements, usageCounts] = await Promise.all([
    prisma.movement.findMany({ orderBy: [{ bioType: 'asc' }, { name: 'asc' }] }),
    prisma.workoutMovement.groupBy({ by: ['movementId'], _count: { _all: true } }),
  ])

  const usageMap: Record<string, number> = {}
  usageCounts.forEach((u: { movementId: string; _count: { _all: number } }) => { usageMap[u.movementId] = u._count._all })

  return (
    <AppShell>
      <AdminClient
        initialMovements={JSON.parse(JSON.stringify(movements))}
        usageMap={usageMap}
      />
    </AppShell>
  )
}
