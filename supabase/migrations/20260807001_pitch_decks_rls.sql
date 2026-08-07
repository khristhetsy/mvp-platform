-- pitch_decks shipped with RLS enabled but NO policies, so the founder's own
-- database client could read (select returns nothing → a default deck is shown)
-- but every insert/update was denied — surfacing as "Save failed" in the pitch
-- deck builder (theme changes, slide edits, finalize, share all failed to persist).
--
-- Add the same owner + staff policies business_plans already uses so a founder
-- (company owner or member) can manage their own deck and staff can read it.

alter table public.pitch_decks enable row level security;

-- Founder (company owner/member) manages their own deck.
drop policy if exists pitch_decks_owner_all on public.pitch_decks;
create policy pitch_decks_owner_all on public.pitch_decks
  for all using (
    exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid())
    or exists (select 1 from public.company_members m where m.company_id = company_id and m.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid())
    or exists (select 1 from public.company_members m where m.company_id = company_id and m.user_id = auth.uid())
  );

-- Staff can read every deck (admin company workspace).
drop policy if exists pitch_decks_staff_read on public.pitch_decks;
create policy pitch_decks_staff_read on public.pitch_decks
  for select using (public.is_staff());
