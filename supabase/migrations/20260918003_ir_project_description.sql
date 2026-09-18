-- IR project record: free-text description shown on the project form (Description tab).
alter table public.ir_projects add column if not exists description text;
