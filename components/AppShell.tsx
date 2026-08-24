import Sidebar from './Sidebar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="main-grid" style={{
        flex: 1,
        marginLeft: 'calc(var(--sidebar-w, 184px) + var(--sidebar-gap, 12px) * 2)',
        overflowY: 'auto',
        padding: 'clamp(20px, 3vw, 36px) clamp(16px, 3.5vw, 40px)',
        minHeight: '100vh',
        minWidth: 0,
        // Pas de transition ici : animer margin-left via calc(var(--sidebar-w)) juste
        // après que la sidebar pose cette variable en JS expose un vrai bug de rendu
        // Chromium (boîte peinte à l'ancienne largeur malgré un style à jour). La
        // sidebar elle-même reste animée ; le contenu suit instantanément, ce qui
        // reste net visuellement.
      }}>
        {children}
      </main>
    </div>
  )
}
