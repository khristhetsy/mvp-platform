-- Link a campaign to the follow up sequence its wizard created.
-- When the campaign finishes sending, its audience list is enrolled in that sequence
-- (sequence batches still wait for human approval before anything goes out).
-- No new table, so no RLS change: marketing_campaigns keeps its existing policies.
alter table marketing_campaigns
  add column if not exists follow_up_sequence_id uuid
  references marketing_sequences(id) on delete set null;
