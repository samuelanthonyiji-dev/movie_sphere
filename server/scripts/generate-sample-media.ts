/**
 * Generates short, original sample media for the fictional "CineVault Original" titles so the
 * real download / streaming pipeline (range requests, multiple qualities, HLS, subtitles) can be
 * exercised in development. Every byte is produced locally by ffmpeg — nothing is downloaded or
 * scraped. Output: STORAGE_DIR/media, STORAGE_DIR/trailers, STORAGE_DIR/subtitles + manifest.json.
 *
 *   npm run media:generate            (requires ffmpeg on PATH)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { CATALOG } from '../prisma/catalog.js'
import { loadEnv } from '../src/lib/env.js'

loadEnv()
const STORAGE = path.resolve(process.env.STORAGE_DIR ?? './storage')
const FONT = process.env.SAMPLE_FONT ?? '/usr/share/fonts/opentype/inter/Inter-Bold.otf'
const FONT_REG = process.env.SAMPLE_FONT_REGULAR ?? '/usr/share/fonts/opentype/inter/Inter-Regular.otf'
const DURATION = Number(process.env.SAMPLE_SECONDS ?? 40)

const SIZES = { '480p': [854, 480], '720p': [1280, 720], '1080p': [1920, 1080] } as const

const SUB_LINES: Record<string, { label: string; lines: string[] }> = {
  en: { label: 'English', lines: ['This is a CineVault development sample.', 'The picture is generated, not filmed.', 'Subtitles are working correctly.', 'Try changing quality or speed.', 'Thanks for testing CineVault.'] },
  fr: { label: 'Français', lines: ['Ceci est un extrait de démonstration CineVault.', 'L’image est générée, pas filmée.', 'Les sous-titres fonctionnent.', 'Essayez de changer la qualité.', 'Merci de tester CineVault.'] },
  es: { label: 'Español', lines: ['Esta es una muestra de desarrollo de CineVault.', 'La imagen es generada, no filmada.', 'Los subtítulos funcionan.', 'Prueba a cambiar la calidad.', 'Gracias por probar CineVault.'] },
  ja: { label: '日本語', lines: ['これはCineVaultの開発用サンプルです。', '映像は生成されたものです。', '字幕は正しく表示されています。', '画質を変更してみてください。', 'ご協力ありがとうございます。'] },
  no: { label: 'Norsk', lines: ['Dette er et CineVault-utviklingseksempel.', 'Bildet er generert, ikke filmet.', 'Undertekster fungerer.', 'Prøv å endre kvalitet.', 'Takk for at du tester CineVault.'] },
}

const hex = (c: string) => '0x' + c.replace('#', '')
const escText = (s: string) => s.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '\u2019').replace(/%/g, '\\%')

function ff(args: string[]) {
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
}

function videoArgs(title: string, palette: string[], w: number, h: number, seconds: number, label: string) {
  const fsTitle = Math.round(h / 9)
  const fsSmall = Math.round(h / 32)
  const vf = [
    `drawtext=fontfile=${FONT}:text='${escText(title.toUpperCase())}':fontcolor=white:fontsize=${fsTitle}:x=(w-text_w)/2:y=(h-text_h)/2-${fsSmall}:alpha='if(lt(t,1),t,1)'`,
    `drawtext=fontfile=${FONT_REG}:text='${escText(label)}':fontcolor=white@0.8:fontsize=${fsSmall}:x=(w-text_w)/2:y=(h/2)+${fsTitle * 0.6}`,
    `drawtext=fontfile=${FONT_REG}:text='CINEVAULT DEVELOPMENT SAMPLE  ·  %{pts\\:hms}':fontcolor=white@0.6:fontsize=${Math.round(fsSmall * 0.8)}:x=${fsSmall}:y=h-${fsSmall * 2}`,
    `fade=in:0:24,fade=out:st=${seconds - 1}:d=1`,
    'format=yuv420p',
  ].join(',')
  return [
    '-f', 'lavfi', '-i', `gradients=s=${w}x${h}:c0=${hex(palette[0])}:c1=${hex(palette[1])}:c2=${hex(palette[2])}:c3=${hex(palette[0])}:nb_colors=4:speed=0.015:duration=${seconds}:rate=24`,
    '-f', 'lavfi', '-i', `aevalsrc='0.04*sin(2*PI*110*t)+0.03*sin(2*PI*164.8*t)+0.02*sin(2*PI*220*t)':s=48000:d=${seconds}`,
    '-vf', vf, '-af', `afade=in:0:d=2,afade=out:st=${seconds - 2}:d=2`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-c:a', 'aac', '-b:a', '96k', '-shortest',
  ]
}

function vtt(lang: string, seconds: number) {
  const s = SUB_LINES[lang] ?? SUB_LINES.en
  const ts = (n: number) => `00:00:${String(Math.floor(n)).padStart(2, '0')}.000`
  let out = 'WEBVTT\n\n'
  const step = seconds / s.lines.length
  s.lines.forEach((line, i) => {
    out += `${i + 1}\n${ts(i * step + 0.5)} --> ${ts(Math.min(i * step + step - 0.5, seconds - 0.1))}\n${line}\n\n`
  })
  return out
}

type Manifest = Record<string, {
  files: Array<{ quality: string; format: string; mimeType: string; storageKey: string; fileSize: number }>
  trailerKey: string
  subtitles: Array<{ language: string; label: string; storageKey: string }>
}>

const manifest: Manifest = {}
for (const item of CATALOG.filter((c) => c.media)) {
  const m = item.media!
  console.log(`▶ ${item.title}`)
  const mediaDir = path.join(STORAGE, 'media', item.slug)
  mkdirSync(mediaDir, { recursive: true })
  const entry: Manifest[string] = { files: [], trailerKey: `trailers/${item.slug}.mp4`, subtitles: [] }

  for (const q of m.qualities) {
    const [w, h] = SIZES[q]
    const key = `media/${item.slug}/${item.slug}-${q}.mp4`
    const out = path.join(STORAGE, key)
    if (!existsSync(out)) ff([...videoArgs(item.title, item.palette, w, h, DURATION, `${q} · ${item.year} · Sample feature file`), '-movflags', '+faststart', out])
    entry.files.push({ quality: q, format: 'mp4', mimeType: 'video/mp4', storageKey: key, fileSize: statSync(out).size })
  }

  if (m.hls) {
    const dir = path.join(mediaDir, 'hls')
    mkdirSync(dir, { recursive: true })
    const playlist = path.join(dir, 'index.m3u8')
    if (!existsSync(playlist))
      ff([...videoArgs(item.title, item.palette, 1280, 720, DURATION, 'HLS adaptive stream sample'), '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod', '-hls_segment_filename', path.join(dir, 'seg_%03d.ts'), playlist])
    entry.files.push({ quality: '720p', format: 'hls', mimeType: 'application/vnd.apple.mpegurl', storageKey: `media/${item.slug}/hls/index.m3u8`, fileSize: 0 })
  }

  mkdirSync(path.join(STORAGE, 'trailers'), { recursive: true })
  const trailer = path.join(STORAGE, entry.trailerKey)
  if (!existsSync(trailer)) ff([...videoArgs(item.title, item.palette, 1280, 720, 12, item.tagline ?? 'Official sample trailer'), '-movflags', '+faststart', trailer])

  mkdirSync(path.join(STORAGE, 'subtitles', item.slug), { recursive: true })
  for (const lang of m.subtitles ?? []) {
    const key = `subtitles/${item.slug}/${lang}.vtt`
    writeFileSync(path.join(STORAGE, key), vtt(lang, DURATION))
    entry.subtitles.push({ language: lang, label: SUB_LINES[lang]?.label ?? lang, storageKey: key })
  }
  manifest[item.slug] = entry
}
writeFileSync(path.join(STORAGE, 'media', 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log('✔ Sample media manifest written')
