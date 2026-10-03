/**
 * Where to send the user after signing in.
 *
 * `RequireAuth` sends anonymous visitors to `/login?next=<path>`. This validates
 * that value so a crafted link cannot turn the sign-in page into an open
 * redirect: only same-origin, absolute-path URLs inside the app are allowed.
 */

export const DEFAULT_AFTER_LOGIN = '/app/dashboard'

const SAFE_PATHS = [/^\/app(\/|$)/, /^\/$/]

export function safeRedirectPath(value: string | null | undefined): string {
  if (!value) return DEFAULT_AFTER_LOGIN

  // Reject absolute URLs, protocol-relative URLs and backslash tricks.
  if (!value.startsWith('/')) return DEFAULT_AFTER_LOGIN
  if (value.startsWith('//') || value.startsWith('/\\')) return DEFAULT_AFTER_LOGIN
  if (value.includes('://')) return DEFAULT_AFTER_LOGIN

  // Never bounce back to the auth screens themselves.
  if (/^\/(login|register|forgot-password|reset-password)(\/|$)/.test(value)) {
    return DEFAULT_AFTER_LOGIN
  }

  return SAFE_PATHS.some((pattern) => pattern.test(value)) ? value : DEFAULT_AFTER_LOGIN
}
