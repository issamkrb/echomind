-- 0013 · security hardening (rate limits, IP bans, audit log)
--
-- Three tables that together turn /api/* into a hardened surface:
--
--   1. rate_limit_events  — sliding-window event log per (bucket, IP).
--                           Inserted on every protected request; the
--                           limiter counts events in the last N
--                           seconds and 429s if the count exceeds the
--                           bucket's budget. A daily cleanup query
--                           (or an external cron) prunes rows older
--                           than 24h to keep the table small.
--
--   2. ip_blocks          — escalating IP ban table. When an IP racks
--                           up enough rate-limit hits in a short
--                           window, /api/* refuses *any* request from
--                           that IP for a cooling-off period — silent
--                           404, no 429 detail, so the attacker can't
--                           tell rate-limited from blocked.
--
--   3. security_events    — append-only audit log. Every 4xx that the
--                           security layer produces (rate-limit,
--                           bad-origin, bad-validation, bad-token)
--                           writes a row here. /admin/security can
--                           read it later; nothing else can.
--
-- All three tables follow the same RLS posture as everything else in
-- this repo: anon role denied, service_role writes through Node-side
-- code paths only. The IP / UA values stored are SHA-256 hashes, not
-- raw — which means the operator can identify a returning attacker
-- without holding identifying network data on real visitors at rest.
--
-- This migration is additive and safe to apply on a database that has
-- any subset of the previous migrations applied.

-- ── rate_limit_events ────────────────────────────────────────────
create table if not exists public.rate_limit_events (
    id          bigserial primary key,
    -- Per-route budget bucket name, e.g. 'api:echo', 'api:submit-testimonial:body',
    -- 'api:auth:otp', 'api:auth:verify'. Buckets are namespaced so a
    -- noisy /api/echo doesn't starve /api/log-visit.
    bucket      text not null,
    -- SHA-256 of the requesting IP (per resolveClientIp). Stored as
    -- bytea so it isn't human-readable in a Supabase table viewer.
    key_hash    bytea not null,
    ts          timestamptz not null default now()
);

create index if not exists rate_limit_events_lookup_idx
    on public.rate_limit_events (bucket, key_hash, ts desc);

create index if not exists rate_limit_events_cleanup_idx
    on public.rate_limit_events (ts);

alter table public.rate_limit_events enable row level security;

drop policy if exists "rate_limit_events: deny anon select" on public.rate_limit_events;
create policy "rate_limit_events: deny anon select" on public.rate_limit_events
    for select to anon using (false);

drop policy if exists "rate_limit_events: deny anon write" on public.rate_limit_events;
create policy "rate_limit_events: deny anon write" on public.rate_limit_events
    for all to anon using (false) with check (false);

-- ── ip_blocks ────────────────────────────────────────────────────
create table if not exists public.ip_blocks (
    -- Primary key is the SHA-256 of the offending IP.
    ip_hash         bytea primary key,
    -- The earliest moment this IP was first seen breaking a limit.
    first_offense_at timestamptz not null default now(),
    -- The most recent offense — bumped every time the IP racks up
    -- another rate-limit strike during the active block window.
    last_offense_at  timestamptz not null default now(),
    -- How many rate-limit strikes have happened since first_offense_at.
    -- Used for escalating bans (more strikes → longer block).
    hit_count       integer not null default 1,
    -- The point in time at which the block lifts. The check is
    --   (now() < blocked_until)  →  blocked
    -- so once this passes the IP is free again, but the row stays
    -- as a record of past offenses (and informs escalation if the
    -- attacker comes back).
    blocked_until   timestamptz not null,
    -- Free-form short reason ("rate-limit:api:echo", "bad-origin", …).
    reason          text not null
);

create index if not exists ip_blocks_active_idx
    on public.ip_blocks (blocked_until desc);

alter table public.ip_blocks enable row level security;

drop policy if exists "ip_blocks: deny anon select" on public.ip_blocks;
create policy "ip_blocks: deny anon select" on public.ip_blocks
    for select to anon using (false);

drop policy if exists "ip_blocks: deny anon write" on public.ip_blocks;
create policy "ip_blocks: deny anon write" on public.ip_blocks
    for all to anon using (false) with check (false);

-- ── security_events ──────────────────────────────────────────────
create table if not exists public.security_events (
    id          bigserial primary key,
    ts          timestamptz not null default now(),
    -- SHA-256 of the offending IP. NULL when the request had no
    -- usable IP (extremely rare; e.g. local dev).
    ip_hash     bytea,
    -- SHA-256 of the user-agent. NULL when no UA was sent.
    ua_hash     bytea,
    path        text,
    method      text,
    -- HTTP status the security layer returned (429, 403, 400, …).
    status      integer,
    -- Short machine reason, mirroring the JSON body's `reason` field.
    reason      text,
    -- Anything else worth keeping (route bucket name, validation
    -- field, geo from CDN headers, etc.). Kept small.
    meta        jsonb
);

create index if not exists security_events_ts_idx
    on public.security_events (ts desc);

create index if not exists security_events_ip_idx
    on public.security_events (ip_hash, ts desc);

alter table public.security_events enable row level security;

drop policy if exists "security_events: deny anon select" on public.security_events;
create policy "security_events: deny anon select" on public.security_events
    for select to anon using (false);

drop policy if exists "security_events: deny anon write" on public.security_events;
create policy "security_events: deny anon write" on public.security_events
    for all to anon using (false) with check (false);
