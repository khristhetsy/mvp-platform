-- Send without signature: documents emailed for review only.
-- New status 'shared' (label "Sent, no signature") and open tracking on the
-- document itself, since these documents have no signing envelope.

alter table public.contract_documents drop constraint if exists contract_documents_status_check;
alter table public.contract_documents
  add constraint contract_documents_status_check check (
    status in ('draft', 'sent', 'viewed', 'changes_requested', 'awaiting_countersign',
               'signed', 'declined', 'cancelled', 'expired', 'shared')
  );

alter table public.contract_documents
  add column if not exists open_count integer not null default 0,
  add column if not exists last_opened_at timestamptz;

-- Atomic open counter for the packet page (review only documents).
create or replace function public.contract_record_packet_open(p_packet_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.contract_documents
     set open_count = open_count + 1, last_opened_at = now()
   where packet_id = p_packet_id and status = 'shared';
$$;
revoke all on function public.contract_record_packet_open(uuid) from public, anon, authenticated;
