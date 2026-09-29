-- IR project card colour (Odoo-style colour picker on the Projects board). Null = none.
alter table public.ir_projects add column if not exists color text
  check (color is null or color ~ '^#[0-9a-fA-F]{6}$');
