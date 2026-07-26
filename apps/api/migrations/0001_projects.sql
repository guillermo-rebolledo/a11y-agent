create table if not exists projects (
  id text primary key,
  installation_id bigint not null,
  repository_id bigint not null unique,
  repository text not null,
  main_deployment jsonb not null,
  preview_deployment jsonb not null,
  trusted_workflow jsonb not null,
  approved_runner_class text not null
    check (approved_runner_class = 'github-hosted-ephemeral'),
  authorization_model jsonb not null,
  execution_state text not null
    check (execution_state = 'disabled-pending-authenticated-enablement'),
  pilot_state text not null check (pilot_state = 'not-provisioned'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on projects from public;
