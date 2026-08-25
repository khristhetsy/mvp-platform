-- Voice campaign audience config. Lets a campaign target a Marketing Hub list, a
-- CRM segment, or a hand-picked set of contacts (instead of the whole eligible
-- pool). Shape:
--   { "source": "all" | "list" | "segment" | "contacts",
--     "listId": "<marketing_lists.id>",              -- source=list
--     "segmentKind": "module" | "status", "segmentValue": "founder",  -- source=segment
--     "contactIds": ["<crm_contacts.external_id>", ...] }             -- source=contacts
-- The pre_dial_gate still runs per contact — this only narrows WHO is in scope,
-- never bypasses consent/DNC/hours. Additive; existing campaigns default to null
-- (= the whole eligible pool). Apply on staging, verify, then production.

alter table public.voice_campaigns
  add column if not exists audience_config jsonb;
