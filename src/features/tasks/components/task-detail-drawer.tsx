import { useState } from 'react'
import { formatDistanceToNowStrict } from 'date-fns'
import {
  Calendar,
  CheckSquare,
  Clock,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { LabelBadge, PriorityBadge, StatusBadge } from '@/components/shared/badges'
import { DatePicker } from '@/components/shared/date-picker'
import { MemberSelect } from '@/components/shared/member-select'
import { LabelMultiSelect, PrioritySelect, ProjectSelect, StatusSelect } from '@/components/shared/task-form-fields'
import { UserAvatar } from '@/components/shared/user-avatar'
import { InlineError, Skeleton } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ACCEPTED_UPLOAD_TYPES, MAX_ATTACHMENT_BYTES } from '@/lib/constants'
import { friendlyMessage } from '@/lib/db/errors'
import { cn, formatBytes } from '@/lib/utils'
import type { ActivityAction, ActivityLog } from '@/types/database'
import { useCurrentUser } from '@/features/auth/queries'
import { useActivity } from '@/features/activity/queries'
import { useMemberOptions } from '@/features/organizations/queries'
import { useWorkspace } from '@/features/organizations/workspace-context'
import { useProjectsSidebar } from '@/features/projects/queries'

import {
  useAddComment,
  useAttachments,
  useChecklist,
  useChecklistMutations,
  useComments,
  useDeleteAttachment,
  useDeleteComment,
  useDeleteTask,
  useTask,
  useTasksByOrganization,
  useUpdateTask,
  useUploadAttachment,
  useWorkspaceTaskMeta,
  type TaskWithMeta,
} from '../queries'
import { useTaskDialog } from '../task-dialog-context'
import { dueLabel, dueState } from '../utils'

type Permission = 'tasks.update' | 'tasks.create' | 'tasks.delete' | 'tasks.assign' | 'files.upload'

export function TaskDetailDrawer() {
  const { openTaskId, closeTask } = useTaskDialog()
  const { data: task, isPending, error, refetch } = useTask(openTaskId ?? undefined)
  const { can } = useWorkspace()

  if (!openTaskId) return null

  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : closeTask())}>
      <SheetContent side="right" className="w-full sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{task?.title ?? 'Task'}</SheetTitle>
          <SheetDescription className="sr-only">
            Properties, checklist, subtasks, comments, attachments and activity
          </SheetDescription>
        </SheetHeader>

        {isPending ? (
          <DrawerSkeleton />
        ) : error || !task ? (
          <div className="space-y-4 p-6">
            <InlineError message={friendlyMessage(error as never)} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void refetch()}>
                Try again
              </Button>
              <Button variant="ghost" onClick={closeTask}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          // `key` remounts the body when a different task is opened, so the
          // local title/description state is initialised from props rather than
          // synced with an effect.
          <TaskDetailBody key={task.id} task={task} can={can} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function DrawerSkeleton() {
  return (
    <div className="space-y-4 p-6" role="status" aria-busy>
      <span className="sr-only">Loading task</span>
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-8 w-full" />
        ))}
      </div>
    </div>
  )
}

