-- Per-sequence assigned approver — route a sequence's pending batches to a named
-- person. The permission gate (manage_actions / super_admin) still governs who
-- CAN release; this just assigns/displays who SHOULD.

alter table public.marketing_sequences
  add column if not exists approver_id uuid references public.profiles(id) on delete set null;

alter table public.marketing_sequence_batches
  add column if not exists approver_id uuid references public.profiles(id) on delete set null;
