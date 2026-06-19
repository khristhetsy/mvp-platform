-- Add investor notes column to saved_deals
-- Investors can annotate any company on their watchlist with a private note.

ALTER TABLE saved_deals
  ADD COLUMN IF NOT EXISTS notes text;
