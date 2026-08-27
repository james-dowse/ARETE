'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Zap, BookOpen, Calendar, Library, UserCircle } from 'lucide-react'

// Barre d'onglets mobile — convention native plutôt que la sidebar rail
// repliée (52px), inutilisable au pouce. Masquée en desktop via CSS
// (.mobile-tab-bar, voir globals.css), affichée uniquement ≤768px.
const TABS = [
  { href: '/dashboard', label: 'Accueil',    icon: LayoutDashboard },
  { href: '/generator', label: 'Générer',    icon: Zap },
  { href: '/workouts',  label: 'Séances',    icon: BookOpen },
  { href: '/planner',   label: 'Planning',   icon: Calendar },
  { href: '/library',   label: 'Biblio',     icon: Library },
  { href: '/profile',   label: 'Profil',     icon: UserCircle },
]

export default function MobileTabBar() {
  const path = usePathname()
  return (
    <nav className="mobile-tab-bar" style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60,
      background: 'var(--sidebar-bg)', borderTop: '1px solid var(--sidebar-border)',
      display: 'none', alignItems: 'stretch', justifyContent: 'space-around',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = path === href
        return (
          <Link key={href} href={href} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3, padding: '8px 4px 6px', textDecoration: 'none',
            color: active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)',
          }}>
            <Icon size={20} strokeWidth={active ? 2.4 : 2} />
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
