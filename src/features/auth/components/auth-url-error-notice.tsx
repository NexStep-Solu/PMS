/**
 * Surfaces auth errors that Supabase returns in the URL.
 *
 * When a confirmation or recovery link is followed, Supabase redirects back to
 * the app with the outcome in the fragment. On success that is the session
 * tokens, which `detectSessionInUrl` consumes. On failure it is
 * `error=...&error_code=...&error_description=...` — which is what you get if
 * the link has already been used. Email link scanners are a common cause:
 * they GET the link first, consuming the single-use token.
 *
 * Without this the user lands on a page that silently does nothing.
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'

const MESSAGES: Record<string, string> = {
  otp_expired: 'That sign-in link has expired. Request a new one.',
  access_denied: 'That link is no longer valid. Request a new one.',
  email_change_requested: 'Confirm the change from the email we just sent you.',
  email_confirm: 'Confirm your email address from the link we just sent you.',
  recovery: 'Choose a new password using the link we just sent you.',
  invite_link: 'That invitation has expired. Ask for a new one.',
  bad_json: 'We could not read that link. Request a new one.',
  bad_verification_token: 'That link has already been used. Request a new one.',
  signup_disabled: 'New sign-ups are disabled for this workspace.',
}

function describe(code: string | null, description: string | null): string {
  if (code && MESSAGES[code]) return MESSAGES[code]
  if (code === 'otp_expired' || code === 'access_denied') {
    return 'That link has expired or was already used. Request a new one.'
  }
  // Never show a raw provider string verbatim; keep it for the console.
  return description
    ? 'We could not complete that link. It may have expired or already been used.'
    : 'We could not complete that link.'
}

export function AuthUrlErrorNotice() {
  const location = useLocation()

  useEffect(() => {
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
    const hashParams = new URLSearchParams(hash)
    const queryParams = new URLSearchParams(window.location.search)

    const code = hashParams.get('error_code') ?? queryParams.get('error_code')
    const description = hashParams.get('error_description') ?? queryParams.get('error_description')
    const isError = hashParams.has('error') || queryParams.has('error')

    if (!isError) return

    console.warn('[pms] auth link error', { code, description })

    toast.error('That link did not work', {
      description: describe(code, description),
      duration: 8000,
    })

    // Drop the error from the URL so a refresh does not repeat it.
    window.history.replaceState({}, '', `${location.pathname}${location.search}`)
  }, [location.pathname, location.search])

  return null
}