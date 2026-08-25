'use client'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import MobileTabBar from './MobileTabBar'

// Routes plein écran : séance en cours et vue impression n'affichent pas la
// sidebar. Comme AppShell est désormais monté par le layout partagé, c'est ici
// qu'on les laisse passer — un layout imbriqué ne pourrait pas s'en extraire.
const FULLSCREEN = [/\/active$/, /\/print$/]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  if (FULLSCREEN.some(re => re.test(path))) return <>{children}</>

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar />
      <main className="main-grid app-shell-main" style={{
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
      <MobileTabBar />
    </div>
  )
}
