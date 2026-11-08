/**
 * Generates original SVG placeholder artwork (posters 2:3 and backdrops 16:9) for development.
 * Clearly marked as placeholders. Replace via the admin dashboard with licensed artwork.
 */
import type { CatalogItem, Motif } from './catalog.js'

function rng(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function wrap(title: string, max: number): string[] {
  const words = title.toUpperCase().split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max && cur) {
      lines.push(cur)
      cur = w
    } else cur = (cur + ' ' + w).trim()
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 4)
}

function motifShapes(m: Motif, W: number, H: number, [, mid, hi]: [string, string, string], r: () => number): string {
  const out: string[] = []
  switch (m) {
    case 'sun': {
      const cx = W * (0.35 + r() * 0.3), cy = H * 0.42, rad = Math.min(W, H) * 0.28
      out.push(`<circle cx="${cx}" cy="${cy}" r="${rad}" fill="url(#hiGrad)"/>`)
      for (let i = 0; i < 7; i++) {
        const y = cy + rad * 0.1 + i * rad * 0.14
        out.push(`<rect x="${cx - rad}" y="${y}" width="${rad * 2}" height="${2 + i * 2.2}" fill="url(#bg)"/>`)
      }
      out.push(`<path d="M0 ${H * 0.68} L${W * 0.3} ${H * 0.52} L${W * 0.55} ${H * 0.63} L${W * 0.8} ${H * 0.5} L${W} ${H * 0.6} L${W} ${H} L0 ${H}Z" fill="#000" opacity=".55"/>`)
      break
    }
    case 'mountains': {
      for (let l = 0; l < 4; l++) {
        const base = H * (0.45 + l * 0.12)
        let d = `M0 ${H} L0 ${base}`
        const steps = 6 + l
        for (let i = 1; i <= steps; i++) d += ` L${(W / steps) * i} ${base - r() * H * (0.22 - l * 0.04)}`
        d += ` L${W} ${H}Z`
        out.push(`<path d="${d}" fill="${l === 0 ? mid : '#000'}" opacity="${l === 0 ? 0.55 : 0.35 + l * 0.15}"/>`)
      }
      out.push(`<circle cx="${W * (0.2 + r() * 0.6)}" cy="${H * 0.22}" r="${W * 0.06}" fill="${hi}" opacity=".85"/>`)
      break
    }
    case 'rings': {
      const cx = W * (0.3 + r() * 0.4), cy = H * 0.4
      for (let i = 9; i > 0; i--)
        out.push(`<circle cx="${cx}" cy="${cy}" r="${i * Math.min(W, H) * 0.045}" fill="none" stroke="${i % 2 ? hi : mid}" stroke-width="${1 + i * 0.6}" opacity="${0.08 + (9 - i) * 0.07}"/>`)
      out.push(`<circle cx="${cx}" cy="${cy}" r="${Math.min(W, H) * 0.05}" fill="${hi}"/>`)
      break
    }
    case 'city': {
      let x = 0
      while (x < W) {
        const w = W * (0.05 + r() * 0.08), h = H * (0.2 + r() * 0.42)
        out.push(`<rect x="${x}" y="${H - h}" width="${w}" height="${h}" fill="#000" opacity="${0.6 + r() * 0.35}"/>`)
        for (let wy = H - h + 10; wy < H - 10; wy += 14)
          for (let wx = x + 5; wx < x + w - 6; wx += 10)
            if (r() > 0.72) out.push(`<rect x="${wx}" y="${wy}" width="4" height="6" fill="${hi}" opacity="${0.4 + r() * 0.6}"/>`)
        x += w + 2
      }
      out.push(`<circle cx="${W * 0.72}" cy="${H * 0.2}" r="${W * 0.11}" fill="${mid}" opacity=".55" filter="url(#blur)"/>`)
      break
    }
    case 'waves': {
      for (let i = 0; i < 9; i++) {
        const y = H * (0.45 + i * 0.065), a = 10 + r() * 22
        let d = `M0 ${y}`
        for (let x = 0; x <= W; x += W / 8) d += ` Q${x + W / 16} ${y - a} ${x + W / 8} ${y}`
        out.push(`<path d="${d}" fill="none" stroke="${i % 3 === 0 ? hi : mid}" stroke-width="${1.5 + i * 0.4}" opacity="${0.25 + i * 0.07}"/>`)
      }
      break
    }
    case 'moon': {
      for (let i = 0; i < 70; i++)
        out.push(`<circle cx="${r() * W}" cy="${r() * H * 0.7}" r="${r() * 1.6 + 0.3}" fill="#fff" opacity="${0.2 + r() * 0.7}"/>`)
      const cx = W * (0.55 + r() * 0.2), cy = H * 0.28, rad = Math.min(W, H) * 0.17
      out.push(`<circle cx="${cx}" cy="${cy}" r="${rad * 1.6}" fill="${hi}" opacity=".12" filter="url(#blur)"/>`)
      out.push(`<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${hi}"/>`)
      out.push(`<circle cx="${cx + rad * 0.45}" cy="${cy - rad * 0.2}" r="${rad * 0.95}" fill="url(#bg)"/>`)
      out.push(`<path d="M0 ${H * 0.75} C${W * 0.3} ${H * 0.62} ${W * 0.6} ${H * 0.8} ${W} ${H * 0.66} L${W} ${H} L0 ${H}Z" fill="#000" opacity=".8"/>`)
      break
    }
    case 'grid': {
      const hz = H * 0.5
      for (let i = 0; i <= 14; i++) {
        const x = (W / 14) * i
        out.push(`<line x1="${W / 2}" y1="${hz}" x2="${x * 3 - W}" y2="${H}" stroke="${hi}" stroke-width="1.2" opacity=".35"/>`)
      }
      for (let i = 1; i < 12; i++) {
        const y = hz + (H - hz) * Math.pow(i / 12, 1.8)
        out.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${hi}" stroke-width="1" opacity=".3"/>`)
      }
      out.push(`<circle cx="${W / 2}" cy="${hz}" r="${W * 0.18}" fill="${mid}" opacity=".7" filter="url(#blur)"/>`)
      break
    }
    case 'beams': {
      const ox = W * (0.2 + r() * 0.6)
      for (let i = 0; i < 6; i++) {
        const a = -0.9 + i * 0.36 + r() * 0.1
        const x2 = ox + Math.sin(a) * H * 1.4, x3 = ox + Math.sin(a + 0.12) * H * 1.4
        out.push(`<path d="M${ox} -10 L${x2} ${H} L${x3} ${H}Z" fill="${hi}" opacity="${0.05 + r() * 0.1}"/>`)
      }
      out.push(`<rect x="0" y="${H * 0.78}" width="${W}" height="${H * 0.22}" fill="#000" opacity=".6"/>`)
      break
    }
  }
  return out.join('')
}

