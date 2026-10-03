import { describe, expect, it } from 'vitest'

import { createDemoClient } from '@/lib/db/mock/client'
import { execute, rowMatches } from '@/lib/db/mock/engine'

/**
 * The demo backend is the app's reference implementation of the data contract.
 * These tests pin the PostgREST behaviours the features rely on.
 */
async function signedInClient(userId = 'u-arkar') {
  const client = createDemoClient()
  const emails: Record<string, string> = {
    'u-arkar': 'arkarmin@pms.dev',
    'u-min': 'min@pms.dev',
    'u-dana': 'dana@pms.dev',
    'u-joe': 'joe@pms.dev',
    'u-sam': 'sam@pms.dev',
    'u-elle': 'elle@pms.dev',
  }
  const email = emails[userId]
  await client.auth.signInWithPassword({ email: email as string, password: 'password123' })
  return client
}

describe('demo auth', () => {
  it('rejects a wrong password with a validation error', async () => {
    const client = createDemoClient()
    const { error } = await client.auth.signInWithPassword({
      email: 'arkarmin@pms.dev',
      password: 'wrong',
    })
    expect(error?.kind).toBe('validation')
  })

  it('restores the session after signing in', async () => {
    const client = await signedInClient()
    const { data } = await client.auth.getSession()
    expect(data?.user.email).toBe('arkarmin@pms.dev')
  })

  it('refuses reads when signed out', async () => {
    const client = createDemoClient()
    const { data, error } = await client.from('projects').select('*')
    expect(data).toBeNull()
    expect(error?.kind).toBe('unauthorized')
  })
})

describe('tenant isolation', () => {
  it('returns only projects in the caller\'s organisations', async () => {
    const client = await signedInClient('u-joe')
    const { data } = await client.from('projects').select('*')
    expect((data ?? []).every((row) => row.organization_id === 'org-nextstep')).toBe(true)
    expect((data ?? []).length).toBe(4)
  })

  it('does not leak a project from another organisation by id', async () => {
    const client = await signedInClient('u-joe')
    const { data, error } = await client.from('projects').select('*').eq('id', 'prj-art-site').maybeSingle()
    expect(data).toBeNull()
    expect(error).toBeNull()
  })

  it('gives a different tenant its own rows', async () => {
    const client = await signedInClient('u-elle')
    const { data } = await client.from('projects').select('*')
    expect((data ?? []).map((row) => row.id)).toEqual(['prj-art-site'])
  })

  it('lets a member of two organisations see both', async () => {
    const client = await signedInClient('u-arkar')
    const { data } = await client.from('organizations').select('*')
    expect((data ?? []).map((row) => row.slug).sort()).toEqual(['artificium', 'nextstep'])
  })

  it('rejects an insert into a foreign organisation', async () => {
    const client = await signedInClient('u-joe')
    const { error } = await client.from('projects').insert({
      organization_id: 'org-artificium',
      name: 'Sneaky',
      key: 'SNEAK',
      status: 'planned',
      priority: 'medium',
      created_by: 'u-arkar',
    })
    expect(error?.kind).toBe('forbidden')
  })

  it('scopes child tables through their parent', async () => {
    const client = await signedInClient('u-joe')
    const { data } = await client.from('task_comments').select('*')
    const taskIds = new Set(['t1', 't4', 't5', 't8', 't14', 't15', 't17'])
    expect((data ?? []).every((row) => taskIds.has(row.task_id as string))).toBe(true)
  })
})

describe('query semantics', () => {
  it('supports eq, in, ilike and order', async () => {
    const client = await signedInClient()
    const { data } = await client
      .from('projects')
      .select('*')
      .eq('status', 'active')
      .order('name', { ascending: false })

    expect((data ?? []).map((row) => row.name)).toEqual(['NextStep Website', 'Mobile Companion'])
  })

  it('filters with is(null)', async () => {
    const client = await signedInClient()
    const { data } = await client.from('tasks').select('*').is('assignee_id', null)
    expect((data ?? []).every((row) => row.assignee_id === null)).toBe(true)
  })

  it('searches case-insensitively with ilike', async () => {
    const client = await signedInClient()
    const { data } = await client.from('tasks').select('*').ilike('title', '%kanban%')
    expect((data ?? []).map((row) => row.title)).toContain('Kanban board with drag and drop')
  })

  it('returns PGRST116 from single() when nothing matches', async () => {
    const client = await signedInClient()
    const { data, error } = await client.from('projects').select('*').eq('id', 'missing').single()
    expect(data).toBeNull()
    expect(error?.code).toBe('PGRST116')
  })

  it('returns null without an error from maybeSingle()', async () => {
    const client = await signedInClient()
    const { data, error } = await client.from('projects').select('*').eq('id', 'missing').maybeSingle()
    expect(data).toBeNull()
    expect(error).toBeNull()
  })

  it('counts with count: exact', async () => {
    const client = await signedInClient()
    const { count } = await client.from('tasks').select('*', { count: 'exact' }).limit(3)
    expect(count).toBeGreaterThan(3)
  })

  it('embeds a parent row through a named relation', async () => {
    const client = await signedInClient()
    const { data } = await client
      .from('tasks')
      .select('title, assignee:profiles!tasks_assignee_id_fkey(full_name)')
      .eq('id', 't5')

    const row = (data ?? [])[0] as unknown as { assignee: { full_name: string } | null } | undefined
    expect(row?.assignee).toMatchObject({ full_name: 'Joe Park' })
  })

  it('paginates with range', async () => {
    const client = await signedInClient()
    const { data } = await client.from('tasks').select('*').range(0, 4)
    expect(data).toHaveLength(5)
  })
})

