/**
 * Adapts the Supabase JS client to the narrow `DatabaseClient` contract.
 *
 * This is the only file in the app that knows about `@supabase/supabase-js`
 * types. Every cast is contained here and justified: the runtime surface is
 * identical, only the generic plumbing differs.
 */

import type { RealtimeChannelOptions, SupabaseClient } from '@supabase/supabase-js'
import type { DatabaseSchema, TableName } from '@/types/database'

import { AppError, kindFromCode, toAppError } from './errors'
import type {
  AuthApi,
  AuthSession,
  AuthUser,
  DatabaseClient,
  RealtimeApi,
  StorageApi,
  Subscription,
  TableRef,
} from './contract'

/**
 * Retags anything that came back from Postgres as `source: 'database'` so the
 * UI never renders raw SQL. Fields already set by `toAppError` — notably
 * `userMessage` — are carried through untouched.
 */
export function mapError(error: unknown, fallback: 'database' | 'upload' = 'database'): AppError {
  const normalised = toAppError(error, fallback)
  const kind = normalised.kind === 'unknown' ? 'database' : normalised.kind

  return new AppError(kind, normalised.message, {
    code: normalised.code,
    details: normalised.details,
    hint: normalised.hint,
    source: 'database',
    userMessage: normalised.userMessage,
  })
}

function mapAuthError(error: unknown): AppError | null {
  if (!error) return null
  const asAuth = (message: string, code: string) => new AppError('validation', message, { code, source: 'auth' })
  const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : null
  const message = error instanceof Error ? error.message : 'Authentication failed.'
  if (code === 'invalid_credentials') {
    return asAuth('Incorrect email or password.', code)
  }
  if (code === 'email_not_confirmed') {
    return asAuth('Please confirm your email address before signing in.', code)
  }
  if (code === 'user_already_exists' || code === 'email_exists') {
    return new AppError('conflict', 'An account with this email already exists.', { code, source: 'auth' })
  }
  if (code === 'weak_password') {
    return asAuth('Password is too weak. Use at least 8 characters.', code)
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
    return asAuth('Too many attempts. Please wait a moment and try again.', code)
  }
  return new AppError(
    kindFromCode(code) === 'unknown' ? 'validation' : kindFromCode(code),
    message,
    { code, source: 'auth' },
  )
}

function mapUser(user: unknown): AuthUser | null {
  if (!user || typeof user !== 'object') return null
  const u = user as {
    id: string
    email?: string
    email_confirmed_at?: string | null
    user_metadata?: Record<string, unknown> | null
    created_at?: string
  }
  return {
    id: u.id,
    email: u.email ?? null,
    emailConfirmedAt: u.email_confirmed_at ?? null,
    userMetadata: u.user_metadata ?? {},
    createdAt: u.created_at ?? new Date().toISOString(),
  }
}

function mapSession(session: unknown): AuthSession | null {
  if (!session || typeof session !== 'object') return null
  const s = session as {
    access_token?: string
    expires_at?: number
    user?: unknown
  }
  const user = mapUser(s.user)
  if (!user) return null
  return {
    user,
    accessToken: s.access_token ?? '',
    expiresAt: (s.expires_at ?? 0) * 1000,
  }
}