function TaskDetailBody({
  task,
  can,
}: {
  task: TaskWithMeta
  can: (permission: Permission) => boolean
}) {
  const { organizationId } = useWorkspace()
  const { statuses, priorities, labels } = useWorkspaceTaskMeta()
  const memberOptions = useMemberOptions()
  const { data: projects } = useProjectsSidebar()
  const updateTask = useUpdateTask(task.id)
  const deleteTask = useDeleteTask()
  const { closeTask } = useTaskDialog()

  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const canUpdate = can('tasks.update')
  const labelIds = task.labels.map((link) => link.label_id)

  const save = (
    values: Omit<Parameters<typeof updateTask.mutate>[0], 'task'>,
    options?: { successMessage?: string },
  ) => {
    updateTask.mutate(
      { ...values, task },
      {
        onSuccess: () => {
          if (options?.successMessage) toast.success(options.successMessage)
        },
        onError: (mutationError) =>
          toast.error("Couldn't update task.", { description: friendlyMessage(mutationError as never) }),
      },
    )
  }

  return (
    <>
      <SheetBody className="space-y-6">
        <div className="space-y-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => {
              if (canUpdate && title.trim().length >= 2 && title.trim() !== task.title) {
                save({ title: title.trim() })
              }
            }}
            className="h-auto border-transparent bg-transparent px-1 py-1 text-lg font-semibold shadow-none hover:border-input focus-visible:border-ring"
            aria-label="Task title"
            disabled={!canUpdate}
          />
          <div className="flex flex-wrap items-center gap-2 px-1">
            <StatusBadge status={task.status} size="sm" />
            {task.priority ? <PriorityBadge priority={task.priority} size="sm" /> : null}
            <DueChip dueDate={task.due_date} completed={task.status.is_completed} />
          </div>
        </div>

        <Separator />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <div className="min-w-0 space-y-7">
            <section className="space-y-2">
              <h3 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
                Description
              </h3>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                onBlur={() => {
                  if (canUpdate && description !== (task.description ?? '')) save({ description })
                }}
                rows={5}
                placeholder="Add more detail…"
                aria-label="Description"
                className="resize-y"
                disabled={!canUpdate}
              />
            </section>

            <ChecklistSection taskId={task.id} canEdit={canUpdate} />
            <SubtaskSection taskId={task.id} organizationId={organizationId} canCreate={can('tasks.create')} />
            <CommentsSection taskId={task.id} taskTitle={task.title} />
            <AttachmentsSection
              taskId={task.id}
              organizationId={organizationId ?? ''}
              canUpload={can('files.upload')}
            />
          </div>

          <aside className="space-y-3 lg:sticky lg:top-0 lg:self-start">
            <PropertyRow label="Status">
              <StatusSelect
                statuses={statuses}
                value={task.status_id}
                onChange={(statusId) =>
                  save({ statusId }, {
                    successMessage: `Moved to ${statuses.find((status) => status.id === statusId)?.name ?? 'new status'}`,
                  })
                }
                className="w-full"
                disabled={!canUpdate}
              />
            </PropertyRow>

            <PropertyRow label="Priority">
              <PrioritySelect
                priorities={priorities}
                value={task.priority_id}
                onChange={(priorityId) => save({ priorityId })}
                className="w-full"
                disabled={!canUpdate}
              />
            </PropertyRow>

            <PropertyRow label="Assignee">
              <MemberSelect
                members={memberOptions}
                value={task.assignee_id}
                onChange={(assigneeId) => save({ assigneeId })}
                className="w-full"
                disabled={!can('tasks.assign')}
                aria-label="Assignee"
              />
            </PropertyRow>

            <PropertyRow label="Project">
              <ProjectSelect
                projects={projects ?? []}
                value={task.project_id}
                onChange={(projectId) => save({ projectId }, { successMessage: 'Task moved' })}
                className="w-full"
                disabled={!canUpdate}
              />
            </PropertyRow>

            <PropertyRow label="Start">
              <DatePicker
                value={task.start_date}
                onChange={(value) => save({ startDate: value })}
                className="w-full"
                disabled={!canUpdate}
              />
            </PropertyRow>

            <PropertyRow label="Due">
              <DatePicker
                value={task.due_date}
                onChange={(value) => save({ dueDate: value })}
                className="w-full"
                disabled={!canUpdate}
              />
            </PropertyRow>

            <PropertyRow label="Labels">
              <LabelMultiSelect
                labels={labels}
                value={labelIds}
                onChange={(next) => save({ labelIds: next })}
                disabled={!canUpdate}
              />
            </PropertyRow>

            {task.labels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {task.labels.map((link) =>
                  link.label ? <LabelBadge key={link.label_id} label={link.label} /> : null,
                )}
              </div>
            ) : null}

            <Separator className="my-4" />

            <TaskActivity taskId={task.id} />

            {can('tasks.delete') ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 aria-hidden />
                Delete task
              </Button>
            ) : null}
          </aside>
        </div>
      </SheetBody>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              Comments, subtasks and attachments are removed too. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteTask.mutate(
                  { taskId: task.id, title: task.title },
                  {
                    onSuccess: () => {
                      setConfirmDelete(false)
                      closeTask()
                      toast.success('Task deleted')
                    },
                    onError: (mutationError) =>
                      toast.error("Couldn't delete task.", {
                        description: friendlyMessage(mutationError as never),
                      }),
                  },
                )
              }
            >
              Delete task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function DueChip({ dueDate, completed }: { dueDate: string | null; completed: boolean }) {
  if (completed) return null
  const state = dueState({ due_date: dueDate, completed_at: null })
  if (state === 'none') return null

  const tone =
    state === 'overdue' ? 'text-destructive' : state === 'today' ? 'text-priority-high' : 'text-muted-foreground'

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', tone)}>
      <Calendar className="size-3.5" aria-hidden />
      {dueLabel(dueDate)}
      {state === 'overdue' ? <span className="sr-only">, overdue</span> : null}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Checklist                                                           */
/* ------------------------------------------------------------------ */

function ChecklistSection({ taskId, canEdit }: { taskId: string; canEdit: boolean }) {
  const { data: items } = useChecklist(taskId)
  const { add, toggle, remove } = useChecklistMutations(taskId)
  const [title, setTitle] = useState('')

  const list = items ?? []
  const done = list.filter((item) => item.is_completed).length
  const percent = list.length === 0 ? 0 : Math.round((done / list.length) * 100)

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <CheckSquare className="size-3.5 text-muted-foreground" aria-hidden />
        <h3 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Checklist</h3>
        {list.length > 0 ? (
          <span className="text-xs text-muted-foreground tabular">
            {done}/{list.length}
          </span>
        ) : null}
      </div>

      {list.length > 0 ? (
        <>
          <Progress value={percent} className="h-1" aria-label={`Checklist ${percent}% complete`} />
          <ul className="space-y-1">
            {list.map((item) => (
              <li key={item.id} className="group flex items-center gap-2 rounded-md px-1 py-0.5">
                <Checkbox
                  id={`checklist-${item.id}`}
                  checked={item.is_completed}
                  disabled={!canEdit}
                  onCheckedChange={(value) => toggle.mutate({ itemId: item.id, isCompleted: value === true })}
                />
                <label
                  htmlFor={`checklist-${item.id}`}
                  className={cn(
                    'flex-1 text-sm',
                    item.is_completed ? 'text-muted-foreground line-through' : 'cursor-pointer',
                  )}
                >
                  {item.title}
                </label>
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Remove ${item.title}`}
                    onClick={() => remove.mutate({ itemId: item.id })}
                  >
                    <X aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No checklist items yet.</p>
      )}

      {canEdit ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!title.trim()) return
            add.mutate({ title: title.trim() })
            setTitle('')
          }}
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Add a checklist item"
            className="h-8"
            aria-label="New checklist item"
          />
          <Button
            type="submit"
            size="icon-sm"
            variant="outline"
            aria-label="Add checklist item"
            disabled={!title.trim()}
          >
            <Plus aria-hidden />
          </Button>
        </form>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Subtasks                                                            */
/* ------------------------------------------------------------------ */

function SubtaskSection({
  taskId,
  organizationId,
  canCreate,
}: {
  taskId: string
  organizationId: string | null
  canCreate: boolean
}) {
  const { data: tasks } = useTasksByOrganization(organizationId ?? undefined)

  const subtasks = (tasks ?? [])
    .filter((task) => task.parent_task_id === taskId)
    .sort((a, b) => a.position - b.position)
  const done = subtasks.filter((task) => task.status.is_completed).length

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Subtasks</h3>
        {subtasks.length > 0 ? (
          <span className="text-xs text-muted-foreground tabular">
            {done}/{subtasks.length}
          </span>
        ) : null}
      </div>

      {subtasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No subtasks yet.</p>
      ) : (
        <ul className="space-y-1">
          {subtasks.map((subtask) => (
            <li key={subtask.id} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  subtask.status.is_completed ? 'bg-status-done' : 'bg-muted-foreground/40',
                )}
                aria-hidden
              />
              <span className={cn(subtask.status.is_completed && 'text-muted-foreground line-through')}>
                {subtask.title}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canCreate ? (
        <p className="text-xs text-muted-foreground">
          Break work down further from the create dialog by setting a parent task.
        </p>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Comments                                                            */
/* ------------------------------------------------------------------ */

interface CommentWithAuthor extends TaskCommentRow {
  profiles: { id: string; full_name: string | null; avatar_url: string | null } | null
}

type TaskCommentRow = { id: string; user_id: string; content: string; created_at: string }

function CommentsSection({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const userId = useCurrentUser()?.id
  const { data: comments, isPending } = useComments(taskId)
  const addComment = useAddComment(taskId)
  const deleteComment = useDeleteComment(taskId)
  const [content, setContent] = useState('')

  const list = (comments ?? []) as unknown as CommentWithAuthor[]

  const submit = () => {
    if (!content.trim() || !userId) return
    addComment.mutate(
      { content: content.trim(), userId, taskTitle },
      { onSuccess: () => setContent('') },
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="size-3.5 text-muted-foreground" aria-hidden />
        <h3 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Comments</h3>
        {list.length > 0 ? <span className="text-xs text-muted-foreground">{list.length}</span> : null}
      </div>

      {isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Start the conversation.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((comment) => (
            <li key={comment.id} className="group flex gap-2.5">
              <UserAvatar
                person={
                  comment.profiles
                    ? {
                        id: comment.profiles.id,
                        full_name: comment.profiles.full_name,
                        avatar_url: comment.profiles.avatar_url,
                      }
                    : null
                }
                size={26}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{comment.profiles?.full_name ?? 'Unknown'}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="mt-0.5 text-sm whitespace-pre-wrap">{comment.content}</p>
              </div>
              {comment.user_id === userId ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label="Delete comment"
                  onClick={() => deleteComment.mutate({ commentId: comment.id })}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex items-start gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Write a comment…"
          rows={2}
          className="min-h-16"
          aria-label="New comment"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              submit()
            }
          }}
        />
        <Button type="submit" size="sm" disabled={!content.trim() || !userId}>
          Comment
        </Button>
      </form>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Attachments                                                         */
/* ------------------------------------------------------------------ */

function AttachmentsSection({
  taskId,
  organizationId,
  canUpload,
}: {
  taskId: string
  organizationId: string
  canUpload: boolean
}) {
  const { data: attachments } = useAttachments(taskId)
  const userId = useCurrentUser()?.id
  const upload = useUploadAttachment(taskId, organizationId)
  const remove = useDeleteAttachment(taskId)
  const list = attachments ?? []

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Paperclip className="size-3.5 text-muted-foreground" aria-hidden />
        <h3 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Attachments</h3>
        {list.length > 0 ? <span className="text-xs text-muted-foreground">{list.length}</span> : null}
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files attached.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {list.map((file) => (
            <li key={file.id} className="flex items-center gap-2 px-3 py-2">
              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{file.file_name}</span>
              <span className="shrink-0 text-xs text-muted-foreground tabular">{formatBytes(file.file_size)}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${file.file_name}`}
                onClick={() => remove.mutate({ attachmentId: file.id, path: file.storage_path })}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {canUpload ? (
        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-primary hover:underline">
            <Upload className="size-3.5" aria-hidden />
            {upload.isPending ? 'Uploading…' : 'Upload a file'}
            <input
              type="file"
              className="sr-only"
              accept={ACCEPTED_UPLOAD_TYPES}
              disabled={upload.isPending || !userId}
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file || !userId) return
                if (file.size > MAX_ATTACHMENT_BYTES) {
                  toast.error('File is too large', {
                    description: `Maximum size is ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
                  })
                  return
                }
                upload.mutate({ file, userId })
              }}
            />
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Up to {formatBytes(MAX_ATTACHMENT_BYTES)} per file.
          </p>
        </div>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

function TaskActivity({ taskId }: { taskId: string }) {
  const { data } = useActivity(200)
  const entries = (data ?? []).filter((entry) => entry.entity_id === taskId).slice(0, 8)

  if (entries.length === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Clock className="size-3.5 text-muted-foreground" aria-hidden />
        <h3 className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">Activity</h3>
      </div>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-start gap-2 text-xs">
            <UserAvatar person={entry.profiles ?? null} size={18} className="mt-0.5" />
            <span className="min-w-0 flex-1 text-muted-foreground">
              <span className="font-medium text-foreground">{entry.profiles?.full_name ?? 'Someone'}</span>{' '}
              {describeActivity(entry.action, entry.metadata)}{' '}
              <span className="opacity-70">
                {formatDistanceToNowStrict(new Date(entry.created_at), { addSuffix: true })}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function describeActivity(action: ActivityAction, metadata: Record<string, unknown>): string {
  const from = typeof metadata.from === 'string' ? metadata.from : null
  const to = typeof metadata.to === 'string' ? metadata.to : null

  switch (action) {
    case 'created':
      return 'created this task'
    case 'status_changed':
      return `changed status${from && to ? ` from ${from} to ${to}` : ''}`
    case 'assigned':
      return 'assigned this task'
    case 'unassigned':
      return 'removed the assignee'
    case 'due_date_changed':
      return `changed the due date to ${to ?? 'none'}`
    case 'priority_changed':
      return `changed the priority to ${to ?? 'none'}`
    case 'commented':
      return 'commented'
    case 'deleted':
      return 'deleted this task'
    default:
      return 'updated this task'
  }
}

export type { ActivityLog }