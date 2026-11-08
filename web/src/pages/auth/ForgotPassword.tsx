import { Loader2, MailCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'
import { AuthLayout, FormError } from './AuthLayout'

export default function ForgotPassword() {
  useDocumentTitle('Reset password')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ message: string; devResetUrl?: string } | null>(null)

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your account email and we’ll send a reset link." footer={<Link to="/login" className="hover:text-white">‹ Back to sign in</Link>}>
      {done ? (
        <div className="space-y-4 text-sm">
          <p className="flex items-start gap-3 text-muted"><MailCheck className="size-5 shrink-0 text-success" />{done.message}</p>
          {done.devResetUrl && (
            <div className="rounded-lg border border-gold/40 bg-gold/10 p-3 text-xs text-muted">
              <strong className="text-gold">Development mode:</strong> no email service is configured, so the link is shown here (and logged on the server). This never appears in production.
              <Link to={done.devResetUrl.replace(/^https?:\/\/[^/]+/, '')} className="mt-2 block break-all text-white underline">Open reset link</Link>
            </div>
          )}
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            setError('')
            try {
              setDone(await api.auth.forgot(email))
            } catch (err) {
              setError((err as Error).message)
            } finally {
              setBusy(false)
            }
          }}
        >
          <FormError>{error}</FormError>
          <label className="block">
            <span className="label">Email</span>
            <input type="email" className="field" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} Send reset link</button>
        </form>
      )}
    </AuthLayout>
  )
}
