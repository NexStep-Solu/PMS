import { describe, expect, it } from 'vitest'

import { createDemoClient } from '@/lib/db/mock/client'

/**
 * The demo backend emulates RLS. These tests pin the workspace roster rule that
 * production enforces with `org_members_select ... using (is_org_member(...))`:
 * a member can read every member of their organisations, not just themselves.
 *
 * Regression: an over-tight self-only filter made assignee pickers, the members
 * page and project member dialogs list a single person.
 */

async function signedIn(email = 'arkarmin@pms.dev') {
  const db = createDemoClient()
  await db.auth.signInWithPassword({ email, password: 'password123' })
  return db
}

const NEXT = 'org-nextstep'
const ART = 'org-artificium'

describe('workspace roster visibility', () => {
  it('returns every member of the current workspace', async () => {
    const db = await signedIn()
    const { data, error } = await db
      .from('organization_members')
      .select('*')
      .eq('organization_id', NEXT)

    expect(error).toBeNull()
    expect(data?.map((row) => row.user_id).sort()).toEqual(['u-arkar', 'u-dana', 'u-joe', 'u-min', 'u-sam'])
  })

  it('never leaks another workspace that the caller does not belong to', async () => {
    const db = await signedIn('elle@pms.dev')
    const { data } = await db.from('organization_members').select('*').eq('organization_id', NEXT)

    expect(data).toEqual([])
  })

  it('resolves profile names through the member embed for the whole roster', async () => {
    const db = await signedIn()
    const { data } = await db
      .from('organization_members')
      .select('user_id, profiles!organization_members_user_id_fkey(id, full_name)')
      .eq('organization_id', NEXT)

    const names = (data ?? []).map(
      (row) => (row as unknown as { profiles: { full_name: string } | null }).profiles?.full_name,
    )
    expect(names).toContain('Joe Park')
    expect(names).toContain('Dana Lim')
  })

  it('keeps each caller scoped to their own workspaces', async () => {
    const arkar = await signedIn()
    const elle = await signedIn('elle@pms.dev')

    const arkarOrgs = await arkar.from('organizations').select('id')
    const elleOrgs = await elle.from('organizations').select('id')

    expect(arkarOrgs.data?.map((o) => o.id).sort()).toEqual([ART, NEXT].sort())
    expect(elleOrgs.data?.map((o) => o.id)).toEqual([ART])
  })
})
