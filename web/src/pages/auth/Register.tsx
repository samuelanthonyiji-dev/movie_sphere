import { Check, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cx } from '@/lib/format'
import { useDocumentTitle } from '@/lib/hooks'
import { useAuth } from '@/state/auth'
import { useUI } from '@/state/ui'
import { AuthLayout, FormError } from './AuthLayout'

export default function Register() {
  useDocumentTitle('Create account')
  const { register } = useAuth()
  const { toast } = useUI()
  const nav = useNavigate()
  const [f, setF] = useState({ username: '', email: '', password: '', agree: false })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const rules = [
    { ok: f.password.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(f.password) && /\d/.test(f.password), label: 'Letters and numbers' },
  ]

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!f.agree) return setError('Please accept the Terms of Service and Privacy Policy.')
    setBusy(true)
    try {
      await register({ username: f.username, email: f.email, password: f.password })
      toast('Account created — welcome to MovieSphere!')
      nav('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Free. Browsing stays open to everyone — an account adds sync across devices." footer={<>Already have an account? <Link to="/login" className="font-semibold text-white hover:underline">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4">
        <FormError>{error}</FormError>
        <label className="block">
          <span className="label">Username</span>
          <input className="field" autoComplete="username" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_.\-]+" title="Letters, numbers, dot, dash and underscore" autoFocus />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input className="field" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input className="field" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} aria-describedby="pw-rules" />
        </label>
        <ul id="pw-rules" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {rules.map((r) => (
            <li key={r.label} className={cx('flex items-center gap-1', r.ok ? 'text-success' : 'text-subtle')}><Check className="size-3.5" aria-hidden />{r.label}</li>
          ))}
        </ul>
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" className="mt-1 size-4 accent-[#e50914]" checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} />
          <span>I agree to the <Link to="/terms" className="text-white underline">Terms of Service</Link> and <Link to="/privacy" className="text-white underline">Privacy Policy</Link>.</span>
        </label>
        <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} Create account</button>
      </form>
    </AuthLayout>
  )
}
