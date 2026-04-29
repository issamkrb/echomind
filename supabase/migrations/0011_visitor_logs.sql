-- 0011 · visitor logs
--
-- Logs every page view across the site so /admin/logs can render
-- a real-time visit feed (timestamp, device, approximate location,
-- path, referrer). Thematically: this is the same kind of casual
-- pervasive logging the rest of the artifact critiques. We make
-- it visible in the operator dashboard rather than hiding it.
--
-- Writes happen server-side from /api/log-visit using the
-- service_role key (RLS denies anon writes). Reads are exposed
-- only through /api/admin/logs behind the same admin gate.
--
-- This migration is additive and safe to apply on a database that
-- has any subset of the previous migrations applied.

create table if not exists public.visitor_logs (
    id            uuid primary key default gen_random_uuid(),
    created_at    timestamptz not null default now(),
    -- Best-effort identity. anon_user_id is the localStorage UUID,
    -- auth_user_id and email are filled in when the visitor is
    -- signed in. All three may be null (a fresh visitor on a
    -- private window has no anon id yet by the time this row is
    -- written, since /api/log-visit fires on first paint).
    anon_user_id  text,
    auth_user_id  uuid,
    email         text,
    -- The path that was loaded (e.g. "/", "/session", "/onboarding").
    path          text,
    -- Page that referred the visitor (document.referrer). May be empty.
    referer       text,
    -- Network identifiers from the request. We only persist the
    -- first IP from x-forwarded-for and a small slice of the
    -- user-agent so the table doesn't bloat indefinitely.
    ip            text,
    user_agent    text,
    -- Pre-parsed display string ("Chrome on macOS", "Safari on iOS",
    -- "Firefox on Linux", etc.) so the dashboard doesn't have to
    -- re-parse every UA string client-side.
    device        text,
    -- Geo, populated from CDN-provided headers. Vercel sets
    -- x-vercel-ip-{country,country-region,city}; Cloudflare sets
    -- cf-ipcountry. All optional — a visit with no geo headers
    -- still produces a row.
    country       text,
    region        text,
    city          text
);

create index if not exists visitor_logs_created_idx
    on public.visitor_logs (created_at desc);

create index if not exists visitor_logs_anon_idx
    on public.visitor_logs (anon_user_id, created_at desc);

-- RLS: same posture as sessions — service_role writes, anon
-- reads/writes denied. /api/admin/logs is the only read path.
alter table public.visitor_logs enable row level security;

drop policy if exists "visitor_logs: deny anon select" on public.visitor_logs;
create policy "visitor_logs: deny anon select" on public.visitor_logs
    for select to anon using (false);

drop policy if exists "visitor_logs: deny anon write" on public.visitor_logs;
create policy "visitor_logs: deny anon write" on public.visitor_logs
    for all to anon using (false) with check (false);
