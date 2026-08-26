import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import ContentClient from './ContentClient'

export const dynamic = 'force-dynamic'

export default async function AdminContentPage() {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) redirect('/')
  return <ContentClient />
}
