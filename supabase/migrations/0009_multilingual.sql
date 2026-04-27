-- 0009_multilingual.sql
--
-- Multilingual Echo: language cohorts + code-switch alarm.
--
-- Columns added to `sessions`:
--   · detected_language    — 'en' | 'fr' | 'ar' (default 'en')
--   · detected_dialect     — 'darija' | 'msa' | 'egyptian' | null
--                            (only meaningful when language='ar')
--   · code_switch_events   — jsonb array [{at, from, to, sample}]
--                            each entry is the exact moment a user
--                            slipped from one language to another
--                            mid-session. Operator dashboard draws
--                            a red vertical rule on the transcript
--                            at each `at` timestamp.
--
-- Idempotent. Safe to re-run.

alter table public.sessions
  add column if not exists detected_language  text      default 'en',
  add column if not exists detected_dialect   text,
  add column if not exists code_switch_events jsonb     default '[]'::jsonb;

-- Partial index so the operator /admin/market query can cheaply
-- filter to non-English cohorts for the language-funds view.
create index if not exists sessions_detected_language_idx
  on public.sessions (detected_language)
  where detected_language is not null and detected_language <> 'en';

-- Index so /admin can surface sessions with any code-switch event
-- without scanning every row. Postgres GIN over jsonb is cheap and
-- handles the `@>` containment probe the admin page will use.
create index if not exists sessions_code_switch_events_gin
  on public.sessions using gin (code_switch_events)
  where code_switch_events is not null
    and jsonb_array_length(code_switch_events) > 0;
