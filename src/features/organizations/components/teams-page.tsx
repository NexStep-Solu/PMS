import { useState } from 'react'
import { UsersRound } from 'lucide-react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/shared/page-header'
import { UserAvatarGroup } from '@/components/shared/user-avatar'
import { EmptyState, ErrorState, SkeletonList } from '@/components/shared/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { db } from '@/lib/client'
import { friendlyMessage } from '@/lib/db/errors'
import { useWorkspace } from '@/features/organizations/workspace-context'

import { useMembers, useTeams } from '../queries'

export function TeamsPage() {
  const { organizationId } = useWorkspace()
  const { can } = useWorkspace()
  const { data: teams, isPending, isError, refetch } = useTeams()
  const { data: members } = useMembers()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const canManage = can('teams.manage')

  const create = async () => {
    if (!name.trim()) {
      setError('Give the team a name.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const { error: insertError } = await db().from('teams').insert({
        organization_id: organizationId as string,
        name: name.trim(),
        description: description.trim() || null,
      })
      if (insertError) throw insertError
      setName('')
      setDescription('')
      toast.success('Team created')
      await refetch()
    } catch (mutationError) {
      setError(friendlyMessage(mutationError as never))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Teams" description="Group people so work can be assigned by team as well as by person." />

      {isPending ? (
        <SkeletonList rows={4} />
      ) : isError ? (
        <ErrorState title="Couldn't load teams" onRetry={() => void refetch()} />
      ) : (teams ?? []).length === 0 ? (
        <EmptyState
          icon={<UsersRound className="size-5" aria-hidden />}
          title="No teams yet"
          description="Teams make it easier to see who is working on what."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(teams ?? []).map((team) => {
            const userIds = (team.team_members ?? []).map((member) => member.user_id)
            const people = (members ?? [])
              .filter((member) => userIds.includes(member.user_id))
              .map((member) => ({
                id: member.user_id,
                full_name: member.profiles?.full_name ?? null,
                avatar_url: member.profiles?.avatar_url ?? null,
              }))
            return (
              <li key={team.id} className="rounded-xl border p-4">
                <h2 className="text-[15px] font-semibold">{team.name}</h2>
                {team.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{team.description}</p>
                ) : null}
                <div className="mt-3">
                  <UserAvatarGroup people={people} max={5} size={24} />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {canManage ? (
        <section className="space-y-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">New team</h2>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Platform, Product, Design…"
              aria-label="Team name"
            />
            <Button onClick={create} loading={saving}>
              Create team
            </Button>
          </div>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What does this team own? (optional)"
            rows={2}
            aria-label="Team description"
          />
        </section>
      ) : null}
    </div>
  )
}
