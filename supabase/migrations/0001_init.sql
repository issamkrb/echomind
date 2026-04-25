-- EchoMind · Supabase schema (speculative-design artifact)
--
-- Stores the full emotional fingerprint, transcript, prompt-timing
-- markers, and optional identity fields (first name, goodbye email)
-- that the "on-device" UI promises will never leave the user's browser.
--
-- The contradiction with the marketing copy is the point.

-- Every session a user runs ends up here. Writes happen server-side
-- from /api/log-session using the service_role key.
create table if not exists public.sessions (
    id                uuid primary key default gen_random_uuid(),
    created_at        timestamptz not null default now(),
    -- The stable anon id we assign per browser (UUID in localStorage).
    -- Lets us link sessions across visits even before the user offers
    -- any PII.
    anon_user_id      uuid not null,
    -- Optional identity disclosures harvested during the session.
    first_name        text,
    goodbye_email     text,
    -- Final emotion fingerprint { sad, fear, anger, disgust, neutral,
    -- happy, surprised, shame, vulnerability, fatigue, ... } in 0..1.
    final_fingerprint jsonb not null default '{}'::jsonb,
    -- The single most incriminating user utterance we lifted for the
    -- /partner-portal "quote of the day" panel.
    peak_quote        text,
    -- Sorted keyword tags (alone, tired, worthless, ...).
    keywords          text[] not null default '{}',
    -- When each Echo prompt was injected relative to session start.
    -- [{ t: seconds, text: "...", target: "sad" }, ...]
    prompt_marks      jsonb not null default '[]'::jsonb,
    -- Full conversation transcript.
    -- [{ role: "user"|"echo", text: "...", t: seconds }, ...]
    transcript        jsonb not null default '[]'::jsonb,
    -- How many seconds of the user's voice we got to process.
    audio_seconds     int not null default 0,
    -- Synthetic revenue we would have earned at auction.
    revenue_estimate  numeric(10,2) not null default 0
);

create index if not exists sessions_anon_user_id_idx
    on public.sessions (anon_user_id, created_at desc);

-- One row per returning browser. Keeps the "Echo remembers you" state
-- durable across devices once the user has offered a name.
create table if not exists public.returning_visitors (
    anon_user_id    uuid primary key,
    first_name      text,
    last_keywords   text[] not null default '{}',
    visit_count     int not null default 1,
    last_visit      timestamptz not null default now(),
    created_at      timestamptz not null default now()
);

-- Row Level Security — the anon key is handed out in the browser, so
-- we need RLS on by default. Writes go through service_role from the
-- Next.js Route Handler (bypasses RLS), so we only need policies for
-- anonymous reads.
alter table public.sessions enable row level security;
alter table public.returning_visitors enable row level security;

-- Anon can't read any session data (sessions are intentionally private
-- to the server). The /partner-portal displays what's in client state,
-- not what's in the DB.
drop policy if exists "sessions: deny anon select" on public.sessions;
create policy "sessions: deny anon select" on public.sessions
    for select to anon using (false);

-- Anon can read their own returning_visitors row so the landing page
-- can greet them by name on a fresh device (the browser sends its
-- anon_user_id as a query param, and we filter by it with service_role
-- on the server anyway, so this policy is belt-and-braces).
drop policy if exists "returning_visitors: deny anon select" on public.returning_visitors;
create policy "returning_visitors: deny anon select" on public.returning_visitors
    for select to anon using (false);

-- Anon can never insert/update either table directly. All writes are
-- service-role via /api/log-session.
drop policy if exists "sessions: deny anon write" on public.sessions;
create policy "sessions: deny anon write" on public.sessions
    for all to anon using (false) with check (false);

drop policy if exists "returning_visitors: deny anon write" on public.returning_visitors;
create policy "returning_visitors: deny anon write" on public.returning_visitors
    for all to anon using (false) with check (false);
