import { Link } from 'react-router-dom'
import { LogoMark } from '@/components/Logo'
import { useDocumentTitle } from '@/lib/hooks'

export default function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <div className="container-page flex min-h-[70vh] flex-col items-center justify-center pt-24 text-center">
      <LogoMark className="size-16 opacity-60" />
      <p className="mt-6 font-display text-7xl tracking-wider text-accent">404</p>
      <h1 className="mt-2 text-2xl font-bold">This reel is missing</h1>
      <p className="mt-2 max-w-sm text-sm text-muted">The page you’re looking for doesn’t exist or has been moved.</p>
      <div className="mt-6 flex gap-2">
        <Link to="/" className="btn-primary">Back home</Link>
        <Link to="/search" className="btn-dark">Search titles</Link>
      </div>
    </div>
  )
}
