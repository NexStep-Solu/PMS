/**
 * Demo dataset for the in-memory backend.
 *
 * Gives a reviewer a realistic, always-fresh workspace: two organisations,
 * five members, four projects and ~30 tasks spanning every status, priority
 * and date bucket so dashboards, boards and reports are meaningful.
 */

import type { TableName } from '@/types/database'

type Row = Record<string, unknown>

export const DEMO_PASSWORD = 'password123'

export const DEMO_USERS = [
  { id: 'u-arkar', email: 'arkarmin@pms.dev', fullName: 'Arkar Min', role: 'owner' as const },
  { id: 'u-min', email: 'min@pms.dev', fullName: 'Min Thiha', role: 'admin' as const },
  { id: 'u-dana', email: 'dana@pms.dev', fullName: 'Dana Lim', role: 'manager' as const },
  { id: 'u-joe', email: 'joe@pms.dev', fullName: 'Joe Park', role: 'member' as const },
  { id: 'u-sam', email: 'sam@pms.dev', fullName: 'Sam Rivera', role: 'viewer' as const },
  { id: 'u-elle', email: 'elle@pms.dev', fullName: 'Elle Moreau', role: 'owner' as const },
]

const ORG_NEXT = 'org-nextstep'
const ORG_ART = 'org-artificium'

const daysFromNow = (days: number): string => {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const daysAgo = (days: number, hour = 10): string => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(hour, 15, 0, 0)
  return date.toISOString()
}

const NOW = new Date().toISOString()

const STATUS = {
  backlog: 'st-backlog',
  todo: 'st-todo',
  progress: 'st-progress',
  review: 'st-review',
  done: 'st-done',
  cancelled: 'st-cancelled',
} as const

const PRIORITY = {
  urgent: 'pr-urgent',
  high: 'pr-high',
  medium: 'pr-medium',
  low: 'pr-low',
} as const

const LABEL = {
  backend: 'lb-backend',
  frontend: 'lb-frontend',
  auth: 'lb-auth',
  bug: 'lb-bug',
  docs: 'lb-docs',
  design: 'lb-design',
  infra: 'lb-infra',
} as const

const PROJECTS = {
  web: 'prj-web',
  mobile: 'prj-mobile',
  erp: 'prj-erp',
  design: 'prj-design',
} as const

interface TaskSeed {
  key: string
  title: string
  project: string
  status: keyof typeof STATUS
  priority?: keyof typeof PRIORITY
  assignee?: string
  reporter?: string
  start?: number
  due?: number
  labels?: (keyof typeof LABEL)[]
  points?: number
  description?: string
  subtasks?: string[]
}

