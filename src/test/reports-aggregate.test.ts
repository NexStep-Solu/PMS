import { describe, expect, it } from 'vitest'

import { createDemoClient } from '@/lib/db/mock/client'
import { summariseReport, type ReportRow } from '@/features/reports/queries'
import type { DatabaseClient } from '@/lib/db/contract'

/**
 * Reports must be computed in the database. These pin both halves of that:
 * the aggregate rows are correct, and the payload is bounded by the number of
 * distinct task *shapes* rather than the number of tasks.
 */

const PASSWORD = 'password123'

async function signedIn(): Promise<DatabaseClient> {
  const db = createDemoClient()
  await db.auth.signInWithPassword({ email: 'arkarmin@pms.dev', password: PASSWORD })
  return db
}

describe('workspace_report', () => {
  it('collapses many identical tasks into a single row', async () => {
    const db = await signedIn()
    const before = await db.rpc<ReportRow[]>('workspace_report', { p_org: 'org-nextstep' })
    expect(before.error).toBeNull()
    const rowsBefore = before.data!.length

    const template = (await db.from('tasks').select('*').eq('organization_id', 'org-nextstep').limit(1))
      .data![0]!
    expect(template).toBeDefined()

    // 40 more tasks that all share one project/status/priority/assignee shape.
    for (let i = 0; i < 40; i += 1) {
      await db.from('tasks').insert({
        organization_id: 'org-nextstep',
        project_id: template.project_id,
        parent_task_id: null,
        title: `Clone ${i}`,
        description: null,
        status_id: template.status_id,
        priority_id: template.priority_id,
        assignee_id: template.assignee_id,
        reporter_id: 'u-arkar',
        start_date: null,
        due_date: null,
        estimated_minutes: null,
        position: 9000 + i,
      })
    }

    const after = await db.rpc<ReportRow[]>('workspace_report', { p_org: 'org-nextstep' })

    // Same number of rows as before: the payload is bounded by distinct shapes,
    // not by the number of tasks.
    expect(after.data!.length).toBe(rowsBefore)

    const grew = after.data!.find((row) => Number(row.total) > Number(
      before.data!.find((r) =>
        r.project_id === template.project_id &&
        r.status_id === template.status_id &&
        r.assignee_id === template.assignee_id &&
        r.priority_id === template.priority_id,
      )?.total ?? 0,
    ))
    expect(grew).toBeDefined()
    expect(Number(grew!.total)).toBeGreaterThanOrEqual(41)
  })

  it('never returns rows for another workspace', async () => {
    const db = await signedIn()
    const { data } = await db.rpc<ReportRow[]>('workspace_report', { p_org: 'org-artificium' })
    expect(data).toEqual([])
  })

  it('omits work the signed-in user cannot see', async () => {
    // Sam is a viewer; private.can_read_task limits viewers to their own and
    // their projects' tasks, so their report cannot be the whole workspace.
    const db = createDemoClient()
    await db.auth.signInWithPassword({ email: 'sam@pms.dev', password: PASSWORD })
    const { data } = await db.rpc<ReportRow[]>('workspace_report', { p_org: 'org-nextstep' })

    const viewerRows = (data ?? []).reduce((sum, row) => sum + Number(row.total), 0)
    const owner = await signedIn()
    const ownerRows = (await owner.rpc<ReportRow[]>('workspace_report', { p_org: 'org-nextstep' })).data ?? []
    const ownerTotal = ownerRows.reduce((sum, row) => sum + Number(row.total), 0)

    expect(ownerTotal).toBeGreaterThan(0)
    expect(viewerRows).toBeLessThanOrEqual(ownerTotal)
  })
})

describe('workspace_time_total', () => {
  it('sums logged minutes and separates running entries', async () => {
    const db = await signedIn()
    const { data, error } = await db.rpc<{
      tracked_minutes: number
      running_entries: number
      logged_entries: number
    }>('workspace_time_total', { p_org: 'org-nextstep' })

    expect(error).toBeNull()
    expect(typeof data?.tracked_minutes).toBe('number')
    expect(data!.tracked_minutes).toBeGreaterThanOrEqual(0)
    expect(data!.logged_entries).toBeGreaterThanOrEqual(0)
  })
})

describe('summariseReport', () => {
  it('adds up the aggregate rows', () => {
    const totals = summariseReport([
      { project_id: 'p1', project_key: 'WEB', status_id: 's1', priority_id: null, assignee_id: 'u1', total: 10, done: 4, in_progress: 3, overdue: 2 },
      { project_id: 'p2', project_key: 'APP', status_id: 's2', priority_id: null, assignee_id: 'u2', total: 5, done: 1, in_progress: 1, overdue: 0 },
    ])

    expect(totals).toEqual({ total: 15, done: 5, inProgress: 4, overdue: 2, percent: 33 })
  })

  it('accepts the strings PostgREST returns for bigint', () => {
    // A bigint column arrives as "10", not 10. Naive addition would concatenate.
    const totals = summariseReport([
      { project_id: null, project_key: null, status_id: 's1', priority_id: null, assignee_id: null, total: '10', done: '4', in_progress: '3', overdue: '2' },
      { project_id: null, project_key: null, status_id: 's2', priority_id: null, assignee_id: null, total: '5', done: '1', in_progress: '1', overdue: '0' },
    ])

    expect(totals.total).toBe(15)
    expect(totals.done).toBe(5)
    expect(totals.overdue).toBe(2)
  })

  it('reports zero rather than dividing by zero', () => {
    expect(summariseReport([])).toEqual({
      total: 0,
      done: 0,
      inProgress: 0,
      overdue: 0,
      percent: 0,
    })
  })
})
describe('reports page stays server-side', () => {
  it('does not pull the whole task table to build its charts', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync('src/features/reports/components/reports-page.tsx', 'utf8')

    // Regression guard: these were the two unbounded reads that made reports
    // scale with the size of the workspace.
    expect(source).not.toContain('useTasksByOrganization')
    expect(source).not.toContain('useProjects(')
    expect(source).not.toContain('useTimeEntries(')
    expect(source).toContain('useWorkspaceReport')
    expect(source).toContain('useWorkspaceTimeTotal')
  })
})
