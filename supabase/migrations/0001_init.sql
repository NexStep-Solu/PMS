-- =====================================================================
-- PMS — Project Management System
-- 0001_init.sql : schema, indexes, triggers, RLS and storage
--
-- Run with:  supabase db push        (or paste into the SQL editor)
--
-- Design notes
--   * Every tenant-owned row carries organization_id so policies can be
--     evaluated with a single indexed lookup.
--   * RLS is the security boundary. The client only ever receives the anon
--     key; no policy trusts a user supplied organization id.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

do $enum$
begin
  if not exists (select 1 from pg_type where typname = 'role') then
    create type public.role as enum ('owner', 'admin', 'manager', 'member', 'viewer');
  end if;
end $enum$;
do $enum$
begin
  if not exists (select 1 from pg_type where typname = 'project_role') then
    create type public.project_role as enum ('owner', 'manager', 'member', 'viewer');
  end if;
end $enum$;
do $enum$
begin
  if not exists (select 1 from pg_type where typname = 'project_status') then
    create type public.project_status as enum ('planned', 'active', 'on_hold', 'completed', 'archived');
  end if;
end $enum$;
do $enum$
begin
  if not exists (select 1 from pg_type where typname = 'project_priority') then
    create type public.project_priority as enum ('low', 'medium', 'high', 'urgent');
  end if;
end $enum$;
do $enum$
begin
  if not exists (select 1 from pg_type where typname = 'status_category') then
    create type public.status_category as enum ('backlog', 'todo', 'in_progress', 'review', 'done', 'cancelled');
  end if;
end $enum$;
do $enum$
begin
  if not exists (select 1 from pg_type where typname = 'milestone_status') then
    create type public.milestone_status as enum ('planned', 'in_progress', 'completed');
  end if;
end $enum$;
do $enum$
begin
  if not exists (select 1 from pg_type where typname = 'invitation_status') then
    create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
  end if;
end $enum$;

-- ---------------------------------------------------------------------
-- updated_at automation
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Profiles (mirrors auth.users)
-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('public.profiles') is null then
  create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    full_name text,
    avatar_url text,
    timezone text not null default 'UTC',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  end if;
end $$;

comment on table public.profiles is 'Public profile for every authenticated user.';

do $trigger$
begin
  if not exists (select 1 from pg_trigger where tgname = 'profiles_updated_at') then
  create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
  end if;
end $trigger$;

-- Auto-create a profile (and a personal workspace) on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
  base_slug text;
  display_name text;
begin
  display_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'New member');

  insert into public.profiles (id, full_name, timezone)
  values (
    new.id,
    display_name,
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC')
  )
  on conflict (id) do nothing;

  -- Signing up through an invitation link joins that workspace. Otherwise every
  -- signup would also mint a personal workspace, leaving the invitee with two and
  -- the new one empty.
  if nullif(new.raw_user_meta_data ->> 'invite_token', '') is not null then
    begin
      perform public.accept_invitation((new.raw_user_meta_data ->> 'invite_token')::uuid);
      return new;
    exception when others then
      -- Fall through to a personal workspace: a stale or mistyped link must never
      -- leave someone unable to sign up at all.
      null;
    end;
  end if;

  base_slug := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'organization_name', 'workspace'), '[^a-zA-Z0-9]+', '-', 'g'))
             || '-' || substr(replace(new.id::text, '-', ''), 1, 6);

  insert into public.organizations (name, slug, created_by)
  values (coalesce(new.raw_user_meta_data ->> 'organization_name', 'My Workspace'), base_slug, new.id)
  returning id into new_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org_id, new.id, 'owner');

  return new;
end;
$$;

do $trigger$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created') then
  create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
  end if;
end $trigger$;

