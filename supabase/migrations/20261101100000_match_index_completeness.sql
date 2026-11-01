-- Profile completeness for the match prefilter's candidate ordering.
--
-- candidateIdsForFounder() reads a short list of investors per founder from this index.
-- Ordering by inv_verified_at alone is nearly arbitrary (only 30 of ~5,800 rows carry a
-- verified date), so large sector pools were cut by contact id. Completeness counts how
-- many of the matchable fields (stages, sizes, types, revenues) an investor has filled
-- in. Investors with more to match on come first; ties fall back to verified date, then id.
--
-- Derived from columns already in the row, so it can never drift, and the table is a cache
-- that is safe to rebuild. The prefilter code tolerates this column being absent.

alter table public.investor_match_index
  add column if not exists completeness integer generated always as (
    coalesce(cardinality(stages), 0) + coalesce(cardinality(sizes), 0)
    + coalesce(cardinality(types), 0) + coalesce(cardinality(revenues), 0)
  ) stored;

create index if not exists investor_match_index_completeness_idx
  on public.investor_match_index (completeness desc, inv_verified_at desc nulls last, contact_id);
