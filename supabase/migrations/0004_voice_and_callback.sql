-- EchoMind · Voice persona + cross-session callback migration.
--
-- Adds two columns to public.sessions and two columns to
-- public.returning_visitors so the operator dashboard can:
--
--   1. Group sessions by voice persona ("sage" / "wren" / "ash" /
--      "june"). Each persona is tuned for a different demographic
--      retention curve, mirroring real wellness-app voice tiers.
--
--   2. Show, for returning users, the exact peak-quote callback line
--      Echo said in the opener — evidence that the AI is using the
--      previous session's most vulnerable moment as a re-engagement
--      hook.
--
-- Both fields are nullable; existing rows simply read NULL.

alter table public.sessions
  add column if not exists voice_persona  text,
  add column if not exists callback_used  text;

alter table public.returning_visitors
  add column if not exists last_peak_quote text,
  add column if not exists voice_persona   text;
