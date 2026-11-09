import { Star, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '@/lib/format'

export function Rating({ value, className, source = 'CineVault score' }: { value: number; className?: string; source?: string }) {
  if (!value || value <= 0) return <span className={cx('text-subtle', className)} title="Not rated yet">—<span className="sr-only">Not rated</span></span>
  return (
    <span className={cx('inline-flex items-center gap-1 font-semibold text-white', className)} title={`${source}: ${value.toFixed(1)} / 10`}>
      <Star className="size-3.5 fill-gold text-gold" aria-hidden />
      <span>{value.toFixed(1)}</span>
      <span className="sr-only"> out of 10 ({source})</span>
    </span>
  )
}

export function Badge({ children, tone = 'dark', className }: { children: ReactNode; tone?: 'dark' | 'red' | 'gold' | 'outline'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-5 items-center rounded px-1.5 text-[10px] leading-none font-bold tracking-wider uppercase',
        tone === 'dark' && 'bg-black/75 text-white backdrop-blur',
        tone === 'red' && 'bg-accent text-white',
        tone === 'gold' && 'bg-gold text-black',
        tone === 'outline' && 'border border-white/30 text-muted',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      {icon && <div className="mb-5 grid size-16 place-items-center rounded-full border border-line bg-card text-muted">{icon}</div>}
      <h2 className="text-xl font-bold">{title}</h2>
      {children && <div className="mt-2 text-sm leading-6 text-muted">{children}</div>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = !navigator.onLine || (error as { status?: number })?.status === 0
  return (
    <EmptyState
      icon={offline ? <WifiOff className="size-7" /> : <span className="text-2xl font-bold">!</span>}
      title={offline ? 'You’re offline' : 'Something went wrong'}
      action={
        <>
          {onRetry && <button className="btn-primary" onClick={onRetry}>Try again</button>}
          {offline && <Link className="btn-dark" to="/downloads">Offline downloads</Link>}
          {offline && <Link className="btn-dark" to="/my-list">My List</Link>}
        </>
      }
    >
      {offline ? 'This content hasn’t been saved for offline use yet. Pages you visited before, your list and stored films are still available.' : (error as Error)?.message}
    </EmptyState>
  )
}

export function PosterSkeleton({ className }: { className?: string }) {
  return (
    <div className={cx('w-full', className)} aria-hidden>
      <div className="skeleton aspect-[2/3] w-full rounded-[var(--radius-card)]" />
      <div className="skeleton mt-3 h-3.5 w-3/4 rounded" />
      <div className="skeleton mt-2 h-3 w-1/2 rounded" />
    </div>
  )
}

export function SectionHeader({ title, icon, href, children }: { title: string; icon?: ReactNode; href?: string | null; children?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="section-title">
        {icon}
        <span className="relative">
          {title}
          <span className="absolute -bottom-2 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-accent" aria-hidden />
        </span>
      </h2>
      <div className="flex items-center gap-2">
        {children}
        {href && (
          <Link to={href} className="text-xs font-semibold tracking-wide text-muted uppercase transition-colors hover:text-white">
            View all <span aria-hidden>›</span>
          </Link>
        )}
      </div>
    </div>
  )
}
