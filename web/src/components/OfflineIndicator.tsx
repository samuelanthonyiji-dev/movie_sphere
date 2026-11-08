import { Wifi, WifiOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useOnline } from '@/lib/hooks'

export function OfflineIndicator() {
  const online = useOnline()
  const [back, setBack] = useState(false)
  const was = useRef(online)
  useEffect(() => {
    if (online && !was.current) {
      setBack(true)
      const t = setTimeout(() => setBack(false), 3000)
      was.current = online
      return () => clearTimeout(t)
    }
    was.current = online
  }, [online])

  if (online && !back) return null
  return (
    <div role="status" aria-live="assertive" className="fixed inset-x-0 top-[calc(4rem+env(safe-area-inset-top))] z-[45] flex justify-center px-4 lg:top-[calc(72px+env(safe-area-inset-top))]">
      <div className={`mt-2 flex animate-rise items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-xl ${online ? 'bg-success text-black' : 'border border-line bg-elevated text-white'}`}>
        {online ? <Wifi className="size-4" aria-hidden /> : <WifiOff className="size-4 text-accent" aria-hidden />}
        {online ? 'Back online' : 'You’re offline — showing saved content'}
      </div>
    </div>
  )
}
