import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '@/lib/format'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
  action?: { label: string; onClick: () => void }
}
interface ConfirmOpts {
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

interface UICtx {
  toast: (message: string, kind?: ToastKind, action?: Toast['action']) => void
  confirm: (opts: ConfirmOpts) => Promise<boolean>
}

const Ctx = createContext<UICtx | null>(null)
export const useUI = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useUI outside provider')
  return c
}

let seq = 0

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [dialog, setDialog] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toast = useCallback<UICtx['toast']>((message, kind = 'success', action) => {
    const id = ++seq
    setToasts((t) => [...t.slice(-3), { id, kind, message, action }])
    setTimeout(() => dismiss(id), action ? 7000 : 4000)
  }, [dismiss])
  const confirm = useCallback<UICtx['confirm']>((opts) => new Promise((resolve) => setDialog({ ...opts, resolve })), [])

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6">
        {toasts.map((t) => {
          const Icon = t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? XCircle : Info
          return (
            <div key={t.id} role={t.kind === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex w-full max-w-sm animate-rise items-center gap-3 rounded-xl border border-line bg-elevated/95 px-4 py-3 text-sm shadow-2xl backdrop-blur">
              <Icon className={cx('size-5 shrink-0', t.kind === 'success' && 'text-success', t.kind === 'error' && 'text-accent', t.kind === 'info' && 'text-muted')} aria-hidden />
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button className="font-semibold text-white underline underline-offset-4" onClick={() => { t.action!.onClick(); dismiss(t.id) }}>
                  {t.action.label}
                </button>
              )}
              <button aria-label="Dismiss notification" className="-mr-1 rounded p-1 text-subtle hover:text-white" onClick={() => dismiss(t.id)}>
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
      {dialog && (
        <ConfirmDialog
          {...dialog}
          onClose={(v) => {
            dialog.resolve(v)
            setDialog(null)
          }}
        />
      )}
    </Ctx.Provider>
  )
}

function ConfirmDialog(p: ConfirmOpts & { onClose: (v: boolean) => void }) {
  return (
    <Modal onClose={() => p.onClose(false)} labelledBy="confirm-title" size="sm">
      <div className="flex gap-4">
        {p.destructive && (
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
            <AlertTriangle className="size-5" aria-hidden />
          </div>
        )}
        <div className="min-w-0">
          <h2 id="confirm-title" className="text-lg font-bold">{p.title}</h2>
          {p.message && <div className="mt-1.5 text-sm leading-6 text-muted">{p.message}</div>}
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button className="btn-ghost" onClick={() => p.onClose(false)}>{p.cancelLabel ?? 'Cancel'}</button>
        <button className="btn-primary" autoFocus onClick={() => p.onClose(true)}>{p.confirmLabel ?? 'Confirm'}</button>
      </div>
    </Modal>
  )
}

/** Accessible modal: focus trap, Escape to close, scroll lock, restores focus. */
export function Modal({ children, onClose, labelledBy, size = 'md', bare }: { children: ReactNode; onClose: () => void; labelledBy?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; bare?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const el = ref.current!
    const focusables = () => [...el.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,video,[tabindex]:not([tabindex="-1"])')]
    if (!el.contains(document.activeElement)) (focusables()[0] ?? el).focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
      if (e.key === 'Tab') {
        const f = focusables()
        if (!f.length) return
        const first = f[0], last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevFocus?.focus?.()
    }
  }, [onClose])
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size]
  return (
    <div className="fixed inset-0 z-[100] flex animate-fade-in items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1} className={cx('relative max-h-[92dvh] w-full animate-rise overflow-y-auto outline-none', w, bare ? '' : 'rounded-t-2xl border border-line bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-6')}>
        {children}
      </div>
    </div>
  )
}
