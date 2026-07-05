/**
 * IndexedDB-backed storage adapter for @tanstack/query-async-storage-persister.
 *
 * Persists React Query's cache across sessions so previously-viewed fics
 * and chapters render instantly on the next visit — even before Vercel
 * or Render finishes a cold-start. New data arrives asynchronously in
 * the background (`stale-while-revalidate`) and React automatically
 * updates the DOM once it lands.
 *
 * We use `idb-keyval` (~600 bytes gzipped) instead of `localStorage`
 * because localStorage is synchronous, ~5-10MB capped, and blocks the
 * main thread while React Query serializes ~1MB of chapter HTML. IDB is
 * async, has ~50MB+ quota on mobile, and doesn't jank scroll.
 *
 * Keys prefixed with 'fanfic-rq:' so we can nuke the whole persistence
 * layer without touching other IDB stores on the origin.
 */
import { createStore, get, set, del } from 'idb-keyval'

const store = createStore('fanfic-ai-query', 'kv')

export const idbStorage = {
  getItem: (key: string): Promise<string | null> =>
    get<string>(key, store).then(v => v ?? null),
  setItem: (key: string, value: string): Promise<void> =>
    set(key, value, store),
  removeItem: (key: string): Promise<void> =>
    del(key, store),
}
