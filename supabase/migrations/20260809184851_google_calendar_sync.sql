create table public.google_calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token_encrypted text,
  refresh_token_encrypted text not null,
  token_expires_at timestamptz,
  scope text,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_connections enable row level security;

-- OAuth tokens are only read and written by authenticated server routes using
-- the service role. They are never exposed through the browser Data API.
revoke all on table public.google_calendar_connections from anon, authenticated;
grant select, insert, update, delete on table public.google_calendar_connections to service_role;
