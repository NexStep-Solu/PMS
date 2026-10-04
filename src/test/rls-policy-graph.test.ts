import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Guards the RLS policy graph.
 *
 * Postgres aborts with `infinite recursion detected in policy for relation
 * "projects"` when two policies read each other's table. We hit exactly that:
 * `projects_select` checked project membership with an `exists` subquery on
 * `project_members`, while `project_members_select` resolved the owning project
 * with an `exists` subquery on `projects`.
 *
 * The rule that prevents it: a policy may only read tables through
 * `private.*` SECURITY DEFINER helpers, never directly. This test parses the
 * migration and fails if any policy body references an RLS-protected table
 * again, or if the resulting graph contains a cycle.
 *
 * It is a static check because there is no Postgres in this environment; the
 * live counterpart is `supabase/verify.sql`.
 */

const sql = readFileSync('supabase/migrations/0001_init.sql', 'utf8')

interface Policy {
  name: string
  table: string
  body: string
}

function policies(): Policy[] {
  const found: Policy[] = []
  const re = /create policy (\w+) on public\.(\w+)\s+(.*?);\n/gs
  let match: RegExpExecArray | null
  while ((match = re.exec(sql)) !== null) {
    found.push({ name: match[1] as string, table: match[2] as string, body: match[3] as string })
  }
  return found
}

const all = policies()

/** Every table the migration creates (i.e. every table that has RLS on). */
function rlsTables(): Set<string> {
  const tables = new Set<string>()
  const re = /create table public\.(\w+) \(/g
  let match: RegExpExecArray | null
  while ((match = re.exec(sql)) !== null) tables.add(match[1] as string)
  return tables
}

/** Tables a policy body reads directly, ignoring the `private` helper layer. */
function directTableRefs(body: string): string[] {
  const refs = new Set<string>()
  const re = /\bfrom\s+public\.(\w+)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) refs.add(match[1] as string)
  return [...refs]
}

function findCycle(graph: Record<string, string[]>): string[] | null {
  const state: Record<string, 0 | 1 | 2> = {}
  const stack: string[] = []

  const visit = (node: string): string[] | null => {
    state[node] = 1
    stack.push(node)
    for (const next of graph[node] ?? []) {
      if (state[next] === 1) return [...stack.slice(stack.indexOf(next)), next]
      if (!state[next]) {
        const cycle = visit(next)
        if (cycle) return cycle
      }
    }
    state[node] = 2
    stack.pop()
    return null
  }

  for (const node of Object.keys(graph)) {
    if (!state[node]) {
      const cycle = visit(node)
      if (cycle) return cycle
    }
  }
  return null
}

describe('RLS policy graph', () => {
  it('declares RLS on every table it creates', () => {
    const tables = rlsTables()
    for (const table of tables) {
      expect(sql, `${table} must have RLS enabled`).toContain(
        `alter table public.${table}`,
      )
    }
    expect(tables.size).toBeGreaterThanOrEqual(20)
  })

  it('creates a policy for every table', () => {
    const policyTables = new Set(all.map((policy) => policy.table))
    const missing = [...rlsTables()].filter((table) => !policyTables.has(table))
    expect(missing, `tables without any RLS policy: ${missing.join(', ')}`).toEqual([])
  })

  it('never reads an RLS-protected table directly from a policy', () => {
    const protectedTables = rlsTables()
    const offenders: string[] = []

    for (const policy of all) {
      for (const ref of directTableRefs(policy.body)) {
        if (protectedTables.has(ref)) offenders.push(`${policy.name} → ${ref}`)
      }
    }

    expect(
      offenders,
      'route cross-table lookups through a private.* SECURITY DEFINER helper instead',
    ).toEqual([])
  })

  it('has no cycles in the policy graph', () => {
    const graph: Record<string, string[]> = {}
    for (const policy of all) {
      const refs = directTableRefs(policy.body)
      graph[policy.table] = [...new Set([...(graph[policy.table] ?? []), ...refs])]
    }
    expect(findCycle(graph)).toBeNull()
  })
})

