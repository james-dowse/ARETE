import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="main-grid" style={{
        flex: 1,
        overflowY: 'auto',
        padding: '36px 40px',
        minHeight: '100vh',
        minWidth: 0,
      }}>
        {children}
      </main>
    </div>
  )
}