function defs(c: [string, string, string], vertical: boolean) {
  return `<defs>
<linearGradient id="bg" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="1"><stop offset="0" stop-color="${c[1]}"/><stop offset=".55" stop-color="${c[0]}"/><stop offset="1" stop-color="#050505"/></linearGradient>
<linearGradient id="hiGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient>
<linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".92"/></linearGradient>
<filter id="blur"><feGaussianBlur stdDeviation="24"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/></filter>
</defs>`
}

export function posterSvg(item: CatalogItem): string {
  const W = 400, H = 600
  const r = rng(item.slug)
  const lines = wrap(item.title, item.title.length > 22 ? 11 : 10)
  const fs = lines.length > 2 ? 46 : 58
  const startY = H - 64 - (lines.length - 1) * fs * 0.95
  const label = item.rights === 'PLATFORM_ORIGINAL' ? 'A CINEVAULT ORIGINAL' : 'PUBLIC DOMAIN CLASSIC'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(item.title)} poster (placeholder)">
<desc>Development placeholder artwork generated by CineVault. Not official artwork.</desc>${defs(item.palette, true)}
<rect width="${W}" height="${H}" fill="url(#bg)"/>${motifShapes(item.motif, W, H, item.palette, r)}
<rect width="${W}" height="${H}" fill="url(#fade)"/><rect width="${W}" height="${H}" filter="url(#grain)"/>
<text x="${W / 2}" y="${startY - fs * 0.95}" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" font-size="12" letter-spacing="4" fill="#fff" opacity=".75">${label}</text>
${lines.map((l, i) => `<text x="${W / 2}" y="${startY + i * fs * 0.95}" text-anchor="middle" font-family="'Bebas Neue',Impact,'Arial Narrow',sans-serif" font-weight="700" font-size="${fs}" letter-spacing="2" fill="#fff">${esc(l)}</text>`).join('\n')}
<text x="${W / 2}" y="${H - 26}" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" font-size="12" letter-spacing="3" fill="${item.palette[2]}">${esc(item.director.toUpperCase().slice(0, 40))} · ${item.year}</text>
</svg>`
}

export function backdropSvg(item: CatalogItem): string {
  const W = 1600, H = 900
  const r = rng(item.slug + ':bd')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(item.title)} backdrop (placeholder)">
<desc>Development placeholder artwork generated by CineVault. Not official artwork.</desc>${defs(item.palette, false)}
<rect width="${W}" height="${H}" fill="url(#bg)"/>${motifShapes(item.motif, W, H, item.palette, r)}
<rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`
}
