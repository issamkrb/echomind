-- 0012 · testimonials (Real Members. Real Evenings.)
--
-- Real user testimonials surfaced on the landing page community
-- wall, alongside the three hardcoded "anonymous whispers" already
-- baked into /. Each row stores BOTH the raw text the user typed
-- and the AI-improved version Groq returned. Only `improved_comment`
-- is ever exposed to the public; `raw_comment` stays inside the
-- service-role surface.
--
-- The 24-hour gate (`goes_live_at`) is enforced at read time by
-- /api/testimonials, so no cron is required for the testimonial to
-- "go live" — it simply becomes visible the moment the wall is
-- queried after the gate passes. The `status` column exists for
-- operator-side bookkeeping (and a future cron flipper, if ever).
--
-- This migration is additive and safe to apply on a database that
-- has any subset of the previous migrations applied.

create table if not exists public.testimonials (
    id                uuid primary key default gen_random_uuid(),
    -- Stable browser anon id of the submitter, so the operator
    -- surface can join testimonials back to the rest of that user's
    -- harvested data. Optional because a fresh tab without an anon
    -- id can still submit.
    anon_user_id      uuid,
    -- Optional Supabase Auth identity if the submitter is signed in.
    auth_user_id      uuid references auth.users(id) on delete set null,
    -- Exactly the text the user typed. Never exposed publicly.
    raw_comment       text not null,
    -- The AI-rewritten "more like you" version that goes on the
    -- wall. Falls back to raw_comment when the LLM call fails so we
    -- never lose a real submission.
    improved_comment  text not null,
    -- Authoritative session count at the moment of submission, taken
    -- from `returning_visitors.visit_count` server-side — NOT from
    -- the client. Becomes the attribution line ("member · 4 sessions").
    session_count     integer not null,
    submitted_at      timestamptz not null default now(),
    -- 24h after submission. Read paths gate on (goes_live_at <= now()).
    goes_live_at      timestamptz not null,
    -- "pending" | "approved". Currently informational; the read query
    -- gates on goes_live_at, not status, so a missing cron does not
    -- prevent the testimonial from going live.
    status            text not null default 'pending'
);

create index if not exists testimonials_live_idx
    on public.testimonials (goes_live_at desc);

create index if not exists testimonials_anon_idx
    on public.testimonials (anon_user_id, submitted_at desc);

-- RLS — same posture as sessions/visitor_logs. The anon role can do
-- nothing directly; the public read path goes through /api/testimonials
-- which uses the service-role client and selects only the safe
-- columns. This guarantees `raw_comment` is never reachable from the
-- browser even by an authenticated user.
alter table public.testimonials enable row level security;

drop policy if exists "testimonials: deny anon select" on public.testimonials;
create policy "testimonials: deny anon select" on public.testimonials
    for select to anon using (false);

drop policy if exists "testimonials: deny anon write" on public.testimonials;
create policy "testimonials: deny anon write" on public.testimonials
    for all to anon using (false) with check (false);
