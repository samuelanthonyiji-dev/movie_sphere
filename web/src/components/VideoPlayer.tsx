import { AlertCircle, Captions, Check, ChevronLeft, Gauge, Maximize, Minimize, Pause, PictureInPicture2, Play, RotateCcw, RotateCw, Settings, Volume1, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cx, formatTime } from '@/lib/format'

export interface PlayerSource {
  id: string
  label: string // e.g. 1080p, 720p, Auto (HLS)
  url: string
  kind: 'mp4' | 'hls'
}
export interface PlayerSubtitle {
  id: string
  label: string
  language: string
  url: string
}

interface Props {
  sources: PlayerSource[]
  subtitles?: PlayerSubtitle[]
  poster?: string | null
  title: string
  startAt?: number
  initialSourceId?: string
  initialSubtitle?: string
  autoPlay?: boolean
  onProgress?: (position: number, duration: number) => void
  onBack?: () => void
  className?: string
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]
type HlsLike = { destroy: () => void; loadSource: (u: string) => void; attachMedia: (v: HTMLMediaElement) => void; on: (e: string, cb: (ev: string, data: { fatal?: boolean }) => void) => void }

export function VideoPlayer({ sources, subtitles = [], poster, title, startAt = 0, initialSourceId, initialSubtitle, autoPlay, onProgress, onBack, className }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const hls = useRef<HlsLike | null>(null)
  const pendingSeek = useRef<{ t: number; play: boolean } | null>(startAt > 0 ? { t: startAt, play: !!autoPlay } : null)
  const hideTimer = useRef<number>(0)
  const lastTap = useRef<{ t: number; x: number }>({ t: 0, x: 0 })

  const [src, setSrc] = useState(() => sources.find((s) => s.id === initialSourceId) ?? sources[0])
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('cv:volume') ?? 1))
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [caption, setCaption] = useState<string>(() => (initialSubtitle && subtitles.some((s) => s.language === initialSubtitle) ? initialSubtitle : 'off'))
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [controls, setControls] = useState(true)
  const [fs, setFs] = useState(false)
  const [menu, setMenu] = useState<null | 'main' | 'quality' | 'speed' | 'captions'>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const pipSupported = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled

  // ── Source loading (MP4 natively, HLS natively on Safari or via lazily-loaded hls.js) ──
  useEffect(() => {
    const v = video.current
    if (!v || !src) return
    setError(null)
    hls.current?.destroy()
    hls.current = null
    if (src.kind === 'hls' && !v.canPlayType('application/vnd.apple.mpegurl')) {
      let cancelled = false
      import('hls.js').then(({ default: Hls }) => {
        if (cancelled) return
        if (!Hls.isSupported()) {
          setError('HLS streaming is not supported in this browser. Choose an MP4 quality instead.')
          return
        }
        const h = new Hls({ capLevelToPlayerSize: true }) as unknown as HlsLike
        h.on('hlsError', (_e, data) => data.fatal && setError('The stream could not be loaded.'))
        h.loadSource(src.url)
        h.attachMedia(v)
        hls.current = h
      })
      return () => {
        cancelled = true
      }
    }
    v.src = src.url
    v.load()
  }, [src])

  useEffect(() => () => hls.current?.destroy(), [])

  useEffect(() => {
    const v = video.current
    if (!v) return
    v.volume = volume
    v.muted = muted
    try { localStorage.setItem('cv:volume', String(volume)) } catch { /* ignore */ }
  }, [volume, muted])
  useEffect(() => {
    if (video.current) video.current.playbackRate = speed
  }, [speed])
  useEffect(() => {
    const v = video.current
    if (!v) return
    const apply = () => {
      for (const t of Array.from(v.textTracks)) t.mode = t.language === caption ? 'showing' : 'disabled'
    }
    apply()
    v.textTracks.addEventListener?.('addtrack', apply)
    return () => v.textTracks.removeEventListener?.('addtrack', apply)
  }, [caption, src])

  // ── Controls visibility ──
  const poke = useCallback(() => {
    setControls(true)
    window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => {
      if (video.current && !video.current.paused) {
        setControls(false)
        setMenu(null)
      }
    }, 2800)
  }, [])

  const toggle = useCallback(async () => {
    const v = video.current
    if (!v) return
    if (v.paused || v.ended) {
      try {
        await v.play()
      } catch (e) {
        if ((e as DOMException).name !== 'AbortError') setError('Playback could not start. Press play to try again.')
      }
    } else v.pause()
    poke()
  }, [poke])

  const seekBy = useCallback((d: number) => {
    const v = video.current
    if (!v) return
    v.currentTime = Math.max(0, Math.min((v.duration || 0) - 0.1, v.currentTime + d))
    setFlash(d > 0 ? `+${d}s` : `${d}s`)
    window.setTimeout(() => setFlash(null), 600)
    poke()
  }, [poke])

  const toggleFs = useCallback(async () => {
    const el = wrap.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null
    const v = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (document.fullscreenElement) await document.exitFullscreen()
    else if (el?.requestFullscreen) await el.requestFullscreen().catch(() => v?.webkitEnterFullscreen?.())
    else v?.webkitEnterFullscreen?.() // iPhone Safari
  }, [])

  const togglePip = useCallback(async () => {
    const v = video.current
    if (!v) return
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await v.requestPictureInPicture()
    } catch {
      setFlash('Picture-in-picture unavailable')
      window.setTimeout(() => setFlash(null), 1200)
    }
  }, [])

  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const changeSource = (s: PlayerSource) => {
    const v = video.current
    if (v) pendingSeek.current = { t: v.currentTime, play: !v.paused }
    setSrc(s)
    setMenu(null)
  }

  // ── Keyboard shortcuts (when the player has focus) ──
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' && !['ArrowLeft', 'ArrowRight'].includes(e.key) && e.key !== ' ') return
    const v = video.current
    if (!v) return
    const k = e.key.toLowerCase()
    const handled = true
    if (k === ' ' || k === 'k') toggle()
    else if (k === 'arrowleft' || k === 'j') seekBy(k === 'j' ? -10 : -5)
    else if (k === 'arrowright' || k === 'l') seekBy(k === 'l' ? 10 : 5)
    else if (k === 'arrowup') setVolume((x) => Math.min(1, +(x + 0.1).toFixed(2)))
    else if (k === 'arrowdown') setVolume((x) => Math.max(0, +(x - 0.1).toFixed(2)))
    else if (k === 'm') setMuted((x) => !x)
    else if (k === 'f') toggleFs()
    else if (k === 'p' && pipSupported) togglePip()
    else if (k === 'c' && subtitles.length) setCaption((c) => (c === 'off' ? subtitles[0].language : 'off'))
    else if (k === '>' || k === '.') setSpeed((s) => SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(s) + 1)])
    else if (k === '<' || k === ',') setSpeed((s) => SPEEDS[Math.max(0, SPEEDS.indexOf(s) - 1)])
    else if (/^[0-9]$/.test(k) && v.duration) v.currentTime = (v.duration * Number(k)) / 10
    else if (k === 'escape' && menu) setMenu(null)
    else return
    if (handled) {
      e.preventDefault()
      e.stopPropagation()
      poke()
    }
  }

  // ── Touch: tap toggles controls; double-tap left/right seeks ──
  const onSurfacePointer = (e: React.PointerEvent) => {
    if (menu) {
      setMenu(null)
      return
    }
    if (e.pointerType === 'mouse') {
      toggle()
      return
    }
    const now = Date.now()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    if (now - lastTap.current.t < 300) {
      if (x < 0.35) seekBy(-10)
      else if (x > 0.65) seekBy(10)
      else toggle()
      lastTap.current = { t: 0, x }
      return
    }
    lastTap.current = { t: now, x }
    window.setTimeout(() => {
      if (lastTap.current.t === now) {
        if (!controls) poke()
        else if (started) toggle()
        else toggle()
      }
    }, 260)
  }

  const pct = duration ? (time / duration) * 100 : 0
  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2
  const show = controls || !playing || !!menu

  return (
    <div
      ref={wrap}
      tabIndex={0}
      onKeyDown={onKey}
      onMouseMove={poke}
      onMouseLeave={() => playing && setControls(false)}
      className={cx('group/player relative isolate overflow-hidden bg-black outline-none select-none focus-visible:ring-2 focus-visible:ring-white/60', !show && 'cursor-none', className)}
      role="region"
      aria-label={`Video player: ${title}`}
    >
      <video
        ref={video}
        className="size-full bg-black object-contain"
        poster={poster ?? undefined}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onPlay={() => { setPlaying(true); setStarted(true); poke() }}
        onPause={() => { setPlaying(false); setControls(true); const v = video.current; if (v && v.duration) onProgress?.(v.currentTime, v.duration) }}
        onTimeUpdate={(e) => {
          const v = e.currentTarget
          setTime(v.currentTime)
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1))
          if (v.duration && Math.floor(v.currentTime) % 5 === 0) onProgress?.(v.currentTime, v.duration)
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget
          setDuration(v.duration)
          const p = pendingSeek.current
          pendingSeek.current = null
          if (p && p.t > 0 && p.t < v.duration - 2) v.currentTime = p.t
          if (p?.play) v.play().catch(() => {})
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => setWaiting(false)}
        onCanPlay={() => setWaiting(false)}
        onEnded={() => { const v = video.current; if (v) onProgress?.(v.duration, v.duration); setControls(true) }}
        onError={() => setError(navigator.onLine ? 'This video could not be played. The file may be unavailable or in an unsupported format.' : 'You’re offline. Only films saved for offline viewing can play.')}
      >
        {subtitles.map((s) => (
          <track key={s.id} kind="subtitles" src={s.url} srcLang={s.language} label={s.label} />
        ))}
      </video>

      {/* Click / tap surface */}
      <div className="absolute inset-0 z-10" onPointerUp={onSurfacePointer} aria-hidden />

      {waiting && !error && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center" role="status" aria-label="Buffering">
          <span className="size-14 animate-spin rounded-full border-4 border-white/20 border-t-accent" />
        </div>
      )}
      {flash && <div className="pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 animate-fade-in rounded-full bg-black/70 px-4 py-2 text-sm font-semibold">{flash}</div>}

      {!started && !error && (
        <button onClick={toggle} className="absolute top-1/2 left-1/2 z-20 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent text-white shadow-[0_10px_40px_-6px_rgb(229_9_20/0.8)] transition-transform hover:scale-105" aria-label={`Play ${title}`}>
          <Play className="ml-1 size-9 fill-white" />
        </button>
      )}

      {error && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/85 p-6 text-center" role="alert">
          <div className="max-w-sm">
            <AlertCircle className="mx-auto mb-3 size-10 text-accent" />
            <p className="text-sm leading-6 text-muted">{error}</p>
            <button
              className="btn-primary mt-5"
              onClick={() => {
                const v = video.current
                setError(null)
                if (v) pendingSeek.current = { t: v.currentTime || time, play: true }
                setSrc((s) => ({ ...s }))
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className={cx('absolute inset-x-0 top-0 z-20 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent p-3 transition-opacity duration-300 sm:p-5', show ? 'opacity-100' : 'pointer-events-none opacity-0')}>
        {onBack && (
          <button className="btn-icon" onClick={onBack} aria-label="Back">
            <ChevronLeft className="size-6" />
          </button>
        )}
        <h2 className="truncate text-base font-semibold sm:text-xl">{title}</h2>
      </div>

      {/* Bottom controls */}
      <div className={cx('absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pt-10 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-opacity duration-300 sm:px-5', show ? 'opacity-100' : 'pointer-events-none opacity-0')}>
        <div className="relative flex items-center gap-3 text-xs tabular-nums">
          <span className="w-12 text-right">{formatTime(time)}</span>
          <div className="relative flex-1">
            <div className="pointer-events-none absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-white/30" style={{ width: `${duration ? (buffered / duration) * 100 : 0}%` }} />
            <input
              type="range"
              className="range relative w-full"
              min={0}
              max={duration || 0}
              step={0.1}
              value={time}
              style={{ ['--fill' as string]: `${pct}%` }}
              aria-label="Seek"
              aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
              onChange={(e) => {
                const v = video.current
                if (v) v.currentTime = Number(e.target.value)
                setTime(Number(e.target.value))
              }}
            />
          </div>
          <span className="w-12 text-subtle">-{formatTime(Math.max(0, duration - time))}</span>
        </div>
        <div className="mt-1 flex items-center gap-0.5 sm:gap-1.5">
          <button className="btn-icon" onClick={toggle} aria-label={playing ? 'Pause (k)' : 'Play (k)'}>
            {playing ? <Pause className="size-6 fill-white" /> : <Play className="size-6 fill-white" />}
          </button>
          <button className="btn-icon" onClick={() => seekBy(-10)} aria-label="Back 10 seconds (j)">
            <RotateCcw className="size-5" />
          </button>
          <button className="btn-icon" onClick={() => seekBy(10)} aria-label="Forward 10 seconds (l)">
            <RotateCw className="size-5" />
          </button>
          <div className="group/vol flex items-center">
            <button className="btn-icon" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute (m)' : 'Mute (m)'}>
              <VolIcon className="size-5" />
            </button>
            <input
              type="range"
              className="range hidden w-0 opacity-0 transition-all duration-200 group-focus-within/vol:w-24 group-focus-within/vol:opacity-100 group-hover/vol:w-24 group-hover/vol:opacity-100 md:block"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              style={{ ['--fill' as string]: `${(muted ? 0 : volume) * 100}%` }}
              aria-label="Volume"
              onChange={(e) => {
                setVolume(Number(e.target.value))
                setMuted(false)
              }}
            />
          </div>
          <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
            {subtitles.length > 0 && (
              <button className={cx('btn-icon', caption !== 'off' && 'text-accent')} onClick={() => setMenu(menu === 'captions' ? null : 'captions')} aria-label="Subtitles (c)" aria-haspopup="menu" aria-expanded={menu === 'captions'}>
                <Captions className="size-5" />
              </button>
            )}
            <button className="btn-icon" onClick={() => setMenu(menu ? null : 'main')} aria-label="Settings: quality and speed" aria-haspopup="menu" aria-expanded={menu === 'main' || menu === 'quality' || menu === 'speed'}>
              <Settings className={cx('size-5 transition-transform', menu && 'rotate-45')} />
            </button>
            {pipSupported && (
              <button className="btn-icon hidden sm:inline-flex" onClick={togglePip} aria-label="Picture in picture (p)">
                <PictureInPicture2 className="size-5" />
              </button>
            )}
            <button className="btn-icon" onClick={toggleFs} aria-label={fs ? 'Exit full screen (f)' : 'Full screen (f)'}>
              {fs ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </button>
          </div>
        </div>
      </div>

      {menu && (
        <div role="menu" className="absolute right-3 bottom-24 z-30 w-60 animate-rise overflow-hidden rounded-xl border border-line bg-black/95 py-1.5 text-sm shadow-2xl backdrop-blur sm:right-5">
          {menu === 'main' && (
            <>
              <MenuRow label="Quality" value={src.label} onClick={() => setMenu('quality')} />
              <MenuRow label="Speed" icon={<Gauge className="size-4" />} value={speed === 1 ? 'Normal' : `${speed}×`} onClick={() => setMenu('speed')} />
              {subtitles.length > 0 && <MenuRow label="Subtitles" value={caption === 'off' ? 'Off' : subtitles.find((s) => s.language === caption)?.label ?? caption} onClick={() => setMenu('captions')} />}
            </>
          )}
          {menu === 'quality' && sources.map((s) => <MenuOption key={s.id} label={s.label} active={s.id === src.id} onClick={() => changeSource(s)} />)}
          {menu === 'speed' && SPEEDS.map((s) => <MenuOption key={s} label={s === 1 ? 'Normal' : `${s}×`} active={s === speed} onClick={() => { setSpeed(s); setMenu(null) }} />)}
          {menu === 'captions' && (
            <>
              <MenuOption label="Off" active={caption === 'off'} onClick={() => { setCaption('off'); setMenu(null) }} />
              {subtitles.map((s) => <MenuOption key={s.id} label={s.label} active={caption === s.language} onClick={() => { setCaption(s.language); setMenu(null) }} />)}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function MenuRow({ label, value, onClick, icon }: { label: string; value: string; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button role="menuitem" onClick={onClick} className="flex min-h-11 w-full items-center gap-2 px-4 text-left hover:bg-white/10">
      {icon}
      <span className="flex-1">{label}</span>
      <span className="text-subtle">{value} ›</span>
    </button>
  )
}
function MenuOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button role="menuitemradio" aria-checked={active} onClick={onClick} className="flex min-h-11 w-full items-center gap-2 px-4 text-left hover:bg-white/10">
      <Check className={cx('size-4', active ? 'text-accent' : 'invisible')} />
      {label}
    </button>
  )
}
