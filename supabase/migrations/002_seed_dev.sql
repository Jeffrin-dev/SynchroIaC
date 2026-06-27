-- Development seed data for local SynchroIaC environments.

insert into organizations (name, api_key, plan)
values ('Dev Org', 'test-api-key-dev', 'pro')
on conflict (api_key) do update
set
  name = excluded.name,
  plan = excluded.plan;

insert into projects (org_id, name, repo_url, terraform_path, aws_region)
select
  id,
  'Dev Project',
  'https://github.com/example/synchroiac-dev',
  './terraform',
  'us-east-1'
from organizations
where api_key = 'test-api-key-dev'
and not exists (
  select 1
  from projects
  where projects.org_id = organizations.id
    and projects.name = 'Dev Project'
);
