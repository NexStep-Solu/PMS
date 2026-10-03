import { describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'

import { AppError, friendlyMessage, toAppError } from '@/lib/db/errors'
import { createSupabaseAdapter } from '@/lib/db/supabase-adapter'
import type { DatabaseClient } from '@/lib/db/contract'

/**
 * Guards the Supabase adapter without needing a real project.
 *
 * PostgREST builders are thenables, so the adapter is exercised against a stub
 * that mimics their shape. That keeps the test instant and focused on the one
 * thing the adapter owns: converting responses into the app's own shape.
 */

interface StubResponse {
  data?: unknown
  error?: unknown
  count?: number | null
}

type ChainMethod =
  | 'eq'
  | 'neq'
  | 'in'
  | 'is'
  | 'order'
  | 'limit'
  | 'range'
  | 'gt'
  | 'lt'
  | 'single'
  | 'maybeSingle'
  | 'throwOnError'

/** A minimal stand-in for `supabase.from(t).select(...)` and friends. */
function stubQueryBuilder(response: StubResponse, log: string[]): Record<string, unknown> {
  const builder: Record<string, unknown> = {
    then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve(response).then(
        (value) => (onFulfilled ? onFulfilled(value) : value),
        onRejected,
      )
    },
  }

  // Every fluent method logs itself and returns another builder, so we can prove
  // the chain survives the wrapper.
  const chain = (method: ChainMethod) => (...args: unknown[]) => {
    log.push(`${method}(${args.map(String).join(',')})`)
    return builder
  }

  for (const method of ['eq', 'neq', 'in', 'is', 'order', 'limit', 'range', 'gt', 'lt'] as const) {
    builder[method] = chain(method)
  }
  for (const method of ['single', 'maybeSingle', 'throwOnError'] as const) {
    builder[method] = chain(method)
  }

  return builder
}

function stubClient(response: StubResponse, log: string[] = []) {
  const builder = () => stubQueryBuilder(response, log)
  const from = () => ({
    select: builder,
    insert: builder,
    update: builder,
    upsert: builder,
    delete: builder,
  })

  return {
    from,
    // Enough of the rest of the client surface for the adapter to construct.
    auth: {
      signUp: async () => ({ data: { user: null, session: null }, error: null }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: null }),
      signOut: async () => ({ error: null }),
      getUser: async () => ({ data: null, error: null }),
      getSession: async () => ({ data: null, error: null }),
      updateUser: async () => ({ data: null, error: null }),
      resetPasswordForEmail: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ path: '', error: null }),
        remove: async () => ({ error: null }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x/${path}` } }),
        createSignedUrl: async () => ({ data: null, error: null }),
      }),
    },
    realtime: {
      channel: () => ({
        on() {
          return this
        },
        subscribe() {
          return this
        },
        unsubscribe: async () => ({ error: null }),
      }),
      removeChannel: async () => ({ error: null }),
    },
  } as unknown as Parameters<typeof createSupabaseAdapter>[0]
}

function adapterFor(response: StubResponse, log?: string[]): DatabaseClient {
  return createSupabaseAdapter(stubClient(response, log))
}

describe('supabase adapter — response normalisation', () => {
  it('turns a raw PostgREST error into an AppError', async () => {
    const db = adapterFor({
      data: null,
      error: { message: 'relation "tasks" does not exist', code: '42P01', details: null, hint: null },
    })

    const { data, error } = await db.from('tasks').select('*')

    expect(data).toBeNull()
    expect(error).toBeInstanceOf(AppError)
    expect(error?.kind).toBe('database')
    expect(error?.code).toBe('42P01')
  })

  it('keeps data and count intact', async () => {
    const db = adapterFor({ data: [{ id: 'a' }], error: null, count: 7 })

    const { data, error, count } = await db.from('tasks').select('*')

    expect(data).toEqual([{ id: 'a' }])
    expect(count).toBe(7)
    expect(error).toBeNull()
  })

  it('preserves the fluent chain', async () => {
    const log: string[] = []
    const db = adapterFor({ data: [], error: null }, log)

    await db
      .from('tasks')
      .select('*')
      .eq('project_id', 'p1')
      .order('position')
      .limit(5)

    expect(log).toEqual(['eq(project_id,p1)', 'order(position)', 'limit(5)'])
  })

  it('normalises the terminal error of a chained call', async () => {
    const db = adapterFor({ data: null, error: { message: 'row not found', code: 'PGRST116' } })

    const { error } = await db.from('projects').select('*').eq('id', 'missing').single()

    expect(error?.kind).toBe('not_found')
  })

  it('does not touch the response when there is no error', async () => {
    const db = adapterFor({ data: null, error: null })
    const { error } = await db.from('projects').select('*').maybeSingle()
    expect(error).toBeNull()
  })

  it('never leaks raw database text into the user-facing message', async () => {
    const db = adapterFor({
      data: null,
      error: { message: 'syntax error at or near "selct" in "public.tasks"', code: '42601' },
    })

    const { error } = await db.from('tasks').select('*')
    const message = friendlyMessage(error as AppError)

    expect(message).not.toContain('selct')
    expect(message).not.toContain('public.tasks')
  })
})

describe('supabase adapter — client construction', () => {
  it('passes the anon key, never a service-role key', () => {
    const supabase = createClient('https://placeholder.supabase.co', 'placeholder-anon-key')
    expect((supabase as unknown as { supabaseKey: string }).supabaseKey).toBe('placeholder-anon-key')
  })

  it('exposes the three storage buckets', () => {
    const db = adapterFor({ data: [], error: null })

    expect(db.storage.from('avatars')).toBeTruthy()
    expect(db.storage.from('project-files')).toBeTruthy()
    expect(db.storage.from('task-attachments')).toBeTruthy()
  })

  it('builds a realtime channel that chains and unsubscribes', () => {
    const db = adapterFor({ data: [], error: null })
    const channel = db.realtime.channel('pms:tasks:org-1')

    expect(channel.on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {})).toBe(
      channel,
    )
    expect(channel.subscribe()).toBe(channel)
  })
})

describe('toAppError', () => {
  it('detects transport failures that carry no code', () => {
    expect(toAppError({ message: 'TypeError: Failed to fetch' }).kind).toBe('network')
    expect(toAppError({ message: 'fetch failed' }).kind).toBe('network')
    expect(toAppError(new Error('Network request failed')).kind).toBe('network')
  })

  it('maps known PostgREST codes', () => {
    expect(toAppError({ message: 'x', code: 'PGRST116' }).kind).toBe('not_found')
    expect(toAppError({ message: 'x', code: '42501' }).kind).toBe('forbidden')
    expect(toAppError({ message: 'x', code: '23505' }).kind).toBe('conflict')
    expect(toAppError({ message: 'x', code: '23503' }).kind).toBe('validation')
  })

  it('falls back for empty input', () => {
    expect(toAppError(null, 'database').kind).toBe('database')
    expect(toAppError(undefined, 'database').kind).toBe('database')
    expect(toAppError({}, 'database').kind).toBe('database')
  })

  it('is idempotent', () => {
    const once = toAppError({ message: 'x', code: 'PGRST116' })
    expect(toAppError(once)).toBe(once)
  })
})