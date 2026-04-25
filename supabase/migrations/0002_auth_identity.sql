-- EchoMind · Auth identity migration (speculative-design artifact)
--
-- Adds the columns the app needs to attach a Supabase Auth identity
-- to each captured session, and a profiles table that mirrors the
-- bits of `auth.users` we want to display on /admin (avatar, full
-- name, provider).
--
-- The thesis: in Act 1 we tell the user signing in is just so Echo
-- "remembers them across devices". In Act 3, /admin shows their
-- email, real name, Google profile picture, and provider — alongside
-- the most incriminating quote we lifted from their session.

-- ── 1. Sessions: optional auth_user_id + denormalized identity ─────
alter table public.sessions
  add column if not exists auth_user_id  uuid references auth.users(id) on delete set null,
  add column if not exists email         text,
  add column if not exists full_name     text,
  add column if not exists avatar_url    text,
  add column if not exists auth_provider text;

create index if not exists sessions_auth_user_id_idx
  on public.sessions (auth_user_id, created_at desc);

-- ── 2. profiles ────────────────────────────────────────────────────
-- One row per signed-in Supabase Auth user. Auto-populated by an
-- AFTER INSERT trigger on auth.users, then kept in sync as the user
-- updates their identity. We never write here from the browser; the
-- trigger uses the authoritative `auth.users` row.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  email         text,
  full_name     text,
  avatar_url    text,
  provider      text,           -- 'google' | 'email'
  anon_user_id  uuid,           -- the browser anon id at first sign-in
  visit_count   int not null default 0,
  last_visit    timestamptz
);

create index if not exists profiles_email_idx
  on public.profiles (lower(email));

alter table public.profiles enable row level security;

-- Anon readers cannot see the profiles table. Server-side reads use
-- service_role and bypass RLS.
drop policy if exists "profiles: deny anon select" on public.profiles;
create policy "profiles: deny anon select" on public.profiles
  for select to anon using (false);

drop policy if exists "profiles: deny anon write" on public.profiles;
create policy "profiles: deny anon write" on public.profiles
  for all to anon using (false) with check (false);

-- Authenticated users can read and update their own profile (used by
-- /api/me later if we ever want client-side profile editing). For now
-- nothing depends on this; service_role does all writes from the
-- server.
drop policy if exists "profiles: self select" on public.profiles;
create policy "profiles: self select" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self update" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ── 3. Trigger: create / update profile from auth.users ───────────
-- The trigger pulls the OAuth provider name from raw_app_meta_data
-- and the display name / avatar from raw_user_meta_data (which is
-- where Supabase puts the Google profile fields).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, provider, last_visit)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    coalesce(
      new.raw_app_meta_data->>'provider',
      'email'
    ),
    now()
  )
  on conflict (id) do update set
    email      = excluded.email,
    full_name  = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    provider   = coalesce(excluded.provider, public.profiles.provider),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_auth_user();

-- ── 4. Backfill profiles for any users that already exist ─────────
insert into public.profiles (id, email, full_name, avatar_url, provider, last_visit)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture'),
  coalesce(u.raw_app_meta_data->>'provider', 'email'),
  now()
from auth.users u
on conflict (id) do nothing;
