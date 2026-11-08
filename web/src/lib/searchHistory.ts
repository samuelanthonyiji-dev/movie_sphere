const KEY = 'cv:search-history'
export function getSearchHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}
export function addSearchHistory(q: string) {
  q = q.trim()
  if (q.length < 2) return
  const next = [q, ...getSearchHistory().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 8)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
}
export function removeSearchHistory(q: string) {
  try { localStorage.setItem(KEY, JSON.stringify(getSearchHistory().filter((x) => x !== q))) } catch { /* ignore */ }
}
export function clearSearchHistory() {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
