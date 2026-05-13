import { getCurrentUser } from '@/lib/session'
import { isAdmin } from '@/lib/admin'
import { redirect } from 'next/navigation'
import UsersClient from './UsersClient'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const user = await getCurrentUser()
  if (!isAdmin(user?.email)) redirect('/')
  const adminEmail = (process.env.ADMIN_EMAIL || 'jimmy.dowse@gmail.com').toLowerCase()
  return <UsersClient adminEmail={adminEmail} />
}