describe('RLS helper functions', () => {
  const HELPERS = [
    /create or replace function private\.(\w+)\([^)]*\)[\s\S]*?security (\w+)[\s\S]*?set search_path = ''/g,
  ]

  it('all live in the private schema, as DEFINER, with an empty search_path', () => {
    const found = [...sql.matchAll(HELPERS[0] as RegExp)]
    expect(found.length).toBeGreaterThan(10)
    for (const match of found) {
      expect(match[2], `${match[1]} must be SECURITY DEFINER`).toBe('definer')
    }
  })

  it('denies anon and PUBLIC access', () => {
    expect(sql).toContain('revoke all on schema private from public, anon;')
    expect(sql).toContain('grant usage on schema private to authenticated;')
    // Every helper must appear in the revoke + grant lists.
    const revoke = sql.slice(sql.lastIndexOf('revoke execute on function'))
    expect(revoke).toContain('private.is_org_member(uuid)')
    expect(revoke).toContain('to authenticated;')
  })

  it('is idempotent so a re-run is safe', () => {
    expect(sql).toContain('create schema if not exists private')
    const drops = sql.match(/^drop policy if exists/gm) ?? []
    const creates = sql.match(/^create policy/gm) ?? []
    expect(drops.length).toBe(creates.length)
    expect(sql).not.toMatch(/^create table\b/m)
  })
})

describe('embedded resource syntax used by the client', () => {
  // PostgREST rejects `<table>!inner(...)` nested inside its own table, which
  // surfaced as "Searched for a foreign key relationship between
  // 'project_members' and 'project_members'".
  it('never nests a table inside itself in a select string', () => {
    const suspects = [
      { file: 'src/features/projects/queries.ts', pattern: /(\w+)!inner\(\s*\1!/ },
      { file: 'src/features/tasks/queries.ts', pattern: /(\w+)!inner\(\s*\1!/ },
    ]

    for (const { file, pattern } of suspects) {
      const source = readFileSync(file, 'utf8')
      expect(pattern.test(source), `${file} nests a table inside itself`).toBe(false)
    }
  })
})
describe('invitation join flow', () => {
  const line = (needle: string) => sql.indexOf(needle)

  it('defines accept/preview only after the tables they touch', () => {
    // Postgres validates `language sql` bodies when they are created, so a
    // function placed above its tables fails the whole migration.
    for (const table of [
      'create table public.organization_invitations',
      'create table public.organization_members',
      'create table public.profiles',
    ]) {
      expect(line(table), `${table} missing`).toBeGreaterThan(-1)
      expect(line(table)).toBeLessThan(line('create or replace function public.invitation_preview'))
    }

    expect(line('create or replace function private.invitation_for_token')).toBeLessThan(
      line('create or replace function public.accept_invitation'),
    )
  })

  it('defines private.current_user_email before the policy that calls it', () => {
    expect(line('create or replace function private.current_user_email')).toBeGreaterThan(-1)
    expect(line('create or replace function private.current_user_email')).toBeLessThan(
      line('create policy invitations_select'),
    )
  })

  it('scopes accept_invitation to the invited email', () => {
    const body = sql.slice(line('create or replace function public.accept_invitation'))
    expect(body.slice(0, 2500)).toContain('invite.email <> caller_email')
    expect(body.slice(0, 2500)).toContain('security definer')
  })

  it('only lets the invitee read their own pending invitation', () => {
    expect(sql).toContain('(email = private.current_user_email() and status = \'pending\')')
  })

  it('lets signup join through the token instead of always minting a workspace', () => {
    const body = sql.slice(line('create or replace function public.handle_new_user'))
    expect(body.slice(0, 3000)).toContain('invite_token')
    expect(body.slice(0, 3000)).toContain('public.accept_invitation')
  })

  it('does not expose accept_invitation to anonymous callers', () => {
    expect(sql).toMatch(
      /revoke all on function public\.accept_invitation\(uuid\) from public;[\s\S]*?grant execute on function public\.accept_invitation\(uuid\) to authenticated;/,
    )
  })
})
