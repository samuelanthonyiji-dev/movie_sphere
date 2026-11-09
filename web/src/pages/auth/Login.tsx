import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '@/lib/hooks'
import { useAuth } from '@/state/auth'
import { useUI } from '@/state/ui'
import { AuthLayout, FormError } from './AuthLayout'

export default function Login() {
  useDocumentTitle('Sign in')
  const { login } = useAuth()
  const { toast } = useUI()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/'
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const u = await login(identifier, password)
      toast(`Welcome back, ${u.displayName}`)
      nav(from === '/login' ? '/' : from, { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout title="Sign in" subtitle="Sync your list, ratings and playback progress across devices." footer={<>New to MovieSphere? <Link to="/register" className="font-semibold text-white hover:underline">Create an account</Link> · <Link to="/" className="hover:text-white">Continue as guest</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError>{error}</FormError>
        <label className="block">
          <span className="label">Email or username</span>
          <input className="field" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
        </label>
        <label className="block">
          <span className="label flex justify-between">Password <Link to="/forgot-password" className="normal-case tracking-normal text-muted hover:text-white">Forgot password?</Link></span>
          <span className="relative block">
            <input className="field pr-12" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center text-subtle hover:text-white" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </label>
        <button className="btn-primary w-full" disabled={busy || !identifier || !password}>{busy && <Loader2 className="size-4 animate-spin" />} Sign in</button>
      </form>
    </AuthLayout>
  )
}
