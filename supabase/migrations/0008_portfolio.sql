-- 0008_portfolio
--
-- Portfolio feature — "the AI is watching you" thesis made literal.
--
-- The same rows that back the user-facing `/portfolio` memoir back
-- the operator-facing `/admin/market` trading floor. Two UIs, two
-- framings, identical data. This migration adds only the small bit
-- of state we need to model portfolio deletion (the clearance sell-
-- off kill shot): when a user deletes their account, the portfolio
-- is NOT removed — it is flagged as cleared inventory and re-listed
-- at a multiplier on the operator market.
--
-- We attach the deletion state to `returning_visitors` (keyed by
-- anon_user_id, the durable per-browser identity) so deletion works
-- for both signed-in and anonymous users. For signed-in users the
-- `profiles` row mirrors the same state for ergonomic admin lookups
-- keyed by auth_user_id.
--
-- `portfolio_unlocked_at` records when a visitor crossed the third-
-- session threshold and was first shown the "your portfolio is
-- ready" notification. Used for analytics and to ensure the banner
-- only fires once.

alter table public.returning_visitors
  add column if not exists portfolio_deleted_at           timestamptz,
  add column if not exists portfolio_clearance_multiplier numeric(4,2),
  add column if not exists portfolio_unlocked_at          timestamptz;

alter table public.profiles
  add column if not exists portfolio_deleted_at           timestamptz,
  add column if not exists portfolio_clearance_multiplier numeric(4,2),
  add column if not exists portfolio_unlocked_at          timestamptz;

-- Fast lookup of "who deleted lately" for the market clearance row.
create index if not exists returning_visitors_portfolio_deleted_idx
  on public.returning_visitors (portfolio_deleted_at desc)
  where portfolio_deleted_at is not null;

create index if not exists profiles_portfolio_deleted_idx
  on public.profiles (portfolio_deleted_at desc)
  where portfolio_deleted_at is not null;
