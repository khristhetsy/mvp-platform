-- ROOT CAUSE of "opens/clicks always 0": marketing_events.resend_id was UNIQUE.
-- One email (one resend_id) legitimately produces MANY events — sent, delivered,
-- opened, clicked, bounced. The unique constraint let the initial "sent" row in,
-- then silently rejected every webhook event that reused the same resend_id, so
-- delivered/opened/clicked never persisted. Drop the unique constraint; a plain
-- lookup index (marketing_events_resend_idx) already exists for the webhook join.
alter table public.marketing_events drop constraint if exists marketing_events_resend_id_key;
