import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { useDocumentTitle } from '@/lib/hooks'
import { useAuth } from '@/state/auth'
import { useUI } from '@/state/ui'
import { AuthLayout, FormError } from './AuthLayout'

export default function ResetPassword() {
  useDocumentTitle('Choose a new password')
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { refresh } = useAuth()
  const { toast } = useUI()
  const nav = useNavigate()

  if (!token) return <AuthLayout title="Invalid link" subtitle="This password reset link is incomplete."><Link to="/forgot-password" className="btn-primary w-full">Request a new link</Link></AuthLayout>
  return (
    <AuthLayout title="Choose a new password">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault()
          if (pw !== pw2) return setError('Passwords don’t match.')
          setBusy(true)
          setError('')
          try {
            await api.auth.reset(token, pw)
            await refresh()
            toast('Password updated — you’re signed in')
            nav('/', { replace: true })
          } catch (err) {
            setError((err as Error).message)
          } finally {
            setBusy(false)
          }
        }}
      >
        <FormError>{error}</FormError>
        <label className="block"><span className="label">New password</span><input type="password" className="field" minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required autoFocus /></label>
        <label className="block"><span className="label">Confirm password</span><input type="password" className="field" minLength={8} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></label>
        <button className="btn-primary w-full" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} Update password</button>
      </form>
    </AuthLayout>
  )
}
