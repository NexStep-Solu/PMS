import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip as ReTooltip, XAxis, YAxis } from 'recharts'

import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, ErrorState, SkeletonPanel } from '@/components/shared/states'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUS_META } from '@/lib/constants'
import { useWorkspace } from '@/features/organizations/workspace-context'
import { useMemberOptions } from '@/features/organizations/queries'
import { useWorkspaceTaskMeta } from '@/features/tasks/queries'
import { summariseReport, useWorkspaceReport, useWorkspaceTimeTotal } from '@/features/reports/queries'

/** Postgres returns bigint as a string over PostgREST. */
const toCount = (value: number | string | null | undefined): number => {
  const parsed = typeof value === 'string' ? Number(value) : (value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const CHART_COLORS = [
  'var(--color-status-progress)',
  'var(--color-status-review)',
  'var(--color-status-done)',
  'var(--color-priority-high)',
  'var(--color-status-todo)',
  'var(--color-status-cancelled)',
]

/**
 * Reports are read-only summaries. Every chart is paired with the underlying
 * numbers so the information is available without relying on colour.
 */
export function ReportsPage() {
  const { organizationName, can } = useWorkspace()
  const members = useMemberOptions()
  const { statuses, priorities } = useWorkspaceTaskMeta()

  // Charts read Postgres-side aggregates. The reports screen used to fetch every
  // task in the workspace and fold it up in the browser.
  const { data: rows, isPending, isError, refetch } = useWorkspaceReport()
  const { data: timeTotal } = useWorkspaceTimeTotal()

  // Stable identity keeps the chart memos from re-running every render.
  const reportRows = useMemo(() => rows ?? [], [rows])

  const statusData = useMemo(() => {
    const map = new Map<string, number>()
    for (const status of statuses) map.set(status.name, 0)
    for (const row of reportRows) {
      const name = statuses.find((status) => status.id === row.status_id)?.name
      if (name) map.set(name, (map.get(name) ?? 0) + toCount(row.total))
    }
    return [...map.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [reportRows, statuses])

  const workloadData = useMemo(() => {
    const totals = new Map<string, number>()
    for (const row of reportRows) {
      if (!row.assignee_id) continue
      totals.set(row.assignee_id, (totals.get(row.assignee_id) ?? 0) + toCount(row.total) - toCount(row.done))
    }
    return members
      .map((member) => ({
        name: member.full_name ?? 'Unnamed',
        open: Math.max(0, totals.get(member.id) ?? 0),
      }))
      .sort((a, b) => b.open - a.open)
      .slice(0, 10)
  }, [members, reportRows])

  const priorityData = useMemo(() => {
    const map = new Map<string, number>()
    for (const priority of priorities) map.set(priority.name, 0)
    for (const row of reportRows) {
      const name = priorities.find((priority) => priority.id === row.priority_id)?.name
      if (name) map.set(name, (map.get(name) ?? 0) + toCount(row.total))
    }
    return [...map.entries()].map(([name, count]) => ({ name, count }))
  }, [reportRows, priorities])

  const projectData = useMemo(() => {
    const byProject = new Map<string, { key: string; total: number; done: number }>()
    for (const row of reportRows) {
      const key = row.project_id ?? 'unassigned'
      const entry = byProject.get(key) ?? { key: row.project_key ?? 'Unassigned', total: 0, done: 0 }
      entry.total += toCount(row.total)
      entry.done += toCount(row.done)
      byProject.set(key, entry)
    }
    return [...byProject.values()]
      .map((entry) => ({
        name: entry.key,
        total: entry.total,
        progress: entry.total === 0 ? 0 : Math.round((entry.done / entry.total) * 100),
      }))
      .sort((a, b) => b.progress - a.progress)
  }, [reportRows])

  const trackedMinutes = toCount(timeTotal?.tracked_minutes)
  const totals = useMemo(() => summariseReport(reportRows), [reportRows])
  const overdue = totals.overdue

  if (!can('reports.view')) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          title="Reports are restricted"
          description="Ask a workspace admin for the reports permission."
        />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <ErrorState title="Couldn't load reports" onRetry={() => void refetch()} />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[100rem] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Reports"
        description={`Workload, throughput and delivery across ${organizationName ?? 'this workspace'}.`}
      />

      {isPending ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonPanel key={index} />
          ))}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 divide-x divide-y rounded-xl border sm:grid-cols-4 sm:divide-y-0">
            <Summary label="Tasks" value={String(totals.total)} />
            <Summary label="Overdue" value={String(overdue)} tone={overdue > 0 ? 'danger' : undefined} />
            <Summary
              label="Tracked time"
              value={`${Math.round(trackedMinutes / 60)}h`}
            />
            <Summary label="Projects" value={String(projectData.length)} />
          </dl>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Task distribution by status</CardTitle>
              </CardHeader>
              <CardContent>
                {statusData.every((entry) => entry.count === 0) ? (
                  <ChartEmpty />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={statusData} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid horizontal={false} stroke="var(--border)" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 11 }} />
                        <ReTooltip
                          cursor={{ fill: 'var(--muted)' }}
                          contentStyle={{
                            background: 'var(--popover)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {statusData.map((entry, index) => (
                            <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <MiniTable
                      headers={['Status', 'Tasks']}
                      rows={statusData.map((entry) => [entry.name, String(entry.count)])}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Open work per person</CardTitle>
              </CardHeader>
              <CardContent>
                {workloadData.every((entry) => entry.open === 0) ? (
                  <ChartEmpty />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={workloadData} layout="vertical" margin={{ left: 8, right: 16 }}>
                        <CartesianGrid horizontal={false} stroke="var(--border)" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={110}
                          tick={{ fontSize: 11 }}
                        />
                        <ReTooltip
                          cursor={{ fill: 'var(--muted)' }}
                          contentStyle={{
                            background: 'var(--popover)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="open" fill="var(--color-primary)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <MiniTable
                      headers={['Person', 'Open']}
                      rows={workloadData.map((entry) => [entry.name, String(entry.open)])}
                    />
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Priority mix</CardTitle>
              </CardHeader>
              <CardContent>
                <MiniTable
                  headers={['Priority', 'Tasks']}
                  rows={priorityData.map((entry) => [entry.name, String(entry.count)])}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Progress by project</CardTitle>
              </CardHeader>
              <CardContent>
                {projectData.length === 0 ? (
                  <ChartEmpty />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={projectData} margin={{ left: 8, right: 16, top: 8 }}>
                        <CartesianGrid vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                        <ReTooltip
                          contentStyle={{
                            background: 'var(--popover)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="progress"
                          stroke="var(--color-primary)"
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <MiniTable
                      headers={['Project', 'Progress', 'Tasks']}
                      rows={projectData.map((entry) => [
                        entry.name,
                        `${entry.progress}%`,
                        String(entry.total),
                      ])}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Status legend</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {statuses.map((status) => (
                <span
                  key={status.id}
                  className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                    STATUS_META[status.category].classes
                  }`}
                >
                  {status.name}
                </span>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Summary({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-2xl font-semibold tabular ${tone === 'danger' ? 'text-destructive' : ''}`}>
        {value}
      </dd>
    </div>
  )
}

function ChartEmpty() {
  return (
    <p className="rounded-lg border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
      Not enough data to chart yet.
    </p>
  )
}

/** Numbers behind the chart, always visible. */
function MiniTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <Table className="mt-3 text-xs">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {headers.map((header) => (
            <TableHead key={header} className="h-7 px-2">
              {header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row[0]} className="hover:bg-transparent">
            {row.map((cell, index) => (
              <TableCell key={index} className="px-2 py-1 tabular">
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}