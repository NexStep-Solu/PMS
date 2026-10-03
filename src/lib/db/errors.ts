/**
 * A single normalised error shape for every data access path.
 *
 * The UI never surfaces raw database errors — it maps `AppError.code` to a
 * human readable message. See `src/lib/db/errors.ts` for the translation.
 */

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

  constructor(
    kind: AppErrorKind,
    message: string,
    options: { code?: string | null; details?: string | null; hint?: string | null } = {},
  ) {
    super(message)
    this.name = 'AppError'
    this.kind = kind
    this.code = options.code ?? null
    this.details = options.details ?? null
    this.hint = options.hint ?? null
  }

  toJSON() {
    return {
      kind: this.kind,
      message: this.message,
      code: this.code,
      details: this.details,
      hint: this.hint,
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
  if (error.kind === 'validation' || error.kind === 'conflict' || error.kind === 'upload') {
    return error.message
  }
  return FRIENDLY[error.kind]
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
    return new AppError(kindFromCode(code), message, { code, details, hint })
  }

  return new AppError(fallback, FRIENDLY[fallback])
}