-- Migration 0074: Add 'claude' as a valid video script provider
-- The previous CHECK constraint on founder_lesson_video_assets only allowed
-- 'manual', 'openai', 'remotion', 'elevenlabs', 'heygen'.
-- Now that all AI runs on Anthropic Claude, we must expand the constraint.

ALTER TABLE founder_lesson_video_assets
  DROP CONSTRAINT IF EXISTS founder_lesson_video_assets_provider_check;

ALTER TABLE founder_lesson_video_assets
  ADD CONSTRAINT founder_lesson_video_assets_provider_check
  CHECK (provider IN ('manual', 'openai', 'claude', 'remotion', 'elevenlabs', 'heygen'));
