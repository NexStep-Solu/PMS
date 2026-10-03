import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Play, Square, Timer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, SkeletonList } from '@/components/shared/states'
import { ProjectSelect } from '@/components/shared/task-form-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { isDemoMode } from '@/lib/client'
import { friendlyMessage } from '@/lib/db/errors'
import { useCurrentUser } from '@/features/auth/queries'
import { useWorkspace } from '@/features/organizations/workspace-context'
import { useProjectsSidebar } from '@/features/projects/queries'
import {
  useDeleteTimeEntry,
  useRunningEntry,
  useStartTimer,
  useStopTimer,
  useTimeEntries,
} from '../queries'

export function TimeTrackingPage() {
  const user = useCurrentUser()
  const { organizationId } = useWorkspace()
  const { can } = useWorkspace()
  const { data: projects } = useProjectsSidebar()
  const { data: entries, isPending } = useTimeEntries(organizationId ?? undefined)
  const { data: running } = useRunningEntry()
  const startTimer = useStartTimer()
  const stopTimer = useStopTimer()

  const [chosenProjectId, setChosenProjectId] = useState<string | null>(null)
  const [description, setDescription] = useState('')

  // Derived, not synchronised: the first project is the default until the user
  // picks another one.
  const projectId = chosenProjectId ?? projects?.[0]?.id ?? ''

  const canTrack = can('time.create')

  const totals = useMemo(() => {
    const list = (entries ?? []).filter((entry) => !entry.is_running)
    const minutes = list.reduce((sum, entry) => sum + (entry.duration_minutes ?? 0), 0)
    return {
      minutes,
      hours: Math.floor(minutes / 60),
      remainder: minutes % 60,
      entries: list.length,
    }
  }, [entries])

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Time tracking"
        description="Record time against projects and tasks."
      />

      {canTrack ? (
        <Card>
          <CardContent className="space-y-3 py-4">
            {running ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 text-sm">
                  <span className="size-2 animate-pulse rounded-full bg-status-done" aria-hidden />
                  Timer running since {format(new Date(running.started_at), 'HH:mm')}
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    stopTimer.mutate(running, {
                      onError: (error) => toast.error(friendlyMessage(error as never)),
                    })
                  }
                  loading={stopTimer.isPending}
                >
                  <Square aria-hidden />
                  Stop
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-48 flex-1">
                  <label htmlFor="time-project" className="text-xs font-medium text-muted-foreground">
                    Project
                  </label>
                  <ProjectSelect
                    projects={projects ?? []}
                    value={projectId}
                    onChange={setChosenProjectId}
                    className="mt-1 w-full"
                  />
                </div>
                <div className="min-w-48 flex-1">
                  <label htmlFor="time-description" className="text-xs font-medium text-muted-foreground">
                    What are you working on?
                  </label>
                  <Input
                    id="time-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Optional note"
                    className="mt-1"
                  />
                </div>
                <Button
                  onClick={() => {
                    if (!user) return
                    startTimer.mutate(
                      { projectId, userId: user.id, description: description.trim() || undefined },
                      {
                        onSuccess: () => setDescription(''),
                        onError: (error) => toast.error(friendlyMessage(error as never)),
                      },
                    )
                  }}
                  disabled={!projectId || startTimer.isPending}
                  loading={startTimer.isPending}
                >
                  <Play aria-hidden />
                  Start timer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <dl className="grid grid-cols-3 divide-x rounded-xl border">
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular">
            {totals.hours}h {totals.remainder}m
          </dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">Entries</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular">{totals.entries}</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">Average</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular">
            {totals.entries === 0
              ? '—'
              : `${Math.round(totals.minutes / totals.entries)}m`}
          </dd>
        </div>
      </dl>

      {isPending ? (
        <SkeletonList rows={5} />
      ) : (entries ?? []).length === 0 ? (
        <EmptyState
          icon={<Timer className="size-5" aria-hidden />}
          title="No time logged yet"
          description="Start the timer above to record your first entry."
        />
      ) : (
        <TimeTable projects={projects ?? []} />
      )}

      {isDemoMode ? (
        <p className="text-xs text-muted-foreground">
          Demo mode: the timer runs on real time but nothing is sent to a server.
        </p>
      ) : null}
    </div>
  )
}

function TimeTable({ projects }: { projects: { id: string; key: string; name: string }[] }) {
  const { organizationId } = useWorkspace()
  const { data: entries } = useTimeEntries(organizationId ?? undefined)
  const remove = useDeleteTimeEntry()

  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  )

  return (
    <ul className="divide-y rounded-xl border">
      {(entries ?? []).map((entry) => {
        const task = (entry as unknown as { tasks: { title: string } | null }).tasks
        const project = projectNames.get(entry.project_id)
        const projectLabel = project ? `${project.key} · ${project.name}` : 'Unknown project'

        return (
          <li key={entry.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">
                {entry.description || task?.title || 'Tracked time'}
              </p>
              <p className="text-xs text-muted-foreground tabular">
                <span className="truncate">{projectLabel}</span>{' · '}
                {format(new Date(entry.started_at), 'd MMM, HH:mm')}
                {entry.is_running ? ' · running' : ''}
              </p>
            </div>
            <span className="shrink-0 text-sm font-medium tabular">
              {entry.is_running
                ? '—'
                : `${Math.floor((entry.duration_minutes ?? 0) / 60)}h ${(entry.duration_minutes ?? 0) % 60}m`}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete entry"
              onClick={() => remove.mutate({ entryId: entry.id })}
            >
              <Trash2 aria-hidden />
            </Button>
          </li>
        )
      })}
    </ul>
  )
}