-- ---------------------------------------------------------------------
-- Organisations & membership
-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('public.organizations') is null then
  create table public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(trim(name)) between 1 and 80),
    slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    logo_url text,
    created_by uuid not null references public.profiles (id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  end if;
end $$;

do $trigger$
begin
  if not exists (select 1 from pg_trigger where tgname = 'organizations_updated_at') then
  create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();
  end if;
end $trigger$;

do $$
begin
  if to_regclass('public.organization_members') is null then
  create table public.organization_members (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    user_id uuid not null references public.profiles (id) on delete cascade,
    role public.role not null default 'member',
    joined_at timestamptz not null default now(),
    unique (organization_id, user_id)
  );
  end if;
end $$;

create index if not exists organization_members_user_idx on public.organization_members (user_id);
create index if not exists organization_members_org_idx on public.organization_members (organization_id);

do $$
begin
  if to_regclass('public.organization_invitations') is null then
  create table public.organization_invitations (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    email citext not null,
    role public.role not null default 'member',
    token uuid not null unique default gen_random_uuid(),
    invited_by uuid not null references public.profiles (id) on delete cascade,
    status public.invitation_status not null default 'pending',
    expires_at timestamptz not null default now() + interval '14 days',
    accepted_at timestamptz,
    created_at timestamptz not null default now()
  );
  end if;
end $$;

create index if not exists organization_invitations_org_idx on public.organization_invitations (organization_id);

-- ---------------------------------------------------------------------
-- Teams
-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('public.teams') is null then
  create table public.teams (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    name text not null check (char_length(trim(name)) between 1 and 80),
    description text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (organization_id, name)
  );
  end if;
end $$;

do $trg$
begin
  if not exists (select 1 from pg_trigger where tgname = 'teams_updated_at') then
    create trigger teams_updated_at before update on public.teams
    for each row execute function public.set_updated_at();
  end if;
end $trg$;

do $$
begin
  if to_regclass('public.team_members') is null then
  create table public.team_members (
    id uuid primary key default gen_random_uuid(),
    team_id uuid not null references public.teams (id) on delete cascade,
    user_id uuid not null references public.profiles (id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (team_id, user_id)
  );
  end if;
end $$;

create index if not exists team_members_user_idx on public.team_members (user_id);

-- ---------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('public.projects') is null then
  create table public.projects (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    name text not null check (char_length(trim(name)) between 1 and 120),
    key text not null check (key ~ '^[A-Z][A-Z0-9]{1,9}$'),
    description text,
    status public.project_status not null default 'planned',
    priority public.project_priority not null default 'medium',
    start_date date,
    due_date date,
    owner_id uuid references public.profiles (id) on delete set null,
    created_by uuid not null references public.profiles (id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (organization_id, key),
    constraint projects_dates_ordered check (due_date is null or start_date is null or due_date >= start_date)
  );
  end if;
end $$;

do $trg$
begin
  if not exists (select 1 from pg_trigger where tgname = 'projects_updated_at') then
    create trigger projects_updated_at before update on public.projects
    for each row execute function public.set_updated_at();
  end if;
end $trg$;

create index if not exists projects_org_idx on public.projects (organization_id);
create index if not exists projects_status_idx on public.projects (organization_id, status);

do $$
begin
  if to_regclass('public.project_members') is null then
  create table public.project_members (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    user_id uuid not null references public.profiles (id) on delete cascade,
    role public.project_role not null default 'member',
    created_at timestamptz not null default now(),
    unique (project_id, user_id)
  );
  end if;
end $$;

create index if not exists project_members_user_idx on public.project_members (user_id);

-- ---------------------------------------------------------------------
-- Task metadata: statuses, priorities, labels
-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('public.task_statuses') is null then
  create table public.task_statuses (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    project_id uuid references public.projects (id) on delete cascade,
    name text not null check (char_length(trim(name)) between 1 and 40),
    key text not null,
    category public.status_category not null,
    color text,
    position integer not null default 0,
    is_default boolean not null default false,
    is_completed boolean not null default false
  );
  end if;
end $$;

create unique index if not exists task_statuses_org_key_unique
  on public.task_statuses (organization_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), key);
create index if not exists task_statuses_org_idx on public.task_statuses (organization_id, position);

do $$
begin
  if to_regclass('public.priorities') is null then
  create table public.priorities (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    name text not null check (char_length(trim(name)) between 1 and 40),
    key text not null,
    level integer not null check (level between 1 and 10),
    position integer not null default 0,
    unique (organization_id, key)
  );
  end if;
end $$;

create index if not exists priorities_org_idx on public.priorities (organization_id, position);

do $$
begin
  if to_regclass('public.labels') is null then
  create table public.labels (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    name text not null check (char_length(trim(name)) between 1 and 40),
    color text not null default '#64748b',
    created_at timestamptz not null default now(),
    unique (organization_id, name)
  );
  end if;
end $$;

create index if not exists labels_org_idx on public.labels (organization_id);

-- ---------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('public.tasks') is null then
  create table public.tasks (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    project_id uuid not null references public.projects (id) on delete cascade,
    parent_task_id uuid references public.tasks (id) on delete cascade,
    title text not null check (char_length(trim(title)) between 1 and 200),
    description text,
    status_id uuid not null references public.task_statuses (id) on delete restrict,
    priority_id uuid references public.priorities (id) on delete set null,
    assignee_id uuid references public.profiles (id) on delete set null,
    reporter_id uuid not null references public.profiles (id) on delete restrict,
    start_date date,
    due_date date,
    estimated_minutes integer check (estimated_minutes is null or estimated_minutes >= 0),
    position numeric not null default 1000,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint tasks_dates_ordered check (due_date is null or start_date is null or due_date >= start_date),
    constraint tasks_not_own_parent check (parent_task_id is null or parent_task_id <> id)
  );
  end if;
end $$;

do $trg$
begin
  if not exists (select 1 from pg_trigger where tgname = 'tasks_updated_at') then
    create trigger tasks_updated_at before update on public.tasks
    for each row execute function public.set_updated_at();
  end if;
end $trg$;

create index if not exists tasks_org_idx on public.tasks (organization_id);
create index if not exists tasks_project_idx on public.tasks (project_id, position);
create index if not exists tasks_assignee_idx on public.tasks (assignee_id) where assignee_id is not null;
create index if not exists tasks_due_idx on public.tasks (due_date) where due_date is not null;
create index if not exists tasks_parent_idx on public.tasks (parent_task_id) where parent_task_id is not null;
create index if not exists tasks_status_idx on public.tasks (status_id);

do $$
begin
  if to_regclass('public.task_labels') is null then
  create table public.task_labels (
    task_id uuid not null references public.tasks (id) on delete cascade,
    label_id uuid not null references public.labels (id) on delete cascade,
    primary key (task_id, label_id)
  );
  end if;
end $$;

create index if not exists task_labels_label_idx on public.task_labels (label_id);

do $$
begin
  if to_regclass('public.task_comments') is null then
  create table public.task_comments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks (id) on delete cascade,
    user_id uuid not null references public.profiles (id) on delete cascade,
    content text not null check (char_length(trim(content)) between 1 and 5000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  end if;
end $$;

do $trg$
begin
  if not exists (select 1 from pg_trigger where tgname = 'task_comments_updated_at') then
    create trigger task_comments_updated_at before update on public.task_comments
    for each row execute function public.set_updated_at();
  end if;
end $trg$;

create index if not exists task_comments_task_idx on public.task_comments (task_id, created_at);

do $$
begin
  if to_regclass('public.task_checklists') is null then
  create table public.task_checklists (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks (id) on delete cascade,
    title text not null check (char_length(trim(title)) between 1 and 200),
    position integer not null default 0,
    is_completed boolean not null default false
  );
  end if;
end $$;

create index if not exists task_checklists_task_idx on public.task_checklists (task_id, position);

do $$
begin
  if to_regclass('public.task_attachments') is null then
  create table public.task_attachments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks (id) on delete cascade,
    uploaded_by uuid not null references public.profiles (id) on delete cascade,
    file_name text not null,
    storage_path text not null,
    file_size bigint not null default 0,
    mime_type text not null default 'application/octet-stream',
    created_at timestamptz not null default now()
  );
  end if;
end $$;

create index if not exists task_attachments_task_idx on public.task_attachments (task_id);

do $$
begin
  if to_regclass('public.project_files') is null then
  create table public.project_files (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    uploaded_by uuid not null references public.profiles (id) on delete cascade,
    file_name text not null,
    storage_path text not null,
    file_size bigint not null default 0,
    mime_type text not null default 'application/octet-stream',
    created_at timestamptz not null default now()
  );
  end if;
end $$;

create index if not exists project_files_project_idx on public.project_files (project_id);

-- ---------------------------------------------------------------------
-- Milestones
-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('public.milestones') is null then
  create table public.milestones (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    project_id uuid not null references public.projects (id) on delete cascade,
    name text not null check (char_length(trim(name)) between 1 and 120),
    description text,
    due_date date not null,
    status public.milestone_status not null default 'planned',
    position integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
  end if;
end $$;

do $trg$
begin
  if not exists (select 1 from pg_trigger where tgname = 'milestones_updated_at') then
    create trigger milestones_updated_at before update on public.milestones
    for each row execute function public.set_updated_at();
  end if;
end $trg$;

create index if not exists milestones_project_idx on public.milestones (project_id, position);
create index if not exists milestones_org_due_idx on public.milestones (organization_id, due_date);

-- ---------------------------------------------------------------------
-- Time tracking
-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('public.time_entries') is null then
  create table public.time_entries (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    project_id uuid not null references public.projects (id) on delete cascade,
    task_id uuid references public.tasks (id) on delete set null,
    user_id uuid not null references public.profiles (id) on delete cascade,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
    description text,
    is_running boolean not null default true,
    created_at timestamptz not null default now(),
    constraint time_entries_has_end check (ended_at is null or ended_at >= started_at)
  );
  end if;
end $$;

create unique index if not exists time_entries_single_running_per_user
  on public.time_entries (user_id)
  where is_running;

create index if not exists time_entries_org_idx on public.time_entries (organization_id, started_at desc);
create index if not exists time_entries_user_idx on public.time_entries (user_id, started_at desc);
create index if not exists time_entries_project_idx on public.time_entries (project_id);

-- ---------------------------------------------------------------------
-- Notifications & activity
-- ---------------------------------------------------------------------

do $$
begin
  if to_regclass('public.notifications') is null then
  create table public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles (id) on delete cascade,
    organization_id uuid not null references public.organizations (id) on delete cascade,
    type text not null,
    title text not null,
    message text,
    data jsonb not null default '{}'::jsonb,
    read_at timestamptz,
    created_at timestamptz not null default now()
  );
  end if;
end $$;

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

do $$
begin
  if to_regclass('public.activity_logs') is null then
  create table public.activity_logs (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations (id) on delete cascade,
    user_id uuid references public.profiles (id) on delete set null,
    entity_type text not null,
    entity_id uuid not null,
    action text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  end if;
end $$;

create index if not exists activity_logs_org_idx on public.activity_logs (organization_id, created_at desc);
create index if not exists activity_logs_entity_idx on public.activity_logs (entity_type, entity_id);

-- =====================================================================
-- Helpers
--
-- These live in a private, non-exposed schema and run as SECURITY DEFINER on
-- purpose:
--
--   * DEFINER, so a policy on `organization_members` can call `is_org_member()`
--     without that call re-entering `organization_members`'s own policy. With
--     SECURITY INVOKER that self-reference recurses until Postgres aborts with
--     "infinite recursion detected" / a max_stack_depth failure.
--   * A private schema, because Postgres grants EXECUTE on new functions to
--     PUBLIC — and `anon`/`authenticated` inherit that. Functions in `public`
--     are reachable over the Data API; functions in `private` are not exposed
--     at all. Explicit revokes/grants below are defence in depth.
--
-- Every function here is a pure read used inside policies, and every one is
-- scoped to `auth.uid()`, so DEFINER widens nothing an RLS policy did not
-- already permit for that same user.
-- =====================================================================

create schema if not exists private;

-- USAGE stays with `authenticated` (policies run as the querying role and must
-- call these helpers) but never with `anon` or `PUBLIC`, so the helpers are not
-- reachable from the Data API without a session.
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select auth.uid() $$;

-- The role the current user holds in `target_org`, or null.
create or replace function private.org_role(target_org uuid)
returns public.role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.organization_members
  where organization_id = target_org
    and user_id = auth.uid()
$$;

create or replace function private.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.organization_members
                     where organization_id = target_org and user_id = auth.uid()) $$;

create or replace function private.has_org_role(target_org uuid, allowed public.role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(private.org_role(target_org) = any(allowed), false) $$;

create or replace function private.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_org_role(target_org, array['owner', 'admin']::public.role[])
$$;

-- ---------------------------------------------------------------------
-- Invitations
--
-- A signup always needs a workspace, but an invited user must *join* the one
-- they were invited to rather than get a second, empty one. Both paths resolve
-- through the token so the two flows cannot drift.
-- ---------------------------------------------------------------------

create or replace function private.current_user_email()
returns citext
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'email', '')::citext
$$;

create or replace function private.invitation_for_token(p_token uuid)
returns public.organization_invitations
language sql
stable
security definer
set search_path = ''
as $$
  select i.*
  from public.organization_invitations i
  where i.token = p_token
    and i.status = 'pending'
    and i.expires_at > now()
$$;

/**
 * Joins the caller to the organisation that issued the token.
 *
 * SECURITY DEFINER because the caller is, by definition, not yet a member and so
 * cannot pass the organization_members policies. Every guard is inside: the
 * token must be live, and the caller's verified email must be the invited one.
 * That last check is what stops anyone with a valid link from walking into a
 * workspace they were not invited to.
 */
create or replace function public.accept_invitation(p_token uuid)
returns table (organization_id uuid, organization_name text, role public.role)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.organization_invitations;
  caller_email citext;
  member_role public.role;
begin
  if p_token is null then
    raise exception 'Invitation not found' using errcode = 'no_data_found';
  end if;

  select * into invite from private.invitation_for_token(p_token);

  if invite.id is null then
    raise exception 'This invitation is no longer valid.' using errcode = 'no_data_found';
  end if;

  caller_email := private.current_user_email();

  if caller_email is null or invite.email <> caller_email then
    raise exception 'This invitation was sent to %.' , invite.email
      using errcode = 'insufficient_privilege';
  end if;

  member_role := invite.role;

  insert into public.organization_members (organization_id, user_id, role)
  values (invite.organization_id, auth.uid(), member_role)
  on conflict (organization_id, user_id) do update set role = excluded.role;

  update public.organization_invitations
  set status = 'accepted', accepted_at = now()
  where id = invite.id;

  return query
    select o.id, o.name, member_role
    from public.organizations o
    where o.id = invite.organization_id;
end;
$$;

/** Enough to render "You have been invited to <workspace> as <role>". */
create or replace function public.invitation_preview(p_token uuid)
returns table (
  organization_name text,
  invited_email citext,
  role public.role,
  invited_by text,
  is_valid boolean,
  status public.invitation_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.name,
    i.email,
    i.role,
    coalesce(p.full_name, 'A teammate'),
    (i.status = 'pending' and i.expires_at > now()),
    i.status
  from public.organization_invitations i
  join public.organizations o on o.id = i.organization_id
  left join public.profiles p on p.id = i.invited_by
  where i.token = p_token
$$;

revoke all on function public.accept_invitation(uuid) from public;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.invitation_preview(uuid) to authenticated, anon;



/** Task visibility: org membership, narrowed to project membership for viewers. */
-- Lookups used by policies on child tables. SECURITY DEFINER for the same
-- reason as the helpers above: `project_members_select` must be able to ask
-- "which organisation owns this project?" without that read re-entering
-- `projects_select`, whose policy in turn reads `project_members`. Routing
-- every cross-table lookup through a definer function is what keeps the policy
-- graph a DAG instead of a cycle.
create or replace function private.project_org(target_project uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organization_id from public.projects p where p.id = target_project
$$;

create or replace function private.team_org(target_team uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.organization_id from public.teams t where t.id = target_team
$$;

create or replace function private.is_project_member(target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.project_members
    where project_id = target_project and user_id = auth.uid()
  )
$$;

create or replace function private.can_read_project(target_org uuid, target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.is_org_member(target_org) then false
    when private.org_role(target_org) <> 'viewer' then true
    else private.is_project_member(target_project)
  end
$$;

create or replace function private.task_org(target_task uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.organization_id from public.tasks t where t.id = target_task
$$;

create or replace function private.can_read_task_for(target_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = target_task
      and private.can_read_task(t.organization_id, t.project_id, t.assignee_id)
  )
$$;

create or replace function private.can_write_task_for(target_task uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tasks t
    where t.id = target_task
      and private.can_write_task(t.organization_id, t.project_id)
  )
$$;

create or replace function private.shares_workspace(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid() and theirs.user_id = target_user
  )
$$;

create or replace function private.is_org_member_in(target_org uuid, target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = target_org and user_id = target_user
  )
$$;

create or replace function private.can_read_task(target_org uuid, target_project uuid, assignee uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.is_org_member(target_org) then false
    when private.org_role(target_org) = 'viewer' then
      -- A task with no project belongs to no project team, so there is no
      -- membership to check; it is visible to the whole workspace.
      target_project is null
      or assignee = auth.uid()
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = target_project and pm.user_id = auth.uid()
      )
    else true
  end
$$;

/** Writes: members and above, plus explicit project membership. */
create or replace function private.can_write_project(target_org uuid, target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.is_org_member(target_org) then false
    when private.org_role(target_org) = 'viewer' then
      exists (
        select 1 from public.project_members pm
        where pm.project_id = target_project and pm.user_id = auth.uid()
      )
    else true
  end
$$;

create or replace function private.can_write_task(target_org uuid, target_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.is_org_member(target_org) then false
    when private.org_role(target_org) = 'viewer' then false
    else private.can_write_project(target_org, target_project)
  end
$$;

-- ---------------------------------------------------------------------
-- Activity + notification side effects
-- ---------------------------------------------------------------------

-- Kept intentionally simple and explicit: the API layer writes activity rows
-- through `record_activity()` so the metadata is human readable.
create or replace function public.record_activity(
  target_org uuid,
  target_entity_type text,
  target_entity_id uuid,
  target_action text,
  target_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  -- SECURITY INVOKER on purpose: the `activity_logs` insert policy already
  -- restricts this to members of `target_org`. A SECURITY DEFINER function in an
  -- exposed schema would hand callers the creator's privileges.
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if not private.is_org_member(target_org) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;

  insert into public.activity_logs (organization_id, user_id, entity_type, entity_id, action, metadata)
  values (target_org, auth.uid(), target_entity_type, target_entity_id, target_action, target_metadata)
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.notify(
  target_user uuid,
  target_org uuid,
  target_type text,
  target_title text,
  target_message text default null,
  target_data jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  -- Guards, because SECURITY INVOKER still needs `notifications` INSERT to be
  -- granted: without them any member could file a notification against any user
  -- in any workspace, i.e. forge a phishing notification.
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if target_user is null or target_user = auth.uid() then
    return null;
  end if;

  -- Both parties must belong to the workspace the notification is filed under.
  if not private.is_org_member(target_org) then
    raise exception 'not a member of this organization' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = target_org and user_id = target_user
  ) then
    raise exception 'recipient is not a member of this organization' using errcode = '42501';
  end if;

  insert into public.notifications (user_id, organization_id, type, title, message, data)
  values (target_user, target_org, target_type, target_title, target_message, target_data)
  returning id into new_id;

  return new_id;
end;
$$;

-- The notifications insert policy that lets `notify()` (SECURITY INVOKER) work,
-- still scoped to notifications a member may file for a co-member.
drop policy if exists "notifications_insert" on public.notifications;
create policy notifications_insert on public.notifications
  for insert to authenticated
  with check (
    private.is_org_member(organization_id)
    and private.is_org_member_in(organization_id, user_id)
  );

-- =====================================================================
-- Row Level Security
-- =====================================================================

-- Nothing in `public` needs to be creatable by API roles.
revoke create on schema public from anon, authenticated;

alter table public.profiles                enable row level security;
alter table public.organizations           enable row level security;
alter table public.organization_members    enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.teams                   enable row level security;
alter table public.team_members            enable row level security;
alter table public.projects                enable row level security;
alter table public.project_members         enable row level security;
alter table public.task_statuses           enable row level security;
alter table public.priorities              enable row level security;
alter table public.labels                  enable row level security;
alter table public.tasks                   enable row level security;
alter table public.task_labels             enable row level security;
alter table public.task_comments           enable row level security;
alter table public.task_checklists         enable row level security;
alter table public.task_attachments        enable row level security;
alter table public.project_files           enable row level security;
alter table public.milestones              enable row level security;
alter table public.time_entries            enable row level security;
alter table public.notifications           enable row level security;
alter table public.activity_logs           enable row level security;

-- profiles -------------------------------------------------------------

drop policy if exists "profiles_select_self" on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or private.shares_workspace(id)
  );

drop policy if exists "profiles_update_self" on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_insert_self" on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- organizations --------------------------------------------------------

drop policy if exists "organizations_select" on public.organizations;
create policy organizations_select on public.organizations
  for select to authenticated
  using (private.is_org_member(id));

drop policy if exists "organizations_update" on public.organizations;
create policy organizations_update on public.organizations
  for update to authenticated
  using (private.is_org_admin(id))
  with check (private.is_org_admin(id));

drop policy if exists "organizations_insert" on public.organizations;
create policy organizations_insert on public.organizations
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "organizations_delete" on public.organizations;
create policy organizations_delete on public.organizations
  for delete to authenticated
  using (private.org_role(id) = 'owner');

-- organization_members -------------------------------------------------

drop policy if exists "org_members_select" on public.organization_members;
create policy org_members_select on public.organization_members
  for select to authenticated
  using (private.is_org_member(organization_id));

drop policy if exists "org_members_insert" on public.organization_members;
create policy org_members_insert on public.organization_members
  for insert to authenticated
  with check (private.is_org_admin(organization_id));

drop policy if exists "org_members_update" on public.organization_members;
create policy org_members_update on public.organization_members
  for update to authenticated
  using (private.is_org_admin(organization_id))
  with check (private.is_org_admin(organization_id));

drop policy if exists "org_members_delete" on public.organization_members;
create policy org_members_delete on public.organization_members
  for delete to authenticated
  using (
    private.is_org_admin(organization_id)
    and not (user_id = auth.uid() and private.org_role(organization_id) = 'owner')
  );

-- organization_invitations --------------------------------------------

drop policy if exists "invitations_select" on public.organization_invitations;
create policy invitations_select on public.organization_invitations
  for select to authenticated
  using (
    private.is_org_admin(organization_id)
    -- The invitee needs to see their own invitation before they are a member.
    or (email = private.current_user_email() and status = 'pending')
  );

drop policy if exists "invitations_insert" on public.organization_invitations;
create policy invitations_insert on public.organization_invitations
  for insert to authenticated
  with check (private.is_org_admin(organization_id) and invited_by = auth.uid());

drop policy if exists "invitations_update" on public.organization_invitations;
create policy invitations_update on public.organization_invitations
  for update to authenticated
  using (private.is_org_admin(organization_id) and status <> 'accepted')
  with check (private.is_org_admin(organization_id));

drop policy if exists "invitations_delete" on public.organization_invitations;
create policy invitations_delete on public.organization_invitations
  for delete to authenticated
  using (private.is_org_admin(organization_id));

-- teams ----------------------------------------------------------------

drop policy if exists "teams_select" on public.teams;
create policy teams_select on public.teams
  for select to authenticated
  using (private.is_org_member(organization_id));

drop policy if exists "teams_insert" on public.teams;
create policy teams_insert on public.teams
  for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.role[]));

drop policy if exists "teams_update" on public.teams;
create policy teams_update on public.teams
  for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.role[]))
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.role[]));

drop policy if exists "teams_delete" on public.teams;
create policy teams_delete on public.teams
  for delete to authenticated
  using (private.is_org_admin(organization_id));

-- team_members ---------------------------------------------------------

drop policy if exists "team_members_select" on public.team_members;
create policy team_members_select on public.team_members
  for select to authenticated
  using (private.is_org_member(private.team_org(team_id)));

drop policy if exists "team_members_write" on public.team_members;
create policy team_members_write on public.team_members
  for all to authenticated
  using (private.has_org_role(private.team_org(team_id), array['owner', 'admin', 'manager']::public.role[]))
  with check (private.has_org_role(private.team_org(team_id), array['owner', 'admin', 'manager']::public.role[]));

-- projects -------------------------------------------------------------

drop policy if exists "projects_select" on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (
    private.is_org_member(organization_id)
    and (
      private.org_role(organization_id) <> 'viewer'
      or owner_id = auth.uid()
      or private.is_project_member(id)
    )
  );

drop policy if exists "projects_insert" on public.projects;
create policy projects_insert on public.projects
  for insert to authenticated
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.role[]));

drop policy if exists "projects_update" on public.projects;
create policy projects_update on public.projects
  for update to authenticated
  using (private.can_write_project(organization_id, id))
  with check (private.can_write_project(organization_id, id));

drop policy if exists "projects_delete" on public.projects;
create policy projects_delete on public.projects
  for delete to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']::public.role[]));

-- project_members ------------------------------------------------------

drop policy if exists "project_members_select" on public.project_members;
create policy project_members_select on public.project_members
  for select to authenticated
  using (private.is_org_member(private.project_org(project_id)));

drop policy if exists "project_members_write" on public.project_members;
create policy project_members_write on public.project_members
  for all to authenticated
  using (private.can_write_project(private.project_org(project_id), project_id))
  with check (private.can_write_project(private.project_org(project_id), project_id));

-- task_statuses / priorities / labels ---------------------------------

drop policy if exists "statuses_select" on public.task_statuses;
create policy statuses_select on public.task_statuses
  for select to authenticated using (private.is_org_member(organization_id));
drop policy if exists "statuses_write" on public.task_statuses;
create policy statuses_write on public.task_statuses
  for all to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']::public.role[]))
  with check (private.has_org_role(organization_id, array['owner', 'admin']::public.role[]));

drop policy if exists "priorities_select" on public.priorities;
create policy priorities_select on public.priorities
  for select to authenticated using (private.is_org_member(organization_id));
drop policy if exists "priorities_write" on public.priorities;
create policy priorities_write on public.priorities
  for all to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin']::public.role[]))
  with check (private.has_org_role(organization_id, array['owner', 'admin']::public.role[]));

drop policy if exists "labels_select" on public.labels;
create policy labels_select on public.labels
  for select to authenticated using (private.is_org_member(organization_id));
drop policy if exists "labels_write" on public.labels;
create policy labels_write on public.labels
  for all to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.role[]))
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.role[]));

