import { BRAND } from '@/config/brand'
import { cx } from '@/lib/format'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <circle cx="256" cy="256" r="176" fill="none" stroke="#E50914" strokeWidth="36" />
      <ellipse cx="256" cy="256" rx="236" ry="78" fill="none" stroke="#E50914" strokeWidth="18" opacity=".55" transform="rotate(-22 256 256)" />
      <path d="M214 176 L352 256 L214 336 Z" fill="#fff" stroke="#fff" strokeWidth="18" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      <LogoMark className="size-7 shrink-0" />
      {!compact && (
        <span className="font-display text-[1.7rem] leading-none tracking-[0.08em]">
          {BRAND.wordmark[0]}
          <span className="text-accent">{BRAND.wordmark[1]}</span>
        </span>
      )}
      <span className="sr-only">{BRAND.name}</span>
    </span>
  )
}

/** Brand-specific loading animation: the sphere ring spins while the play mark pulses. */
export function BrandLoader({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cx('flex flex-col items-center justify-center gap-4 py-24', className)}>
      <svg viewBox="0 0 512 512" className="size-14" aria-hidden="true">
        <circle cx="256" cy="256" r="168" fill="none" stroke="#2a2a2a" strokeWidth="34" />
        <circle cx="256" cy="256" r="168" fill="none" stroke="#E50914" strokeWidth="34" strokeLinecap="round" strokeDasharray="300 760" className="origin-center animate-vault" />
        <path d="M222 190 L340 256 L222 322 Z" fill="#fff" className="animate-pulse" />
      </svg>
      <span className="text-xs font-semibold tracking-[0.3em] text-subtle uppercase">{label}</span>
    </div>
  )
}
