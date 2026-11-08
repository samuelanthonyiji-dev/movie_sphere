import { CheckCircle2, Flag, Loader2, Mail } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BRAND } from '@/config/brand'
import { api } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'
import { useAuth } from '@/state/auth'
import { FormError } from '../auth/AuthLayout'

const KINDS = [
  { value: 'copyright', label: 'Copyright infringement / takedown' },
  { value: 'broken', label: 'Broken file, stream or subtitles' },
  { value: 'inappropriate', label: 'Incorrect or inappropriate content' },
  { value: 'other', label: 'Something else' },
]

export default function ContactPage({ mode }: { mode: 'contact' | 'report' }) {
  useDocumentTitle(mode === 'report' ? 'Report content' : 'Contact us')
  const [params] = useSearchParams()
  const { user } = useAuth()
  const [f, setF] = useState({
    kind: mode === 'report' ? 'copyright' : 'contact',
    movieSlug: params.get('movie') ?? '',
    name: user?.displayName ?? '',
    email: user?.email ?? '',
    message: params.get('topic') === 'licensing' ? `I’m the rights holder for "${params.get('movie')}" and would like to discuss distribution.\n\n` : '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <div className="container-page grid max-w-5xl gap-10 pt-24 lg:grid-cols-[1fr_320px] lg:pt-28">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight sm:text-4xl">
          {mode === 'report' ? <Flag className="size-7 text-accent" /> : <Mail className="size-7 text-accent" />} {mode === 'report' ? 'Report content' : 'Contact us'}
        </h1>
        <p className="mt-2 text-sm text-muted">{mode === 'report' ? 'Tell us about a copyright concern, a broken file or anything that shouldn’t be here. We review every report.' : 'Questions, partnership or licensing enquiries — we’d love to hear from you.'}</p>
        {sent ? (
          <div className="card mt-8 flex items-start gap-4 p-6">
            <CheckCircle2 className="size-6 shrink-0 text-success" />
            <div>
              <p className="font-semibold">Thanks — your message was received.</p>
              <p className="mt-1 text-sm text-muted">We’ll reply to {f.email} if we need more information.</p>
              <Link to="/" className="btn-dark mt-4">Back to home</Link>
            </div>
          </div>
        ) : (
          <form
            className="mt-8 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              setBusy(true)
              setError('')
              try {
                await api.report({ ...f, movieSlug: f.movieSlug || undefined })
                setSent(true)
              } catch (err) {
                setError((err as Error).message)
              } finally {
                setBusy(false)
              }
            }}
          >
            <FormError>{error}</FormError>
            {mode === 'report' && (
              <>
                <label className="block">
                  <span className="label">Reason</span>
                  <select className="field" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
                    {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="label">Title page (slug or URL)</span>
                  <input className="field" value={f.movieSlug} onChange={(e) => setF({ ...f, movieSlug: e.target.value.replace(/^.*\/movie\//, '') })} placeholder="e.g. nosferatu-1922" />
                </label>
              </>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="label">Your name</span><input className="field" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} /></label>
              <label className="block"><span className="label">Email</span><input type="email" className="field" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></label>
            </div>
            <label className="block">
              <span className="label">Message</span>
              <textarea className="field min-h-40 py-3" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} required minLength={10} maxLength={5000} placeholder={f.kind === 'copyright' ? 'Identify the work, your rights, and include the statements required by our Copyright Policy.' : ''} />
            </label>
            {f.kind === 'copyright' && <p className="text-xs text-subtle">See our <Link to="/copyright" className="underline">Copyright Policy</Link> for what a complete takedown notice needs.</p>}
            <button className="btn-primary" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} Send</button>
          </form>
        )}
      </div>
      <aside className="card h-fit space-y-4 p-5 text-sm">
        <div><p className="label">General</p><a className="text-white underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a></div>
        <div><p className="label">Copyright agent</p><a className="text-white underline" href={`mailto:${BRAND.copyrightEmail}`}>{BRAND.copyrightEmail}</a></div>
        <div><p className="label">Privacy</p><a className="text-white underline" href={`mailto:${BRAND.privacyEmail}`}>{BRAND.privacyEmail}</a></div>
        <p className="text-xs text-subtle">Placeholder addresses — set real ones in <code>src/config/brand.ts</code>.</p>
      </aside>
    </div>
  )
}
