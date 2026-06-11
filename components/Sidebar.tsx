'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Zap, Library, BookOpen, LayoutDashboard, Settings2, Users, ChevronLeft, ChevronRight, UserCircle, Sun, Moon, Calendar } from 'lucide-react'

const allNav = [
  { href: '/',            label: 'Dashboard',    icon: LayoutDashboard, admin: false },
  { href: '/generator',   label: 'Générateur',   icon: Zap,             admin: false },
  { href: '/library',     label: 'Bibliothèque', icon: Library,         admin: false },
  { href: '/workouts',    label: 'Workouts',     icon: BookOpen,        admin: false },
  { href: '/planner',     label: 'Planner',      icon: Calendar,        admin: false },
  { href: '/profile',     label: 'Mon profil',   icon: UserCircle,      admin: false },
  { href: '/admin',       label: 'Mouvements',   icon: Settings2,       admin: true, sub: true },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users,           admin: true, sub: true },
]

const EXPANDED_WIDTH = 224
const COLLAPSED_WIDTH = 56

export default function Sidebar() {
  const path = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(data => {
      if (data?.isAdmin) setIsAdmin(true)
    }).catch(() => {})
  }, [])

  const nav = allNav.filter(item => !item.admin || isAdmin)

  // Replié par défaut sur mobile
  useEffect(() => {
    const mobile = window.innerWidth < 768
    if (mobile) setCollapsed(true)
  }, [])

  // Persist theme
  useEffect(() => {
    const saved = localStorage.getItem('arete-theme') as 'dark' | 'light' | null
    if (saved) { setTheme(saved); document.documentElement.setAttribute('data-theme', saved) }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('arete-theme', next)
  }

  // Met à jour la CSS variable utilisée par AppShell pour le margin-left
  useEffect(() => {
    const w = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH
    document.documentElement.style.setProperty('--sidebar-w', `${w}px`)
  }, [collapsed])

  const w = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH

  return (
    <aside style={{
      position: 'fixed',
      top: 0,
      left: 0,
      height: '100vh',
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--sidebar-border)',
      width: w,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
      zIndex: 50,
    }}>

      {/* ── Brand ── */}
      <div style={{ padding: collapsed ? '28px 0 24px' : '28px 20px 24px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', transition: 'padding 0.22s', flexShrink: 0 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 12 }}>
          <Image src="/logo.svg" alt="ARETE" width={32} height={32} style={{ flexShrink: 0, opacity: 0.9 }} />
          <div style={{ overflow: 'hidden', width: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1, transition: 'opacity 0.15s, width 0.22s', whiteSpace: 'nowrap' }}>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.22em', color: 'var(--gold)', lineHeight: 1 }}>ARETE</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.20em', marginTop: 4, textTransform: 'uppercase' }}>Protocol</div>
          </div>
        </Link>
      </div>

      {/* ── Séparateur ── */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(200,169,81,0.15) 0%, transparent 80%)', margin: collapsed ? '0 8px' : '0 20px', transition: 'margin 0.22s', flexShrink: 0 }} />

      {/* ── Main nav — hauteur naturelle (pas flex:1) ── */}
      <nav style={{ display: 'flex', flexDirection: 'column', padding: collapsed ? '20px 8px 0' : '20px 12px 0', transition: 'padding 0.22s' }}>
        {!collapsed && (
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em', padding: '0 10px', marginBottom: 10, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
            Navigation
          </div>
        )}
        {nav.map(({ href, label, icon: Icon, sub }) => {
          const active = path === href || (href === '/admin' && path === '/admin')
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`nav-link${active ? ' nav-active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: collapsed ? 0 : 10,
                padding: collapsed ? '10px 0' : sub ? '6px 10px 6px 26px' : '8px 10px',
                borderRadius: collapsed ? 8 : 0,
                textDecoration: 'none',
                background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                color: active ? 'var(--sidebar-text-active)' : sub ? 'rgba(255,255,255,0.38)' : 'var(--sidebar-text)',
                fontWeight: active ? 600 : 400,
                fontSize: sub ? 14 : 15,
                letterSpacing: active ? '0.01em' : 0,
                borderLeft: collapsed ? 'none' : active ? '2px solid var(--gold)' : '2px solid transparent',
                marginLeft: collapsed ? 0 : -1,
                transition: 'color 0.12s, background 0.12s, padding 0.22s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <Icon size={collapsed ? 18 : sub ? 12 : 14} strokeWidth={active ? 2.5 : 1.8} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', maxWidth: collapsed ? 0 : 200, opacity: collapsed ? 0 : 1, transition: 'max-width 0.22s, opacity 0.15s' }}>
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* ── Bouton toggle — collé sous les liens ── */}
      <div style={{ padding: collapsed ? '10px 8px' : '10px 12px', flexShrink: 0 }}>
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'rgba(200,169,81,0.08)',
            border: '1px solid rgba(200,169,81,0.22)',
            borderRadius: 8,
            padding: '9px',
            cursor: 'pointer',
            color: 'rgba(200,169,81,0.7)',
            transition: 'color 0.15s, background 0.15s, border-color 0.15s',
            overflow: 'hidden',
          }}
          onMouseEnter={e => {
            const b = e.currentTarget as HTMLButtonElement
            b.style.background = 'rgba(200,169,81,0.16)'
            b.style.borderColor = 'rgba(200,169,81,0.5)'
            b.style.color = 'var(--gold)'
          }}
          onMouseLeave={e => {
            const b = e.currentTarget as HTMLButtonElement
            b.style.background = 'rgba(200,169,81,0.08)'
            b.style.borderColor = 'rgba(200,169,81,0.22)'
            b.style.color = 'rgba(200,169,81,0.7)'
          }}
        >
          {collapsed ? <ChevronRight size={16} strokeWidth={2.5} /> : <ChevronLeft size={16} strokeWidth={2.5} />}
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', maxWidth: collapsed ? 0 : 80, opacity: collapsed ? 0 : 1, transition: 'max-width 0.22s, opacity 0.15s', overflow: 'hidden', whiteSpace: 'nowrap' }}>
            Replier
          </span>
        </button>
      </div>

      {/* ── Footer — poussé en bas ── */}
      <div style={{ marginTop: 'auto', padding: collapsed ? '16px 8px' : '16px 12px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Dark/light toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8, background: 'rgba(200,169,81,0.06)', border: '1px solid rgba(200,169,81,0.15)',
            borderRadius: 8, padding: collapsed ? '8px' : '8px 12px', cursor: 'pointer',
            color: 'rgba(255,255,255,0.45)', transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.background = 'rgba(200,169,81,0.12)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; e.currentTarget.style.background = 'rgba(200,169,81,0.06)' }}
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          <span style={{ fontSize: 12, maxWidth: collapsed ? 0 : 100, opacity: collapsed ? 0 : 1, overflow: 'hidden', whiteSpace: 'nowrap', transition: 'max-width 0.22s, opacity 0.15s' }}>
            {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </span>
        </button>

        {!collapsed && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.10)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 0 0' }}>
            © 2026 ARETE
          </div>
        )}
      </div>
    </aside>
  )
}
