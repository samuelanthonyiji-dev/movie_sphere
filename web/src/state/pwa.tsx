import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PwaCtx {
  /** True when the browser offered an install prompt we can trigger. */
  canPrompt: boolean
  /** iOS / iPadOS Safari: no prompt API, show manual Add to Home Screen guide. */
  isIOS: boolean
  installed: boolean
  install: () => Promise<'accepted' | 'dismissed' | 'ios-guide' | 'unavailable'>
  showIOSGuide: boolean
  setShowIOSGuide: (v: boolean) => void
  updateReady: boolean
  applyUpdate: () => void
}

const Ctx = createContext<PwaCtx | null>(null)
export const usePwa = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('usePwa outside provider')
  return c
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: window-controls-overlay)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

function detectIOS() {
  const ua = navigator.userAgent
  const iDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  return iDevice
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [updateSW, setUpdateSW] = useState<((reload?: boolean) => Promise<void>) | null>(null)
  const isIOS = detectIOS()

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    const mq = window.matchMedia('(display-mode: standalone)')
    const onMode = () => setInstalled(isStandalone())
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    mq.addEventListener('change', onMode)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      mq.removeEventListener('change', onMode)
    }
  }, [])

  // Register the service worker (production builds only).
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    import('virtual:pwa-register').then(({ registerSW }) => {
      const update = registerSW({
        immediate: true,
        onNeedRefresh: () => setUpdateReady(true),
      })
      setUpdateSW(() => update)
    })
  }, [])

  const install = useCallback(async () => {
    if (deferred) {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      setDeferred(null)
      return outcome
    }
    if (isIOS && !installed) {
      setShowIOSGuide(true)
      return 'ios-guide' as const
    }
    return 'unavailable' as const
  }, [deferred, isIOS, installed])

  return (
    <Ctx.Provider
      value={{
        canPrompt: !!deferred && !installed,
        isIOS,
        installed,
        install,
        showIOSGuide,
        setShowIOSGuide,
        updateReady,
        applyUpdate: () => updateSW?.(true),
      }}
    >
      {children}
    </Ctx.Provider>
  )
}
