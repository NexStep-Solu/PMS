import { describe, expect, it } from 'vitest'

import { createDemoClient } from '@/lib/db/mock/client'

/**
 * The join flow, exercised against the demo backend's Postgres-function
 * emulation. Before this existed, `useInviteMember` wrote a row that nothing ever
 * read: there was no accept path, and every signup minted its own workspace, so
 * two people could never end up in the same workspace.
 *
 * One client instance throughout, because each `createDemoClient()` owns its own
 * in-memory store.
 */

const PASSWORD = 'password123'
const NEXT = 'org-nextstep'

function makeClient() {
  const db = createDemoClient()
  return db
}

/** Signs up through the public auth API so the invite token reaches signup metadata. */
async function signUp(
  db: ReturnType<typeof makeClient>,
  email: string,
  inviteToken?: string,
) {
  const { error } = await db.auth.signUp({
    email,
    password: PASSWORD,
    options: { data: inviteToken ? { invite_token: inviteToken } : {} },
  })
  expect(error).toBeNull()
}

async function signIn(db: ReturnType<typeof makeClient>, email: string) {
  const { error } = await db.auth.signInWithPassword({ email, password: PASSWORD })
  expect(error).toBeNull()
}

async function createInvite(
  db: ReturnType<typeof makeClient>,
  email: string,
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer' = 'member',
): Promise<string> {
  const session = await db.auth.getSession()
  const token = crypto.randomUUID()
  const { error } = await db.from('organization_invitations').insert({
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

describe('invitation preview', () => {
  it('describes the workspace, role and inviter', async () => {
    const db = makeClient()
    await signIn(db, 'arkarmin@pms.dev')
    const token = await createInvite(db, 'new.hire@pms.dev', 'manager')

    // Signed out, like the person who just received the link.
    await db.auth.signOut()
    const { data, error } = await db.rpc<{
      organization_name: string
      invited_email: string
      role: string
      invited_by: string
      is_valid: boolean
    }>('invitation_preview', { p_token: token })

    expect(error).toBeNull()
    expect(data?.organization_name).toBe('NextStep')
    expect(data?.invited_email).toBe('new.hire@pms.dev')
    expect(data?.role).toBe('manager')
    expect(data?.invited_by).toBe('Arkar Min')
    expect(data?.is_valid).toBe(true)
  })

  it('returns nothing for an unknown token', async () => {
    const db = makeClient()
    await signIn(db, 'arkarmin@pms.dev')
    const { data } = await db.rpc('invitation_preview', { p_token: crypto.randomUUID() })

    expect(data).toBeNull()
  })
})

describe('accept_invitation', () => {
  it('adds the signed-in user, consumes the invite and returns the workspace', async () => {
    const db = makeClient()
    await signIn(db, 'arkarmin@pms.dev')
    const token = await createInvite(db, 'elle@pms.dev')

    await signIn(db, 'elle@pms.dev')
    const { data, error } = await db.rpc<{ organization_name: string; role: string }>(
      'accept_invitation',
      { p_token: token },
    )

    expect(error).toBeNull()
    expect(data?.organization_name).toBe('NextStep')

    const invitation = await db
      .from('organization_invitations')
      .select('status, accepted_at')
      .eq('token', token)
      .maybeSingle()
    expect(invitation.data?.status).toBe('accepted')
    expect(invitation.data?.accepted_at).not.toBeNull()
  })

  it('refuses a token addressed to a different email', async () => {
    const db = makeClient()
    await signIn(db, 'arkarmin@pms.dev')
    const token = await createInvite(db, 'someone.else@pms.dev')

    await signIn(db, 'joe@pms.dev')
    const { data, error } = await db.rpc('accept_invitation', { p_token: token })

    expect(data).toBeNull()
    expect(error?.message).toContain('someone.else@pms.dev')

    const invitation = await db.from('organization_invitations').select('status').eq('token', token).maybeSingle()
    expect(invitation.data?.status).toBe('pending')
  })

  it('cannot be replayed once accepted', async () => {
    const db = makeClient()
    await signIn(db, 'arkarmin@pms.dev')
    const token = await createInvite(db, 'elle@pms.dev')

    await signIn(db, 'elle@pms.dev')
    expect((await db.rpc('accept_invitation', { p_token: token })).error).toBeNull()

    const replay = await db.rpc('accept_invitation', { p_token: token })
    expect(replay.error?.message).toContain('no longer valid')
  })

  it('rejects an expired token', async () => {
    const db = makeClient()
    await signIn(db, 'arkarmin@pms.dev')
    const token = await createInvite(db, 'elle@pms.dev')

    await db
      .from('organization_invitations')
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq('token', token)

    await signIn(db, 'elle@pms.dev')
    const { error } = await db.rpc('accept_invitation', { p_token: token })
    expect(error?.message).toContain('no longer valid')
  })

  it('reports an unknown function rather than pretending to succeed', async () => {
    const db = makeClient()
    const { data, error } = await db.rpc('does_not_exist', {})

    expect(data).toBeNull()
    expect(error?.code).toBe('42883')
  })
})

describe('signup workspace creation', () => {
  it('joins the invited workspace instead of minting a second one', async () => {
    const db = makeClient()
    await signIn(db, 'arkarmin@pms.dev')
    const token = await createInvite(db, 'new.hire@pms.dev')

    await db.auth.signOut()
    await signUp(db, 'new.hire@pms.dev', token)

    const orgs = await db.from('organizations').select('id, name, created_by')
    expect(orgs.data?.map((o) => o.name)).toEqual(['NextStep'])

    const members = await db.from('organization_members').select('user_id').eq('organization_id', NEXT)
    expect(members.data?.some((m) => m.user_id === 'u-newhire')).toBe(true)
  })

  it('still creates a personal workspace when there is no invite', async () => {
    const db = makeClient()
    await signUp(db, 'solo@pms.dev')

    const orgs = await db.from('organizations').select('id, name, created_by')
    expect(orgs.data?.length).toBe(1)
    expect(orgs.data?.[0]?.created_by).toBe('u-solo')
  })

  it('falls back to a personal workspace when the token is stale', async () => {
    const db = makeClient()
    await signUp(db, 'new.hire@pms.dev', crypto.randomUUID())

    const orgs = await db.from('organizations').select('name')
    expect(orgs.data?.length).toBe(1)
    expect(orgs.data?.[0]?.name).not.toBe('NextStep')
  })
})