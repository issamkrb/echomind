-- 0010 · live-session heartbeat fields
--
-- The /session page now opens a row at visit start and streams
-- transcript-so-far, elapsed time, and rolling fingerprint every
-- ~5s. The /admin dashboard picks those rows up immediately and
-- renders a pulsing "LIVE · 00:42" pill. Without these columns the
-- admin page falls back to a heuristic (fresh row, no audio yet)
-- but the heuristic is less precise — especially around slow first
-- replies from Echo, when the elapsed counter would otherwise read
-- zero. The schema-drift tolerator in log-session / session/live
-- strips these fields when the column is missing, so this
-- migration is additive and safe to apply at any time.

alter table public.sessions
  add column if not exists status text default 'ended',
  add column if not exists last_heartbeat_at timestamptz,
  add column if not exists ended_at timestamptz;

-- Order the admin dashboard query faster on big tables.
create index if not exists sessions_status_created_idx
  on public.sessions (status, created_at desc);
