import { Download, Home, LayoutGrid, ListVideo, Search } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cx } from '@/lib/format'

const ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/categories', label: 'Browse', icon: LayoutGrid },
  { to: '/downloads', label: 'Downloads', icon: Download },
  { to: '/my-list', label: 'My List', icon: ListVideo },
]

/** Bottom tab bar for phones; respects the home-indicator safe area. */
export function MobileNavigation() {
  return (
    <nav aria-label="Bottom navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-white/5 bg-bg/95 pb-safe backdrop-blur-xl md:hidden">
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={({ isActive }) => cx('flex h-16 flex-col items-center justify-center gap-1 text-[10px] font-semibold tracking-wide transition-colors', isActive ? 'text-white' : 'text-subtle')}>
              {({ isActive }) => (
                <>
                  <Icon className={cx('size-[22px]', isActive && 'text-accent')} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
