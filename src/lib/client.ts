/**
 * The single data client used by the whole app.
 *
 * `isDemoMode` decides whether we talk to Supabase (Postgres + RLS) or to the
 * in-memory backend. Every feature imports `db()` from here so nothing needs
 * to know which backend is active.
 */

import { createClient } from '@supabase/supabase-js'

import type { DatabaseClient } from './db/contract'
import { createDemoClient } from './db/mock/client'
import { createSupabaseAdapter } from './db/supabase-adapter'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * True when the app runs against the in-memory backend.
 *
 * Forced during tests: a developer's local `.env.local` must never make the
 * suite sign in to, or read from, their real Supabase project.
 */
export const isDemoMode: boolean = import.meta.env.MODE === 'test' || !url || !anonKey

let instance: DatabaseClient | null = null

function create(): DatabaseClient {
  if (isDemoMode) return createDemoClient()
  return createSupabaseAdapter(
    createClient(url as string, anonKey as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { headers: { 'x-application-name': 'pms' } },
    }),
  )
}

export function db(): DatabaseClient {
  if (!instance) instance = create()
  return instance
}

/**
 * Drops the cached client so the next `db()` call rebuilds it.
 *
 * Test-only: the browser keeps one client for the lifetime of the page, but a
 * test run needs a fresh in-memory dataset and a signed-out session between
 * cases.
 */
export function resetDbClient(): void {
  instance = null
}

export type { DatabaseClient }

/** Project host, for diagnostics. Never contains the key. */
export const supabaseUrl = url ?? null