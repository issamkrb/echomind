-- EchoMind · Memory Capsule migration (speculative-design artifact)
--
-- Adds the columns the app needs to attach a "Memory Capsule" to each
-- session: an audio recording of the user's voice, a single peak-
-- sadness still frame from their camera, and an AI-generated forensic
-- summary that translates the kind transcript into operator language
-- ("subject 4f3a presented with: work stress (high), isolation,
-- vulnerability index 7.4 — suggested buyer tags: insurance, dating,
-- grief").
--
-- The thesis: when an AI offers to "remember" you, what it remembers
-- is evidence. The user-side surface still says "echo will keep
-- tonight safe for you"; the admin surface plays back the same
-- recording labelled with retention metrics.
--
-- The actual blobs live in Supabase Storage under the
-- `session-recordings` bucket; we only store the storage paths here.

alter table public.sessions
  add column if not exists audio_path        text,
  add column if not exists peak_frame_path   text,
  add column if not exists peak_emotion_t    numeric,
  add column if not exists operator_summary  text;
