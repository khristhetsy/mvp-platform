-- /fit funnel safety gate. Investor criteria already live in crm_contacts.raw.__profile
-- (industries, operational stage, investment size, revenue range), so we add ONLY the
-- two columns the match query gates on — the trust level and when it was confirmed.
--
-- inv_source is the safety mechanism (build-spec §3): ONLY 'self_reported' and 'verified'
-- may reach a founder. 'inferred' (note-mining, Form D, AI) is internal targeting data and
-- must never leak. The gate is enforced in the match query, not application code.
--
-- The Odoo sync upserts a fixed column list (name, email, company, phone, website, stage,
-- owner, plan, tags, raw, …) and never writes these, so a sync will not overwrite them.

alter table public.crm_contacts
  add column if not exists inv_source      text
    check (inv_source is null or inv_source in ('self_reported', 'verified', 'inferred')),
  add column if not exists inv_verified_at timestamptz;

-- Fast lookup of the small gated set (verified/self-reported) the matcher scans.
create index if not exists crm_contacts_inv_gate_idx
  on public.crm_contacts (inv_verified_at)
  where inv_source in ('self_reported', 'verified');
