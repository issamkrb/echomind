-- Dynamic starter chips (AI-generated tap-to-start prompts).
--
-- starter_chips          — JSON array of 4 {text, target} objects that
--                          were SHOWN to the user this session.
-- starter_chips_source   — "ai" | "fallback-no-key" | "fallback-llm-failed"
-- tapped_chip            — single {text, target} object if the user
--                          actually tapped one (null if they typed or
--                          spoke their first line instead).
--
-- All three are nullable / defaulted so previously-logged rows stay
-- valid. JSONB columns keep the payload introspectable in the SQL
-- editor without extra join tables.
alter table public.sessions
  add column if not exists starter_chips        jsonb default '[]'::jsonb,
  add column if not exists starter_chips_source text,
  add column if not exists tapped_chip          jsonb;