function isBuilder(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

/**
 * Wraps a PostgREST builder so the response the app receives is the app's own
 * shape: `{ data, error, count }` with `error` always an `AppError`.
 *
 * Without this, a query failure would hand back a raw PostgREST error and the
 * UI could leak things like `relation "tasks" does not exist` straight to a
 * user. `friendlyMessage()` and `<ErrorState>` both rely on `error.kind`.
 *
 * Every fluent method returns *another* builder, so the wrapper is re-applied
 * on each result — otherwise only the first link of `.eq(...).single()` would
 * be normalised and the terminal call would leak the raw error again.
 */
function normaliseBuilder<T>(inner: unknown): T {
  const target = inner as object

  return new Proxy(target, {
    get(object, property, receiver) {
      if (property === 'then') {
        return (
          onFulfilled?: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => {
          const settle = (value: unknown) => {
            const result = (value ?? {}) as { error?: unknown }
            const normalised = {
              ...(value as object),
              error: result.error ? mapError(result.error) : null,
            }
            return onFulfilled ? onFulfilled(normalised) : normalised
          }
          const settleWith = (target as { then: (a: unknown, b: unknown) => Promise<unknown> }).then
          return Promise.resolve(
            settleWith.call(target, (value: unknown) => settle(value), onRejected),
          )
        }
      }

      const value = Reflect.get(object, property, receiver)

      if (typeof value !== 'function') return value

      return (...args: unknown[]) => {
        // `call` on the real object: PostgREST keeps private state on `this`.
        const result = value.apply(object, args)
        return isBuilder(result) ? normaliseBuilder(result) : result
      }
    },
  }) as T
}

type TableMethods = Partial<Record<'select' | 'insert' | 'update' | 'upsert' | 'delete', unknown>>

export function createSupabaseAdapter(supabase: SupabaseClient): DatabaseClient {
  const from = <K extends TableName>(table: K): TableRef<DatabaseSchema[K]> => {
    const raw = supabase.from(table) as unknown as TableMethods
    const wrapped: Record<string, (...args: never[]) => unknown> = {}

    for (const method of ['select', 'insert', 'update', 'upsert', 'delete'] as const) {
      wrapped[method] = (...args: never[]) => {
        const invoke = raw[method] as ((...rest: never[]) => unknown) | undefined
        if (typeof invoke !== 'function') {
          throw new TypeError(`supabase.from('${table}').${method} is not a function`)
        }
        // `call`, not `apply` on the bare function: PostgREST builders keep
        // private state on `this`.
        return normaliseBuilder(invoke.call(raw, ...args))
      }
    }

    return wrapped as unknown as TableRef<DatabaseSchema[K]>
  }

  const auth: AuthApi = {
    signUp: (params) => {
      const call = supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: params.options
          ? { data: params.options.data, emailRedirectTo: params.options.emailRedirectTo }
          : undefined,
      }) as unknown as PromiseLike<{
        data: { user: unknown; session: unknown }
        error: unknown
      }>
      return Promise.resolve(call).then((res) => ({
        data: { user: mapUser(res.data?.user), session: mapSession(res.data?.session) },
        error: mapAuthError(res.error),
      }))
    },
    signInWithPassword: (params) => {
      const call = supabase.auth.signInWithPassword(params) as unknown as PromiseLike<{
        data: { user: unknown; session: unknown }
        error: unknown
      }>
      return Promise.resolve(call).then((res) => ({
        data: { user: mapUser(res.data?.user), session: mapSession(res.data?.session) },
        error: mapAuthError(res.error),
      }))
    },
    signOut: () =>
      Promise.resolve(supabase.auth.signOut()).then((res) => ({
        error: res.error ? mapAuthError(res.error) : null,
      })),
    getUser: () =>
      Promise.resolve(supabase.auth.getUser()).then((res) => ({
        data: mapUser(res.data?.user),
        error: res.error ? mapAuthError(res.error) : null,
      })),
    getSession: () =>
      Promise.resolve(supabase.auth.getSession()).then((res) => ({
        data: mapSession(res.data?.session),
        error: res.error ? mapAuthError(res.error) : null,
      })),
    updateUser: (attributes) => {
      const call = supabase.auth.updateUser(attributes) as unknown as PromiseLike<{
        data: { user: unknown }
        error: unknown
      }>
      return Promise.resolve(call).then((res) => ({
        data: mapUser(res.data?.user),
        error: mapAuthError(res.error),
      }))
    },
    resetPasswordForEmail: (email, options) =>
      Promise.resolve(supabase.auth.resetPasswordForEmail(email, options ?? {})).then((res) => ({
        error: res.error ? mapAuthError(res.error) : null,
      })),
    onAuthStateChange: (callback) => {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        callback(event as never, mapSession(session))
      })
      const subscription: Subscription = { unsubscribe: () => data.subscription.unsubscribe() }
      return subscription
    },
  }

  const storage: StorageApi = {
    from: (bucket) => {
      const ref = supabase.storage.from(bucket)
      return {
        upload: async (path, file, options) => {
          const res = await ref.upload(path, file, { upsert: false, ...(options ?? {}) })
          return {
            path: res.data?.path ?? path,
            error: res.error ? mapError(res.error, 'upload') : null,
          }
        },
        remove: (paths) =>
          Promise.resolve(ref.remove(paths)).then((res) => ({
            error: res.error ? mapError(res.error, 'upload') : null,
          })),
        getPublicUrl: (path) => ref.getPublicUrl(path) as { data: { publicUrl: string } },
        createSignedUrl: (path, expiresIn) =>
          Promise.resolve(ref.createSignedUrl(path, expiresIn)).then((res) => ({
            data: res.data ? { signedUrl: res.data.signedUrl } : null,
            error: res.error ? mapError(res.error, 'upload') : null,
          })),
      }
    },
  }

  const realtime: RealtimeApi = {
    channel: (name, options) =>
      supabase.realtime.channel(name, (options ?? {}) as RealtimeChannelOptions) as unknown as ReturnType<
        RealtimeApi['channel']
      >,
    removeChannel: (channel) => {
      const raw = channel as unknown as Parameters<SupabaseClient['realtime']['removeChannel']>[0]
      return Promise.resolve(supabase.realtime.removeChannel(raw)).then((res) => ({
        error: res === 'error' ? new AppError('unknown', 'Failed to remove the realtime channel.') : null,
      }))
    },
  }

  /**
   * SECURITY DEFINER Postgres functions. Errors come back as plain objects, so
   * they go through `mapError` like any other database response — that is what
   * turns `raise exception 'This invitation is no longer valid.'` into a message
   * a person can read.
   */
  const rpc = async <T,>(fn: string, args?: Record<string, unknown>) => {
    const res = await supabase.rpc(fn, args ?? {})
    if (res.error) return { data: null as T, error: mapError(res.error) }
    return { data: (res.data ?? null) as T, error: null }
  }

  return { from, rpc, auth, storage, realtime } satisfies DatabaseClient
}