import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Sun, Database, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { ThemeSwitcher } from '@/components/layout/user-menu'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ErrorState, InlineError, SkeletonPanel } from '@/components/shared/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isDemoMode } from '@/lib/client'
import { friendlyMessage } from '@/lib/db/errors'
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/permissions'
import { nullable } from '@/lib/utils'
import { useAuthActions, useCurrentUser, useProfile, useUpdateProfile } from '@/features/auth/queries'
import { useWorkspace } from '@/features/organizations/workspace-context'
import { useUpdateOrganization } from '@/features/organizations/queries'

import { profileSchema, type ProfileValues } from '@/features/auth/schemas'
import type { Profile } from '@/types/database'
import { RolesPage } from '@/features/organizations/components/members-page'
import { MembersPage } from '@/features/organizations/components/members-page'

export function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Settings" description="Your profile, this workspace and how the app looks." />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="organization">Workspace</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="pt-4">
          <ProfileSection />
        </TabsContent>
        <TabsContent value="organization" className="pt-4">
          <OrganizationSection />
        </TabsContent>
        <TabsContent value="members" className="-mx-4 pt-4 sm:-mx-6 lg:-mx-8">
          <MembersPage />
        </TabsContent>
        <TabsContent value="roles" className="-mx-4 pt-4 sm:-mx-6 lg:-mx-8">
          <RolesPage />
        </TabsContent>
        <TabsContent value="preferences" className="pt-4">
          <PreferencesCard />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Re-keys the form once the profile has loaded so defaults come from props. */
function ProfileSection() {
  const user = useCurrentUser()
  const { data: profile, isPending, isError, refetch } = useProfile(user?.id)

  if (isPending) return <SkeletonPanel />
  // Without this a failed profile read silently showed a blank, unsaved form.
  if (isError) {
    return (
      <ErrorState
        title="Couldn't load your profile"
        description="Check your connection and try again."
        onRetry={() => void refetch()}
      />
    )
  }

  return <ProfileCard key={profile?.id ?? 'new'} profile={profile ?? null} />
}

function ProfileCard({ profile }: { profile: Profile | null }) {
  const user = useCurrentUser()
  const updateProfile = useUpdateProfile()
  const { changePassword } = useAuthActions()
  const [error, setError] = useState<string | null>(null)

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.full_name ?? '',
      timezone: profile?.timezone ?? 'UTC',
      avatarUrl: profile?.avatar_url ?? '',
    },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    if (!user) return
    try {
      await updateProfile.mutateAsync({
        userId: user.id,
        full_name: values.fullName,
        timezone: values.timezone,
        avatar_url: values.avatarUrl || null,
      })
      toast.success('Profile updated')
    } catch (mutationError) {
      setError(friendlyMessage(mutationError as never))
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="max-w-md space-y-4">
          {error ? <InlineError message={error} /> : null}

          <div className="flex items-center gap-3">
            <UserAvatar
              person={{
                id: user?.id ?? 'me',
                full_name: form.watch('fullName'),
                avatar_url: profile?.avatar_url ?? null,
              }}
              size={48}
            />
            <div className="text-sm">
              <p className="font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground">
                Avatars come from your profile URL for now.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="fullName" className="text-sm font-medium">
              Full name
            </label>
            <Input id="fullName" {...form.register('fullName')} />
            {form.formState.errors.fullName ? (
              <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="timezone" className="text-sm font-medium">
              Timezone
            </label>
            <Input id="timezone" {...form.register('timezone')} />
            {form.formState.errors.timezone ? (
              <p className="text-xs text-destructive">{form.formState.errors.timezone.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="avatarUrl" className="text-sm font-medium">
              Avatar URL
            </label>
            <Input id="avatarUrl" {...form.register('avatarUrl')} placeholder="https://…" />
            {form.formState.errors.avatarUrl ? (
              <p className="text-xs text-destructive">{form.formState.errors.avatarUrl.message}</p>
            ) : null}
          </div>

          <Button type="submit" loading={form.formState.isSubmitting}>
            Save profile
          </Button>
        </form>

        <div className="mt-6 max-w-md space-y-3 border-t pt-5">
          <h3 className="text-sm font-semibold">Password</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = window.prompt('Enter a new password (min 8 characters)')
              if (!next) return
              changePassword
                .mutateAsync(next)
                .then(() => toast.success('Password updated'))
                .catch((mutationError) =>
                  toast.error("Couldn't update password.", {
                    description: friendlyMessage(mutationError as never),
                  }),
                )
            }}
          >
            Change password
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function OrganizationSection() {
  const { organizationName } = useWorkspace()
  return <OrganizationCard key={organizationName ?? 'workspace'} initialName={organizationName ?? ''} />
}

function OrganizationCard({ initialName }: { initialName: string }) {
  const { organization, role } = useWorkspace()
  const updateOrganization = useUpdateOrganization()
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
      </CardHeader>
      <CardContent className="max-w-md space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{role ? ROLE_LABELS[role] : 'No role'}</Badge>
          {role ? <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</span> : null}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="workspace-name" className="text-sm font-medium">
            Workspace name
          </label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!updateOrganization.isPending && role !== 'owner' && role !== 'admin'}
          />
          <p className="text-xs text-muted-foreground">
            Slug: <code className="font-mono">{organization?.slug}</code>
          </p>
        </div>

        {error ? <InlineError message={error} /> : null}

        <Button
          size="sm"
          loading={updateOrganization.isPending}
          onClick={() => {
            setError(null)
            updateOrganization.mutate(
              { name, logo_url: nullable(organization?.logo_url) },
              {
                onError: (mutationError: unknown) => setError(friendlyMessage(mutationError as never)),
              },
            )
          }}
        >
          Save workspace
        </Button>
      </CardContent>
    </Card>
  )
}

function PreferencesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            {resolvedIcon()}
            Appearance
          </h3>
          <ThemeSwitcher className="max-w-xs" />
          <p className="text-xs text-muted-foreground">
            System follows your operating system setting.
          </p>
        </div>

        <div className="space-y-2 border-t pt-5">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <Database className="size-3.5" aria-hidden />
            Data source
          </h3>
          <p className="text-sm text-muted-foreground">
            {isDemoMode ? (
              <>
                Running on the <strong className="text-foreground">in-memory demo backend</strong>. Add{' '}
                <code className="font-mono text-xs">VITE_SUPABASE_URL</code> and{' '}
                <code className="font-mono text-xs">VITE_SUPABASE_ANON_KEY</code> to switch to Supabase.
              </>
            ) : (
              <>
                Connected to Supabase. Row Level Security is enforced on every table.
              </>
            )}
          </p>
        </div>

        <div className="space-y-2 border-t pt-5">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <ShieldCheck className="size-3.5" aria-hidden />
            Security
          </h3>
          <p className="text-sm text-muted-foreground">
            The browser only ever receives the anon key. Authorization is enforced by database
            policies, not by hiding buttons.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function resolvedIcon() {
  return <Sun className="size-3.5" aria-hidden />
}
