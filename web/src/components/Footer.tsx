import { Link } from 'react-router-dom'
import { BRAND } from '@/config/brand'
import { Logo } from './Logo'

const COLS = [
  { title: 'Browse', links: [['Movies', '/movies'], ['TV Series', '/series'], ['Categories', '/categories'], ['Collections', '/collections'], ['Latest', '/latest']] },
  { title: 'Your account', links: [['My List', '/my-list'], ['Downloads', '/downloads'], ['Profile', '/profile'], ['Sign in', '/login']] },
  { title: 'Legal', links: [['Copyright & DMCA', '/copyright'], ['Privacy policy', '/privacy'], ['Terms of service', '/terms'], ['Report content', '/report'], ['Contact', '/contact']] },
]

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-surface/50 pb-24 md:pb-0">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">{BRAND.description}</p>
          <p className="mt-4 max-w-sm text-xs leading-5 text-subtle">
            {BRAND.name} only distributes public-domain works, licensed films and titles uploaded or authorized by their rights holders. Artwork shown in this build is generated placeholder art.
          </p>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="label">{c.title}</h2>
            <ul className="space-y-1">
              {c.links.map(([label, to]) => (
                <li key={to}>
                  <Link to={to} className="inline-flex min-h-9 items-center text-sm text-muted hover:text-white">{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-subtle sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</span>
          <span>Copyright notices: <a className="text-muted hover:text-white" href={`mailto:${BRAND.copyrightEmail}`}>{BRAND.copyrightEmail}</a></span>
        </div>
      </div>
    </footer>
  )
}
