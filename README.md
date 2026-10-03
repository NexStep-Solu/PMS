# PMS — Project Management System

A multi-tenant project management system for software teams: projects, tasks
with subtasks, a Kanban board, list/calendar/timeline views, milestones,
comments, attachments, time tracking, notifications, activity logs and
role-based permissions.

Built to `PMS_START.md` (engineering spec) and `PMS_DESIGN.md` (UI/UX spec).

---

## Stack

| Layer | Choice |
| --- | --- |
| Build | Vite 8 + TypeScript (strict, `noUncheckedIndexedAccess`) |
| UI | React 19, React Router 7, Tailwind CSS v4, shadcn/ui (Radix) |
| Server state | TanStack Query v5 + TanStack Table v8 |
| Forms | React Hook Form + Zod |
| Interaction | dnd-kit (Kanban), cmdk (command palette), Sonner (toasts) |
| Charts | Recharts |
| Backend | Supabase (Postgres, Auth, RLS, Storage, Realtime) |

---

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. With no environment file the app runs against an
**in-memory demo backend** — a full workspace with two organisations, five
members, four projects and ~30 tasks, so every screen has something real to
show. Sign in with any of:

| Email | Role |
| --- | --- |
| `arkarmin@pms.dev` | Owner of NextStep, Admin of Artificium |
| `min@pms.dev` | Admin |
| `dana@pms.dev` | Manager |
| `joe@pms.dev` | Member |
| `sam@pms.dev` | Viewer |
| `elle@pms.dev` | Owner of Artificium |

Password for all of them: `password123`

### Connecting Supabase

```bash
cp .env.example .env.local   # then fill in the two values
supabase db push             # apply supabase/migrations/0001_init.sql
```

After that the app talks to Postgres and **Row Level Security is the security
boundary** — the browser only ever receives the anon key.

---

## Scripts

```bash
npm run dev            # dev server
npm run build          # typecheck + production build
npm run typecheck      # tsc, no emit
npm run lint           # eslint
npm run test           # vitest (unit + integration + app flow)
npm run test:watch     # vitest in watch mode
npm run check          # typecheck + lint + test
```

---

## Architecture

```
src/
├── app/                 router, providers, query client
├── components/
│   ├── ui/              shadcn/ui primitives
│   ├── layout/          app shell, sidebar, topbar, command palette
│   ├── shared/          badges, avatars, date picker, states, page header
│   ├── data-table/      generic TanStack Table wrapper
│   └── forms/          React Hook Form + Zod bindings
├── features/            one folder per product area
│   ├── auth/            session, profile, workspaces, login/register/reset
│   ├── organizations/   members, teams, workspace context, settings
│   ├── projects/        list, overview, project members, files
│   ├── tasks/           CRUD, subtasks, board, list, calendar, timeline, drawer
│   ├── milestones/  time-tracking/  reports/  dashboard/  activity/  notifications/
├── hooks/               theme, debounce
├── lib/
│   ├── client.ts        the single data client
│   ├── db/              data-access contract, Supabase adapter, demo backend
│   ├── permissions.ts   role → permission matrix
│   ├── query-keys.ts    one place for every cache key
│   └── utils.ts  constants.ts
├── schemas/             shared Zod schemas
├── test/                vitest suites
└── types/database.ts    canonical row types
```

### One data client, two backends

Features never import Supabase directly. They use the `DatabaseClient`
contract in `src/lib/db/contract.ts` — a narrow subset of the Supabase JS API
(filters, `or()`, ordering, pagination, embedded resources, auth, storage,
realtime). Two implementations satisfy it:

- `src/lib/db/supabase-adapter.ts` — the real client, with errors normalised
  into a single `AppError` shape.
- `src/lib/db/mock/` — an in-memory implementation with ~80 seeded rows, the
  same tenant isolation rules, and a PostgREST-compatible query evaluator.

That is what makes the app demoable with zero setup and testable without a
database, and it means adding a feature never involves backend branching.

### Multi-tenancy

Every tenant-owned row carries `organization_id`. Reads and writes are scoped
by that column; the demo backend applies the equivalent filters in-process so
leaking another tenant's rows is not possible there either. **Frontend
permission checks are a usability feature, never a security control** — the
policies in `supabase/migrations/0001_init.sql` are what actually enforce
access.

### Roles

`owner → admin → manager → member → viewer`, defined once in
`src/lib/permissions.ts` and mirrored by `can_read_task` / `can_write_project`
/ `can_write_task` in the SQL. A workspace viewer never gains write access
through project membership — the UI and the database agree on that.

---

## Database

`supabase/migrations/0001_init.sql` is the whole schema:

- enums, 20 tables, indexes for the hot paths
- `set_updated_at()` triggers and an `on_auth_user_created` trigger that
  creates a profile **and** a personal workspace on signup
- RLS enabled on every table, with policies built on
  `is_org_member` / `has_org_role` / `can_read_task` / `can_write_task`
- three storage buckets (`avatars`, `project-files`, `task-attachments`) with
  organisation-scoped policies and the
  `organizations/{orgId}/projects/{projectId}/…` path convention
- `seed_workspace_defaults()` giving every new workspace the default statuses
  and priorities
- realtime enabled for tasks, comments, notifications and activity

See `supabase/README.md` for how to verify RLS with two real accounts.

---

## Design system

`design-system/pms/MASTER.md` documents the visual language: neutral base,
colour reserved for status and priority, Inter at a dense scale, motion only
where it communicates state, and the accessibility rules the UI is held to.
Where that document deviates from the generated baseline, the deviation and
its reason are recorded in the file.

Notable rules the code enforces:

- status and priority are **text + icon**, never colour alone
- loading uses `aria-busy` + skeletons, not full-screen spinners
- every screen has a real empty state and a retryable error state
- sticky headers use `scroll-padding` so keyboard focus is never hidden
- drag-and-drop has a keyboard equivalent (focus a card, `Space`, arrows,
  `Space`)

---

## Testing

```bash
npm run test
```

97 tests across five suites:

| Suite | Covers |
| --- | --- |
| `permissions.test.ts` | role matrix, monotonicity, viewer containment |
| `task-utils.test.ts` | due-date maths, progress, ordering, dates, errors, schemas |
| `demo-client.test.ts` | auth, tenant isolation, PostgREST semantics, projection |
| `components.test.tsx` | badges, states, login form, cards, board, data table |
| `app-flow.test.tsx` | sign in, then mount all 17 authenticated routes |

The app-flow suite is deliberately broad: it signs in and visits every route,
which is what caught the command-palette crash, the mobile-nav trigger and the
`select('*, rel(...)')` projection bug during development.