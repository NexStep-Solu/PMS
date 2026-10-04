import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Compass } from 'lucide-react'

import { AppShell } from '@/components/layout/app-shell'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState, LoadingState } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { RequireAuth, RequireGuest } from '@/features/auth/components/auth-guard'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form'
import { LoginForm } from '@/features/auth/components/login-form'
import { RegisterForm } from '@/features/auth/components/register-form'
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form'

/* Route-level code splitting keeps the first paint small. */
const ProjectsPage = lazy(() =>
  import('@/features/projects/components/projects-page').then((m) => ({ default: m.ProjectsPage })),
)
const ProjectOverview = lazy(() =>
  import('@/features/projects/components/project-overview').then((m) => ({ default: m.ProjectOverview })),
)
const ProjectBoard = lazy(() =>
  import('@/features/projects/components/project-views').then((m) => ({ default: m.ProjectBoard })),
)
const ProjectListView = lazy(() =>
  import('@/features/projects/components/project-views').then((m) => ({ default: m.ProjectListView })),
)
const ProjectCalendarView = lazy(() =>
  import('@/features/projects/components/project-views').then((m) => ({ default: m.ProjectCalendarView })),
)
const ProjectTimelineView = lazy(() =>
  import('@/features/projects/components/project-views').then((m) => ({ default: m.ProjectTimelineView })),
)
const ProjectMilestones = lazy(() =>
  import('@/features/projects/components/project-views').then((m) => ({ default: m.ProjectMilestones })),
)
const ProjectFiles = lazy(() =>
  import('@/features/projects/components/project-views').then((m) => ({ default: m.ProjectFiles })),
)
const ProjectLayout = lazy(() =>
  import('@/features/projects/project-layout').then((m) => ({ default: m.ProjectLayout })),
)
const DashboardPage = lazy(() =>
  import('@/features/dashboard/components/dashboard-page').then((m) => ({ default: m.DashboardPage })),
)
const MyTasksPage = lazy(() =>
  import('@/features/tasks/components/my-tasks-page').then((m) => ({ default: m.MyTasksPage })),
)
const WorkspaceCalendarPage = lazy(() =>
  import('@/features/calendar/components/workspace-calendar-page').then((m) => ({
    default: m.WorkspaceCalendarPage,
  })),
)
const InboxPage = lazy(() =>
  import('@/features/notifications/components/inbox-page').then((m) => ({ default: m.InboxPage })),
)
const MembersPage = lazy(() =>
  import('@/features/organizations/components/members-page').then((m) => ({ default: m.MembersPage })),
)
const TeamsPage = lazy(() =>
  import('@/features/organizations/components/teams-page').then((m) => ({ default: m.TeamsPage })),
)
const ReportsPage = lazy(() =>
  import('@/features/reports/components/reports-page').then((m) => ({ default: m.ReportsPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/components/settings-page').then((m) => ({ default: m.SettingsPage })),
)
const TimeTrackingPage = lazy(() =>
  import('@/features/time-tracking/components/time-page').then((m) => ({ default: m.TimeTrackingPage })),
)
const InvitePage = lazy(() =>
  import('@/features/organizations/components/invite-page').then((m) => ({ default: m.InvitePage })),
)

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>
}

export function AppRouter() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<RequireGuest />}>
        <Route
          path="/login"
          element={
            <AuthLayout title="Sign in" subtitle="Use your work email to continue.">
              <LoginForm />
            </AuthLayout>
          }
        />
        <Route
          path="/register"
          element={
            <AuthLayout
              title="Create your workspace"
              subtitle="A workspace holds your projects, tasks and people."
            >
              <RegisterForm />
            </AuthLayout>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <AuthLayout title="Reset your password">
              <ForgotPasswordForm />
            </AuthLayout>
          }
        />
      </Route>

      <Route
        path="/invite/:token"
        element={
          <Suspense fallback={<LoadingState />}>
            <InvitePage />
          </Suspense>
        }
      />

      <Route
        path="/reset-password"
        element={
          <AuthLayout title="Choose a new password" subtitle="You will use this from now on.">
            <ResetPasswordForm />
          </AuthLayout>
        }
      />

      {/* Authenticated */}
      <Route element={<RequireAuth />}>
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <Lazy>
                <DashboardPage />
              </Lazy>
            }
          />
          <Route
            path="my-tasks"
            element={
              <Lazy>
                <MyTasksPage />
              </Lazy>
            }
          />
          <Route
            path="calendar"
            element={
              <Lazy>
                <WorkspaceCalendarPage />
              </Lazy>
            }
          />
          <Route
            path="inbox"
            element={
              <Lazy>
                <InboxPage />
              </Lazy>
            }
          />
          <Route
            path="time"
            element={
              <Lazy>
                <TimeTrackingPage />
              </Lazy>
            }
          />
          <Route
            path="members"
            element={
              <Lazy>
                <MembersPage />
              </Lazy>
            }
          />
          <Route
            path="teams"
            element={
              <Lazy>
                <TeamsPage />
              </Lazy>
            }
          />
          <Route
            path="reports"
            element={
              <Lazy>
                <ReportsPage />
              </Lazy>
            }
          />

          <Route path="projects" element={<Lazy><ProjectsPage /></Lazy>} />
          <Route path="projects/:projectId" element={<Lazy><ProjectLayout /></Lazy>}>
            <Route index element={<Navigate to="overview" replace />} />
            <Route path="overview" element={<Lazy><ProjectOverview /></Lazy>} />
            <Route path="board" element={<Lazy><ProjectBoard /></Lazy>} />
            <Route path="list" element={<Lazy><ProjectListView /></Lazy>} />
            <Route path="calendar" element={<Lazy><ProjectCalendarView /></Lazy>} />
            <Route path="timeline" element={<Lazy><ProjectTimelineView /></Lazy>} />
            <Route path="milestones" element={<Lazy><ProjectMilestones /></Lazy>} />
            <Route path="files" element={<Lazy><ProjectFiles /></Lazy>} />
          </Route>

          <Route path="settings" element={<Lazy><SettingsPage /></Lazy>} />
          <Route path="settings/:section" element={<Lazy><SettingsPage /></Lazy>} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md">
        <PageHeader title="Page not found" description="That link doesn’t lead anywhere." />
        <EmptyState
          icon={<Compass className="size-5" aria-hidden />}
          title="Nothing here"
          description="Check the URL, or head back to your dashboard."
          action={
            <Button asChild size="sm">
              <a href="/app/dashboard">Back to dashboard</a>
            </Button>
          }
        />
      </div>
    </div>
  )
}