-- tasks ----------------------------------------------------------------

drop policy if exists "tasks_select" on public.tasks;
create policy tasks_select on public.tasks
  for select to authenticated
  using (private.can_read_task(organization_id, project_id, assignee_id));

drop policy if exists "tasks_insert" on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    private.can_write_task(organization_id, project_id)
    and reporter_id = auth.uid()
    and private.is_org_member(organization_id)
  );

drop policy if exists "tasks_update" on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (private.can_write_task(organization_id, project_id))
  with check (private.can_write_task(organization_id, project_id));

drop policy if exists "tasks_delete" on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (
    reporter_id = auth.uid()
    or private.has_org_role(organization_id, array['owner', 'admin', 'manager']::public.role[])
  );

-- task_labels ----------------------------------------------------------

drop policy if exists "task_labels_select" on public.task_labels;
create policy task_labels_select on public.task_labels
  for select to authenticated
  using (private.can_read_task_for(task_id));

drop policy if exists "task_labels_write" on public.task_labels;
create policy task_labels_write on public.task_labels
  for all to authenticated
  using (private.can_write_task_for(task_id))
  with check (private.can_write_task_for(task_id));

-- task_comments --------------------------------------------------------

drop policy if exists "task_comments_select" on public.task_comments;
create policy task_comments_select on public.task_comments
  for select to authenticated
  using (private.can_read_task_for(task_id));

