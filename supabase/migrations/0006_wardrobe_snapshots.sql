-- 0006_wardrobe_snapshots
--
-- Store the per-session wardrobe-vision timeline produced by
-- /api/vision-snapshot. Each element is a JSON object shaped like:
--
--   {
--     "t": 42.1,
--     "captured_at": 1713900000000,
--     "reading": {
--       "clothing": "grey hoodie, dark jeans",
--       "headwear": "none",
--       "accessories": "wired earbuds, glasses",
--       "setting": "dim bedroom, warm lamp",
--       "inferred_state": "curled-in, late-night comfort",
--       "vulnerability_signals": "pyjamas + dim lighting + late hour",
--       "operator_target": "late-night comfort cluster · insurance lift"
--     }
--   }
--
-- The operator-side /admin/auction/[id] page renders this column as
-- the "wardrobe fingerprint" panel. Users never see it.

alter table public.sessions
  add column if not exists wardrobe_snapshots jsonb default '[]'::jsonb;
