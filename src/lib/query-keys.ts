/**
 * Canonical TanStack Query keys.
 *
 * Keys are nested arrays so a mutation can invalidate exactly the slice it
 * touched (`queryClient.invalidateQueries({ queryKey: keys.tasks.list(org) })`).
 */

export const keys = {
  session: ['session'] as const,
  profile: (userId: string) => ['profile', userId] as const,
  workspaces: ['workspaces'] as const,

  members: (org: string) => ['org', org, 'members'] as const,
  invitations: (org: string) => ['org', org, 'invitations'] as const,
  report: (org: string) => ['org', org, 'report'] as const,
  invitationPreview: (token: string) => ['invitation', token] as const,
  teams: (org: string) => ['org', org, 'teams'] as const,
  teamMembers: (teamId: string) => ['team', teamId, 'members'] as const,
  organization: (org: string) => ['org', org] as const,

  statuses: (org: string) => ['org', org, 'statuses'] as const,
  priorities: (org: string) => ['org', org, 'priorities'] as const,
  labels: (org: string) => ['org', org, 'labels'] as const,

  projects: (org: string) => ['org', org, 'projects'] as const,
  project: (projectId: string) => ['project', projectId] as const,
  projectMembers: (projectId: string) => ['project', projectId, 'members'] as const,
  projectFiles: (projectId: string) => ['project', projectId, 'files'] as const,

  tasks: (org: string) => ['org', org, 'tasks'] as const,
  projectTasks: (projectId: string) => ['project', projectId, 'tasks'] as const,
  task: (taskId: string) => ['task', taskId] as const,
  taskDetail: (taskId: string) => ['task', taskId, 'detail'] as const,
  comments: (taskId: string) => ['task', taskId, 'comments'] as const,
  checklists: (taskId: string) => ['task', taskId, 'checklists'] as const,
  attachments: (taskId: string) => ['task', taskId, 'attachments'] as const,
  taskLabels: (taskId: string) => ['task', taskId, 'labels'] as const,

  milestones: (projectId: string) => ['project', projectId, 'milestones'] as const,
  orgMilestones: (org: string) => ['org', org, 'milestones'] as const,

  timeEntries: (org: string) => ['org', org, 'time'] as const,
  runningEntry: (userId: string) => ['org', 'time', 'running', userId] as const,

  notifications: (userId: string) => ['notifications', userId] as const,
  activity: (org: string) => ['org', org, 'activity'] as const,
  entityActivity: (entityId: string) => ['entity', entityId, 'activity'] as const,
  dashboard: (org: string) => ['org', org, 'dashboard'] as const,
} as const