drop policy if exists "task_comments_insert" on public.task_comments;
create policy task_comments_insert on public.task_comments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and private.can_read_task_for(task_id)
  );

drop policy if exists "task_comments_update" on public.task_comments;
create policy task_comments_update on public.task_comments
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "task_comments_delete" on public.task_comments;
create policy task_comments_delete on public.task_comments
  for delete to authenticated
  using (user_id = auth.uid() or private.is_org_admin(private.task_org(task_id)));

-- task_checklists ------------------------------------------------------

drop policy if exists "task_checklists_select" on public.task_checklists;
create policy task_checklists_select on public.task_checklists
  for select to authenticated
  using (private.can_read_task_for(task_id));

drop policy if exists "task_checklists_write" on public.task_checklists;
create policy task_checklists_write on public.task_checklists
  for all to authenticated
  using (private.can_write_task_for(task_id))
  with check (private.can_write_task_for(task_id));

-- attachments ----------------------------------------------------------

drop policy if exists "task_attachments_select" on public.task_attachments;
create policy task_attachments_select on public.task_attachments
  for select to authenticated
  using (private.can_read_task_for(task_id));

drop policy if exists "task_attachments_insert" on public.task_attachments;
create policy task_attachments_insert on public.task_attachments
  for insert to authenticated
  with check (uploaded_by = auth.uid() and private.can_write_task_for(task_id));

