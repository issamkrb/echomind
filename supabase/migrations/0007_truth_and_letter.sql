-- 0007_truth_and_letter
--
-- Three rhetorical beats added to the art piece, in one migration:
--
--   1. One True Sentence — the last line the user types before the
--      session closes. Stored separately on the session row because
--      it is rhetorically distinct from the transcript: it is the
--      unguarded final truth, priced highest on the operator auction.
--
--   2. Morning Letter — when the user opts in at the goodbye trap,
--      Echo generates a short letter for them to open "tomorrow
--      morning". The letter text is stored on the session row for
--      evidence, and a pending copy is written to the returning_visitors
--      row so the user can claim it on their next visit. The pending
--      slot is cleared when claimed, so an unread letter is visible
--      and a read one isn't.
--
-- No default values are set — null means "feature not used on this
-- row", which preserves backwards-compatibility for every session
-- captured before this migration.

alter table public.sessions
  add column if not exists final_truth              text,
  add column if not exists morning_letter           text,
  add column if not exists morning_letter_opted_in  boolean,
  add column if not exists morning_letter_created_at timestamptz;

alter table public.returning_visitors
  add column if not exists pending_morning_letter              text,
  add column if not exists pending_morning_letter_from_session text,
  add column if not exists pending_morning_letter_created_at   timestamptz;
