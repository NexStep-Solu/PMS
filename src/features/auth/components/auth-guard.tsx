import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom'

import { LoadingState } from '@/components/shared/states'
import { useAuthSession } from '@/features/auth/queries'
import { safeRedirectPath } from '@/lib/redirects'

/**
 * Route protection. Three states, all handled: loading, unauthenticated,
 * authenticated. Nothing renders behind a spinner that could flash private UI.
 */
export function RequireAuth() {
  const { data: session, isPending, isError } = useAuthSession()
  const location = useLocation()

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingState label="Restoring your session" />
      </div>
    )
  }

  if (isError || !session) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  return <Outlet />
}

/**
 * Keeps signed-in users out of the login/register screens.
 *
 * Once a session exists the user is sent wherever they were originally heading
 * (`?next=`), not always to the dashboard — otherwise this guard races the login
 * form and swallows the intended destination.
 */
export function RequireGuest() {
  const { data: session, isPending } = useAuthSession()
  const [params] = useSearchParams()

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingState />
      </div>
    )
  }

  if (session) return <Navigate to={safeRedirectPath(params.get('next'))} replace />
  return <Outlet />
}