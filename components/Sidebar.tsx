'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Zap, Library, BookOpen, LayoutDashboard, Settings2, Users } from 'lucide-react'

const nav = [
  { href: '/',            label: 'Dashboard',    icon: LayoutDashboard },
  { href: '/generator',   label: 'Générateur',   icon: Zap },
  { href: '/library',     label: 'Bibliothèque', icon: Library },
  { href: '/admin',       label: 'Mouvements',   icon: Settings2, sub: true },
  { href: '/admin/users', label: 'Utilisateurs', icon: Users,     sub: true },
  { href: '/workouts',    label: 'Workouts',     icon: BookOpen },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside style={{
      background: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--sidebar-border)',
      width: 224,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>

      {/* ── Brand ── */}
      <div style={{ padding: '28px 20px 24px' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image src="/logo.svg" alt="ARETE" width={32} height={32} style={{ flexShrink: 0, opacity: 0.9 }} />
          <div>
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
      <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(200,169,81,0.15) 0%, transparent 80%)', margin: '0 20px' }} />

      {/* ── Main nav ── */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 12px 0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em', padding: '0 10px', marginBottom: 10, textTransform: 'uppercase' }}>
          Navigation
        </div>
        {nav.map(({ href, label, icon: Icon, sub }) => {
          const active = path === href || (href === '/admin' && path === '/admin')
          return (
            <Link
              key={href}
              href={href}
              className={`nav-link${active ? ' nav-active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: sub ? '6px 10px 6px 26px' : '8px 10px',
                borderRadius: 0,
                textDecoration: 'none',
                background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                color: active ? 'var(--sidebar-text-active)' : sub ? 'rgba(255,255,255,0.38)' : 'var(--sidebar-text)',
                fontWeight: active ? 600 : 400,
                fontSize: sub ? 14 : 15,
                letterSpacing: active ? '0.01em' : 0,
                borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
                marginLeft: -1,
                transition: 'color 0.12s, background 0.12s',
              }}
            >
              <Icon size={sub ? 12 : 14} strokeWidth={active ? 2.5 : 1.8} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* ── Footer ── */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.04)', marginBottom: 12 }} />
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          © 2026 ARETE
        </div>
      </div>
    </aside>
  )
}
