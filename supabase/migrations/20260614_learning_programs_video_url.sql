-- Add video_url to learning_programs for course-level video sync
ALTER TABLE learning_programs ADD COLUMN IF NOT EXISTS video_url text;
