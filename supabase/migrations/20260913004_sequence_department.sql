-- Sequences group by department like Lists and Templates. Existing rows stay
-- unassigned until moved.
alter table public.marketing_sequences
  add column if not exists department text;

create index if not exists marketing_sequences_department_idx
  on public.marketing_sequences (department);