drop policy if exists "task_attachments_delete" on public.task_attachments;
create policy task_attachments_delete on public.task_attachments
  for delete to authenticated
  using (uploaded_by = auth.uid() or private.can_write_task_for(task_id));

drop policy if exists "project_files_select" on public.project_files;
create policy project_files_select on public.project_files
  for select to authenticated
  using (private.is_org_member(private.project_org(project_id)));

drop policy if exists "project_files_insert" on public.project_files;
create policy project_files_insert on public.project_files
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and private.can_write_project(private.project_org(project_id), project_id)
  );

drop policy if exists "project_files_delete" on public.project_files;
create policy project_files_delete on public.project_files
  for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or private.can_write_project(private.project_org(project_id), project_id)
  );

-- milestones -----------------------------------------------------------

drop policy if exists "milestones_select" on public.milestones;
create policy milestones_select on public.milestones
  for select to authenticated
  using (private.can_read_project(organization_id, project_id));

drop policy if exists "milestones_write" on public.milestones;
create policy milestones_write on public.milestones
  for all to authenticated
  using (private.can_write_task(organization_id, project_id))
  with check (private.can_write_task(organization_id, project_id));

-- time_entries ---------------------------------------------------------

drop policy if exists "time_entries_select" on public.time_entries;
create policy time_entries_select on public.time_entries
  for select to authenticated
  using (
    private.is_org_member(organization_id)
    and (user_id = auth.uid() or private.org_role(organization_id) <> 'viewer')
  );

