import { MonitorDown, PlusSquare, RefreshCw, Share, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Modal } from '@/state/ui'
import { usePwa } from '@/state/pwa'
import { LogoMark } from './Logo'

const DISMISS_KEY = 'cv:install-dismissed'

/** Install banner (Android/desktop prompt or iOS guide) + update-available prompt. */
export function InstallPWA() {
  const pwa = usePwa()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return Date.now() - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < 14 * 86400_000
    } catch {
      return false
    }
  })
  const [visible, setVisible] = useState(false)

  // Don't nag immediately: show the banner after a short delay on the user's visit.
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 6000)
    return () => clearTimeout(t)
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
  }

  const available = !pwa.installed && (pwa.canPrompt || pwa.isIOS)

  return (
    <>
      {pwa.updateReady && (
        <div role="status" className="fixed inset-x-4 top-[calc(4.5rem+env(safe-area-inset-top))] z-[60] mx-auto flex max-w-md animate-rise items-center gap-3 rounded-xl border border-line bg-elevated p-3 text-sm shadow-2xl">
          <RefreshCw className="size-5 shrink-0 text-accent" aria-hidden />
          <span className="flex-1">A new version of CineVault is available.</span>
          <button className="btn-primary min-h-9 px-4 text-xs" onClick={pwa.applyUpdate}>Update</button>
        </div>
      )}

      {available && visible && !dismissed && (
        <div role="dialog" aria-label="Install CineVault" className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[55] mx-auto flex max-w-lg animate-rise items-center gap-3 rounded-2xl border border-line bg-elevated/95 p-3 shadow-2xl backdrop-blur md:right-6 md:bottom-6 md:left-auto md:mx-0">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-black">
            <LogoMark className="size-9" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Install the CineVault app</p>
            <p className="text-xs text-muted">Faster launch, offline list and downloads, full-screen viewing.</p>
          </div>
          <button className="btn-primary min-h-9 px-4 text-xs" onClick={() => pwa.install()}>
            <MonitorDown className="size-4" /> Install
          </button>
          <button className="btn-icon size-9 text-subtle" onClick={dismiss} aria-label="Dismiss install suggestion">
            <X className="size-4" />
          </button>
        </div>
      )}

      {pwa.showIOSGuide && (
        <Modal onClose={() => pwa.setShowIOSGuide(false)} labelledBy="ios-title" size="sm">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-xl bg-black"><LogoMark className="size-9" /></div>
            <h2 id="ios-title" className="text-lg font-bold">Add CineVault to your Home Screen</h2>
          </div>
          <ol className="mt-5 space-y-4 text-sm text-muted">
            <li className="flex gap-3"><Step n={1} /><span>Open this page in <strong className="text-white">Safari</strong> (other iOS browsers may not offer installation).</span></li>
            <li className="flex gap-3"><Step n={2} /><span>Tap the <strong className="text-white">Share</strong> button <Share className="inline size-4 align-text-bottom text-white" aria-label="Share icon" /> in the toolbar.</span></li>
            <li className="flex gap-3"><Step n={3} /><span>Scroll and choose <strong className="text-white">Add to Home Screen</strong> <PlusSquare className="inline size-4 align-text-bottom text-white" aria-hidden />.</span></li>
            <li className="flex gap-3"><Step n={4} /><span>Tap <strong className="text-white">Add</strong>. CineVault will open full-screen like a native app.</span></li>
          </ol>
          <button className="btn-primary mt-6 w-full" onClick={() => pwa.setShowIOSGuide(false)}>Got it</button>
        </Modal>
      )}
    </>
  )
}

function Step({ n }: { n: number }) {
  return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-white">{n}</span>
}
