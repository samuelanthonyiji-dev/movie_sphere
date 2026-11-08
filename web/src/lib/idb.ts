/** Tiny promise wrapper around IndexedDB (no dependency). Stores: list, progress, recent, downloads, kv. */
const DB_NAME = 'cinevault'
const VERSION = 1
export type StoreName = 'list' | 'progress' | 'recent' | 'downloads' | 'kv'

let dbp: Promise<IDBDatabase> | null = null
function db(): Promise<IDBDatabase> {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const d = req.result
      for (const s of ['list', 'progress', 'recent', 'downloads', 'kv'] as StoreName[]) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbp
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(store, mode)
        const req = fn(t.objectStore(store))
        t.oncomplete = () => resolve(req ? (req.result as T) : (undefined as T))
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

export const idb = {
  get: <T,>(store: StoreName, key: string) => tx<T | undefined>(store, 'readonly', (s) => s.get(key)),
  set: <T,>(store: StoreName, key: string, value: T) => tx<IDBValidKey>(store, 'readwrite', (s) => s.put(value, key)),
  del: (store: StoreName, key: string) => tx<undefined>(store, 'readwrite', (s) => s.delete(key)),
  all: <T,>(store: StoreName) => tx<T[]>(store, 'readonly', (s) => s.getAll()),
  clear: (store: StoreName) => tx<undefined>(store, 'readwrite', (s) => s.clear()),
}