drop policy if exists "time_entries_insert" on public.time_entries;
create policy time_entries_insert on public.time_entries
  for insert to authenticated
  with check (user_id = auth.uid() and private.can_write_project(organization_id, project_id));

drop policy if exists "time_entries_update" on public.time_entries;
create policy time_entries_update on public.time_entries
  for update to authenticated
  using (user_id = auth.uid() or private.is_org_admin(organization_id))
  with check (user_id = auth.uid() or private.is_org_admin(organization_id));

drop policy if exists "time_entries_delete" on public.time_entries;
create policy time_entries_delete on public.time_entries
  for delete to authenticated
  using (user_id = auth.uid() or private.is_org_admin(organization_id));

-- notifications --------------------------------------------------------

drop policy if exists "notifications_select" on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "notifications_update" on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notifications_delete" on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- activity_logs --------------------------------------------------------

drop policy if exists "activity_logs_select" on public.activity_logs;
create policy activity_logs_select on public.activity_logs
  for select to authenticated
  using (private.is_org_member(organization_id));

drop policy if exists "activity_logs_insert" on public.activity_logs;
create policy activity_logs_insert on public.activity_logs
  for insert to authenticated
  with check (private.is_org_member(organization_id));

-- =====================================================================
-- Realtime
-- =====================================================================

