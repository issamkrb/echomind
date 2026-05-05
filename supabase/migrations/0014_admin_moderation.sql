-- ============================================================================
-- Migration 0014 — Admin Moderation Layer
-- ============================================================================
--
-- Adds:
--   1. Soft-delete columns (`deleted_at`, `deleted_by`) to user-content
--      tables (`sessions`, `visitor_logs`, `testimonials`). The admin
--      panel sets `deleted_at = now()` rather than DELETE-ing rows.
--      Rows reappear in default views only when `deleted_at IS NULL`.
--      A scheduled `/api/admin/purge-trash` job hard-deletes rows whose
--      `deleted_at` is older than 24h, plus the linked Supabase Storage
--      objects. So nothing is ever lost in less than 24h, and after 24h
--      it is provably erased.
--
--   2. `admin_audit` — append-only log of every admin action (trash,
--      restore, purge, kill-switch flip, forget-user, export, …). Used
--      to render `/admin/audit`. Hashed IP only; no raw addresses.
--
--   3. `app_flags` — operator kill-switches (pause new sessions, pause
--      testimonials, maintenance mode). Single-row-per-key key/value
--      table. Read on every request via a 30s in-memory cache; writes
--      go through `/api/admin/flags` PUT.
--
-- All new tables and columns use:
--   - RLS enabled
--   - No anon SELECT
--   - All writes happen via the service-role client used by /api/admin/*
--
-- This migration is additive and idempotent. Safe to re-run.
-- ============================================================================


-- ─── 1. Soft-delete columns ────────────────────────────────────────────────

alter table if exists public.sessions
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

create index if not exists sessions_deleted_at_idx
  on public.sessions (deleted_at)
  where deleted_at is not null;

alter table if exists public.visitor_logs
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

create index if not exists visitor_logs_deleted_at_idx
  on public.visitor_logs (deleted_at)
  where deleted_at is not null;

alter table if exists public.testimonials
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;

create index if not exists testimonials_deleted_at_idx
  on public.testimonials (deleted_at)
  where deleted_at is not null;


-- ─── 2. Admin audit log ────────────────────────────────────────────────────

create table if not exists public.admin_audit (
  id           uuid primary key default gen_random_uuid(),
  ts           timestamptz not null default now(),
  admin_email  text not null,
  -- Action verb. Loose vocabulary: trash, restore, purge, flag,
  -- forget, export, etc. Stored as plain text so we can introduce
  -- new actions without an enum migration.
  action       text not null,
  -- Which table the action targeted. NULL for global actions like
  -- flag flips. One of: sessions, visitor_logs, testimonials,
  -- session-recordings, app_flags, … or null.
  target_table text,
  -- For single-target actions, the row id. For bulk actions, NULL
  -- and `target_count` carries how many rows were affected. The
  -- `meta` JSON has the full id list when needed.
  target_id    text,
  target_count integer,
  meta         jsonb,
  -- Hashed IP of the admin (sha256 → bytea). We deliberately do
  -- NOT log the raw IP — even operator-side telemetry stays
  -- privacy-aware.
  ip_hash      bytea
);

create index if not exists admin_audit_ts_idx on public.admin_audit (ts desc);
create index if not exists admin_audit_admin_email_idx
  on public.admin_audit (admin_email, ts desc);
create index if not exists admin_audit_action_idx
  on public.admin_audit (action, ts desc);

alter table public.admin_audit enable row level security;

-- No anon access. Reads happen only through the service-role client
-- in /api/admin/audit, which is itself token + email gated.
drop policy if exists admin_audit_no_anon_select on public.admin_audit;
create policy admin_audit_no_anon_select
  on public.admin_audit
  for select
  to anon
  using (false);

drop policy if exists admin_audit_no_anon_write on public.admin_audit;
create policy admin_audit_no_anon_write
  on public.admin_audit
  for all
  to anon
  using (false)
  with check (false);


-- ─── 3. App flags (kill-switches) ──────────────────────────────────────────

create table if not exists public.app_flags (
  key         text primary key,
  value       boolean not null default false,
  -- Free-form note shown in the admin UI next to the toggle.
  description text,
  updated_by  text,
  updated_at  timestamptz not null default now()
);

alter table public.app_flags enable row level security;

drop policy if exists app_flags_no_anon_select on public.app_flags;
create policy app_flags_no_anon_select
  on public.app_flags
  for select
  to anon
  using (false);

drop policy if exists app_flags_no_anon_write on public.app_flags;
create policy app_flags_no_anon_write
  on public.app_flags
  for all
  to anon
  using (false)
  with check (false);

-- Seed the three documented flags. Each one defaults to `false`
-- (everything operational). The admin panel can flip them.
insert into public.app_flags (key, description) values
  ('pause_sessions',
   'When true, /api/echo returns 503 and the session page shows a soft "echo is resting" banner. Existing in-progress sessions continue.'),
  ('pause_testimonials',
   'When true, /api/submit-testimonial returns 503. The wall keeps showing existing approved testimonials.'),
  ('maintenance_mode',
   'When true, the landing page shows a "back shortly" banner and /session redirects to /. Admin paths still work.')
on conflict (key) do nothing;
