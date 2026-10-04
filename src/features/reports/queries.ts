import { useQuery } from '@tanstack/react-query'

import { db } from '@/lib/client'
import { keys } from '@/lib/query-keys'

import { useWorkspace } from '@/features/organizations/workspace-context'

/**
 * Reports read pre-aggregated rows instead of the task table.
 *
 * `public.workspace_report` groups by project, status, priority and assignee, so
 * the payload is bounded by the number of distinct combinations rather than the
 * number of tasks, and the aggregation happens in Postgres.
 */
export interface ReportRow {
  project_id: string | null
  project_key: string | null
  status_id: string
  priority_id: string | null
  assignee_id: string | null
  /** Postgres returns bigint as a string over PostgREST. */
  total: number | string
  done: number | string
  in_progress: number | string
  overdue: number | string
}

export interface TimeTotal {
  tracked_minutes: number | string
  running_entries: number | string
  logged_entries: number | string
}

const toNumber = (value: number | string | null | undefined): number => {
  const parsed = typeof value === 'string' ? Number(value) : (value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function useWorkspaceReport() {
  const { organizationId } = useWorkspace()

  return useQuery({
    queryKey: [...keys.report(organizationId ?? '')],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<ReportRow[]> => {
      const { data, error } = await db().rpc<ReportRow[]>('workspace_report', {
        p_org: organizationId,
      })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useWorkspaceTimeTotal() {
  const { organizationId } = useWorkspace()

  return useQuery({
    queryKey: [...keys.report(organizationId ?? ''), 'time'],
    enabled: Boolean(organizationId),
    queryFn: async (): Promise<TimeTotal> => {
      const { data, error } = await db().rpc<TimeTotal>('workspace_time_total', {
        p_org: organizationId,
      })
      if (error) throw error
      return data ?? { tracked_minutes: 0, running_entries: 0, logged_entries: 0 }
    },
  })
}

export interface ReportTotals {
  total: number
  done: number
  inProgress: number
  overdue: number
  percent: number
}

/** Sums the aggregate rows into the headline numbers. */
export function summariseReport(rows: ReportRow[]): ReportTotals {
  let total = 0
  let done = 0
  let inProgress = 0
  let overdue = 0

  for (const row of rows) {
    total += toNumber(row.total)
    done += toNumber(row.done)
    inProgress += toNumber(row.in_progress)
    overdue += toNumber(row.overdue)
  }

  return { total, done, inProgress, overdue, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}