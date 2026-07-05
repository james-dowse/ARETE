import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="main-grid" style={{
        flex: 1,
        marginLeft: 'calc(var(--sidebar-w, 224px) + var(--sidebar-gap, 12px) * 2)',
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
