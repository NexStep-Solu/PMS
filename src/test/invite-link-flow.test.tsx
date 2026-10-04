import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import App from '@/App'
import { queryClient } from '@/app/query-client'
import { db, resetDbClient } from '@/lib/client'

/**
 * The invitation link, end to end through the UI.
 *
 * This is the flow that was missing entirely: an admin could create an
 * invitation, but nothing could consume it, so two people could never share a
 * workspace and "assign this to someone else" was impossible in production.
 */

beforeEach(() => {
  queryClient.clear()
  resetDbClient()
  window.history.pushState({}, '', '/login')
})

/**
 * Generous on purpose. The demo backend adds artificial latency per query and this
 * file boots the whole app several times, so under a parallel run the default
 * timeout fails on slowness rather than on a real defect.
 */
const TIMEOUT = 45000
const PASSWORD = 'password123'
const NEXT = 'org-nextstep'

/**
 * Authenticates through the shared client *before* mounting, so the app renders
 * exactly once per test. Rendering it twice leaves two React roots on the same
 * URL and their queries race.
 */
async function openAppAs(email: string | null) {
  if (email === null) {
    await db().auth.signOut()
  } else {
    const { error } = await db().auth.signInWithPassword({ email, password: PASSWORD })
    expect(error).toBeNull()
  }
  queryClient.clear()
  render(<App />)
}

/** Signs in as the owner, creates an invitation, then clears the session. */
async function seedInvite(
  email: string,
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer' = 'member',
) {
  const { error } = await db().auth.signInWithPassword({
    email: 'arkarmin@pms.dev',
    password: PASSWORD,
  })
  expect(error).toBeNull()
  const token = await createInvite(email, role)
  await db().auth.signOut()
  queryClient.clear()
  return token
}

async function createInvite(
  email: string,
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer' = 'member',
) {
  const session = await db().auth.getSession()
  const token = crypto.randomUUID()
  const { error } = await db().from('organization_invitations').insert({
    id: `inv-${token.slice(0, 8)}`,
    organization_id: NEXT,
    email,
    role,
    invited_by: session.data!.user.id,
    status: 'pending',
    token,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  })
  expect(error).toBeNull()
  return token
}

describe('invitation link', () => {
  it('shows the workspace and role to a signed-out visitor', async () => {
    const token = await seedInvite('new.hire@pms.dev', 'manager')
    await openAppAs(null)

    window.history.pushState({}, '', `/invite/${token}`)
    window.dispatchEvent(new PopStateEvent('popstate'))

    await screen.findByRole('heading', { name: /join nextstep/i }, { timeout: TIMEOUT })
    expect(screen.getByText(/invited you as manager/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in to accept/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create an account/i })).toBeInTheDocument()
  })

  it('lets the invited user accept and joins them to the workspace', async () => {
    const token = await seedInvite('elle@pms.dev')
    await openAppAs('elle@pms.dev')

    window.history.pushState({}, '', `/invite/${token}`)
    window.dispatchEvent(new PopStateEvent('popstate'))

    await screen.findByRole('heading', { name: /join nextstep/i }, { timeout: TIMEOUT })
    await userEvent.setup().click(screen.getByRole('button', { name: /^join nextstep$/i }))

    // Membership is what actually changed; assert the row, not just the toast.
    await waitFor(async () => {
      const members = await db().from('organization_members').select('*').eq('organization_id', NEXT)
      expect(members.data?.some((m) => m.user_id === 'u-elle')).toBe(true)
    }, { timeout: TIMEOUT })

    const invitation = await db().from('organization_invitations').select('status').eq('token', token).maybeSingle()
    expect(invitation.data?.status).toBe('accepted')
  }, 90000)

  it('refuses a signed-in user whose email was not invited', async () => {
    const token = await seedInvite('someone.else@pms.dev')
    await openAppAs('arkarmin@pms.dev')

    window.history.pushState({}, '', `/invite/${token}`)
    window.dispatchEvent(new PopStateEvent('popstate'))

    await screen.findByRole('heading', { name: /join nextstep/i }, { timeout: TIMEOUT })
    // Arkar is signed in, but the invite is addressed to someone.else@pms.dev.
    expect(screen.getByText(/this invitation was sent to/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^join nextstep$/i })).not.toBeInTheDocument()

    const stillPending = await db()
      .from('organization_invitations')
      .select('status')
      .eq('token', token)
      .maybeSingle()
    expect(stillPending.data?.status).toBe('pending')
  })

  it('says so plainly for an unknown token', async () => {
    await openAppAs('arkarmin@pms.dev')
    window.history.pushState({}, '', `/invite/${crypto.randomUUID()}`)
    window.dispatchEvent(new PopStateEvent('popstate'))

    await screen.findByRole('heading', { name: /invitation not found/i }, { timeout: TIMEOUT })
  })

  it('reports an expired invitation rather than offering to accept it', async () => {
    const token = await seedInvite('elle@pms.dev')
    await openAppAs('arkarmin@pms.dev')
    await db()
      .from('organization_invitations')
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq('token', token)

    window.history.pushState({}, '', `/invite/${token}`)
    window.dispatchEvent(new PopStateEvent('popstate'))

    await screen.findByRole('heading', { name: /expired/i }, { timeout: TIMEOUT })
    expect(screen.queryByRole('button', { name: /^join nextstep$/i })).not.toBeInTheDocument()
  })

  it('shows "already joined" instead of "expired" after accepting once', async () => {
    const token = await seedInvite('elle@pms.dev')
    await openAppAs('elle@pms.dev')

    window.history.pushState({}, '', `/invite/${token}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
    await screen.findByRole('heading', { name: /join nextstep/i }, { timeout: TIMEOUT })
    await userEvent.setup().click(screen.getByRole('button', { name: /^join nextstep$/i }))

    await waitFor(async () => {
      const invitation = await db().from('organization_invitations').select('status').eq('token', token).maybeSingle()
      expect(invitation.data?.status).toBe('accepted')
    }, { timeout: TIMEOUT })

    window.history.pushState({}, '', `/invite/${token}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
    await screen.findByRole('heading', { name: /you are in nextstep/i }, { timeout: TIMEOUT })
  })
})

describe('registering through an invite', () => {
  it('hides the workspace name field and joins instead of creating one', async () => {
    const token = await seedInvite('brand.new@pms.dev')
    await openAppAs(null)

    window.history.pushState({}, '', '/register')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await screen.findByRole('heading', { name: /create your workspace/i }, { timeout: TIMEOUT })

    // Without a token the field is part of normal signup.
    expect(screen.getByLabelText(/workspace name/i)).toBeInTheDocument()

    // Navigate with the token the way the invite page links to it.
    window.history.pushState({}, '', `/register?token=${token}`)
    window.dispatchEvent(new PopStateEvent('popstate'))

    await waitFor(
      () => expect(screen.queryByLabelText(/workspace name/i)).not.toBeInTheDocument(),
      { timeout: TIMEOUT },
    )
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
  })
})