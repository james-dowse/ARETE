'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Zap, Library, BookOpen, LayoutDashboard, Settings2, Users, ChevronLeft, ChevronRight } from 'lucide-react'

const nav = [
  { href: '/',            label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/generator',   label: 'Générateur',   icon: Zap },
  { href: '/library',     label: 'Bibliothèque', icon: Library },
  { href: '/admin',       label: 'Mouvements',   icon: Settings2, sub: true },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users,     sub: true },
  { href: '/workouts',    label: 'Workouts',     icon: BookOpen },
]

const EXPANDED_WIDTH = 224
const COLLAPSED_WIDTH = 56

export default function Sidebar() {
  const path = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  // Replié par défaut sur mobile
  useEffect(() => {
    const mobile = window.innerWidth < 768
    if (mobile) setCollapsed(true)
  }, [])

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

      {/* ── Main nav ── */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: collapsed ? '20px 8px 0' : '20px 12px 0', transition: 'padding 0.22s', overflowY: 'auto' }}>
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

      {/* ── Bouton plier/déplier — juste sous les liens ── */}
      <div style={{ padding: collapsed ? '12px 8px' : '12px 12px', flexShrink: 0 }}>
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Déplier le menu' : 'Replier le menu'}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: collapsed ? 0 : 8,
            background: 'rgba(200,169,81,0.08)',
            border: '1px solid rgba(200,169,81,0.22)',
            borderRadius: 8,
            padding: '9px',
            cursor: 'pointer',
            color: 'rgba(200,169,81,0.7)',
            transition: 'color 0.15s, background 0.15s, border-color 0.15s',
            whiteSpace: 'nowrap',
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
          {collapsed
            ? <ChevronRight size={16} strokeWidth={2.5} />
            : <><ChevronLeft size={16} strokeWidth={2.5} /><span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', maxWidth: collapsed ? 0 : 100, opacity: collapsed ? 0 : 1, transition: 'max-width 0.22s, opacity 0.15s', overflow: 'hidden' }}>Replier</span></>
          }
        </button>
      </div>

      {/* ── Footer ── */}
      {!collapsed && (
        <div style={{ padding: '8px 20px 16px', flexShrink: 0 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.10)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            © 2026 ARETE
          </div>
        </div>
      )}
    </aside>
  )
}
