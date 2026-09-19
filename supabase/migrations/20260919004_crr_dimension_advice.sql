-- Cache for the per-dimension improvement suggestions shown on /admin/readiness.
--
-- Generated on demand (one Claude call the first time a dimension card is
-- opened) and kept here so re-opening it is free. company_readiness_scores is
-- append-only — every scoring run INSERTs a new row — so a re-score starts with
-- an empty cache automatically and stale advice can never outlive its score.
--
-- Shape: { "traction": { "generatedAt": "...", "source": "ai" | "flags",
--                        "items": [ { "title": ..., "detail": ..., "factor": ... } ] }, ... }
-- The point gains are NOT stored: they are recomputed from the factor scores on
-- every read, so they can never drift from the weighting that is active today.

alter table public.company_readiness_scores
  add column if not exists dimension_advice jsonb not null default '{}'::jsonb;

comment on column public.company_readiness_scores.dimension_advice is
  'Cached improvement suggestions per CRR dimension for this score row. Written on first open, discarded naturally when the next scoring run inserts a new row.';
