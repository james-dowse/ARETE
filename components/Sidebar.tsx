'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Zap, Library, BookOpen, LayoutDashboard, Settings2, Users, ChevronLeft, ChevronRight, UserCircle, Sun, Moon, Calendar, Search, X, LayoutGrid } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useCallback } from 'react'

const allNav = [
  { href: '/generator',   label: 'La Forge',      icon: Zap,             admin: false },
  { href: '/workouts',    label: 'Mes WODs',      icon: BookOpen,        admin: false },
  { href: '/planner',     label: 'Semaine',       icon: Calendar,        admin: false },
  { href: '/vision-board', label: 'Vision Board', icon: LayoutGrid,      admin: false },
  { href: '/library',     label: 'Arsenal',       icon: Library,         admin: false },
  { href: '/dashboard',   label: 'Tableau de bord', icon: LayoutDashboard, admin: false },
  { href: '/profile',     label: 'Mon profil',    icon: UserCircle,      admin: false },
  { href: '/admin',       label: 'Mouvements',    icon: Settings2,       admin: true, sub: true },
  { href: '/admin/users', label: 'Utilisateurs',  icon: Users,           admin: true, sub: true },
]

const EXPANDED_WIDTH = 224
const COLLAPSED_WIDTH = 56

interface SearchResult {
  workouts: { id: string; name: string; duration?: number | null; movements: { movement: { bioType: string } }[] }[]
  movements: { id: string; name: string; bioType: string; complexity: string }[]
}

export default function Sidebar() {
  const path = usePathname()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [showSearch, setShowSearch] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

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

  // Global search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setSearchResults(null); return }
    setSearchLoading(true)
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setSearchResults(data)
    setSearchLoading(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQ), 220)
    return () => clearTimeout(t)
  }, [searchQ, doSearch])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(s => !s)
        setSearchQ('')
        setSearchResults(null)
        setTimeout(() => searchRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') { setShowSearch(false); setSearchQ('') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const openSearch = () => {
    setShowSearch(true); setSearchQ(''); setSearchResults(null)
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  const navigate = (href: string) => {
    setShowSearch(false); setSearchQ(''); router.push(href)
  }

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
    <>
    <aside style={{
      position: 'fixed',
      top: 'var(--sidebar-gap)',
      left: 'var(--sidebar-gap)',
      height: 'calc(100vh - var(--sidebar-gap) * 2)',
      background: 'var(--sidebar-bg)',
      border: '1px solid var(--sidebar-border)',
      borderRadius: 'var(--r-lg)',
      width: w,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      overflow: 'hidden',
      boxShadow: 'var(--elev-2)',
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
                borderRadius: 'var(--r-sm)',
                marginBottom: 2,
                textDecoration: 'none',
                background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                boxShadow: active ? 'inset 0 0 0 1px var(--gold-border)' : 'none',
                color: active ? 'var(--sidebar-text-active)' : sub ? 'rgba(255,255,255,0.38)' : 'var(--sidebar-text)',
                fontWeight: active ? 600 : 400,
                fontSize: sub ? 14 : 15,
                letterSpacing: active ? '0.01em' : 0,
                transition: 'color 0.12s, background 0.12s, padding 0.22s, box-shadow 0.15s',
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

      {/* ── Recherche ── */}
      <div style={{ padding: collapsed ? '8px 8px 0' : '8px 12px 0', flexShrink: 0 }}>
        <button
          onClick={openSearch}
          title="Recherche globale (Ctrl+K)"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 'var(--r-sm)', padding: collapsed ? '8px' : '7px 10px', cursor: 'pointer',
            color: 'rgba(255,255,255,0.35)', transition: 'color 0.15s, background 0.15s, border-color 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(200,169,81,0.4)' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
        >
          <Search size={14} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, flex: 1, textAlign: 'left', maxWidth: collapsed ? 0 : 120, opacity: collapsed ? 0 : 1, overflow: 'hidden', whiteSpace: 'nowrap', transition: 'max-width 0.22s, opacity 0.15s' }}>
            Rechercher…
          </span>
          {!collapsed && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>Ctrl K</span>}
        </button>
      </div>

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
            borderRadius: 'var(--r-sm)',
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
            borderRadius: 'var(--r-sm)', padding: collapsed ? '8px' : '8px 12px', cursor: 'pointer',
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

    {/* ── Search overlay ── */}

    {showSearch && (
      <div
        onClick={() => { setShowSearch(false); setSearchQ('') }}
        className="overlay-in"
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(8,6,2,0.4)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          paddingTop: '12vh',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="modal-in"
          style={{
            width: 560, maxWidth: 'calc(100vw - 32px)',
            background: 'var(--bg-card)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--gold-border)',
            boxShadow: 'var(--elev-3)',
            overflow: 'hidden',
          }}
        >
          {/* Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <Search size={16} style={{ color: 'rgba(200,169,81,0.7)', flexShrink: 0 }} />
            <input
              ref={searchRef}
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Rechercher un workout, un mouvement…"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text, #fff)', fontSize: 15, fontFamily: 'inherit',
              }}
            />
            {searchQ && (
              <button onClick={() => setSearchQ('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0, display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Results */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {searchLoading && (
              <div style={{ padding: '20px 16px', fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>Recherche…</div>
            )}
            {!searchLoading && searchResults && searchResults.workouts.length === 0 && searchResults.movements.length === 0 && (
              <div style={{ padding: '20px 16px', fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>Aucun résultat</div>
            )}
            {!searchLoading && searchResults && searchResults.workouts.length > 0 && (
              <>
                <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(200,169,81,0.6)' }}>Workouts</div>
                {searchResults.workouts.map(w => (
                  <button
                    key={w.id}
                    onClick={() => navigate(`/workouts/${w.id}`)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left', color: 'var(--text, #fff)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,169,81,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                  >
                    <BookOpen size={13} style={{ color: 'rgba(200,169,81,0.6)', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, flex: 1 }}>{w.name}</span>
                    {w.duration && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{w.duration} min</span>}
                  </button>
                ))}
              </>
            )}
            {!searchLoading && searchResults && searchResults.movements.length > 0 && (
              <>
                <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(200,169,81,0.6)', borderTop: searchResults.workouts.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', marginTop: searchResults.workouts.length > 0 ? 4 : 0 }}>Mouvements</div>
                {searchResults.movements.map(m => (
                  <button
                    key={m.id}
                    onClick={() => navigate(`/library?movement=${m.id}`)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer',
                      textAlign: 'left', color: 'var(--text, #fff)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,169,81,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                  >
                    <Library size={13} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, flex: 1 }}>{m.name}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{m.bioType}</span>
                  </button>
                ))}
              </>
            )}
            {!searchQ && (
              <div style={{ padding: '18px 16px', fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>Tapez pour rechercher…</div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}
