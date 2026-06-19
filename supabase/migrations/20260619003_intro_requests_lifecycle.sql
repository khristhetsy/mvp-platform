-- Upgrade intro_requests to support a full request→facilitate lifecycle.
--
-- New status values:  requested → reviewing → facilitated | declined
-- New columns:
--   facilitator_note  — admin note attached when status changes
--   facilitated_at    — timestamp when status was set to 'facilitated'
--   updated_by        — FK to the admin/staff user who last changed status

ALTER TABLE intro_requests
  ADD COLUMN IF NOT EXISTS facilitator_note text,
  ADD COLUMN IF NOT EXISTS facilitated_at   timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add a check constraint for the four lifecycle statuses.
-- Existing rows with status = 'requested' or NULL satisfy the constraint.
ALTER TABLE intro_requests
  DROP CONSTRAINT IF EXISTS intro_requests_status_check;

ALTER TABLE intro_requests
  ADD CONSTRAINT intro_requests_status_check
    CHECK (status IN ('requested', 'reviewing', 'facilitated', 'declined'));

-- Back-fill any NULL statuses to 'requested'
UPDATE intro_requests SET status = 'requested' WHERE status IS NULL;

-- Make status NOT NULL now that it has a default
ALTER TABLE intro_requests
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'requested';

-- Index for the admin "Intro Queue" view — pending requests first
CREATE INDEX IF NOT EXISTS idx_intro_requests_status_created
  ON intro_requests(status, created_at DESC);

-- Index for founder-side status lookup
CREATE INDEX IF NOT EXISTS idx_intro_requests_company_status
  ON intro_requests(company_id, status);
