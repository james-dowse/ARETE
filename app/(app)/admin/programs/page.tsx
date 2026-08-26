import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import ProgramsClient from './ProgramsClient'

export const dynamic = 'force-dynamic'

export default async function AdminProgramsPage() {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) redirect('/')
  return <ProgramsClient />
}
