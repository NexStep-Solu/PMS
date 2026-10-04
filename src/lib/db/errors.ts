/**
 * A single normalised error shape for every data access path.
 *
 * The UI never surfaces raw database errors — it maps `AppError.code` to a
 * human readable message. See `src/lib/db/errors.ts` for the translation.
 */

/**
 * Where an error came from.
 *
 * `database` errors carry Postgres text ("invalid input syntax for type uuid")
 * that must never reach a user — it goes to the console instead, and the UI
 * shows the generic message for that kind.
 */
export type AppErrorSource = 'app' | 'auth' | 'database'

export type AppErrorKind =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'database'
  | 'upload'
  | 'unknown'

export class AppError extends Error {
  readonly kind: AppErrorKind
  readonly code: string | null
  readonly details: string | null
  readonly hint: string | null
  readonly source: AppErrorSource
  /**
   * A curated, human-readable explanation. Lets the database layer say
   * "that value had the wrong format" without leaking the SQL text, which
   * stays on `message` for the console.
   */
  readonly userMessage: string | null

  constructor(
    kind: AppErrorKind,
    message: string,
    options: {
      code?: string | null
      details?: string | null
      hint?: string | null
      source?: AppErrorSource
      userMessage?: string | null
    } = {},
  ) {
    super(message)
    this.name = 'AppError'
    this.kind = kind
    this.code = options.code ?? null
    this.details = options.details ?? null
    this.hint = options.hint ?? null
    this.source = options.source ?? 'app'
    this.userMessage = options.userMessage ?? null
  }

  toJSON() {
    return {
      kind: this.kind,
      message: this.message,
      code: this.code,
      details: this.details,
      hint: this.hint,
      source: this.source,
      userMessage: this.userMessage,
    }
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError
}

const KIND_BY_CODE: Record<string, AppErrorKind> = {
  PGRST116: 'not_found',
  PGRST301: 'validation',
  '23505': 'conflict',
  '23503': 'validation',
  '23514': 'validation',
  '22P02': 'validation',
  '42501': 'forbidden',
  '401': 'unauthorized',
  '403': 'forbidden',
  '404': 'not_found',
  '409': 'conflict',
  '400': 'validation',
}

const FRIENDLY: Record<AppErrorKind, string> = {
  network: "Can't reach the server. Check your connection and try again.",
  unauthorized: 'Your session expired. Please sign in again.',
  forbidden: "You don't have permission to do that.",
  not_found: "We couldn't find what you were looking for.",
  validation: 'Some of the details provided are invalid.',
  conflict: 'That already exists.',
  database: "We couldn't complete that. Please try again.",
  upload: "The file couldn't be uploaded.",
  unknown: 'Something went wrong. Please try again.',
}

export function kindFromCode(code: string | null | undefined): AppErrorKind {
  if (!code) return 'unknown'
  return KIND_BY_CODE[code] ?? 'unknown'
}

export function friendlyMessage(error: AppError): string {
  // A curated explanation always wins: it was written for humans.
  if (error.userMessage) return error.userMessage

  // Raw database text never reaches a user.
  if (error.source === 'database') return FRIENDLY[error.kind]

  if (error.kind === 'validation' || error.kind === 'conflict' || error.kind === 'upload') {
    return error.message
  }
  return FRIENDLY[error.kind]
}

/** `invalid_text_representation` and friends: the caller sent a bad shape. */
const SHAPE_HINTS: Record<string, string> = {
  '22P02': 'One of the values sent was not the right format. Reload the page and try again.',
  '22007': 'One of the values sent is out of range.',
  '22008': 'The date sent was not valid.',
}

const NETWORK_PATTERN =
  /failed to fetch|fetch failed|networkerror|network request failed|load failed|econnrefused|econnreset|etimedout|timeout/i

/**
 * Normalises anything thrown or returned by the transport layer into an
 * `AppError`.
 *
 * Handles all three shapes we actually see: an `AppError` (already normalised),
 * a native `Error`, and the plain `{ message, code?, details? }` object that
 * PostgREST returns — which has no `code` for transport failures.
 */
export function toAppError(input: unknown, fallback: AppErrorKind = 'unknown'): AppError {
  if (isAppError(input)) return input
  if (input === null || input === undefined) {
    return new AppError(fallback, FRIENDLY[fallback])
  }

  const raw = (typeof input === 'object' ? input : {}) as {
    message?: unknown
    code?: unknown
    details?: unknown
    hint?: unknown
  }

  const message = typeof raw.message === 'string' ? raw.message : ''
  const code = typeof raw.code === 'string' ? raw.code : null
  const details = typeof raw.details === 'string' ? raw.details : null
  const hint = typeof raw.hint === 'string' ? raw.hint : null

  // A transport failure has no code — it only shows up in the message.
  if (NETWORK_PATTERN.test(message)) {
    return new AppError('network', message || FRIENDLY.network, { code, details, hint })
  }

  if (message) {
    const kind = kindFromCode(code)
    if (code && SHAPE_HINTS[code]) {
      return new AppError('validation', message, {
        code,
        details,
        hint,
        source: 'database',
        userMessage: SHAPE_HINTS[code],
      })
    }
    return new AppError(kind, message, { code, details, hint })
  }

  return new AppError(fallback, FRIENDLY[fallback])
}