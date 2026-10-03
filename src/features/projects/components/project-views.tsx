import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'

import { EmptyState, ErrorState, SkeletonList } from '@/components/shared/states'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ACCEPTED_UPLOAD_TYPES, MAX_ATTACHMENT_BYTES } from '@/lib/constants'
import { friendlyMessage } from '@/lib/db/errors'
import { formatBytes } from '@/lib/utils'
import { db } from '@/lib/client'
import { useCurrentUser } from '@/features/auth/queries'
import { usePermission, useWorkspace } from '@/features/organizations/workspace-context'

import { useProjectFiles } from '../queries'
import { KanbanBoard } from '@/features/tasks/components/kanban-board'
import { TaskListView } from '@/features/tasks/components/task-list-view'
import { TaskCalendarView } from '@/features/tasks/components/task-calendar-view'
import { TaskTimelineView } from '@/features/tasks/components/task-timeline-view'
import { MilestoneList } from '@/features/milestones/components/milestone-list'
import { useMilestones } from '@/features/milestones/queries'
import { useTasksByProject, useWorkspaceTaskMeta } from '@/features/tasks/queries'

/* ------------------------------------------------------------------ */
/* Board                                                               */
/* ------------------------------------------------------------------ */

export function ProjectBoard() {
  const { projectId } = useParams<{ projectId: string }>()
  const { can } = usePermission()
  const { data: tasks, isPending, isError, refetch } = useTasksByProject(projectId)
  const { statuses } = useWorkspaceTaskMeta()

  if (isPending) return <SkeletonList rows={6} />
  if (isError) {
    return (
      <ErrorState
        title="Couldn't load the board"
        description="We couldn't fetch the tasks for this project."
        onRetry={() => void refetch()}
      />
    )
  }

  return (
    <div className="min-h-0">
      <KanbanBoard tasks={tasks ?? []} statuses={statuses} canUpdate={can('tasks.update')} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* List                                                                */
/* ------------------------------------------------------------------ */

export function ProjectListView() {
  const { projectId } = useParams<{ projectId: string }>()
  const { can } = usePermission()
  const { data: tasks, isPending, isError, refetch } = useTasksByProject(projectId)
  const { statuses } = useWorkspaceTaskMeta()

  if (isPending) return <SkeletonList rows={8} />
  if (isError) {
    return (
      <ErrorState title="Couldn't load tasks" onRetry={() => void refetch()} />
    )
  }

  return (
    <TaskListView
      tasks={tasks ?? []}
      statuses={statuses}
      projectNames={{ [projectId ?? '']: 'This project' }}
      canUpdate={can('tasks.update')}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

export function ProjectCalendarView() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: tasks, isPending } = useTasksByProject(projectId)
  const { statuses } = useWorkspaceTaskMeta()
  const { data: milestones } = useMilestones(projectId)

  if (isPending) return <SkeletonList rows={6} />

  return (
    <TaskCalendarView
      tasks={tasks ?? []}
      statuses={statuses}
      milestones={(milestones ?? []).map((milestone) => ({
        id: milestone.id,
        name: milestone.name,
        due_date: milestone.due_date,
        status: milestone.status,
      }))}
    />
  )
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

export function ProjectTimelineView() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: tasks, isPending } = useTasksByProject(projectId)
  const { statuses } = useWorkspaceTaskMeta()

  if (isPending) return <SkeletonList rows={6} />

  return <TaskTimelineView tasks={tasks ?? []} statuses={statuses} />
}

/* ------------------------------------------------------------------ */
/* Milestones                                                          */
/* ------------------------------------------------------------------ */

export function ProjectMilestones() {
  const { projectId } = useParams<{ projectId: string }>()
  const { data: milestones, isPending } = useMilestones(projectId)

  if (isPending) return <SkeletonList rows={4} />

  return <MilestoneList projectId={projectId ?? ''} milestones={milestones ?? []} />
}

/* ------------------------------------------------------------------ */
/* Files                                                               */
/* ------------------------------------------------------------------ */

export function ProjectFiles() {
  const { projectId } = useParams<{ projectId: string }>()
  const { organizationId } = useWorkspace()
  const { can } = usePermission()
  const userId = useCurrentUser()?.id
  const { data: files, isPending, refetch } = useProjectFiles(projectId)
  const [uploading, setUploading] = useState(false)

  const list = useMemo(() => files ?? [], [files])

  const upload = async (file: File) => {
    if (!projectId || !organizationId || !userId) return
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error('File is too large', {
        description: `Maximum size is ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
      })
      return
    }

    setUploading(true)
    try {
      const path = `organizations/${organizationId}/projects/${projectId}/${Date.now()}-${file.name}`
      const result = await db()
        .storage.from('project-files')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (result.error) throw result.error

      const { error } = await db().from('project_files').insert({
        project_id: projectId,
        uploaded_by: userId,
        file_name: file.name,
        storage_path: result.path,
        file_size: file.size,
        mime_type: file.type || 'application/octet-stream',
      })
      if (error) throw error

      toast.success('File uploaded')
      await refetch()
    } catch (error) {
      toast.error('Upload failed', { description: friendlyMessage(error as never) })
    } finally {
      setUploading(false)
    }
  }

  if (isPending) return <SkeletonList rows={4} />

  return (
    <div className="space-y-3">
      {can('files.upload') ? (
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-accent/50">
          <Upload className="size-4" aria-hidden />
          {uploading ? 'Uploading…' : 'Upload a project file'}
          <input
            type="file"
            className="sr-only"
            accept={ACCEPTED_UPLOAD_TYPES}
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void upload(file)
            }}
          />
        </label>
      ) : null}

      {list.length === 0 ? (
        <EmptyState
          title="No files yet"
          description="Project briefs, designs and specs shared with the whole team live here."
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {list.map((file) => {
            const uploader = (
              file as unknown as {
                profiles: { id: string; full_name: string | null; avatar_url: string | null } | null
              }
            ).profiles
            return (
              <li key={file.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.file_name}</p>
                  <p className="text-xs text-muted-foreground tabular">
                    {formatBytes(file.file_size)} · {new Date(file.created_at).toLocaleDateString()}
                  </p>
                </div>
                {uploader ? <UserAvatar person={uploader} size={22} /> : null}
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Files are stored under{' '}
        <code className="font-mono">organizations/&lt;org&gt;/projects/&lt;project&gt;/</code> and guarded by
        storage policies.
      </p>
    </div>
  )
}