const TASK_SEEDS: TaskSeed[] = [
  {
    key: 't1',
    title: 'Set up Supabase project and RLS policies',
    project: PROJECTS.web,
    status: 'done',
    priority: 'urgent',
    assignee: 'u-arkar',
    reporter: 'u-arkar',
    start: -18,
    due: -12,
    labels: ['backend', 'infra'],
    points: 5,
    description:
      'Create the Supabase project, enable Row Level Security on every table and verify tenant isolation with at least two test accounts.',
    subtasks: ['Create project', 'Write migration', 'Verify with test users'],
  },
  {
    key: 't2',
    title: 'Design the authentication screens',
    project: PROJECTS.web,
    status: 'done',
    priority: 'medium',
    assignee: 'u-min',
    reporter: 'u-arkar',
    start: -16,
    due: -10,
    labels: ['design', 'frontend'],
    points: 3,
  },
  {
    key: 't3',
    title: 'Implement email + password sign in',
    project: PROJECTS.web,
    status: 'done',
    priority: 'high',
    assignee: 'u-joe',
    reporter: 'u-min',
    start: -11,
    due: -6,
    labels: ['auth', 'frontend'],
    points: 5,
  },
  {
    key: 't4',
    title: 'Organisation switcher with active workspace persistence',
    project: PROJECTS.web,
    status: 'review',
    priority: 'high',
    assignee: 'u-arkar',
    reporter: 'u-arkar',
    start: -6,
    due: 2,
    labels: ['frontend'],
    points: 5,
    description: 'Switching workspaces should persist across reloads and update every scoped query.',
    subtasks: ['Switcher dropdown', 'Persist selection', 'Refetch scoped queries'],
  },
  {
    key: 't5',
    title: 'Kanban board with drag and drop',
    project: PROJECTS.web,
    status: 'progress',
    priority: 'urgent',
    assignee: 'u-joe',
    reporter: 'u-arkar',
    start: -4,
    due: 4,
    labels: ['frontend'],
    points: 8,
    subtasks: ['Columns', 'Drag sensor', 'Optimistic reorder'],
  },
  {
    key: 't6',
    title: 'Task detail drawer with comments and attachments',
    project: PROJECTS.web,
    status: 'progress',
    priority: 'high',
    assignee: 'u-min',
    reporter: 'u-arkar',
    start: -3,
    due: 5,
    labels: ['frontend', 'backend'],
    points: 8,
  },
  {
    key: 't7',
    title: 'Global search command menu',
    project: PROJECTS.web,
    status: 'todo',
    priority: 'medium',
    assignee: 'u-arkar',
    reporter: 'u-arkar',
    start: 3,
    due: 10,
    labels: ['frontend'],
    points: 5,
  },
  {
    key: 't8',
    title: 'Fix timezone drift in calendar view',
    project: PROJECTS.web,
    status: 'todo',
    priority: 'high',
    assignee: 'u-dana',
    reporter: 'u-min',
    start: 1,
    due: 3,
    labels: ['bug', 'frontend'],
    points: 3,
    description: 'Tasks after 18:00 SGT render on the previous day in month view.',
  },
  {
    key: 't9',
    title: 'Notification centre and realtime updates',
    project: PROJECTS.web,
    status: 'backlog',
    priority: 'medium',
    assignee: 'u-min',
    reporter: 'u-arkar',
    labels: ['backend'],
    points: 5,
  },
  {
    key: 't10',
    title: 'Write the onboarding guide',
    project: PROJECTS.web,
    status: 'backlog',
    priority: 'low',
    assignee: 'u-sam',
    reporter: 'u-arkar',
    labels: ['docs'],
    points: 2,
  },
  {
    key: 't11',
    title: 'Offline mode for the mobile app',
    project: PROJECTS.mobile,
    status: 'backlog',
    priority: 'low',
    assignee: 'u-dana',
    reporter: 'u-dana',
    labels: ['frontend'],
    points: 8,
  },
  {
    key: 't12',
    title: 'Design the mobile navigation',
    project: PROJECTS.mobile,
    status: 'todo',
    priority: 'medium',
    assignee: 'u-min',
    reporter: 'u-dana',
    start: 0,
    due: 6,
    labels: ['design'],
    points: 3,
  },
  {
    key: 't13',
    title: 'Push notification permissions flow',
    project: PROJECTS.mobile,
    status: 'todo',
    priority: 'high',
    assignee: 'u-joe',
    reporter: 'u-dana',
    start: 2,
    due: 9,
    labels: ['frontend'],
    points: 5,
  },
  {
    key: 't14',
    title: 'Sync engine for offline task edits',
    project: PROJECTS.mobile,
    status: 'progress',
    priority: 'urgent',
    assignee: 'u-arkar',
    reporter: 'u-dana',
    start: -5,
    due: 1,
    labels: ['backend'],
    points: 13,
    subtasks: ['Conflict resolution', 'Retry queue', 'Status flags'],
  },
  {
    key: 't15',
    title: 'Reduce cold start time below 2s',
    project: PROJECTS.mobile,
    status: 'review',
    priority: 'medium',
    assignee: 'u-joe',
    reporter: 'u-dana',
    start: -2,
    due: 4,
    labels: ['bug'],
    points: 5,
  },
  {
    key: 't16',
    title: 'Inventory import mapping',
    project: PROJECTS.erp,
    status: 'progress',
    priority: 'high',
    assignee: 'u-dana',
    reporter: 'u-arkar',
    start: -8,
    due: 7,
    labels: ['backend'],
    points: 8,
  },
  {
    key: 't17',
    title: 'Chart of accounts migration',
    project: PROJECTS.erp,
    status: 'todo',
    priority: 'urgent',
    assignee: 'u-arkar',
    reporter: 'u-arkar',
    start: 4,
    due: 12,
    labels: ['backend', 'infra'],
    points: 13,
  },
  {
    key: 't18',
    title: 'Audit the existing permission matrix',
    project: PROJECTS.erp,
    status: 'done',
    priority: 'medium',
    assignee: 'u-sam',
    reporter: 'u-arkar',
    start: -14,
    due: -8,
    labels: ['docs'],
    points: 3,
  },
  {
    key: 't19',
    title: 'Design system colour tokens',
    project: PROJECTS.design,
    status: 'done',
    priority: 'medium',
    assignee: 'u-min',
    reporter: 'u-arkar',
    start: -20,
    due: -15,
    labels: ['design'],
    points: 5,
  },
  {
    key: 't20',
    title: 'Status and priority badge components',
    project: PROJECTS.design,
    status: 'done',
    priority: 'low',
    assignee: 'u-min',
    reporter: 'u-arkar',
    start: -13,
    due: -9,
    labels: ['design', 'frontend'],
    points: 3,
  },
  {
    key: 't21',
    title: 'Data table density options',
    project: PROJECTS.design,
    status: 'review',
    priority: 'low',
    assignee: 'u-sam',
    reporter: 'u-min',
    start: -1,
    due: 8,
    labels: ['design', 'frontend'],
    points: 2,
  },
  {
    key: 't22',
    title: 'Dark mode contrast audit',
    project: PROJECTS.design,
    status: 'todo',
    priority: 'medium',
    assignee: 'u-min',
    reporter: 'u-arkar',
    start: 5,
    due: 14,
    labels: ['design'],
    points: 3,
  },
  {
    key: 't23',
    title: 'Iconography review',
    project: PROJECTS.design,
    status: 'backlog',
    priority: 'low',
    assignee: undefined,
    reporter: 'u-min',
    labels: ['design'],
    points: 2,
  },
  {
    key: 't24',
    title: 'Optimise bundle size for first load',
    project: PROJECTS.web,
    status: 'todo',
    priority: 'medium',
    assignee: 'u-joe',
    reporter: 'u-arkar',
    start: 6,
    due: 15,
    labels: ['infra', 'frontend'],
    points: 5,
  },
  {
    key: 't25',
    title: 'Keyboard shortcut for quick task creation',
    project: PROJECTS.web,
    status: 'cancelled',
    priority: 'low',
    assignee: 'u-arkar',
    reporter: 'u-arkar',
    labels: ['frontend'],
    points: 1,
  },
  {
    key: 't26',
    title: 'Legacy report export endpoint',
    project: PROJECTS.erp,
    status: 'cancelled',
    priority: 'low',
    assignee: 'u-dana',
    reporter: 'u-arkar',
    labels: ['backend'],
    points: 3,
  },
]

