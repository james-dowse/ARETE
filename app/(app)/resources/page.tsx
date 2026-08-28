import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import ResourcesClient from './ResourcesClient'

export const dynamic = 'force-dynamic'

export default async function ResourcesPage() {
  const user = await getCurrentUser()
  const resources = await prisma.resource.findMany({
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  })

  return <ResourcesClient initialResources={resources.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }))} isAdmin={isAdmin(user?.email)} />
}