do $publication$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks') then
    alter publication supabase_realtime add table public.tasks;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_comments') then
    alter publication supabase_realtime add table public.task_comments;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_logs') then
    alter publication supabase_realtime add table public.activity_logs;
  end if;
end $publication$;

-- =====================================================================
-- Storage
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true),
       ('project-files', 'project-files', false),
       ('task-attachments', 'task-attachments', false)
on conflict (id) do nothing;

-- Objects live at  organizations/{orgId}/projects/{projectId}/...
-- ---------------------------------------------------------------------
-- Reporting
--
-- The reports screen used to download every task in the workspace and fold it
-- into charts in the browser, so its cost grew linearly with the data. These
-- aggregate in Postgres instead: one row per task-shape the charts need.
-- ---------------------------------------------------------------------

create or replace function public.workspace_report(p_org uuid)
returns table (
  project_id uuid,
  project_key text,
  status_id uuid,
  priority_id uuid,
  assignee_id uuid,
  total bigint,
  done bigint,
  in_progress bigint,
  overdue bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.project_id,
    p.key,
    t.status_id,
    t.priority_id,
    t.assignee_id,
    count(*)::bigint,
    count(*) filter (where s.is_completed and s.category <> 'cancelled')::bigint,
    count(*) filter (where s.category = 'in_progress')::bigint,
    count(*) filter (
      where t.due_date < current_date
        and not s.is_completed
        and s.category <> 'cancelled'
    )::bigint
  from public.tasks t
  join public.task_statuses s on s.id = t.status_id
  left join public.projects p on p.id = t.project_id
  where t.organization_id = p_org
    and private.is_org_member(p_org)
    -- Same visibility rule as tasks_select, so the numbers match the lists.
    and private.can_read_task(t.organization_id, t.project_id, t.assignee_id)
  group by t.project_id, p.key, t.status_id, t.priority_id, t.assignee_id
$$;

create or replace function public.workspace_time_total(p_org uuid)
returns table (tracked_minutes bigint, running_entries bigint, logged_entries bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(t.duration_minutes) filter (where not t.is_running), 0)::bigint,
    count(*) filter (where t.is_running)::bigint,
    count(*) filter (where not t.is_running)::bigint
  from public.time_entries t
  where t.organization_id = p_org and private.is_org_member(p_org)
$$;

revoke all on function public.workspace_report(uuid) from public;
revoke all on function public.workspace_time_total(uuid) from public;
grant execute on function public.workspace_report(uuid) to authenticated;
grant execute on function public.workspace_time_total(uuid) to authenticated;

create or replace function private.storage_org_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  segment text;
begin
  segment := split_part(object_name, '/', 2);
  if segment ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return segment::uuid;
  end if;
  return null;
end;
$$;

drop policy if exists "storage_avatars_read" on storage.objects;
create policy storage_avatars_read on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "storage_avatars_write" on storage.objects;
create policy storage_avatars_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "storage_project_files_read" on storage.objects;
create policy storage_project_files_read on storage.objects
  for select to authenticated
  using (bucket_id = 'project-files' and private.is_org_member(private.storage_org_id(name)));

drop policy if exists "storage_project_files_write" on storage.objects;
create policy storage_project_files_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-files' and private.is_org_member(private.storage_org_id(name)));

drop policy if exists "storage_project_files_delete" on storage.objects;
create policy storage_project_files_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'project-files' and private.is_org_member(private.storage_org_id(name)));

