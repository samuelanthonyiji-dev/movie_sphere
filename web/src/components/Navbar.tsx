import { Download, Film, LayoutDashboard, LogIn, LogOut, Menu, MonitorDown, Search, User as UserIcon, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { cx } from '@/lib/format'
import { useAuth } from '@/state/auth'
import { usePwa } from '@/state/pwa'
import { Logo } from './Logo'

const SearchOverlay = lazy(() => import('./SearchBar').then((m) => ({ default: m.SearchOverlay })))

export const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/movies', label: 'Movies' },
  { to: '/series', label: 'TV Series' },
  { to: '/categories', label: 'Categories' },
  { to: '/latest', label: 'Latest' },
  { to: '/trending', label: 'Trending' },
  { to: '/my-list', label: 'My List' },
]

export function Avatar({ name, url, className }: { name: string; url?: string | null; className?: string }) {
  return url ? (
    <img src={url} alt="" className={cx('rounded-full object-cover', className)} />
  ) : (
    <span className={cx('grid place-items-center rounded-full bg-gradient-to-br from-accent to-[#7a050b] font-bold text-white', className)} aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [search, setSearch] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [menu, setMenu] = useState(false)
  const { user, logout } = useAuth()
  const pwa = usePwa()
  const loc = useLocation()
  const nav = useNavigate()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    setDrawer(false)
    setMenu(false)
  }, [loc.pathname])
  useEffect(() => {
    // "/" opens search (unless typing in a field)
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) {
        e.preventDefault()
        setSearch(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  const solid = scrolled || !['/', ''].includes(loc.pathname) && !loc.pathname.startsWith('/movie/')

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-black">Skip to content</a>
      <header className={cx('fixed inset-x-0 top-0 z-50 pt-safe transition-[background-color,border-color,backdrop-filter] duration-300', solid ? 'border-b border-white/5 bg-bg/90 backdrop-blur-xl' : 'border-b border-transparent bg-gradient-to-b from-black/80 to-transparent')}>
        <div className="container-page flex h-16 items-center gap-4 lg:h-[72px]">
          <button className="btn-icon -ml-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer}>
            <Menu className="size-6" />
          </button>
          <Link to="/" aria-label="MovieSphere home" className="shrink-0">
            <Logo />
          </Link>
          <nav aria-label="Primary" className="ml-6 hidden flex-1 lg:block">
            <ul className="flex items-center gap-1 xl:gap-2">
              {NAV_LINKS.map((l) => (
                <li key={l.to}>
                  <NavLink to={l.to} end={l.end} className={({ isActive }) => cx('relative rounded-full px-3 py-2 text-[13px] font-medium transition-colors', isActive ? 'text-white' : 'text-muted hover:text-white')}>
                    {({ isActive }) => (
                      <>
                        {l.label}
                        {isActive && <span className="absolute -bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-accent" />}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button className="btn-icon" onClick={() => setSearch(true)} aria-label="Search (press /)">
              <Search className="size-5" />
            </button>
            {(pwa.canPrompt || (pwa.isIOS && !pwa.installed)) && (
              <button className="btn-dark hidden min-h-9 px-3.5 text-xs md:inline-flex" onClick={() => pwa.install()}>
                <MonitorDown className="size-4" /> Install app
              </button>
            )}
            {user ? (
              <div className="relative" ref={menuRef}>
                <button className="flex items-center gap-2 rounded-full p-1 hover:bg-white/10" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu} aria-label="Account menu">
                  <Avatar name={user.displayName} url={user.avatarUrl} className="size-8 text-sm" />
                </button>
                {menu && (
                  <div role="menu" className="absolute right-0 mt-2 w-60 animate-rise overflow-hidden rounded-xl border border-line bg-surface py-1.5 shadow-2xl">
                    <div className="border-b border-line px-4 py-3">
                      <p className="truncate text-sm font-semibold">{user.displayName}</p>
                      <p className="truncate text-xs text-subtle">{user.email}</p>
                    </div>
                    <MenuLink to="/profile" icon={<UserIcon className="size-4" />}>Profile & settings</MenuLink>
                    <MenuLink to="/my-list" icon={<Film className="size-4" />}>My List</MenuLink>
                    <MenuLink to="/downloads" icon={<Download className="size-4" />}>Downloads</MenuLink>
                    {user.role === 'ADMIN' && <MenuLink to="/admin" icon={<LayoutDashboard className="size-4" />}>Admin dashboard</MenuLink>}
                    <button role="menuitem" className="flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm text-muted hover:bg-white/5 hover:text-white" onClick={async () => { await logout(); nav('/') }}>
                      <LogOut className="size-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/login" state={{ from: loc.pathname }} className="btn-primary min-h-9 px-4 text-xs">
                <LogIn className="size-4" /> <span className="hidden xs:inline">Sign in</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {drawer && (
        <div className="fixed inset-0 z-[70] animate-fade-in bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setDrawer(false)}>
          <nav aria-label="Mobile" onClick={(e) => e.stopPropagation()} className="flex h-full w-[82%] max-w-xs animate-rise flex-col border-r border-line bg-surface pt-safe pb-safe">
            <div className="flex h-16 items-center justify-between px-4">
              <Logo />
              <button className="btn-icon" onClick={() => setDrawer(false)} aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto px-2 py-2">
              {[...NAV_LINKS, { to: '/collections', label: 'Collections' }, { to: '/downloads', label: 'Downloads' }, { to: '/profile', label: 'Profile & settings' }].map((l) => (
                <li key={l.to}>
                  <NavLink to={l.to} end={'end' in l ? l.end : undefined} className={({ isActive }) => cx('flex min-h-12 items-center rounded-lg px-4 text-[15px] font-medium', isActive ? 'bg-accent-soft text-white' : 'text-muted hover:bg-white/5')}>
                    {l.label}
                  </NavLink>
                </li>
              ))}
              {user?.role === 'ADMIN' && (
                <li>
                  <NavLink to="/admin" className="flex min-h-12 items-center rounded-lg px-4 text-[15px] font-medium text-muted hover:bg-white/5">Admin dashboard</NavLink>
                </li>
              )}
            </ul>
            {!pwa.installed && (pwa.canPrompt || pwa.isIOS) && (
              <div className="border-t border-line p-4">
                <button className="btn-primary w-full" onClick={() => pwa.install()}>
                  <MonitorDown className="size-4" /> Install MovieSphere
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
      {search && (
        <Suspense fallback={null}>
          <SearchOverlay onClose={() => setSearch(false)} />
        </Suspense>
      )}
    </>
  )
}

function MenuLink({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link role="menuitem" to={to} className="flex min-h-11 items-center gap-3 px-4 text-sm text-muted hover:bg-white/5 hover:text-white">
      {icon}
      {children}
    </Link>
  )
}
