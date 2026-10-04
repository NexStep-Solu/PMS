import { useEffect, useState } from 'react'

import { db } from '@/lib/client'

/**
 * True when the current URL established a recovery session.
 *
 * `resetPasswordForEmail` emails a single-use link; following it exchanges the
 * token for a short-lived session scoped to password updates. The form should
 * not render until that exchange completes, otherwise submitting fails.
 */
export function useHasRecoverySession(): boolean {
  const [hasSession, setHasSession] = useState(false)

  useEffect(() => {
    let active = true

    const check = async () => {
      const { data, error } = await db().auth.getSession()
      if (!active) return
      // An error means there is nothing usable, which is the same as "no session".
      setHasSession(Boolean(data) && !error)
    }

    void check()
    const subscription = db().auth.onAuthStateChange((_event, session) => {
      if (active) setHasSession(Boolean(session))
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return hasSession
}