drop policy if exists "storage_attachments_read" on storage.objects;
create policy storage_attachments_read on storage.objects
  for select to authenticated
  using (bucket_id = 'task-attachments' and private.is_org_member(private.storage_org_id(name)));

drop policy if exists "storage_attachments_write" on storage.objects;
create policy storage_attachments_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'task-attachments' and private.is_org_member(private.storage_org_id(name)));

drop policy if exists "storage_attachments_delete" on storage.objects;
create policy storage_attachments_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'task-attachments' and private.is_org_member(private.storage_org_id(name)));

-- =====================================================================
-- Workspace defaults
-- =====================================================================

create or replace function public.seed_workspace_defaults(target_org uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_statuses (organization_id, name, key, category, position, is_default, is_completed) values
    (target_org, 'Backlog',    'backlog',    'backlog',    1, false, false),
    (target_org, 'Todo',       'todo',       'todo',       2, true,  false),
    (target_org, 'In Progress','in_progress','in_progress',3, false, false),
    (target_org, 'Review',     'review',     'review',     4, false, false),
    (target_org, 'Done',       'done',       'done',       5, false, true),
    (target_org, 'Cancelled',  'cancelled',  'cancelled',  6, false, true)
  on conflict do nothing;

  insert into public.priorities (organization_id, name, key, level, position) values
    (target_org, 'Urgent', 'urgent', 1, 1),
    (target_org, 'High',   'high',   2, 2),
    (target_org, 'Medium', 'medium', 3, 3),
    (target_org, 'Low',    'low',    4, 4)
  on conflict do nothing;
end;
$$;

create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_workspace_defaults(new.id);
  return new;
end;
$$;

do $trigger$
begin
  if not exists (select 1 from pg_trigger where tgname = 'on_organization_created') then
  create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();
  end if;
end $trigger$;

-- Backfill defaults for workspaces created before this migration.
do $$
declare
  org record;
begin
  for org in select id from public.organizations loop
    perform public.seed_workspace_defaults(org.id);
  end loop;
end;
$$;
-- =====================================================================
-- Function execution hardening
--
-- Postgres grants EXECUTE on every new function to PUBLIC, which `anon` and
-- `authenticated` inherit. That makes any function in an exposed schema a
-- public endpoint, so lock down the ones that do real work: only a signed-in
-- member may call them, and trigger helpers are not callable at all.
-- =====================================================================

revoke execute on function
  public.record_activity(uuid, text, uuid, text, jsonb),
  public.notify(uuid, uuid, text, text, text, jsonb)
  from public, anon;

grant execute on function
  public.record_activity(uuid, text, uuid, text, jsonb),
  public.notify(uuid, uuid, text, text, text, jsonb)
  to authenticated;

-- Trigger helpers: called by the trigger, never directly.
revoke execute on function
  public.handle_new_user(),
  public.handle_new_organization(),
  public.set_updated_at(),
  public.seed_workspace_defaults(uuid)
  from public, anon, authenticated;

-- Called from storage policies, so `authenticated` does need it. It only
-- parses a path segment.
revoke execute on function private.storage_org_id(text) from public, anon;
grant execute on function private.storage_org_id(text) to authenticated;

-- Helpers used inside RLS policies.
revoke execute on function
  private.project_org(uuid),
  private.team_org(uuid),
  private.task_org(uuid),
  private.is_project_member(uuid),
  private.can_read_project(uuid, uuid),
  private.can_read_task_for(uuid),
  private.can_write_task_for(uuid),
  private.shares_workspace(uuid),
  private.is_org_member_in(uuid, uuid),
  private.current_user_id(),
  private.org_role(uuid),
  private.is_org_member(uuid),
  private.has_org_role(uuid, public.role[]),
  private.is_org_admin(uuid),
  private.can_read_task(uuid, uuid, uuid),
  private.can_write_project(uuid, uuid),
  private.can_write_task(uuid, uuid),
  private.storage_org_id(text)
  from public, anon;

grant execute on function
  private.project_org(uuid),
  private.team_org(uuid),
  private.task_org(uuid),
  private.is_project_member(uuid),
  private.can_read_project(uuid, uuid),
  private.can_read_task_for(uuid),
  private.can_write_task_for(uuid),
  private.shares_workspace(uuid),
  private.is_org_member_in(uuid, uuid),
  private.current_user_id(),
  private.org_role(uuid),
  private.is_org_member(uuid),
  private.has_org_role(uuid, public.role[]),
  private.is_org_admin(uuid),
  private.can_read_task(uuid, uuid, uuid),
  private.can_write_project(uuid, uuid),
  private.can_write_task(uuid, uuid),
  private.storage_org_id(text)
  to authenticated;
