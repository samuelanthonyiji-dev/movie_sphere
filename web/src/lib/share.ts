export async function shareMovie(m: { title: string; slug: string; description?: string }): Promise<'shared' | 'copied' | 'cancelled'> {
  const url = `${location.origin}/movie/${m.slug}`
  if (navigator.share) {
    try {
      await navigator.share({ title: m.title, text: m.description?.slice(0, 120), url })
      return 'shared'
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled'
    }
  }
  await copyText(url)
  return 'copied'
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
}
