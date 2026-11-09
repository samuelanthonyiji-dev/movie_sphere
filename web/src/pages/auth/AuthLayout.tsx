import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogoMark } from '@/components/Logo'

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative grid min-h-[100dvh] place-items-center overflow-hidden px-4 pt-24 pb-16">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-accent/15 blur-[120px]" aria-hidden />
      <div className="relative w-full max-w-md animate-rise">
        <div className="card p-6 sm:p-8">
          <Link to="/" className="mb-6 inline-flex" aria-label="MovieSphere home"><LogoMark className="size-10" /></Link>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  )
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return <p role="alert" className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2.5 text-sm text-white">{children}</p>
}
