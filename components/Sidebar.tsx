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
    if (window.innerWidth < 768) setCollapsed(true)
  }, [])

  const w = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH

  return (
    <aside style={{
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--sidebar-border)',
      width: w,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 10,
    }}>

      {/* ── Brand ── */}
      <div style={{ padding: collapsed ? '28px 0 24px' : '28px 20px 24px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', transition: 'padding 0.22s' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 12 }}>
          <Image src="/logo.svg" alt="ARETE" width={32} height={32} style={{ flexShrink: 0, opacity: 0.9 }} />
          <div style={{ overflow: 'hidden', width: collapsed ? 0 : 'auto', opacity: collapsed ? 0 : 1, transition: 'opacity 0.15s, width 0.22s', whiteSpace: 'nowrap' }}>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.22em', color: 'var(--gold)', lineHeight: 1 }}>
              ARETE
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.20em', marginTop: 4, textTransform: 'uppercase' }}>
              Protocol
            </div>
          </div>
        </Link>
      </div>

      {/* ── Séparateur ── */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(200,169,81,0.15) 0%, transparent 80%)', margin: collapsed ? '0 8px' : '0 20px', transition: 'margin 0.22s' }} />

      {/* ── Main nav ── */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: collapsed ? '20px 8px 0' : '20px 12px 0', transition: 'padding 0.22s' }}>
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

      {/* ── Footer + toggle ── */}
      <div style={{ padding: collapsed ? '16px 8px' : '16px 20px', transition: 'padding 0.22s' }}>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', marginBottom: 12 }} />
        {!collapsed && (
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12, whiteSpace: 'nowrap' }}>
            © 2026 ARETE
          </div>
        )}
        {/* Bouton plier/déplier */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Déplier' : 'Replier'}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-end',
            background: 'none',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '7px',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.3)',
            transition: 'color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--gold)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(201,165,53,0.3)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)' }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  )
}