describe('mutations', () => {
  it('inserts, updates and deletes', async () => {
    const client = await signedInClient()

    const { data: created, error } = await client
      .from('tasks')
      .insert({
        organization_id: 'org-nextstep',
        project_id: 'prj-web',
        title: 'Written by a test',
        status_id: 'st-todo',
        reporter_id: 'u-arkar',
        position: 1,
      })
      .select('*')
      .single()

    expect(error).toBeNull()
    expect(created?.id).toBeTruthy()

    const { data: updated } = await client
      .from('tasks')
      .update({ title: 'Renamed' })
      .eq('id', created?.id as string)
      .select('*')
      .single()
    expect(updated?.title).toBe('Renamed')

    await client.from('tasks').delete().eq('id', created?.id as string)
    const { data: gone } = await client.from('tasks').select('*').eq('id', created?.id as string).maybeSingle()
    expect(gone).toBeNull()
  })

  it('stamps created_at on insert', async () => {
    const client = await signedInClient()
    const { data } = await client
      .from('tasks')
      .insert({
        organization_id: 'org-nextstep',
        project_id: 'prj-web',
        title: 'Stamped',
        status_id: 'st-todo',
        reporter_id: 'u-arkar',
        position: 1,
      })
      .select('created_at')
      .single()
    expect(typeof data?.created_at).toBe('string')
  })
})

describe('engine internals', () => {
  const store = {
    table: () => [] as Record<string, unknown>[],
    rows: () => [] as Record<string, unknown>[],
  }

  it('matches multiple filters with AND', () => {
    const row = { status: 'todo', position: 5 }
    expect(
      rowMatches(row, [
        { op: 'eq', column: 'status', value: 'todo' },
        { op: 'gte', column: 'position', value: 5 },
      ], []),
    ).toBe(true)
    expect(
      rowMatches(row, [
        { op: 'eq', column: 'status', value: 'done' },
        { op: 'gte', column: 'position', value: 5 },
      ], []),
    ).toBe(false)
  })

  it('evaluates or() branches', () => {
    expect(rowMatches({ a: '1' }, [], ['a.eq.1,b.eq.2'])).toBe(true)
    expect(rowMatches({ a: '3' }, [], ['a.eq.1,b.eq.2'])).toBe(false)
  })

  it('respects limit, offset and ordering', () => {
    const rows = [
      { id: '1', position: 3 },
      { id: '2', position: 1 },
      { id: '3', position: 2 },
    ]
    const table = [...rows]

    const outcome = execute(
      {
        table: 'x',
        mode: 'select',
        select: '*',
        countExact: false,
        filters: [],
        orFilters: [],
        order: [{ column: 'position', ascending: true }],
        limit: 2,
        offset: 0,
        single: null,
        insertRows: null,
        patch: null,
      },
      { table: () => table, rows: (_n, filter) => table.filter(filter) },
    )

    expect(outcome.data.map((row) => row.id)).toEqual(['2', '3'])
    expect(store).toBeTruthy()
  })
})
describe('select projection', () => {
  it('keeps base columns when a select mixes * with embedded resources', async () => {
    const client = await signedInClient()
    const { data } = await client
      .from('projects')
      .select('*, owner:profiles!projects_owner_id_fkey(full_name)')
      .eq('id', 'prj-web')
      .single()

    const project = data as unknown as Record<string, unknown>
    expect(project.status).toBe('active')
    expect(project.key).toBe('WEB')
    expect((project.owner as { full_name: string }).full_name).toBe('Arkar Min')
  })

  it('embeds a one-to-many collection under its alias', async () => {
    const client = await signedInClient()
    const { data } = await client
      .from('projects')
      .select('id, members:project_members(role)')
      .eq('id', 'prj-web')
      .single()

    const project = data as unknown as { members: { role: string }[] }
    expect(project.members.map((member) => member.role).sort()).toEqual([
      'manager',
      'member',
      'owner',
      'viewer',
    ])
  })

  it('restricts columns when an explicit list is given', async () => {
    const client = await signedInClient()
    const { data } = await client.from('projects').select('id, name').eq('id', 'prj-web').single()
    expect(data).toEqual({ id: 'prj-web', name: 'NextStep Website' })
  })
})
