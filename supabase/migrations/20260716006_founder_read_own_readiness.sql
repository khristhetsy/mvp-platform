-- Product decision (reverses 0071's "never to founders"): founders may now see their
-- OWN company's Investable Readiness. This adds a read policy scoped to companies the
-- founder owns — it does NOT let founders read any other company's score, and does not
-- grant write/override (that stays admin-only).

drop policy if exists "founder_read_own" on company_readiness_scores;
create policy "founder_read_own" on company_readiness_scores
  for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = company_readiness_scores.company_id
        and c.founder_id = auth.uid()
    )
  );
