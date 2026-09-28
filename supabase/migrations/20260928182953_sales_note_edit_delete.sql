-- Sales Hub note log: edit, soft delete (with undo / recently deleted), and Odoo links.
--
-- sales_activity_log
--   edited_at / edited_by    set when a note's text is changed
--   deleted_at / deleted_by  soft delete; the row stays so Undo and Restore work
--   odoo_message_id          the Odoo mail.message this row mirrors. Two cases:
--                            * kind 'odoo_note'  an Odoo note edited or deleted in iCapOS
--                              (iCapOS keeps its own copy; Odoo itself is not changed)
--                            * kind 'note'/'opp_note'  a note logged in iCapOS and also
--                              posted to Odoo, so the Odoo copy is not shown twice
-- sales_opportunities
--   odoo_lead_id             cached Odoo crm.lead id, so the opportunity can read (and
--                            post to) the Odoo opportunity chatter

alter table public.sales_activity_log
  add column if not exists edited_at       timestamptz,
  add column if not exists edited_by       uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_at      timestamptz,
  add column if not exists deleted_by      uuid references public.profiles(id) on delete set null,
  add column if not exists odoo_message_id bigint;

create unique index if not exists sales_activity_log_odoo_message_uq
  on public.sales_activity_log (odoo_message_id)
  where odoo_message_id is not null;

create index if not exists idx_sales_activity_deleted
  on public.sales_activity_log (deleted_at)
  where deleted_at is not null;

alter table public.sales_opportunities
  add column if not exists odoo_lead_id bigint;