export function createSeedData(): Record<TableName, Row[]> {
  const profiles: Row[] = DEMO_USERS.map((user, index) => ({
    id: user.id,
    full_name: user.fullName,
    avatar_url: null,
    timezone: index % 2 === 0 ? 'Asia/Singapore' : 'Asia/Yangon',
    created_at: daysAgo(90 - index * 3),
    updated_at: NOW,
  }))

  const organizations: Row[] = [
    {
      id: ORG_NEXT,
      name: 'NextStep',
      slug: 'nextstep',
      logo_url: null,
      created_by: 'u-arkar',
      created_at: daysAgo(88),
      updated_at: NOW,
    },
    {
      id: ORG_ART,
      name: 'Artificium',
      slug: 'artificium',
      logo_url: null,
      created_by: 'u-elle',
      created_at: daysAgo(40),
      updated_at: NOW,
    },
  ]

  const membership: Array<[string, string, string, string]> = [
    ['u-arkar', ORG_NEXT, 'owner', '-88'],
    ['u-min', ORG_NEXT, 'admin', '-85'],
    ['u-dana', ORG_NEXT, 'manager', '-70'],
    ['u-joe', ORG_NEXT, 'member', '-45'],
    ['u-sam', ORG_NEXT, 'viewer', '-20'],
    ['u-elle', ORG_ART, 'owner', '-40'],
    ['u-arkar', ORG_ART, 'admin', '-38'],
  ]

  const organization_members: Row[] = membership.map(([user, org, role, offset], index) => ({
    id: `om-${index}`,
    organization_id: org,
    user_id: user,
    role,
    joined_at: daysAgo(Number(offset)),
  }))

  const organization_invitations: Row[] = [
    {
      id: 'inv-1',
      organization_id: ORG_NEXT,
      email: 'new.hire@pms.dev',
      role: 'member',
      token: 'tok-demo-invite-1',
      invited_by: 'u-arkar',
      status: 'pending',
      expires_at: daysAgo(-6),
      accepted_at: null,
      created_at: daysAgo(2),
    },
  ]

  const teams: Row[] = [
    {
      id: 'team-platform',
      organization_id: ORG_NEXT,
      name: 'Platform',
      description: 'Infrastructure, data and integrations.',
      created_at: daysAgo(70),
      updated_at: NOW,
    },
    {
      id: 'team-product',
      organization_id: ORG_NEXT,
      name: 'Product',
      description: 'Customer-facing web and mobile experiences.',
      created_at: daysAgo(70),
      updated_at: NOW,
    },
    {
      id: 'team-design',
      organization_id: ORG_NEXT,
      name: 'Design',
      description: 'Brand, design system and content.',
      created_at: daysAgo(60),
      updated_at: NOW,
    },
  ]

  const team_members: Row[] = [
    ['tm-1', 'team-platform', 'u-arkar'],
    ['tm-2', 'team-platform', 'u-dana'],
    ['tm-3', 'team-product', 'u-joe'],
    ['tm-4', 'team-product', 'u-min'],
    ['tm-5', 'team-design', 'u-min'],
    ['tm-6', 'team-design', 'u-sam'],
  ].map(([id, team, user], index) => ({
    id,
    team_id: team,
    user_id: user,
    created_at: daysAgo(60 - index),
  }))

  const projects: Row[] = [
    {
      id: PROJECTS.web,
      organization_id: ORG_NEXT,
      name: 'NextStep Website',
      key: 'WEB',
      description: 'Marketing site and documentation hub for the NextStep launch.',
      status: 'active',
      priority: 'high',
      start_date: daysFromNow(-18),
      due_date: daysFromNow(24),
      owner_id: 'u-arkar',
      created_by: 'u-arkar',
      created_at: daysAgo(18),
      updated_at: daysAgo(1, 16),
    },
    {
      id: PROJECTS.mobile,
      organization_id: ORG_NEXT,
      name: 'Mobile Companion',
      key: 'MOB',
      description: 'iOS and Android companion app with offline support.',
      status: 'active',
      priority: 'urgent',
      start_date: daysFromNow(-12),
      due_date: daysFromNow(38),
      owner_id: 'u-dana',
      created_by: 'u-dana',
      created_at: daysAgo(12),
      updated_at: daysAgo(2, 9),
    },
    {
      id: PROJECTS.erp,
      organization_id: ORG_NEXT,
      name: 'ERP Rollout',
      key: 'ERP',
      description: 'Migrate finance and inventory workflows onto the new platform.',
      status: 'on_hold',
      priority: 'high',
      start_date: daysFromNow(-30),
      due_date: daysFromNow(60),
      owner_id: 'u-arkar',
      created_by: 'u-arkar',
      created_at: daysAgo(30),
      updated_at: daysAgo(4, 11),
    },
    {
      id: PROJECTS.design,
      organization_id: ORG_NEXT,
      name: 'Design System',
      key: 'DSG',
      description: 'Shared tokens, components and documentation.',
      status: 'completed',
      priority: 'medium',
      start_date: daysFromNow(-24),
      due_date: daysFromNow(-9),
      owner_id: 'u-min',
      created_by: 'u-arkar',
      created_at: daysAgo(24),
      updated_at: daysAgo(9, 14),
    },
    {
      id: 'prj-art-site',
      organization_id: ORG_ART,
      name: 'Artificium Site',
      key: 'ART',
      description: 'Studio portfolio rebuild.',
      status: 'planned',
      priority: 'medium',
      start_date: daysFromNow(7),
      due_date: daysFromNow(45),
      owner_id: 'u-elle',
      created_by: 'u-elle',
      created_at: daysAgo(20),
      updated_at: daysAgo(5, 10),
    },
  ]

  const project_members: Row[] = [
    [PROJECTS.web, 'u-arkar', 'owner'],
    [PROJECTS.web, 'u-min', 'manager'],
    [PROJECTS.web, 'u-joe', 'member'],
    [PROJECTS.web, 'u-sam', 'viewer'],
    [PROJECTS.mobile, 'u-dana', 'owner'],
    [PROJECTS.mobile, 'u-joe', 'member'],
    [PROJECTS.mobile, 'u-arkar', 'member'],
    [PROJECTS.erp, 'u-arkar', 'owner'],
    [PROJECTS.erp, 'u-dana', 'member'],
    [PROJECTS.design, 'u-min', 'owner'],
    [PROJECTS.design, 'u-sam', 'member'],
    ['prj-art-site', 'u-elle', 'owner'],
  ].map(([project, user, role], index) => ({
    id: `pm-${index}`,
    project_id: project,
    user_id: user,
    role,
    created_at: daysAgo(20 - index),
  }))

  const statusNames: Array<[string, string, string, boolean, number]> = [
    [STATUS.backlog, 'Backlog', 'backlog', false, 1],
    [STATUS.todo, 'Todo', 'todo', false, 2],
    [STATUS.progress, 'In Progress', 'in_progress', false, 3],
    [STATUS.review, 'Review', 'review', false, 4],
    [STATUS.done, 'Done', 'done', true, 5],
    [STATUS.cancelled, 'Cancelled', 'cancelled', true, 6],
  ]

  const task_statuses: Row[] = [
    ...statusNames.map(([id, name, category, isCompleted, position], index) => ({
      id,
      organization_id: ORG_NEXT,
      project_id: null,
      name,
      key: name.replace(/\s+/g, '_').toLowerCase(),
      category,
      color: null,
      position,
      is_default: position === 2,
      is_completed: isCompleted,
      created_at: daysAgo(85 - index),
    })),
    ...statusNames.map(([id, name, category, isCompleted, position]) => ({
      id: `${id}-art`,
      organization_id: ORG_ART,
      project_id: null,
      name,
      key: name.replace(/\s+/g, '_').toLowerCase(),
      category,
      color: null,
      position,
      is_default: position === 2,
      is_completed: isCompleted,
      created_at: daysAgo(38),
    })),
  ]

  const priorities: Row[] = [
    [PRIORITY.urgent, 'Urgent', 'urgent', 1],
    [PRIORITY.high, 'High', 'high', 2],
    [PRIORITY.medium, 'Medium', 'medium', 3],
    [PRIORITY.low, 'Low', 'low', 4],
  ].flatMap(([id, name, key, level]) =>
    [ORG_NEXT, ORG_ART].map((org) => ({
      id: org === ORG_NEXT ? id : `${id}-art`,
      organization_id: org,
      name,
      key,
      level,
      position: level,
      created_at: daysAgo(85),
    })),
  )

  const labels: Row[] = [
    [LABEL.backend, 'backend', '#3b82f6'],
    [LABEL.frontend, 'frontend', '#8b5cf6'],
    [LABEL.auth, 'auth', '#0ea5e9'],
    [LABEL.bug, 'bug', '#ef4444'],
    [LABEL.docs, 'docs', '#64748b'],
    [LABEL.design, 'design', '#ec4899'],
    [LABEL.infra, 'infra', '#f59e0b'],
  ].flatMap(([id, name, color]) =>
    [ORG_NEXT, ORG_ART].map((org) => ({
      id: org === ORG_NEXT ? id : `${id}-art`,
      organization_id: org,
      name,
      color,
      created_at: daysAgo(85),
    })),
  )

  const tasks: Row[] = TASK_SEEDS.map((seed, index) => ({
    id: seed.key,
    organization_id: seed.project === 'prj-art-site' ? ORG_ART : ORG_NEXT,
    project_id: seed.project,
    parent_task_id: null,
    title: seed.title,
    description: seed.description ?? null,
    status_id: seed.project === 'prj-art-site' ? `${STATUS[seed.status]}-art` : STATUS[seed.status],
    priority_id: seed.project === 'prj-art-site' ? null : PRIORITY[seed.priority ?? 'medium'],
    assignee_id: seed.assignee ?? null,
    reporter_id: seed.reporter ?? (seed.project === 'prj-art-site' ? 'u-elle' : 'u-arkar'),
    start_date: seed.start === undefined ? null : daysFromNow(seed.start),
    due_date: seed.due === undefined ? null : daysFromNow(seed.due),
    estimated_minutes: seed.points ? seed.points * 60 : null,
    position: index + 1,
    completed_at: seed.status === 'done' ? daysAgo(Math.abs((seed.due ?? -1) + 1)) : null,
    created_at: daysAgo(20 - (index % 14)),
    updated_at: daysAgo(index % 9, 9 + (index % 8)),
  }))

  const task_labels: Row[] = TASK_SEEDS.flatMap((seed, index) =>
    (seed.labels ?? []).map((label, position) => ({
      task_id: seed.key,
      label_id: seed.project === 'prj-art-site' ? `${label}-art` : label,
      created_at: daysAgo(18 - index),
      position,
    })),
  )

  const task_comments: Row[] = [
    ['c1', 't5', 'u-arkar', 'Nice. Keep the drop indicator visible while dragging so people know where the card will land.', 3],
    ['c2', 't5', 'u-joe', 'Done — added a subtle placeholder row instead.', 2],
    ['c3', 't8', 'u-min', 'Reproduced on Firefox too, so it is probably our date parsing rather than the browser.', 1],
    ['c4', 't14', 'u-dana', 'Conflict resolution is the risky part. Let us spike it before we commit.', 4],
    ['c5', 't4', 'u-min', 'Workspace switcher should remember the last project you were on.', 5],
    ['c6', 't17', 'u-arkar', 'Needs sign-off from finance before we start the migration.', 7],
    ['c7', 't15', 'u-joe', 'Cold start is now 2.4s on a mid-range Android device.', 2],
  ].map(([id, task, user, content, offset]) => ({
    id: id as string,
    task_id: task as string,
    user_id: user as string,
    content: content as string,
    created_at: daysAgo(offset as number, 14),
    updated_at: daysAgo(offset as number, 14),
  }))

  const task_checklists: Row[] = [
    ['ck1', 't1', 'Create Supabase project', 1, true],
    ['ck2', 't1', 'Write the migration', 2, true],
    ['ck3', 't1', 'Verify with two test accounts', 3, true],
    ['ck4', 't5', 'Column layout', 1, true],
    ['ck5', 't5', 'Drag sensor', 2, true],
    ['ck6', 't5', 'Optimistic reorder', 3, false],
    ['ck7', 't14', 'Conflict resolution', 1, false],
    ['ck8', 't14', 'Retry queue', 2, false],
    ['ck9', 't17', 'Finance sign-off', 1, false],
  ].flatMap(([id, task, title, position, done]) => {
    const base = {
      task_id: task as string,
      title: title as string,
      position: position as number,
      is_completed: done as boolean,
    }
    return [
      { id: id as string, ...base },
      { id: `${id as string}-s2`, ...base, title: `${title as string} (verification)`, position: (position as number) + 10 },
    ]
  })

  const milestones: Row[] = [
    {
      id: 'ms-1',
      organization_id: ORG_NEXT,
      project_id: PROJECTS.web,
      name: 'Beta launch',
      description: 'Invite-only beta with the first 50 teams.',
      due_date: daysFromNow(9),
      status: 'in_progress',
      position: 1,
      created_at: daysAgo(18),
      updated_at: daysAgo(2),
    },
    {
      id: 'ms-2',
      organization_id: ORG_NEXT,
      project_id: PROJECTS.web,
      name: 'Public launch',
      description: null,
      due_date: daysFromNow(24),
      status: 'planned',
      position: 2,
      created_at: daysAgo(18),
      updated_at: daysAgo(18),
    },
    {
      id: 'ms-3',
      organization_id: ORG_NEXT,
      project_id: PROJECTS.mobile,
      name: 'Store submission',
      description: 'Ship the 1.0 build to both stores.',
      due_date: daysFromNow(30),
      status: 'planned',
      position: 1,
      created_at: daysAgo(12),
      updated_at: daysAgo(12),
    },
    {
      id: 'ms-4',
      organization_id: ORG_NEXT,
      project_id: PROJECTS.erp,
      name: 'Finance go-live',
      description: null,
      due_date: daysFromNow(52),
      status: 'planned',
      position: 1,
      created_at: daysAgo(30),
      updated_at: daysAgo(30),
    },
  ]

  const time_entries: Row[] = [
    ['te-1', PROJECTS.web, 't5', 'u-joe', -1, 150, 'Drag and drop wiring'],
    ['te-2', PROJECTS.web, 't6', 'u-min', -2, 210, 'Comments composer'],
    ['te-3', PROJECTS.mobile, 't14', 'u-arkar', -3, 240, 'Conflict resolution spike'],
    ['te-4', PROJECTS.erp, 't16', 'u-dana', -4, 180, 'Import mapping'],
    ['te-5', PROJECTS.web, 't4', 'u-arkar', -5, 120, 'Workspace switcher'],
    ['te-6', PROJECTS.design, 't21', 'u-sam', -6, 90, 'Density options'],
    ['te-7', PROJECTS.mobile, 't15', 'u-joe', -7, 135, 'Cold start profiling'],
    ['te-8', PROJECTS.web, 't3', 'u-joe', -8, 200, 'Sign in flow'],
  ].map(([id, project, task, user, offset, minutes, description], index) => {
    const startedAt = daysAgo(offset as number, 9)
    const start = new Date(startedAt)
    const end = new Date(start.getTime() + (minutes as number) * 60_000)
    return {
      id: id as string,
      organization_id: ORG_NEXT,
      project_id: project as string,
      task_id: task as string,
      user_id: user as string,
      started_at: startedAt,
      ended_at: end.toISOString(),
      duration_minutes: minutes,
      description: description as string,
      is_running: false,
      created_at: startedAt,
      position: index,
    }
  })

  const runningEntry = {
    id: 'te-running',
    organization_id: ORG_NEXT,
    project_id: PROJECTS.web,
    task_id: 't4',
    user_id: 'u-arkar',
    started_at: new Date(Date.now() - 22 * 60_000).toISOString(),
    ended_at: null,
    duration_minutes: null,
    description: 'Workspace switcher polish',
    is_running: true,
    created_at: new Date().toISOString(),
  }

  const notifications: Row[] = [
    {
      id: 'nt-1',
      user_id: 'u-arkar',
      organization_id: ORG_NEXT,
      type: 'task_assigned',
      title: 'Min assigned you "Organisation switcher with active workspace persistence"',
      message: null,
      data: { task_id: 't4', project_id: PROJECTS.web },
      read_at: null,
      created_at: daysAgo(0, 8),
    },
    {
      id: 'nt-2',
      user_id: 'u-arkar',
      organization_id: ORG_NEXT,
      type: 'comment_added',
      title: 'Min commented on "Organisation switcher with active workspace persistence"',
      message: 'Workspace switcher should remember the last project you were on.',
      data: { task_id: 't4' },
      read_at: null,
      created_at: daysAgo(0, 13),
    },
    {
      id: 'nt-3',
      user_id: 'u-arkar',
      organization_id: ORG_NEXT,
      type: 'task_due_soon',
      title: '"Sync engine for offline task edits" is due tomorrow',
      message: null,
      data: { task_id: 't14', project_id: PROJECTS.mobile },
      read_at: null,
      created_at: daysAgo(1, 9),
    },
    {
      id: 'nt-4',
      user_id: 'u-arkar',
      organization_id: ORG_NEXT,
      type: 'milestone_approaching',
      title: 'Beta launch is due in 9 days',
      message: null,
      data: { milestone_id: 'ms-1' },
      read_at: daysAgo(0, 9),
      created_at: daysAgo(1, 17),
    },
    {
      id: 'nt-5',
      user_id: 'u-arkar',
      organization_id: ORG_NEXT,
      type: 'task_mentioned',
      title: 'Dana mentioned you in a comment',
      message: 'Can you take a look at the risk on this one?',
      data: { task_id: 't17' },
      read_at: daysAgo(2, 12),
      created_at: daysAgo(2, 12),
    },
  ]

  const activity_logs: Row[] = [
    ['al-1', 'u-arkar', 'task', 't5', 'status_changed', { from: 'Todo', to: 'In Progress' }, 0, 11],
    ['al-2', 'u-joe', 'task', 't5', 'updated', { fields: ['title'] }, 0, 10],
    ['al-3', 'u-min', 'comment', 'c5', 'created', {}, 0, 13],
    ['al-4', 'u-arkar', 'task', 't4', 'assigned', { assignee: 'Min Thiha' }, 1, 9],
    ['al-5', 'u-dana', 'project', PROJECTS.erp, 'status_changed', { from: 'Active', to: 'On hold' }, 4, 11],
    ['al-6', 'u-arkar', 'milestone', 'ms-1', 'created', { name: 'Beta launch' }, 3, 16],
    ['al-7', 'u-min', 'task', 't22', 'created', { title: 'Dark mode contrast audit' }, 2, 14],
    ['al-8', 'u-sam', 'task', 't18', 'status_changed', { from: 'Review', to: 'Done' }, 8, 12],
    ['al-9', 'u-arkar', 'member', 'u-sam', 'member_added', { member: 'Sam Rivera' }, 20, 10],
    ['al-10', 'u-dana', 'task', 't16', 'updated', { fields: ['due_date'] }, 1, 18],
    ['al-11', 'u-joe', 'task', 't3', 'status_changed', { from: 'Review', to: 'Done' }, 6, 15],
    ['al-12', 'u-arkar', 'project', PROJECTS.web, 'updated', { fields: ['description'] }, 5, 10],
  ].map(([id, user, entity, entityId, action, metadata, offset, hour]) => ({
    id: id as string,
    organization_id: ORG_NEXT,
    user_id: user as string,
    entity_type: entity as string,
    entity_id: entityId as string,
    action: action as string,
    metadata: metadata as Row,
    created_at: daysAgo(offset as number, hour as number),
  }))

  return {
    profiles,
    organizations,
    organization_members,
    organization_invitations,
    teams,
    team_members,
    projects,
    project_members,
    task_statuses,
    priorities,
    labels,
    tasks,
    task_labels,
    task_comments,
    task_checklists,
    task_attachments: [],
    project_files: [],
    milestones,
    time_entries: [...time_entries, runningEntry],
    notifications,
    activity_logs,
  }
}