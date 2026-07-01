-- New table for linking Supabase Auth users to organizations.
-- matches existing pattern: service role access only, RLS disabled.

create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique(user_id)
);

create index org_members_user_id_idx on org_members(user_id);
create index org_members_org_id_idx on org_members(org_id);

alter table org_members disable row level security;

-- Distinguish seed org from signups
alter table organizations add column created_via text default 'seed' check (created_via in ('seed', 'signup'));
