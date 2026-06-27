-- Initial SynchroIaC schema.
--
-- Headless-first architecture note:
-- All business logic, validation, authentication, billing checks, and data access
-- enforcement are handled exclusively in the server-side API layer using the
-- Supabase service role key. Frontend clients must not call the database
-- directly. Row Level Security is intentionally disabled on all tables below
-- because access is controlled entirely by the API layer.

create extension if not exists pgcrypto;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_key text not null unique,
  plan text not null default 'free' check (plan in ('free', 'pro', 'team')),
  paddle_subscription_id text,
  created_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  repo_url text,
  terraform_path text not null default './terraform',
  aws_region text not null default 'us-east-1',
  created_at timestamptz not null default now()
);

create table scans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  total_drifts int not null default 0,
  critical_drifts int not null default 0,
  high_drifts int not null default 0,
  medium_drifts int not null default 0,
  low_drifts int not null default 0,
  scanner_version text,
  error_message text,
  check (total_drifts >= 0),
  check (critical_drifts >= 0),
  check (high_drifts >= 0),
  check (medium_drifts >= 0),
  check (low_drifts >= 0)
);

create table drifts (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  resource_type text not null,
  resource_id text not null,
  attribute text not null,
  desired_value text,
  actual_value text,
  drift_type text not null check (drift_type in ('configuration', 'missing', 'extra', 'security')),
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  explanation text,
  pr_url text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table notification_configs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  type text not null check (type in ('email', 'slack')),
  config jsonb not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index projects_org_id_idx on projects(org_id);
create index scans_project_id_idx on scans(project_id);
create index scans_status_idx on scans(status);
create index drifts_scan_id_idx on drifts(scan_id);
create index drifts_risk_level_idx on drifts(risk_level);
create index drifts_open_idx on drifts(resolved_at) where resolved_at is null;
create index organizations_api_key_idx on organizations(api_key);

alter table organizations disable row level security;
alter table projects disable row level security;
alter table scans disable row level security;
alter table drifts disable row level security;
alter table notification_configs disable row level security;
