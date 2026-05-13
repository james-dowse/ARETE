import Sidebar from './Sidebar'
import { getCurrentUser } from '@/lib/session'
import { isAdmin as checkAdmin } from '@/lib/admin'

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  const admin = checkAdmin(user?.email)

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar isAdmin={admin} />
      <main className="main-grid" style={{
        flex: 1,
        marginLeft: 'var(--sidebar-w, 224px)',
        overflowY: 'auto',
        padding: '36px 40px',
        minHeight: '100vh',
        minWidth: 0,
        transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {children}
      </main>
    </div>
  )
}
